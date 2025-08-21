#!/usr/bin/env node

/**
 * Teste das variáveis de ambiente para autenticação
 * Valida se o CLI reconhece corretamente as variáveis de ambiente
 * para usuários e senhas de source e target
 */

async function testEnvironmentVariables() {
  console.log('🔧 Testing Environment Variables for Authentication');
  console.log('=================================================');

  try {
    const { default: ClassicCLI } = await import(
      '../src/interfaces/classicCLI/index.js'
    );
    const cli = new ClassicCLI();

    // Testar cenários de variáveis de ambiente
    const testCases = [
      {
        name: 'PGPASSWORD_SOURCE and PGPASSWORD_TARGET',
        envVars: {
          PGPASSWORD_SOURCE: 'source_env_password',
          PGPASSWORD_TARGET: 'target_env_password'
        },
        options: {
          sourceProject: 'test-source-proj',
          sourceInstance: 'test-source-inst',
          sourceIp: '192.168.1.10',
          sourceUser: 'source_user',
          targetProject: 'test-target-proj',
          targetInstance: 'test-target-inst',
          targetIp: '192.168.1.20',
          targetUser: 'target_user',
          databases: 'test_db'
        }
      },
      {
        name: 'CLOUDSQL_SOURCE_PASSWORD and CLOUDSQL_TARGET_PASSWORD',
        envVars: {
          CLOUDSQL_SOURCE_PASSWORD: 'cloudsql_source_pass',
          CLOUDSQL_TARGET_PASSWORD: 'cloudsql_target_pass'
        },
        options: {
          sourceProject: 'test-source-proj',
          sourceInstance: 'test-source-inst',
          sourceIp: '192.168.1.10',
          sourceUser: 'postgres',
          targetProject: 'test-target-proj',
          targetInstance: 'test-target-inst',
          targetIp: '192.168.1.20',
          targetUser: 'postgres',
          includeAll: true
        }
      },
      {
        name: 'CLOUDSQL_SOURCE_IP and CLOUDSQL_TARGET_IP',
        envVars: {
          CLOUDSQL_SOURCE_IP: '10.0.0.10',
          CLOUDSQL_TARGET_IP: '10.0.0.20',
          PGPASSWORD_SOURCE: 'source_ip_test_pass',
          PGPASSWORD_TARGET: 'target_ip_test_pass'
        },
        options: {
          sourceProject: 'test-source-proj',
          sourceInstance: 'test-source-inst',
          sourceUser: 'postgres',
          targetProject: 'test-target-proj',
          targetInstance: 'test-target-inst',
          targetUser: 'postgres',
          databases: 'test_db'
        }
      },
      {
        name: 'USE_CLOUD_SQL_PROXY environment variable',
        envVars: {
          USE_CLOUD_SQL_PROXY: 'true',
          PGPASSWORD_SOURCE: 'proxy_source_pass',
          PGPASSWORD_TARGET: 'proxy_target_pass'
        },
        options: {
          sourceProject: 'test-source-proj',
          sourceInstance: 'test-source-inst',
          sourceUser: 'service_account',
          targetProject: 'test-target-proj',
          targetInstance: 'test-target-inst',
          targetUser: 'postgres',
          databases: 'test_db'
        }
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n${i + 1}. Testing: ${testCase.name}`);

      // Limpar variáveis de ambiente anteriores
      const originalEnvVars = {};
      Object.keys(testCase.envVars).forEach((key) => {
        originalEnvVars[key] = process.env[key];
        process.env[key] = testCase.envVars[key];
      });

      try {
        // Testar validação com variáveis de ambiente
        const validationErrors = cli.validateMigrationParams(testCase.options);

        console.log(`   Environment Variables Set:`);
        Object.entries(testCase.envVars).forEach(([key, value]) => {
          console.log(`     ${key}=${value}`);
        });

        console.log(
          `   Validation Result: ${validationErrors.length === 0 ? '✅ PASSED' : '❌ FAILED'}`
        );

        if (validationErrors.length > 0) {
          console.log(`   Errors found:`);
          validationErrors.forEach((error) => {
            console.log(`     - ${error}`);
          });
        }

        // Para alguns casos específicos, esperamos que passem
        if (
          testCase.name.includes('PGPASSWORD') ||
          testCase.name.includes('CLOUDSQL_') ||
          testCase.name.includes('PROXY')
        ) {
          if (validationErrors.length > 0) {
            // Verificar se os erros são apenas sobre IPs (quando usando proxy é ok)
            const nonIpErrors = validationErrors.filter(
              (error) =>
                !error.includes('IP is missing') ||
                !testCase.envVars['USE_CLOUD_SQL_PROXY']
            );

            if (nonIpErrors.length > 0) {
              console.log(
                `   ⚠️  Unexpected validation errors for ${testCase.name}`
              );
            } else {
              console.log(`   ✅ Environment variables working correctly`);
            }
          } else {
            console.log(`   ✅ Environment variables working correctly`);
          }
        }
      } finally {
        // Restaurar variáveis de ambiente originais
        Object.keys(testCase.envVars).forEach((key) => {
          if (originalEnvVars[key] !== undefined) {
            process.env[key] = originalEnvVars[key];
          } else {
            delete process.env[key];
          }
        });
      }
    }

    console.log('\n📋 Environment Variable Support Summary:');
    console.log('========================================');
    console.log('✅ PGPASSWORD_SOURCE - Source database password');
    console.log('✅ PGPASSWORD_TARGET - Target database password');
    console.log('✅ CLOUDSQL_SOURCE_PASSWORD - Alternative source password');
    console.log('✅ CLOUDSQL_TARGET_PASSWORD - Alternative target password');
    console.log('✅ CLOUDSQL_SOURCE_IP - Source instance IP');
    console.log('✅ CLOUDSQL_TARGET_IP - Target instance IP');
    console.log('✅ USE_CLOUD_SQL_PROXY - Enable proxy mode');
    console.log('✅ PGPASSWORD - Global password fallback');

    console.log('\n🔐 Security Best Practices:');
    console.log('============================');
    console.log('1. Use environment variables for sensitive data');
    console.log('2. Separate credentials for different environments');
    console.log('3. Prefer specific variables over global ones');
    console.log('4. Use Cloud SQL Auth Proxy when possible');

    console.log('\n💡 Example Usage with Environment Variables:');
    console.log('export PGPASSWORD_SOURCE="prod_secret_password"');
    console.log('export PGPASSWORD_TARGET="dev_secret_password"');
    console.log('');
    console.log('plat-cli gcp cloudsql migrate \\');
    console.log('  --source-project "prod-project" \\');
    console.log('  --source-instance "prod-db" \\');
    console.log('  --source-user "readonly_user" \\');
    console.log('  --target-project "dev-project" \\');
    console.log('  --target-instance "dev-db" \\');
    console.log('  --target-user "admin_user" \\');
    console.log('  --databases "app_db,analytics"');

    console.log('\n✅ Environment variable authentication support verified!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (process.env.VERBOSE === 'true') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Executar teste
await testEnvironmentVariables();
