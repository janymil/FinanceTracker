// Test encryption system
const crypto = require('crypto');

// Simulate the encryption system
const getEncryptionKey = () => {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('ENCRYPTION_KEY not found in environment variables. Using temporary key for development.');
    return crypto.randomBytes(32);
  }
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
};

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';

class TestDataEncryption {
  static encrypt(text) {
    if (!text) return text;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  static decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return encryptedData;
    }
    
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        return encryptedData;
      }
      
      const [ivHex, encrypted, authTagHex] = parts;
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipherGCM(ALGORITHM, ENCRYPTION_KEY, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedData;
    }
  }
}

// Test the encryption
console.log('Testing encryption system...');
console.log('ENCRYPTION_KEY exists:', !!process.env.ENCRYPTION_KEY);

const testAmount = '123.45';
const testDescription = 'Test Coffee Purchase';

console.log('\nOriginal amount:', testAmount);
const encryptedAmount = TestDataEncryption.encrypt(testAmount);
console.log('Encrypted amount:', encryptedAmount);
const decryptedAmount = TestDataEncryption.decrypt(encryptedAmount);
console.log('Decrypted amount:', decryptedAmount);
console.log('Amount encryption success:', testAmount === decryptedAmount);

console.log('\nOriginal description:', testDescription);
const encryptedDesc = TestDataEncryption.encrypt(testDescription);
console.log('Encrypted description:', encryptedDesc);
const decryptedDesc = TestDataEncryption.decrypt(encryptedDesc);
console.log('Decrypted description:', decryptedDesc);
console.log('Description encryption success:', testDescription === decryptedDesc);

// Test with actual database values
console.log('\nTesting with database values:');
const dbAmount = '4000.00';
const dbDescription = 'Suva daily allowances';

console.log('DB Amount is encrypted:', dbAmount.includes(':'));
console.log('DB Description is encrypted:', dbDescription.includes(':'));