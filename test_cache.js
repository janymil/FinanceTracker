// Test the unified cache system directly
const fetch = require('node-fetch');

async function testCache() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('=== CACHE SYSTEM TEST ===');
  
  try {
    // First call - should miss cache and call Fly.io
    console.log('\n1. First call (should be cache MISS):');
    const start1 = Date.now();
    const response1 = await fetch(`${baseUrl}/api/ai/daily-recommendations`, {
      headers: {
        'Authorization': 'Bearer dummy'
      }
    });
    const time1 = Date.now() - start1;
    const data1 = await response1.text();
    console.log(`Status: ${response1.status}, Time: ${time1}ms`);
    console.log(`Response length: ${data1.length} chars`);
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Second call - should hit cache
    console.log('\n2. Second call (should be cache HIT):');
    const start2 = Date.now();
    const response2 = await fetch(`${baseUrl}/api/ai/daily-recommendations`, {
      headers: {
        'Authorization': 'Bearer dummy'
      }
    });
    const time2 = Date.now() - start2;
    const data2 = await response2.text();
    console.log(`Status: ${response2.status}, Time: ${time2}ms`);
    console.log(`Response length: ${data2.length} chars`);
    
    // Compare times
    console.log(`\n=== RESULTS ===`);
    console.log(`First call: ${time1}ms`);
    console.log(`Second call: ${time2}ms`);
    console.log(`Speed improvement: ${((time1 - time2) / time1 * 100).toFixed(1)}%`);
    console.log(`Cache working: ${time2 < time1 * 0.5 ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testCache();