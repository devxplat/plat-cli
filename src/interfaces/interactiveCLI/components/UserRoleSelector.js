import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

/**
 * UserRoleSelector Component
 * Allows selection of specific users and roles to migrate
 */
const UserRoleSelector = ({ 
  sourceProject, 
  sourceInstance, 
  sourceConnectionInfo,
  onComplete, 
  onCancel 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allItems, setAllItems] = useState([]);

  // Fetch users and roles from source database
  useEffect(() => {
    const fetchUsersAndRoles = async () => {
      if (!sourceProject || !sourceInstance) {
        setError('Source project and instance are required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Dynamic import to avoid circular dependencies
        const [
          { default: ConnectionManager },
          { default: Logger }
        ] = await Promise.all([
          import('../../../infrastructure/cloud/gcp-connection-manager.js'),
          import('../../../infrastructure/logging/winston-logger.js')
        ]);

        const logger = new Logger({ level: 'error', cliMode: true });
        const connectionManager = new ConnectionManager(logger);
        
        // Get connection info from sourceConnectionInfo
        const connectionInfo = {
          project: sourceProject,
          instance: sourceInstance,
          ip: sourceConnectionInfo?.ip || sourceConnectionInfo?.credentials?.ip,
          user: sourceConnectionInfo?.user || sourceConnectionInfo?.credentials?.user || 'postgres',
          password: sourceConnectionInfo?.password || sourceConnectionInfo?.credentials?.password
        };

        // Connect to postgres database
        const pool = await connectionManager.connect(
          sourceProject,
          sourceInstance,
          'postgres',
          true, // isSource
          connectionInfo
        );
        const client = await pool.connect();

        try {
          // Query for users and roles
          const result = await client.query(`
            SELECT 
              r.rolname,
              r.rolcanlogin,
              r.rolsuper,
              r.rolcreatedb,
              r.rolcreaterole,
              r.rolreplication,
              ARRAY(
                SELECT b.rolname 
                FROM pg_catalog.pg_auth_members m 
                JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid) 
                WHERE m.member = r.oid
              ) as memberof,
              CASE 
                WHEN r.rolcanlogin THEN 'user'
                ELSE 'role'
              END as type
            FROM pg_catalog.pg_roles r
            WHERE r.rolname NOT IN (
              'postgres', 'cloudsqlsuperuser', 'cloudsqliamserviceaccount',
              'cloudsqliamuser', 'cloudsqlimportexport', 'cloudsqlreplica'
            )
            AND r.rolname NOT LIKE 'pg_%'
            AND r.rolname NOT LIKE 'cloudsql%'
            ORDER BY r.rolcanlogin DESC, r.rolname
          `);

          // Separate users and roles
          const usersList = result.rows.filter(r => r.rolcanlogin);
          const rolesList = result.rows.filter(r => !r.rolcanlogin);
          
          setUsers(usersList);
          setRoles(rolesList);
          
          // Combine for display
          const combined = [
            ...usersList.map(u => ({ ...u, displayType: 'USER' })),
            ...rolesList.map(r => ({ ...r, displayType: 'ROLE' }))
          ];
          setAllItems(combined);
          
          // Select all by default
          const allNames = new Set(combined.map(item => item.rolname));
          setSelectedItems(allNames);
          
        } finally {
          client.release();
          await connectionManager.closeAllConnections();
        }
        
        setLoading(false);
      } catch (err) {
        setError(`Failed to fetch users and roles: ${err.message}`);
        setLoading(false);
      }
    };

    fetchUsersAndRoles();
  }, [sourceProject, sourceInstance, sourceConnectionInfo]);

  // Handle keyboard input
  useInput((input, key) => {
    if (loading || error) return;

    if (key.upArrow) {
      setCurrentIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCurrentIndex(prev => Math.min(allItems.length - 1, prev + 1));
    } else if (input === ' ') {
      // Toggle selection
      const item = allItems[currentIndex];
      if (item) {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(item.rolname)) {
          newSelected.delete(item.rolname);
        } else {
          newSelected.add(item.rolname);
        }
        setSelectedItems(newSelected);
      }
    } else if (input === 'a' || input === 'A') {
      // Select/deselect all
      if (selectedItems.size === allItems.length) {
        setSelectedItems(new Set());
      } else {
        setSelectedItems(new Set(allItems.map(item => item.rolname)));
      }
    } else if (key.return) {
      // Submit selection
      const selectedUsersList = users.filter(u => selectedItems.has(u.rolname));
      const selectedRolesList = roles.filter(r => selectedItems.has(r.rolname));
      
      onComplete({
        users: selectedUsersList.map(u => u.rolname),
        roles: selectedRolesList.map(r => r.rolname),
        all: Array.from(selectedItems)
      });
    } else if (key.escape) {
      onCancel();
    }
  });

  if (loading) {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Spinner, { label: 'Loading users and roles...' })
    );
  }

  if (error) {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(StatusMessage, { variant: 'error' }, error),
      React.createElement(Text, { color: 'gray' }, 'Press ESC to go back')
    );
  }

  if (allItems.length === 0) {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(StatusMessage, { variant: 'warning' }, 'No users or roles found to migrate'),
      React.createElement(Text, { color: 'gray' }, 'Press ENTER to continue or ESC to go back')
    );
  }

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, 'Select Users and Roles to Migrate')
    ),
    
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: 'gray' },
        `${selectedItems.size} of ${allItems.length} selected`
      )
    ),

    React.createElement(Box, { flexDirection: 'column', marginBottom: 1 },
      allItems.map((item, index) => {
        const isSelected = selectedItems.has(item.rolname);
        const isCurrent = index === currentIndex;
        
        // Build attributes string
        const attrs = [];
        if (item.rolsuper) attrs.push('SUPER');
        if (item.rolcreatedb) attrs.push('CREATEDB');
        if (item.rolcreaterole) attrs.push('CREATEROLE');
        if (item.rolreplication) attrs.push('REPLICATION');
        const attrString = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
        
        return React.createElement(Box, { key: item.rolname },
          React.createElement(Text, { color: isCurrent ? 'yellow' : 'white' },
            isCurrent ? '>' : ' '
          ),
          React.createElement(Text, { color: isSelected ? 'green' : 'gray' },
            `[${isSelected ? '✓' : ' '}]`
          ),
          React.createElement(Text, { color: item.displayType === 'USER' ? 'cyan' : 'magenta' },
            ` ${item.displayType}:`
          ),
          React.createElement(Text, { color: isSelected ? 'white' : 'gray' },
            ` ${item.rolname}${attrString}`
          ),
          item.memberof && item.memberof.length > 0 &&
            React.createElement(Text, { color: 'gray' },
              ` (member of: ${item.memberof.join(', ')})`
            )
        );
      })
    ),

    React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { color: 'gray' },
        React.createElement(Text, { bold: true }, '↑↓'),
        ' Navigate  ',
        React.createElement(Text, { bold: true }, 'SPACE'),
        ' Toggle  ',
        React.createElement(Text, { bold: true }, 'A'),
        ' Select All'
      ),
      React.createElement(Text, { color: 'gray' },
        React.createElement(Text, { bold: true }, 'ENTER'),
        ' Confirm  ',
        React.createElement(Text, { bold: true }, 'ESC'),
        ' Cancel'
      )
    )
  );
};

export default UserRoleSelector;