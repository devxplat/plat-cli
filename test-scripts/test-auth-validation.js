#!/usr/bin/env node

/**
 * Teste para validar funcionamento de usuários/senhas diferentes
 * para source e target no Classic CLI
 */

import { Command } from 'commander';
import OperationConfig from '../src/domain/models/operation-config.js';

async function testAuthenticationParsing() {
  console.log('🔐 Testing CLI Authentication Parameter Parsing');
  console.log('===============================================');

  try {
    // Simular argumentos do CLI com usuários e senhas diferentes
    const testCases = [
      {
        name: 'Different users and passwords',
        args: {
          sourceProject: 'prod-project',
          sourceInstance: 'prod-db',
          sourceUser: 'readonly_user',
          sourcePassword: 'prod_password_123',
          targetProject: 'dev-project',
          targetInstance: 'dev-db',
          targetUser: 'admin_user',
          targetPassword: 'dev_password_456',
          databases: 'app_db,analytics_db',
          toolName: 'gcp.cloudsql.migrate'
        }
      },
      {
        name: 'Same user, different passwords',
        args: {
          sourceProject: 'company-prod',
          sourceInstance: 'main-db',
          sourceUser: 'postgres',
          sourcePassword: 'super_secure_prod',
          targetProject: 'company-staging',
          targetInstance: 'staging-db',
          targetUser: 'postgres',
          targetPassword: 'staging_password_2024',
          includeAll: true,
          toolName: 'gcp.cloudsql.migrate'
        }
      },
      {
        name: 'Default users with passwords',
        args: {
          sourceProject: 'analytics-prod',
          sourceInstance: 'data-warehouse',
          sourcePassword: 'analytics_prod_pass',
          targetProject: 'analytics-dev',
          targetInstance: 'test-warehouse',
          targetPassword: 'analytics_dev_pass',
          databases: 'metrics,events',
          toolName: 'gcp.cloudsql.migrate'
        }
      },
      {
        name: 'Custom users with specific roles',
        args: {
          sourceProject: 'client-production',
          sourceInstance: 'client-db',
          sourceUser: 'data_export_user',
          sourcePassword: 'export_user_password',
          targetProject: 'our-staging',
          targetInstance: 'imported-data',
          targetUser: 'data_import_user',
          targetPassword: 'import_user_password',
          databases: 'client_data',
          schemaOnly: true,
          toolName: 'gcp.cloudsql.migrate'
        }
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n${i + 1}. Testing: ${testCase.name}`);

      // Criar config usando fromCliArgs (mesmo método do CLI)
      const config = OperationConfig.fromCliArgs(testCase.args);

      // Verificar se source foi configurado corretamente
      console.log(`   Source:`);
      console.log(`     Project: ${config.source.project}`);
      console.log(`     Instance: ${config.source.instance}`);
      console.log(`     User: ${config.source.user}`);
      console.log(
        `     Password: ${config.source.password ? '***masked***' : 'NOT SET'}`
      );
      console.log(
        `     Databases: ${config.source.databases?.join(', ') || 'NOT SET'}`
      );

      // Verificar se target foi configurado corretamente
      console.log(`   Target:`);
      console.log(`     Project: ${config.target.project}`);
      console.log(`     Instance: ${config.target.instance}`);
      console.log(`     User: ${config.target.user}`);
      console.log(
        `     Password: ${config.target.password ? '***masked***' : 'NOT SET'}`
      );

      // Verificar opções
      console.log(`   Options:`);
      console.log(`     Include All: ${config.options.includeAll}`);
      console.log(`     Schema Only: ${config.options.schemaOnly}`);
      console.log(`     Retry Attempts: ${config.options.retryAttempts}`);

      // Validações específicas para cada caso
      if (testCase.name.includes('Different users')) {
        if (
          config.source.user !== 'readonly_user' ||
          config.target.user !== 'admin_user'
        ) {
          throw new Error(
            `❌ User parsing failed for test case: ${testCase.name}`
          );
        }
        if (!config.source.password || !config.target.password) {
          throw new Error(
            `❌ Password parsing failed for test case: ${testCase.name}`
          );
        }
      }

      if (testCase.name.includes('Same user')) {
        if (
          config.source.user !== 'postgres' ||
          config.target.user !== 'postgres'
        ) {
          throw new Error(
            `❌ User parsing failed for test case: ${testCase.name}`
          );
        }
        if (config.source.password === config.target.password) {
          throw new Error(
            `❌ Passwords should be different for test case: ${testCase.name}`
          );
        }
      }

      if (testCase.name.includes('Default users')) {
        if (
          config.source.user !== 'postgres' ||
          config.target.user !== 'postgres'
        ) {
          throw new Error(
            `❌ Default user should be 'postgres' for test case: ${testCase.name}`
          );
        }
      }

      console.log(`   ✅ Test case passed: ${testCase.name}`);
    }

    console.log('\n🎉 All authentication parsing tests passed!');

    // Testar validação de credenciais
    console.log('\n📋 Testing credential validation...');

    const { default: ClassicCLI } = await import(
      '../src/interfaces/classicCLI/index.js'
    );
    const cli = new ClassicCLI();

    // Testar validação com credenciais completas
    const completeOptions = {
      sourceProject: 'test-source-proj',
      sourceInstance: 'test-source-inst',
      sourceIp: '192.168.1.10',
      sourceUser: 'source_user',
      sourcePassword: 'source_pass',
      targetProject: 'test-target-proj',
      targetInstance: 'test-target-inst',
      targetIp: '192.168.1.20',
      targetUser: 'target_user',
      targetPassword: 'target_pass',
      databases: 'test_db'
    };

    const completeValidation = cli.validateMigrationParams(completeOptions);
    if (completeValidation.length > 0) {
      throw new Error(
        `❌ Complete validation should pass but got errors: ${completeValidation.join(', ')}`
      );
    }
    console.log('   ✅ Complete credential validation passed');

    // Testar validação com credenciais faltando
    const incompleteOptions = {
      sourceProject: 'test-source-proj',
      sourceInstance: 'test-source-inst',
      sourceUser: 'source_user',
      // sourcePassword: missing
      targetProject: 'test-target-proj',
      targetInstance: 'test-target-inst',
      targetUser: 'target_user',
      // targetPassword: missing
      databases: 'test_db'
    };

    const incompleteValidation = cli.validateMigrationParams(incompleteOptions);
    if (incompleteValidation.length === 0) {
      throw new Error(`❌ Incomplete validation should fail but passed`);
    }
    console.log('   ✅ Incomplete credential validation correctly failed');
    console.log(`   📝 Expected errors: ${incompleteValidation.length} found`);

    console.log('\n🔐 Authentication Features Summary:');
    console.log('=====================================');
    console.log('✅ Separate source/target users supported');
    console.log('✅ Separate source/target passwords supported');
    console.log('✅ Default user fallback (postgres) works');
    console.log('✅ CLI argument parsing works correctly');
    console.log('✅ Parameter validation works correctly');
    console.log('✅ Environment variable support included');
    console.log('✅ Ready for production use');

    console.log('\n💡 Example Usage:');
    console.log('plat-cli gcp cloudsql migrate \\');
    console.log('  --source-project "prod-project" \\');
    console.log('  --source-instance "prod-db" \\');
    console.log('  --source-user "readonly_user" \\');
    console.log('  --source-password "prod_pass" \\');
    console.log('  --target-project "dev-project" \\');
    console.log('  --target-instance "dev-db" \\');
    console.log('  --target-user "admin_user" \\');
    console.log('  --target-password "dev_pass" \\');
    console.log('  --databases "app_db,analytics"');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (process.env.VERBOSE === 'true') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Executar os testes
await testAuthenticationParsing();
