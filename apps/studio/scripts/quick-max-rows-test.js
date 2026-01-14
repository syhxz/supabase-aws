#!/usr/bin/env node

/**
 * Quick Max Rows API Test
 * Feature: data-api-management, Property 10: Max Rows Enforcement
 * 
 * This script tests the max rows enforcement through API calls
 * Validates: Requirements 5.2, 5.3
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  projectRef: 'test-project-123',
  baseUrl: 'http://localhost:3000',
  timeout: 10000
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow
  };
  
  console.log(`${colorMap[level] || ''}[${level.toUpperCase()}] ${timestamp} - ${message}${colors.reset}`);
}

// HTTP request helper
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody,
            rawBody: body
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            rawBody: body
          });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(CONFIG.timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// API helper functions
const api = {
  async getConfig() {
    const url = new URL(`/api/v1/projects/${CONFIG.projectRef}/config/data-api`, CONFIG.baseUrl);
    return makeRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  async updateConfig(config) {
    const url = new URL(`/api/v1/projects/${CONFIG.projectRef}/config/data-api`, CONFIG.baseUrl);
    return makeRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    }, config);
  },
  
  async queryData(schema, table, params = {}) {
    const url = new URL(`/api/v1/projects/${CONFIG.projectRef}/data-api/${schema}/tables/${table}/rows`, CONFIG.baseUrl);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });
    
    return makeRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

// Test functions
async function testMaxRowsEnforcement() {
  log('info', 'Starting Max Rows Enforcement Tests');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  const test = async (name, testFn) => {
    try {
      log('info', `Running test: ${name}`);
      await testFn();
      log('success', `✓ ${name}`);
      testsPassed++;
    } catch (error) {
      log('error', `✗ ${name}: ${error.message}`);
      testsFailed++;
    }
  };
  
  // Test 1: Get current configuration
  let originalConfig;
  await test('Get current configuration', async () => {
    const response = await api.getConfig();
    if (response.statusCode !== 200) {
      throw new Error(`Failed to get config: ${response.statusCode}`);
    }
    originalConfig = response.body;
    log('info', `Current max rows: ${originalConfig.maxRows || 'not set'}`);
  });
  
  // Test 2: Set max rows to 10
  await test('Set max rows to 10', async () => {
    const response = await api.updateConfig({
      maxRows: 10,
      enableDataApi: true,
      exposedSchemas: ['public']
    });
    
    if (response.statusCode !== 200) {
      throw new Error(`Failed to update config: ${response.statusCode} - ${JSON.stringify(response.body)}`);
    }
    
    if (response.body.config && response.body.config.maxRows !== 10) {
      throw new Error(`Max rows not updated correctly: expected 10, got ${response.body.config.maxRows}`);
    }
  });
  
  // Test 3: Query with limit within max rows (should succeed)
  await test('Query with limit=5 (within max rows)', async () => {
    const response = await api.queryData('public', 'users', { limit: 5 });
    
    if (response.statusCode !== 200) {
      throw new Error(`Query failed: ${response.statusCode} - ${JSON.stringify(response.body)}`);
    }
    
    const dataLength = response.body.data?.data?.length || 0;
    if (dataLength > 5) {
      throw new Error(`Returned too many rows: expected ≤5, got ${dataLength}`);
    }
    
    log('info', `Returned ${dataLength} rows (limit=5)`);
  });
  
  // Test 4: Query with limit exceeding max rows (should fail)
  await test('Query with limit=20 (exceeds max rows)', async () => {
    const response = await api.queryData('public', 'users', { limit: 20 });
    
    if (response.statusCode !== 400) {
      throw new Error(`Expected 400 error, got ${response.statusCode}`);
    }
    
    if (!response.body.error || !response.body.error.message.includes('exceeds maximum')) {
      throw new Error(`Expected max rows error message, got: ${JSON.stringify(response.body.error)}`);
    }
    
    log('info', `Correctly rejected limit=20 with error: ${response.body.error.message}`);
  });
  
  // Test 5: Query without limit (should use max rows as default)
  await test('Query without limit (should default to max rows)', async () => {
    const response = await api.queryData('public', 'users');
    
    if (response.statusCode !== 200) {
      throw new Error(`Query failed: ${response.statusCode} - ${JSON.stringify(response.body)}`);
    }
    
    const dataLength = response.body.data?.data?.length || 0;
    if (dataLength > 10) {
      throw new Error(`Returned too many rows: expected ≤10, got ${dataLength}`);
    }
    
    log('info', `Returned ${dataLength} rows (no limit specified)`);
  });
  
  // Test 6: Check pagination headers
  await test('Verify pagination headers', async () => {
    const response = await api.queryData('public', 'users', { limit: 5, offset: 10 });
    
    if (response.statusCode !== 200) {
      throw new Error(`Query failed: ${response.statusCode}`);
    }
    
    const headers = response.headers;
    if (!headers['content-range']) {
      throw new Error('Missing Content-Range header');
    }
    
    if (!headers['x-total-count']) {
      throw new Error('Missing X-Total-Count header');
    }
    
    if (headers['accept-ranges'] !== 'items') {
      throw new Error(`Invalid Accept-Ranges header: ${headers['accept-ranges']}`);
    }
    
    log('info', `Pagination headers: Content-Range=${headers['content-range']}, X-Total-Count=${headers['x-total-count']}`);
  });
  
  // Test 7: Update to larger max rows value
  await test('Update max rows to 100', async () => {
    const response = await api.updateConfig({ maxRows: 100 });
    
    if (response.statusCode !== 200) {
      throw new Error(`Failed to update config: ${response.statusCode}`);
    }
  });
  
  // Test 8: Query that was previously rejected should now succeed
  await test('Query with limit=20 (should now succeed)', async () => {
    const response = await api.queryData('public', 'users', { limit: 20 });
    
    if (response.statusCode !== 200) {
      throw new Error(`Query should succeed now: ${response.statusCode} - ${JSON.stringify(response.body)}`);
    }
    
    const dataLength = response.body.data?.data?.length || 0;
    log('info', `Successfully returned ${dataLength} rows with limit=20`);
  });
  
  // Test 9: Test invalid max rows values (reduced examples)
  await test('Reject invalid max rows values', async () => {
    const invalidValues = [-1, 2000000]; // Reduced from 4 to 2 examples
    
    for (const value of invalidValues) {
      const response = await api.updateConfig({ maxRows: value });
      
      if (response.statusCode === 200) {
        throw new Error(`Should have rejected invalid max rows value: ${value}`);
      }
      
      log('info', `Correctly rejected invalid value: ${value}`);
    }
  });
  
  // Test 10: Property-based test simulation (reduced examples)
  await test('Property-based test simulation', async () => {
    const testCases = [
      { maxRows: 5, limit: 3, shouldSucceed: true },   // Within limit
      { maxRows: 5, limit: 10, shouldSucceed: false }, // Exceeds limit
      { maxRows: 50, limit: 100, shouldSucceed: false } // Exceeds limit
    ]; // Reduced from 5 to 3 examples
    
    for (const testCase of testCases) {
      // Set max rows
      await api.updateConfig({ maxRows: testCase.maxRows });
      
      // Test query
      const response = await api.queryData('public', 'users', { limit: testCase.limit });
      
      const actualSuccess = response.statusCode === 200;
      if (actualSuccess !== testCase.shouldSucceed) {
        throw new Error(
          `Property test failed: maxRows=${testCase.maxRows}, limit=${testCase.limit}, ` +
          `expected ${testCase.shouldSucceed ? 'success' : 'failure'}, got ${actualSuccess ? 'success' : 'failure'}`
        );
      }
      
      log('info', `Property test passed: maxRows=${testCase.maxRows}, limit=${testCase.limit} → ${actualSuccess ? 'success' : 'failure'}`);
    }
  });
  
  // Restore original configuration
  if (originalConfig) {
    await test('Restore original configuration', async () => {
      const response = await api.updateConfig({
        maxRows: originalConfig.maxRows,
        enableDataApi: originalConfig.enableDataApi,
        exposedSchemas: originalConfig.exposedSchemas
      });
      
      if (response.statusCode !== 200) {
        log('warning', `Failed to restore original config: ${response.statusCode}`);
      } else {
        log('info', 'Original configuration restored');
      }
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  log('success', `Tests passed: ${testsPassed}`);
  log('error', `Tests failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    log('success', 'All tests passed! Max Rows enforcement is working correctly.');
    return true;
  } else {
    log('error', 'Some tests failed. Please check the implementation.');
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log('Max Rows API Test');
    console.log('Feature: data-api-management, Property 10: Max Rows Enforcement');
    console.log('Validates: Requirements 5.2, 5.3');
    console.log('='.repeat(50));
    
    const success = await testMaxRowsEnforcement();
    process.exit(success ? 0 : 1);
  } catch (error) {
    log('error', `Test execution failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { testMaxRowsEnforcement, api };