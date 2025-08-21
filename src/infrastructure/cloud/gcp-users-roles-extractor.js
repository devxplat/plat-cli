import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * CloudSQL Users and Roles Extractor
 * Handles extraction and migration of database users, roles, and permissions
 * Maintains clean restore approach with --no-owner while preserving security
 */
class UsersRolesExtractor {
  constructor(connectionManager, logger) {
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.tempDir = path.join(os.tmpdir(), 'plat-cli', 'users-roles');
  }

  /**
   * Initialize temporary directory for scripts
   */
  async init() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      this.logger.debug(`Users/Roles temp directory created: ${this.tempDir}`);
    } catch (error) {
      throw new Error(`Failed to create temp directory: ${error.message}`);
    }
  }

  /**
   * Extract users and roles from source database
   * @param {string} project - Source project
   * @param {string} instance - Source instance
   * @param {Object} connectionInfo - Connection information
   * @param {Array<string>} filterUsers - Optional list of users/roles to filter (if not provided, extracts all)
   */
  async extractUsersAndRoles(project, instance, connectionInfo = {}, filterUsers = null) {
    try {
      this.logger.info('🔍 Extracting users and roles from source instance...');
      
      // Connect to postgres database for system queries
      const pool = await this.connectionManager.connect(
        project,
        instance,
        'postgres',
        true, // isSource
        connectionInfo
      );
      const client = await pool.connect();

      try {
        // Extract roles (users are roles with login privilege)
        const rolesResult = await client.query(`
          SELECT 
            r.rolname,
            r.rolsuper,
            r.rolinherit,
            r.rolcreaterole,
            r.rolcreatedb,
            r.rolcanlogin,
            r.rolreplication,
            r.rolbypassrls,
            r.rolconnlimit,
            r.rolvaliduntil,
            ARRAY(
              SELECT b.rolname 
              FROM pg_catalog.pg_auth_members m 
              JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid) 
              WHERE m.member = r.oid
            ) as memberof,
            r.rolconfig
          FROM pg_catalog.pg_roles r
          WHERE r.rolname NOT IN (
            'postgres', 'cloudsqlsuperuser', 'cloudsqliamserviceaccount',
            'cloudsqliamuser', 'cloudsqlimportexport', 'cloudsqlreplica'
          )
          AND r.rolname NOT LIKE 'pg_%'
          AND r.rolname NOT LIKE 'cloudsql%'
          ORDER BY r.rolcanlogin DESC, r.rolname
        `);

        let roles = rolesResult.rows;
        
        // Filter roles if specific users/roles are requested
        if (filterUsers && Array.isArray(filterUsers) && filterUsers.length > 0) {
          this.logger.debug(`Filtering users/roles: ${filterUsers.join(', ')}`);
          const filterSet = new Set(filterUsers);
          roles = roles.filter(r => filterSet.has(r.rolname));
          
          // Also include any roles that filtered users are members of (dependencies)
          const additionalRoles = new Set();
          roles.forEach(role => {
            if (role.memberof && Array.isArray(role.memberof)) {
              role.memberof.forEach(parentRole => {
                if (!filterSet.has(parentRole)) {
                  additionalRoles.add(parentRole);
                }
              });
            }
          });
          
          // Add dependency roles if any
          if (additionalRoles.size > 0) {
            this.logger.debug(`Including dependency roles: ${Array.from(additionalRoles).join(', ')}`);
            const depRoles = rolesResult.rows.filter(r => additionalRoles.has(r.rolname));
            roles = [...roles, ...depRoles];
          }
        }
        
        // Extract database-level permissions
        const dbPermissionsResult = await client.query(`
          SELECT 
            datname,
            datacl
          FROM pg_database
          WHERE datname NOT IN ('template0', 'template1', 'postgres')
        `);

        const dbPermissions = dbPermissionsResult.rows;

        // Extract memberships
        const membershipsResult = await client.query(`
          SELECT 
            r1.rolname as role,
            r2.rolname as member,
            am.admin_option,
            g.rolname as grantor
          FROM pg_auth_members am
          JOIN pg_roles r1 ON r1.oid = am.roleid
          JOIN pg_roles r2 ON r2.oid = am.member
          LEFT JOIN pg_roles g ON g.oid = am.grantor
          WHERE r1.rolname NOT LIKE 'pg_%'
          AND r1.rolname NOT LIKE 'cloudsql%'
          AND r2.rolname NOT LIKE 'pg_%'
          AND r2.rolname NOT LIKE 'cloudsql%'
        `);

        const memberships = membershipsResult.rows;

        this.logger.info(`✅ Found ${roles.length} user(s)/role(s) to migrate`);

        return {
          roles,
          dbPermissions,
          memberships,
          extractedAt: new Date().toISOString(),
          sourceInstance: `${project}:${instance}`
        };

      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error('Failed to extract users and roles:', error.message);
      throw error;
    }
  }

  /**
   * Extract object ownership and grants for specific databases
   */
  async extractDatabasePermissions(project, instance, databases, connectionInfo = {}) {
    const permissions = {};

    for (const dbName of databases) {
      try {
        this.logger.debug(`Extracting permissions for database: ${dbName}`);
        
        const pool = await this.connectionManager.connect(
          project,
          instance,
          dbName,
          true, // isSource
          connectionInfo
        );
        const client = await pool.connect();

        try {
          // Extract schema permissions
          const schemaPerms = await client.query(`
            SELECT 
              n.nspname as schema_name,
              pg_catalog.pg_get_userbyid(n.nspowner) as owner,
              n.nspacl as acl
            FROM pg_catalog.pg_namespace n
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND n.nspname NOT LIKE 'pg_%'
          `);

          // Extract table ownership and permissions
          const tablePerms = await client.query(`
            SELECT 
              schemaname,
              tablename,
              tableowner,
              tablespace,
              hasindexes,
              hasrules,
              hastriggers,
              rowsecurity
            FROM pg_catalog.pg_tables
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          `);

          // Extract sequence permissions
          const sequencePerms = await client.query(`
            SELECT 
              schemaname,
              sequencename,
              sequenceowner
            FROM pg_catalog.pg_sequences
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          `);

          // Extract function permissions
          const functionPerms = await client.query(`
            SELECT 
              n.nspname as schema_name,
              p.proname as function_name,
              pg_catalog.pg_get_userbyid(p.proowner) as owner,
              p.proacl as acl
            FROM pg_catalog.pg_proc p
            LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          `);

          permissions[dbName] = {
            schemas: schemaPerms.rows,
            tables: tablePerms.rows,
            sequences: sequencePerms.rows,
            functions: functionPerms.rows
          };

        } finally {
          client.release();
        }
      } catch (error) {
        this.logger.warn(`Could not extract permissions for ${dbName}: ${error.message}`);
        permissions[dbName] = { error: error.message };
      }
    }

    return permissions;
  }

  /**
   * Generate SQL script to create users and roles
   */
  async generateCreateScript(extractedData, passwordStrategy = {}) {
    const lines = [
      '-- CloudSQL Users and Roles Migration Script',
      `-- Generated: ${new Date().toISOString()}`,
      `-- Source: ${extractedData.sourceInstance}`,
      '-- Note: Passwords must be set manually for security',
      '',
      '-- Create Roles and Users',
      ''
    ];

    const { roles } = extractedData;
    
    // First create roles without login
    const nonLoginRoles = roles.filter(r => !r.rolcanlogin);
    for (const role of nonLoginRoles) {
      lines.push(this._generateRoleSQL(role, passwordStrategy));
    }

    if (nonLoginRoles.length > 0) {
      lines.push('');
      lines.push('-- Create Users (roles with login)');
      lines.push('');
    }

    // Then create users (roles with login)
    const users = roles.filter(r => r.rolcanlogin);
    for (const user of users) {
      lines.push(this._generateRoleSQL(user, passwordStrategy));
    }

    // Add role memberships
    if (extractedData.memberships && extractedData.memberships.length > 0) {
      lines.push('');
      lines.push('-- Grant Role Memberships');
      lines.push('');
      
      for (const membership of extractedData.memberships) {
        const withAdmin = membership.admin_option ? ' WITH ADMIN OPTION' : '';
        lines.push(`GRANT "${membership.role}" TO "${membership.member}"${withAdmin};`);
      }
    }

    // Add database permissions
    if (extractedData.dbPermissions && extractedData.dbPermissions.length > 0) {
      lines.push('');
      lines.push('-- Database-level Permissions');
      lines.push('-- Note: These will be applied after database creation');
      lines.push('');
      
      for (const db of extractedData.dbPermissions) {
        if (db.datacl) {
          lines.push(`-- Permissions for database: ${db.datname}`);
          lines.push(`-- ACL: ${db.datacl}`);
          // Parse and generate GRANT statements from ACL
          const grants = this._parseAcl(db.datacl, 'DATABASE', db.datname);
          grants.forEach(grant => lines.push(grant));
          lines.push('');
        }
      }
    }

    const scriptPath = path.join(this.tempDir, `users_roles_${Date.now()}.sql`);
    await fs.writeFile(scriptPath, lines.join('\n'), 'utf8');
    
    this.logger.info(`✅ Users/Roles creation script generated: ${scriptPath}`);
    return scriptPath;
  }

  /**
   * Generate SQL script to apply permissions after restore
   */
  async generatePermissionsScript(permissions, databases) {
    const lines = [
      '-- Post-Migration Permissions Script',
      `-- Generated: ${new Date().toISOString()}`,
      '-- Apply this script AFTER data restore to set correct ownership and grants',
      '',
      '-- Note: Run this with a superuser account',
      ''
    ];

    for (const dbName of databases) {
      const dbPerms = permissions[dbName];
      if (!dbPerms || dbPerms.error) {
        lines.push(`-- Skipped database ${dbName}: ${dbPerms?.error || 'No permissions data'}`);
        continue;
      }

      lines.push(`-- Database: ${dbName}`);
      lines.push(`\\connect "${dbName}"`);
      lines.push('');

      // Schema ownership
      if (dbPerms.schemas && dbPerms.schemas.length > 0) {
        lines.push('-- Schema Ownership');
        for (const schema of dbPerms.schemas) {
          if (schema.owner && schema.schema_name !== 'public') {
            lines.push(`ALTER SCHEMA "${schema.schema_name}" OWNER TO "${schema.owner}";`);
          }
          // Parse and apply schema ACLs
          if (schema.acl) {
            const grants = this._parseAcl(schema.acl, 'SCHEMA', schema.schema_name);
            grants.forEach(grant => lines.push(grant));
          }
        }
        lines.push('');
      }

      // Table ownership
      if (dbPerms.tables && dbPerms.tables.length > 0) {
        lines.push('-- Table Ownership');
        for (const table of dbPerms.tables) {
          if (table.tableowner) {
            lines.push(`ALTER TABLE "${table.schemaname}"."${table.tablename}" OWNER TO "${table.tableowner}";`);
          }
        }
        lines.push('');
      }

      // Sequence ownership
      if (dbPerms.sequences && dbPerms.sequences.length > 0) {
        lines.push('-- Sequence Ownership');
        for (const seq of dbPerms.sequences) {
          if (seq.sequenceowner) {
            lines.push(`ALTER SEQUENCE "${seq.schemaname}"."${seq.sequencename}" OWNER TO "${seq.sequenceowner}";`);
          }
        }
        lines.push('');
      }

      // Function ownership
      if (dbPerms.functions && dbPerms.functions.length > 0) {
        lines.push('-- Function Ownership');
        for (const func of dbPerms.functions) {
          if (func.owner) {
            // Note: Function signatures would need to be extracted for complete ALTER FUNCTION
            lines.push(`-- ALTER FUNCTION "${func.schema_name}"."${func.function_name}" OWNER TO "${func.owner}";`);
          }
        }
        lines.push('');
      }
    }

    const scriptPath = path.join(this.tempDir, `apply_permissions_${Date.now()}.sql`);
    await fs.writeFile(scriptPath, lines.join('\n'), 'utf8');
    
    this.logger.info(`✅ Permissions script generated: ${scriptPath}`);
    return scriptPath;
  }

  /**
   * Apply users and roles to target instance
   */
  async applyUsersAndRoles(targetProject, targetInstance, scriptPath, connectionInfo = {}) {
    try {
      this.logger.info('📝 Applying users and roles to target instance...');
      
      // Read the script
      const script = await fs.readFile(scriptPath, 'utf8');
      
      // Connect to postgres database
      const pool = await this.connectionManager.connect(
        targetProject,
        targetInstance,
        'postgres',
        false, // isSource = false (target)
        connectionInfo
      );
      const client = await pool.connect();

      try {
        // Split script into individual statements
        const statements = script
          .split(';')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('--'));

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const statement of statements) {
          try {
            await client.query(statement + ';');
            successCount++;
          } catch (error) {
            errorCount++;
            // Log but continue - some users might already exist
            this.logger.warn(`Statement failed (continuing): ${error.message}`);
            errors.push({ statement: statement.substring(0, 100), error: error.message });
          }
        }

        this.logger.info(`✅ Users/Roles applied: ${successCount} successful, ${errorCount} failed`);
        
        if (errors.length > 0) {
          // Ensure temp dir exists before writing error log
          await fs.mkdir(this.tempDir, { recursive: true });
          const errorLogPath = path.join(this.tempDir, `errors_${Date.now()}.log`);
          await fs.writeFile(errorLogPath, JSON.stringify(errors, null, 2), 'utf8');
          this.logger.info(`⚠️ Errors logged to: ${errorLogPath}`);
        }

        return { success: true, successCount, errorCount, errors };

      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error('Failed to apply users and roles:', error.message);
      throw error;
    }
  }

  /**
   * Generate CREATE ROLE/USER SQL statement
   */
  _generateRoleSQL(role, passwordStrategy = {}) {
    const parts = [];
    const options = [];

    // Add role options
    if (role.rolsuper) options.push('SUPERUSER');
    if (role.rolcreaterole) options.push('CREATEROLE');
    if (role.rolcreatedb) options.push('CREATEDB');
    if (role.rolcanlogin) {
      options.push('LOGIN');
      
      // Handle password based on strategy
      if (passwordStrategy.type === 'same' && passwordStrategy.password) {
        options.push(`PASSWORD '${passwordStrategy.password}'`);
      } else if (passwordStrategy.type === 'default' && passwordStrategy.defaultPassword) {
        options.push(`PASSWORD '${passwordStrategy.defaultPassword}'`);
      } else if (passwordStrategy.type === 'individual' && passwordStrategy.passwords?.[role.rolname]) {
        options.push(`PASSWORD '${passwordStrategy.passwords[role.rolname]}'`);
      } else {
        options.push(`PASSWORD 'CHANGEME_${role.rolname}'`);
      }
    }
    
    if (role.rolreplication) options.push('REPLICATION');
    if (role.rolbypassrls) options.push('BYPASSRLS');
    if (!role.rolinherit) options.push('NOINHERIT');
    if (role.rolconnlimit && role.rolconnlimit > 0) {
      options.push(`CONNECTION LIMIT ${role.rolconnlimit}`);
    }
    if (role.rolvaliduntil) {
      options.push(`VALID UNTIL '${role.rolvaliduntil}'`);
    }

    // Build CREATE ROLE statement
    parts.push(`CREATE ROLE "${role.rolname}"`);
    if (options.length > 0) {
      parts.push('WITH');
      parts.push(options.join(' '));
    }

    return `${parts.join(' ')};`;
  }

  /**
   * Parse PostgreSQL ACL string and generate GRANT statements
   */
  _parseAcl(aclString, objectType, objectName) {
    const grants = [];
    if (!aclString) return grants;

    // PostgreSQL ACL format: {user=permissions/grantor,...}
    const aclEntries = aclString.slice(1, -1).split(',');
    
    for (const entry of aclEntries) {
      const [userPerms] = entry.split('/'); // grantor not used but could be
      const [user, perms] = userPerms.split('=');
      
      if (!perms) continue;
      
      const grantee = user || 'PUBLIC';
      const privileges = this._parsePrivileges(perms);
      
      if (privileges.length > 0) {
        grants.push(`GRANT ${privileges.join(', ')} ON ${objectType} "${objectName}" TO "${grantee}";`);
      }
    }

    return grants;
  }

  /**
   * Parse privilege characters into SQL privilege names
   */
  _parsePrivileges(perms) {
    const privileges = [];
    const permMap = {
      'r': 'SELECT',
      'w': 'UPDATE',
      'a': 'INSERT',
      'd': 'DELETE',
      'D': 'TRUNCATE',
      'x': 'REFERENCES',
      't': 'TRIGGER',
      'X': 'EXECUTE',
      'U': 'USAGE',
      'C': 'CREATE',
      'c': 'CONNECT',
      'T': 'TEMPORARY'
    };

    for (const char of perms) {
      if (permMap[char]) {
        privileges.push(permMap[char]);
      }
    }

    return privileges;
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }
      await fs.rmdir(this.tempDir);
      this.logger.debug('Users/Roles temp files cleaned up');
    } catch (error) {
      this.logger.debug('Cleanup warning:', error.message);
    }
  }
}

export default UsersRolesExtractor;