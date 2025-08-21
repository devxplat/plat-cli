import test from 'ava';
import sinon from 'sinon';
import UsersRolesExtractor from './gcp-users-roles-extractor.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock logger
const createMockLogger = () => ({
  info: sinon.stub(),
  debug: sinon.stub(),
  warn: sinon.stub(),
  error: sinon.stub()
});

// Mock connection manager
const createMockConnectionManager = () => {
  const mockClient = {
    query: sinon.stub(),
    release: sinon.stub()
  };
  
  const mockPool = {
    connect: sinon.stub().resolves(mockClient)
  };
  
  return {
    connect: sinon.stub().resolves(mockPool),
    mockClient,
    mockPool
  };
};

test.beforeEach(t => {
  t.context.logger = createMockLogger();
  t.context.connectionManager = createMockConnectionManager();
  t.context.extractor = new UsersRolesExtractor(
    t.context.connectionManager,
    t.context.logger
  );
});

test.afterEach.always(async () => {
  // Cleanup temp files if they exist
  try {
    const tempDir = path.join(os.tmpdir(), 'plat-cli', 'users-roles');
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

test('init creates temporary directory', async t => {
  const { extractor } = t.context;
  
  await extractor.init();
  
  const tempDir = path.join(os.tmpdir(), 'plat-cli', 'users-roles');
  const stats = await fs.stat(tempDir);
  
  t.true(stats.isDirectory());
});

test('extractUsersAndRoles extracts users and roles correctly', async t => {
  const { extractor, connectionManager, logger } = t.context;
  const { mockClient } = connectionManager;
  
  // Mock query responses
  mockClient.query
    .onFirstCall().resolves({
      rows: [
        {
          rolname: 'app_user',
          rolcanlogin: true,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          memberof: []
        },
        {
          rolname: 'readonly_role',
          rolcanlogin: false,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          memberof: []
        }
      ]
    })
    .onSecondCall().resolves({
      rows: [
        {
          datname: 'mydb',
          datacl: '{app_user=CTc/postgres}'
        }
      ]
    })
    .onThirdCall().resolves({
      rows: [
        {
          role: 'readonly_role',
          member: 'app_user',
          admin_option: false,
          grantor: 'postgres'
        }
      ]
    });
  
  const result = await extractor.extractUsersAndRoles(
    'my-project',
    'my-instance',
    { ip: '127.0.0.1', user: 'postgres', password: 'test' }
  );
  
  t.is(result.roles.length, 2);
  t.is(result.roles[0].rolname, 'app_user');
  t.true(result.roles[0].rolcanlogin);
  t.is(result.roles[1].rolname, 'readonly_role');
  t.false(result.roles[1].rolcanlogin);
  
  t.is(result.dbPermissions.length, 1);
  t.is(result.dbPermissions[0].datname, 'mydb');
  
  t.is(result.memberships.length, 1);
  t.is(result.memberships[0].role, 'readonly_role');
  t.is(result.memberships[0].member, 'app_user');
  
  t.true(connectionManager.connect.calledWith(
    'my-project',
    'my-instance',
    'postgres',
    true
  ));
});

test('generateCreateScript generates SQL with default password strategy', async t => {
  const { extractor } = t.context;
  
  await extractor.init();
  
  const extractedData = {
    sourceInstance: 'project:instance',
    roles: [
      {
        rolname: 'app_user',
        rolcanlogin: true,
        rolsuper: false,
        rolcreatedb: true,
        rolcreaterole: false,
        rolconnlimit: 10
      },
      {
        rolname: 'readonly_role',
        rolcanlogin: false,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false
      }
    ],
    memberships: [
      {
        role: 'readonly_role',
        member: 'app_user',
        admin_option: false
      }
    ],
    dbPermissions: []
  };
  
  const passwordStrategy = {
    type: 'default',
    defaultPassword: 'TestPassword123'
  };
  
  const scriptPath = await extractor.generateCreateScript(extractedData, passwordStrategy);
  
  t.true(scriptPath.includes('users_roles'));
  
  const scriptContent = await fs.readFile(scriptPath, 'utf8');
  
  t.true(scriptContent.includes('CREATE ROLE "readonly_role"'));
  t.true(scriptContent.includes('CREATE ROLE "app_user" WITH LOGIN'));
  t.true(scriptContent.includes('PASSWORD \'TestPassword123\''));
  t.true(scriptContent.includes('CREATEDB'));
  t.true(scriptContent.includes('CONNECTION LIMIT 10'));
  t.true(scriptContent.includes('GRANT "readonly_role" TO "app_user"'));
});

test('generatePermissionsScript creates post-restore permissions script', async t => {
  const { extractor } = t.context;
  
  await extractor.init();
  
  const permissions = {
    mydb: {
      schemas: [
        {
          schema_name: 'public',
          owner: 'app_user',
          acl: '{app_user=UC/app_user,readonly_role=U/app_user}'
        }
      ],
      tables: [
        {
          schemaname: 'public',
          tablename: 'users',
          tableowner: 'app_user'
        }
      ],
      sequences: [
        {
          schemaname: 'public',
          sequencename: 'users_id_seq',
          sequenceowner: 'app_user'
        }
      ],
      functions: []
    }
  };
  
  const scriptPath = await extractor.generatePermissionsScript(permissions, ['mydb']);
  
  t.true(scriptPath.includes('apply_permissions'));
  
  const scriptContent = await fs.readFile(scriptPath, 'utf8');
  
  t.true(scriptContent.includes('\\connect "mydb"'));
  t.true(scriptContent.includes('ALTER TABLE "public"."users" OWNER TO "app_user"'));
  t.true(scriptContent.includes('ALTER SEQUENCE "public"."users_id_seq" OWNER TO "app_user"'));
  t.true(scriptContent.includes('GRANT USAGE, CREATE ON SCHEMA "public" TO "app_user"'));
});

test('applyUsersAndRoles executes SQL statements', async t => {
  const { extractor, connectionManager } = t.context;
  const { mockClient } = connectionManager;
  
  await extractor.init();
  
  // Create a test script with only valid SQL statements
  const testScript = `CREATE ROLE "test_role";
CREATE ROLE "test_user" WITH LOGIN PASSWORD 'test';`;
  
  const scriptPath = path.join(extractor.tempDir, 'test_script.sql');
  await fs.writeFile(scriptPath, testScript, 'utf8');
  
  // Mock successful queries
  mockClient.query.resolves();
  
  const result = await extractor.applyUsersAndRoles(
    'target-project',
    'target-instance',
    scriptPath,
    { ip: '127.0.0.1', user: 'postgres', password: 'test' }
  );
  
  t.true(result.success);
  // Script has 2 SQL statements
  t.is(result.successCount, 2);
  t.is(result.errorCount, 0);
  
  t.true(connectionManager.connect.calledWith(
    'target-project',
    'target-instance',
    'postgres',
    false
  ));
});

test('applyUsersAndRoles handles errors gracefully', async t => {
  const { extractor, connectionManager } = t.context;
  const { mockClient } = connectionManager;
  
  await extractor.init();
  
  const testScript = `
CREATE ROLE "existing_role";
CREATE ROLE "new_role";
  `;
  
  const scriptPath = path.join(extractor.tempDir, 'test_script.sql');
  await fs.writeFile(scriptPath, testScript, 'utf8');
  
  // Mock first query fails (role exists), second succeeds
  mockClient.query
    .onFirstCall().rejects(new Error('role "existing_role" already exists'))
    .onSecondCall().resolves();
  
  const result = await extractor.applyUsersAndRoles(
    'target-project',
    'target-instance',
    scriptPath,
    { ip: '127.0.0.1', user: 'postgres', password: 'test' }
  );
  
  t.true(result.success);
  t.is(result.successCount, 1);
  t.is(result.errorCount, 1);
  t.is(result.errors.length, 1);
  t.true(result.errors[0].error.includes('already exists'));
});

test('_generateRoleSQL creates correct SQL for different password strategies', t => {
  const { extractor } = t.context;
  
  // Test with 'same' strategy
  const sqlSame = extractor._generateRoleSQL(
    { rolname: 'user1', rolcanlogin: true },
    { type: 'same', password: 'migration_password' }
  );
  t.true(sqlSame.includes('PASSWORD \'migration_password\''));
  
  // Test with 'default' strategy
  const sqlDefault = extractor._generateRoleSQL(
    { rolname: 'user2', rolcanlogin: true },
    { type: 'default', defaultPassword: 'DefaultPass123' }
  );
  t.true(sqlDefault.includes('PASSWORD \'DefaultPass123\''));
  
  // Test with 'individual' strategy
  const sqlIndividual = extractor._generateRoleSQL(
    { rolname: 'user3', rolcanlogin: true },
    { 
      type: 'individual', 
      passwords: { 'user3': 'IndividualPass123' }
    }
  );
  t.true(sqlIndividual.includes('PASSWORD \'IndividualPass123\''));
  
  // Test fallback password
  const sqlFallback = extractor._generateRoleSQL(
    { rolname: 'user4', rolcanlogin: true },
    {}
  );
  t.true(sqlFallback.includes('PASSWORD \'CHANGEME_user4\''));
});

test('_parseAcl generates correct GRANT statements', t => {
  const { extractor } = t.context;
  
  const grants = extractor._parseAcl(
    '{app_user=arwdDxt/postgres,readonly=r/postgres}',
    'TABLE',
    'users'
  );
  
  t.is(grants.length, 2);
  // Check individual components since order may vary
  t.true(grants[0].includes('GRANT'));
  t.true(grants[0].includes('SELECT'));
  t.true(grants[0].includes('INSERT'));
  t.true(grants[0].includes('UPDATE'));
  t.true(grants[0].includes('DELETE'));
  t.true(grants[0].includes('TRUNCATE'));
  t.true(grants[0].includes('REFERENCES'));
  t.true(grants[0].includes('TRIGGER'));
  t.true(grants[0].includes('ON TABLE "users" TO "app_user"'));
  t.true(grants[1].includes('GRANT SELECT ON TABLE "users" TO "readonly"'));
});

test('cleanup removes temporary files', async t => {
  const { extractor } = t.context;
  
  await extractor.init();
  
  // Create a test file
  const testFile = path.join(extractor.tempDir, 'test.sql');
  await fs.writeFile(testFile, 'test content', 'utf8');
  
  // Verify file exists
  await t.notThrowsAsync(fs.access(testFile));
  
  // Cleanup
  await extractor.cleanup();
  
  // Verify directory is removed
  await t.throwsAsync(fs.access(extractor.tempDir));
});