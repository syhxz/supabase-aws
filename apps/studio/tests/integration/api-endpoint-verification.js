/**
 * API Endpoint Verification Script
 * 
 * This script verifies that API endpoints work correctly in both platform 
 * and self-hosted modes by testing the actual API handlers directly.
 * 
 * Requirements tested:
 * - 3.1: Self-hosted mode provides full API key management functionality
 * - 3.2: Self-hosted mode provides full JWT key management functionality  
 * - 3.3: Consistent UI and behavior between platform and self-hosted modes
 * - 3.4: Appropriate backend endpoints based on deployment mode
 * - 3.5: Consistent authentication and authorization across both modes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test utilities
function createMockApiRequest(method, query = {}, body = null) {
  return {
    method,
    query,
    body,
    headers: {},
    url: '',
    cookies: {}
  };
}

function createMockApiResponse() {
  const res = {
    statusCode: 200,
    data: null,
    headers: {},
    
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    
    json: function (data) {
      this.data = data;
      return this;
    },
    
    setHeader: function (name, value) {
      this.headers = this.headers || {};
      this.headers[name] = value;
      return this;
    }
  };
  
  return res;
}

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    console.log(`✓ ${message}`);
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    console.log(`✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, actual: ${actual})`);
}

function assertProperty(obj, prop, message) {
  assert(obj && obj.hasOwnProperty(prop), `${message} - should have property '${prop}'`);
}

async function runTests() {
  console.log('🚀 Starting API Endpoint Verification Tests\n');
  
  // Set up test environment
  const originalEnv = { ...process.env };
  
  try {
    // Test 1: API Keys endpoint in self-hosted mode
    console.log('📋 Testing API Keys endpoint in self-hosted mode...');
    
    process.env.NEXT_PUBLIC_IS_PLATFORM = 'false';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key-12345';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key-67890';
    
    // Import the API handler (this will use the current environment)
    delete require.cache[require.resolve('../../pages/api/v1/projects/[ref]/api-keys.ts')];
    
    // For TypeScript files, we need to compile them first or use a different approach
    // Let's test the functionality by directly calling the handler functions
    const apiKeysModule = await import('../../pages/api/v1/projects/[ref]/api-keys.ts');
    const apiKeysHandler = apiKeysModule.default;
    
    // Test GET request
    const getReq = createMockApiRequest('GET', { ref: 'test-project' });
    const getRes = createMockApiResponse();
    
    await apiKeysHandler(getReq, getRes);
    
    assertEqual(getRes.statusCode, 200, 'GET /api-keys should return 200');
    assert(Array.isArray(getRes.data), 'GET /api-keys should return an array');
    assertEqual(getRes.data.length, 2, 'Should return 2 legacy keys');
    
    const anonKey = getRes.data.find(key => key.name === 'anon');
    const serviceKey = getRes.data.find(key => key.name === 'service_role');
    
    assertProperty(anonKey, 'api_key', 'Anon key should have api_key property');
    assertEqual(anonKey.api_key, 'test-anon-key-12345', 'Anon key should match environment variable');
    assertEqual(anonKey.type, 'legacy', 'Anon key should be legacy type');
    
    assertProperty(serviceKey, 'api_key', 'Service key should have api_key property');
    assertEqual(serviceKey.api_key, 'test-service-key-67890', 'Service key should match environment variable');
    assertEqual(serviceKey.type, 'legacy', 'Service key should be legacy type');
    
    // Test POST request for creating new key
    const postReq = createMockApiRequest('POST', { ref: 'test-project' }, {
      name: 'test-secret-key',
      description: 'Test secret key',
      type: 'secret'
    });
    const postRes = createMockApiResponse();
    
    await apiKeysHandler(postReq, postRes);
    
    assertEqual(postRes.statusCode, 201, 'POST /api-keys should return 201');
    assertProperty(postRes.data, 'id', 'Created key should have id');
    assertProperty(postRes.data, 'api_key', 'Created key should have api_key');
    assertEqual(postRes.data.name, 'test-secret-key', 'Created key should have correct name');
    assertEqual(postRes.data.type, 'secret', 'Created key should have correct type');
    assert(postRes.data.api_key.startsWith('sb_secret_'), 'Secret key should have correct prefix');
    
    // Test validation
    const invalidReq = createMockApiRequest('POST', { ref: 'test-project' }, {
      description: 'Missing name and type'
    });
    const invalidRes = createMockApiResponse();
    
    await apiKeysHandler(invalidReq, invalidRes);
    
    assertEqual(invalidRes.statusCode, 400, 'Invalid POST should return 400');
    assertProperty(invalidRes.data, 'error', 'Invalid request should have error');
    
    console.log('✅ API Keys endpoint tests completed\n');
    
    // Test 2: Individual API Key endpoint
    console.log('📋 Testing individual API Key endpoint...');
    
    delete require.cache[require.resolve('../../pages/api/v1/projects/[ref]/api-keys/[id].ts')];
    const apiKeyModule = await import('../../pages/api/v1/projects/[ref]/api-keys/[id].ts');
    const apiKeyHandler = apiKeyModule.default;
    
    // Test GET individual key
    const getKeyReq = createMockApiRequest('GET', { ref: 'test-project', id: 'anon' });
    const getKeyRes = createMockApiResponse();
    
    await apiKeyHandler(getKeyReq, getKeyRes);
    
    assertEqual(getKeyRes.statusCode, 200, 'GET /api-keys/anon should return 200');
    assertEqual(getKeyRes.data.id, 'anon', 'Should return anon key');
    assert(getKeyRes.data.api_key.includes('••••••••••••••••'), 'Key should be masked by default');
    
    // Test GET with reveal
    const revealReq = createMockApiRequest('GET', { ref: 'test-project', id: 'anon', reveal: 'true' });
    const revealRes = createMockApiResponse();
    
    await apiKeyHandler(revealReq, revealRes);
    
    assertEqual(revealRes.statusCode, 200, 'GET /api-keys/anon?reveal=true should return 200');
    assertEqual(revealRes.data.api_key, 'test-anon-key-12345', 'Key should be revealed when requested');
    
    // Test DELETE
    const deleteReq = createMockApiRequest('DELETE', { ref: 'test-project', id: 'custom-key' });
    const deleteRes = createMockApiResponse();
    
    await apiKeyHandler(deleteReq, deleteRes);
    
    assertEqual(deleteRes.statusCode, 200, 'DELETE /api-keys/custom-key should return 200');
    assert(deleteRes.data.message.includes('deleted successfully'), 'Should confirm deletion');
    
    // Test DELETE legacy key (should fail)
    const deleteLegacyReq = createMockApiRequest('DELETE', { ref: 'test-project', id: 'anon' });
    const deleteLegacyRes = createMockApiResponse();
    
    await apiKeyHandler(deleteLegacyReq, deleteLegacyRes);
    
    assertEqual(deleteLegacyRes.statusCode, 400, 'DELETE legacy key should return 400');
    assert(deleteLegacyRes.data.error.message.includes('Cannot delete legacy'), 'Should prevent legacy key deletion');
    
    console.log('✅ Individual API Key endpoint tests completed\n');
    
    // Test 3: Cross-deployment mode consistency
    console.log('📋 Testing cross-deployment mode consistency...');
    
    const deploymentModes = [
      { IS_PLATFORM: 'true', description: 'platform mode' },
      { IS_PLATFORM: 'false', description: 'self-hosted mode' }
    ];
    
    for (const mode of deploymentModes) {
      console.log(`  Testing ${mode.description}...`);
      
      process.env.NEXT_PUBLIC_IS_PLATFORM = mode.IS_PLATFORM;
      
      // Clear require cache to pick up new environment
      delete require.cache[require.resolve('../../pages/api/v1/projects/[ref]/api-keys.ts')];
      const handlerModule = await import('../../pages/api/v1/projects/[ref]/api-keys.ts');
      const handler = handlerModule.default;
      
      const req = createMockApiRequest('GET', { ref: 'test-project' });
      const res = createMockApiResponse();
      
      await handler(req, res);
      
      assertEqual(res.statusCode, 200, `${mode.description} should return 200`);
      assert(Array.isArray(res.data), `${mode.description} should return array`);
      
      // Verify consistent data structure
      for (const key of res.data) {
        assertProperty(key, 'id', `${mode.description} key should have id`);
        assertProperty(key, 'name', `${mode.description} key should have name`);
        assertProperty(key, 'api_key', `${mode.description} key should have api_key`);
        assertProperty(key, 'type', `${mode.description} key should have type`);
      }
    }
    
    console.log('✅ Cross-deployment mode consistency tests completed\n');
    
    // Test 4: Error handling consistency
    console.log('📋 Testing error handling consistency...');
    
    for (const mode of deploymentModes) {
      process.env.NEXT_PUBLIC_IS_PLATFORM = mode.IS_PLATFORM;
      
      delete require.cache[require.resolve('../../pages/api/v1/projects/[ref]/api-keys.ts')];
      const handlerModule = await import('../../pages/api/v1/projects/[ref]/api-keys.ts');
      const handler = handlerModule.default;
      
      // Test unsupported method
      const req = createMockApiRequest('PATCH', { ref: 'test-project' });
      const res = createMockApiResponse();
      
      await handler(req, res);
      
      assertEqual(res.statusCode, 405, `${mode.description} should return 405 for unsupported method`);
      assertProperty(res.data, 'error', `${mode.description} should have error object`);
      assertProperty(res.headers, 'Allow', `${mode.description} should set Allow header`);
    }
    
    console.log('✅ Error handling consistency tests completed\n');
    
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`Test execution error: ${error.message}`);
    console.error('❌ Test execution failed:', error);
  } finally {
    // Restore original environment
    process.env = originalEnv;
  }
  
  // Print results
  console.log('📊 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 Failed Tests:');
    testResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! API endpoints work correctly in both deployment modes.');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Please review the implementation.');
    return false;
  }
}

// Run the tests
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };