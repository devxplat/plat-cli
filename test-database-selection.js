import ConnectionManager from './src/infrastructure/cloud/gcp-connection-manager.js';

// Test database fetching
async function testDatabaseFetch() {
  console.log('Testing database fetch...');
  
  const connectionManager = new ConnectionManager({
    debug: (msg, data) => console.log('DEBUG:', msg, data),
    info: (msg) => console.log('INFO:', msg),
    warn: (msg) => console.log('WARN:', msg),
    error: (msg) => console.error('ERROR:', msg)
  });

  // Test parameters - replace with your actual values
  const testInstance = {
    project: process.env.TEST_PROJECT || 'your-project',
    instance: process.env.TEST_INSTANCE || 'your-instance',
    ip: process.env.TEST_IP || '127.0.0.1'
  };

  const connectionInfo = {
    ip: testInstance.ip,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'test-password',
    useProxy: false
  };

  try {
    console.log('Attempting to connect to:', testInstance);
    console.log('Connection info:', { ...connectionInfo, password: '***' });
    
    const databases = await connectionManager.listDatabases(
      testInstance.project,
      testInstance.instance,
      true, // isSource
      connectionInfo
    );
    
    console.log('✅ Successfully fetched databases:');
    databases.forEach(db => {
      console.log(`  - ${db.name} (${db.sizeFormatted})`);
    });
    
    await connectionManager.closeConnection(testInstance.project, testInstance.instance, 'postgres');
    console.log('✅ Connection closed successfully');
    
  } catch (error) {
    console.error('❌ Failed to fetch databases:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run test
testDatabaseFetch().catch(console.error);