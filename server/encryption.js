"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataEncryption = void 0;
const crypto_1 = __importDefault(require("crypto"));
const getEncryptionKey = () => {
    if (!process.env.ENCRYPTION_KEY) {
        console.warn('ENCRYPTION_KEY not found in environment variables. Using temporary key for development.');
        return crypto_1.default.randomBytes(32);
    }
    return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
};
const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';
class DataEncryption {
    static encrypt(text) {
        return text;
    }
    static decrypt(encryptedData) {
        return encryptedData;
    }
    static encryptAmount(amount) {
        return this.encrypt(amount);
    }
    static decryptAmount(encryptedAmount) {
        return this.decrypt(encryptedAmount);
    }
    static encryptDescription(description) {
        return this.encrypt(description);
    }
    static decryptDescription(encryptedDescription) {
        return this.decrypt(encryptedDescription);
    }
}
exports.DataEncryption = DataEncryption;
