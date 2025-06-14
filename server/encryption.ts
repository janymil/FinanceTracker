
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

export class DataEncryption {
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('financial-data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  static decrypt(encryptedData: string): string {
    const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('financial-data'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
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
