
import crypto from 'crypto';

// Get encryption key from Replit Secrets or generate a fallback for development
const getEncryptionKey = (): Buffer => {
  if (!process.env.ENCRYPTION_KEY) {
    return crypto.randomBytes(32);
  }
  
  // Convert hex string from environment to Buffer
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
};

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';

export class DataEncryption {
  static encrypt(text: string): string {
    // Encryption disabled - return original text
    return text;
  }

  static decrypt(encryptedData: string): string {
    // Encryption disabled - return original data
    return encryptedData;
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
