import fetch from 'node-fetch';

interface BunnyStorageConfig {
  storageZone: string;
  accessKey: string;
  storagePassword: string;
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
    };

    if (!this.config.storageZone || !this.config.accessKey || !this.config.storagePassword) {
      throw new Error('Bunny.net credentials not properly configured');
    }

    this.baseUrl = `https://la.storage.bunnycdn.com/${this.config.storageZone}`;
  }

  private async makeRequest(
    method: string,
    path: string,
    data?: string | Buffer,
    contentType?: string
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'AccessKey': this.config.storagePassword,
    };

    if (data) {
      headers['Content-Type'] = contentType || 'application/octet-stream';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bunny.net API error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      if (responseText) {
        try {
          return JSON.parse(responseText);
        } catch {
          return responseText;
        }
      }
      return null;
    } catch (error) {
      console.error(`Bunny.net request failed for ${method} ${path}:`, error);
      throw error;
    }
  }

  async uploadFile(filePath: string, data: string | Buffer, contentType = 'application/json'): Promise<void> {
    await this.makeRequest('PUT', `/${filePath}`, data, contentType);
  }

  async downloadFile(filePath: string): Promise<string> {
    return await this.makeRequest('GET', `/${filePath}`);
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.makeRequest('DELETE', `/${filePath}`);
  }

  async listFiles(path = ''): Promise<StorageFileInfo[]> {
    try {
      const result = await this.makeRequest('GET', `/${path}`);
      return Array.isArray(result) ? result : [];
    } catch (error: any) {
      // 404 errors are expected when directory doesn't exist yet
      if (error.message && (error.message.includes('404') || error.message.includes('Object Not Found'))) {
        console.log(`Directory ${path} doesn't exist yet - this is normal for new users`);
        return [];
      }
      console.error(`Failed to list files in ${path}:`, error);
      return [];
    }
  }

  async createBackup(userId: number, backupData: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = `backups/user-${userId}/${filename}`;
    
    const backupContent = JSON.stringify(backupData, null, 2);
    
    try {
      await this.uploadFile(filePath, backupContent, 'application/json');
      console.log(`Backup created successfully: ${filePath}`);
    } catch (error) {
      console.error(`Failed to create backup ${filePath}:`, error);
      throw error;
    }
    
    return filename;
  }

  async getUserBackups(userId: number): Promise<StorageFileInfo[]> {
    return await this.listFiles(`backups/user-${userId}`);
  }

  async cleanupOldBackups(userId: number, retentionDays: number): Promise<number> {
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
    
    return deletedCount;
  }

  async restoreBackup(userId: number, backupFilename: string): Promise<any> {
    const filePath = `backups/user-${userId}/${backupFilename}`;
    const backupData = await this.downloadFile(filePath);
    return JSON.parse(backupData);
  }

  async getBackupInfo(userId: number): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    const backups = await this.getUserBackups(userId);
    
    if (backups.length === 0) {
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }
    
    const totalSize = backups.reduce((sum, backup) => sum + backup.Size, 0);
    const sortedBackups = backups.sort((a, b) => 
      new Date(a.DateCreated).getTime() - new Date(b.DateCreated).getTime()
    );
    
    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: sortedBackups[0].DateCreated,
      newestBackup: sortedBackups[sortedBackups.length - 1].DateCreated,
    };
  }
}

export const bunnyStorage = new BunnyStorage();