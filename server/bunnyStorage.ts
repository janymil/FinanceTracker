import https from 'https';
import { Readable } from 'stream';

interface BunnyStorageConfig {
  storageZone: string;
  accessKey: string;
  storagePassword: string;
  region?: string;
}

interface BackupFile {
  filename: string;
  data: string | Buffer;
  contentType?: string;
}

interface StorageFileInfo {
  ObjectName: string;
  Guid: string;
  StorageZoneName: string;
  Path: string;
  ObjectId: string;
  ServerUrl: string;
  ArrayNumber: number;
  Size: number;
  UserId: string;
  ContentType: string;
  DateCreated: string;
  LastChanged: string;
  ServerId: number;
  IsDirectory: boolean;
  Checksum: string;
  ReplicatedZones: string;
}

export class BunnyStorage {
  private config: BunnyStorageConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      storageZone: process.env.BUNNY_STORAGE_ZONE || '',
      accessKey: process.env.BUNNY_ACCESS_KEY || '',
      storagePassword: process.env.BUNNY_STORAGE_PASSWORD || '',
      region: 'de' // Default to Germany region, can be changed to ny, la, sg, etc.
    };

    if (!this.config.storageZone || !this.config.accessKey || !this.config.storagePassword) {
      throw new Error('Bunny.net credentials not properly configured');
    }

    this.baseUrl = `https://${this.config.region || 'de'}.storage.bunnycdn.com/${this.config.storageZone}`;
  }

  private makeRequest(
    method: string,
    path: string,
    data?: string | Buffer,
    contentType?: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      
      const options = {
        method,
        headers: {
          'AccessKey': this.config.storagePassword,
          'Content-Type': contentType || 'application/json',
          ...(data && { 'Content-Length': Buffer.byteLength(data) })
        }
      };

      const req = https.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = responseData ? JSON.parse(responseData) : {};
              resolve(parsed);
            } catch (e) {
              resolve(responseData);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(data);
      }
      
      req.end();
    });
  }

  async uploadFile(filePath: string, data: string | Buffer, contentType = 'application/json'): Promise<void> {
    try {
      await this.makeRequest('PUT', `/${filePath}`, data, contentType);
      console.log(`Successfully uploaded file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to upload file ${filePath}:`, error);
      throw error;
    }
  }

  async downloadFile(filePath: string): Promise<string> {
    try {
      const data = await this.makeRequest('GET', `/${filePath}`);
      return data;
    } catch (error) {
      console.error(`Failed to download file ${filePath}:`, error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.makeRequest('DELETE', `/${filePath}`);
      console.log(`Successfully deleted file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  async listFiles(path = ''): Promise<StorageFileInfo[]> {
    try {
      const files = await this.makeRequest('GET', `/${path}/`);
      return Array.isArray(files) ? files : [];
    } catch (error) {
      console.error(`Failed to list files in ${path}:`, error);
      return [];
    }
  }

  async createBackup(userId: number, backupData: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backups/user-${userId}/backup-${timestamp}.json`;
    
    const backup = {
      userId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: backupData
    };

    const jsonData = JSON.stringify(backup, null, 2);
    await this.uploadFile(filename, jsonData, 'application/json');
    
    return filename;
  }

  async getUserBackups(userId: number): Promise<StorageFileInfo[]> {
    try {
      const userBackupPath = `backups/user-${userId}`;
      const files = await this.listFiles(userBackupPath);
      
      // Sort by date (newest first)
      return files
        .filter(file => !file.IsDirectory && file.ObjectName.endsWith('.json'))
        .sort((a, b) => new Date(b.DateCreated).getTime() - new Date(a.DateCreated).getTime());
    } catch (error) {
      console.error(`Failed to get backups for user ${userId}:`, error);
      return [];
    }
  }

  async cleanupOldBackups(userId: number, retentionDays: number): Promise<number> {
    try {
      const backups = await this.getUserBackups(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      let deletedCount = 0;
      
      for (const backup of backups) {
        const backupDate = new Date(backup.DateCreated);
        if (backupDate < cutoffDate) {
          try {
            await this.deleteFile(`backups/user-${userId}/${backup.ObjectName}`);
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete old backup ${backup.ObjectName}:`, error);
          }
        }
      }
      
      console.log(`Cleaned up ${deletedCount} old backups for user ${userId}`);
      return deletedCount;
    } catch (error) {
      console.error(`Failed to cleanup backups for user ${userId}:`, error);
      return 0;
    }
  }

  async restoreBackup(userId: number, backupFilename: string): Promise<any> {
    try {
      const backupPath = `backups/user-${userId}/${backupFilename}`;
      const backupData = await this.downloadFile(backupPath);
      
      const parsedBackup = JSON.parse(backupData);
      
      if (parsedBackup.userId !== userId) {
        throw new Error('Backup does not belong to this user');
      }
      
      return parsedBackup.data;
    } catch (error) {
      console.error(`Failed to restore backup ${backupFilename} for user ${userId}:`, error);
      throw error;
    }
  }

  async getBackupInfo(userId: number): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    try {
      const backups = await this.getUserBackups(userId);
      
      const totalSize = backups.reduce((sum, backup) => sum + backup.Size, 0);
      
      return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].DateCreated : null,
        newestBackup: backups.length > 0 ? backups[0].DateCreated : null,
      };
    } catch (error) {
      console.error(`Failed to get backup info for user ${userId}:`, error);
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }
  }
}

// Singleton instance
export const bunnyStorage = new BunnyStorage();