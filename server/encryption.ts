
import crypto from 'crypto';

// Get encryption key from Replit Secrets or generate a fallback for development
const getEncryptionKey = (): Buffer => {
  if (!process.env.ENCRYPTION_KEY) {
    console.warn('ENCRYPTION_KEY not found in environment variables. Using temporary key for development.');
    return crypto.randomBytes(32);
  }
  
  // Convert hex string from environment to Buffer
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
};

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';

export class DataEncryption {
  static encrypt(text: string): string {
    if (!text) return text;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  static decrypt(encryptedData: string): string {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return encryptedData; // Return as-is if not encrypted or invalid
    }
    
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        // Data might not be encrypted, return as-is
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
      // Return original data if decryption fails (might be unencrypted legacy data)
      return encryptedData;
    }
  }

  static encryptAmount(amount: string): string {
    return this.encrypt(amount);
  }

  static decryptAmount(encryptedAmount: string): string {
    return this.decrypt(encryptedAmount);
  }

  static encryptDescription(description: string): string {
    return this.encrypt(description);
  }

  static decryptDescription(encryptedDescription: string): string {
    return this.decrypt(encryptedDescription);
  }
}
