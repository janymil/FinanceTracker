// Test course API endpoint
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/courses/content',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('Modules found:', parsed.modules?.length || 0);
      if (parsed.modules && parsed.modules.length > 0) {
        console.log('First module:', JSON.stringify(parsed.modules[0], null, 2));
      }
    } catch (e) {
      console.log('Failed to parse JSON:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();