/**
 * Check if Authorization header is being sent with API requests
 * 
 * This script intercepts fetch requests to verify the Authorization header
 * Run this in the browser console BEFORE making API requests
 */

console.log('🔍 Authorization Header Checker loaded!');
console.log('This will intercept fetch requests and log Authorization headers');
console.log('');

// Store original fetch
const originalFetch = window.fetch;

// Track requests
const requests = [];

// Intercept fetch
window.fetch = function(...args) {
  const [url, options = {}] = args;
  
  // Log the request
  const headers = options.headers || {};
  const authHeader = headers['Authorization'] || headers['authorization'];
  
  const requestInfo = {
    url: url,
    method: options.method || 'GET',
    hasAuthHeader: !!authHeader,
    authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : null,
    timestamp: new Date().toISOString()
  };
  
  requests.push(requestInfo);
  
  // Log to console
  if (url.includes('/api/')) {
    console.log('📡 API Request:', {
      url: url,
      method: requestInfo.method,
      hasAuthHeader: requestInfo.hasAuthHeader,
      authPreview: requestInfo.authHeader
    });
    
    if (!authHeader) {
      console.warn('⚠️ No Authorization header found!');
    } else {
      console.log('✅ Authorization header present');
    }
  }
  
  // Call original fetch
  return originalFetch.apply(this, args);
};

console.log('✅ Fetch interceptor installed!');
console.log('Now make an API request (e.g., try to create a project)');
console.log('');
console.log('To see all captured requests, run: window.authRequests');

// Make requests accessible
window.authRequests = requests;

// Helper function to check current state
window.checkAuthState = function() {
  console.log('=== Current Auth State ===');
  
  // Check localStorage
  const token = localStorage.getItem('supabase.dashboard.auth.token');
  if (token) {
    try {
      const parsed = JSON.parse(token);
      console.log('✅ Token in localStorage:', {
        hasAccessToken: !!parsed.access_token,
        expiresAt: parsed.expires_at
      });
    } catch (e) {
      console.log('❌ Failed to parse token');
    }
  } else {
    console.log('❌ No token in localStorage');
  }
  
  // Check recent requests
  console.log('');
  console.log('Recent API requests:', requests.slice(-5));
  
  return {
    hasToken: !!token,
    recentRequests: requests.slice(-5)
  };
};

console.log('Run window.checkAuthState() to see current state');
