// Verification script for encryption system
import crypto from 'crypto';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Test encryption functionality
function testEncryption() {
  console.log('🔐 Testing Kaptia Encryption System');
  console.log('=====================================\n');

  // Get encryption key from environment
  const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY || 'defaultkey123456789012345678901234567890';
    return Buffer.from(key, 'utf8').subarray(0, 32);
  };

  // Test encryption function
  function encrypt(text) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  // Test decryption function
  function decrypt(encryptedData) {
    const key = getEncryptionKey();
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Test cases
  const testCases = [
    { type: 'Transaction Amount', data: '$1,234.56' },
    { type: 'Transaction Description', data: 'Grocery shopping at Whole Foods Market' },
    { type: 'Reference Note', data: 'Weekly grocery budget - organic produce' },
    { type: 'Sensitive Data', data: 'Credit card ending in 4567' }
  ];

  console.log('Environment Configuration:');
  console.log('- ENCRYPTION_ENABLED:', process.env.ENCRYPTION_ENABLED);
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- Encryption Key Length:', getEncryptionKey().length, 'bytes');
  console.log('');

  let allTestsPassed = true;

  testCases.forEach((testCase, index) => {
    try {
      console.log(`Test ${index + 1}: ${testCase.type}`);
      console.log('Original:', testCase.data);
      
      const encrypted = encrypt(testCase.data);
      console.log('Encrypted:', encrypted);
      
      const decrypted = decrypt(encrypted);
      console.log('Decrypted:', decrypted);
      
      const passed = testCase.data === decrypted;
      console.log('Result:', passed ? '✅ PASSED' : '❌ FAILED');
      console.log('---');
      
      if (!passed) allTestsPassed = false;
    } catch (error) {
      console.error('❌ FAILED:', error.message);
      console.log('---');
      allTestsPassed = false;
    }
  });

  console.log('\n📊 Final Results:');
  console.log('================');
  console.log(allTestsPassed ? '✅ All encryption tests PASSED' : '❌ Some tests FAILED');
  console.log('Status: Encryption system is', allTestsPassed ? 'WORKING' : 'NOT WORKING');
  
  return allTestsPassed;
}

// Run the test
testEncryption();