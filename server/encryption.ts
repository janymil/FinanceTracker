
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
  private static isEncryptionEnabled(): boolean {
    // Enable encryption in production or when explicitly enabled
    return process.env.NODE_ENV === 'production' || process.env.ENCRYPTION_ENABLED === 'true';
  }

  static encrypt(text: string): string {
    if (!this.isEncryptionEnabled() || !text) {
      return text;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return format: iv:encrypted
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      return text; // Fallback to original text if encryption fails
    }
  }

  static decrypt(encryptedData: string): string {
    if (!this.isEncryptionEnabled() || !encryptedData) {
      return encryptedData;
    }

    try {
      // Check if data is encrypted (contains colon separator)
      if (!encryptedData.includes(':')) {
        return encryptedData; // Return as-is if not encrypted
      }

      const [ivHex, encrypted] = encryptedData.split(':');
      if (!ivHex || !encrypted) {
        return encryptedData; // Return as-is if malformed
      }

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedData; // Return original data if decryption fails
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

  // Utility method to check if data appears to be encrypted
  static isEncrypted(data: string): boolean {
    return data && data.includes(':') && data.split(':').length === 2;
  }

  // Method to get encryption status
  static getEncryptionStatus(): { enabled: boolean; environment: string } {
    return {
      enabled: this.isEncryptionEnabled(),
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
