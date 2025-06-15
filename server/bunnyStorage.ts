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
  ObjectId?: string;
  ServerUrl?: string;
  ArrayNumber: number;
  Size?: number; // Legacy field
  Length: number; // Actual field from Bunny.net
  UserId: string;
  ContentType: string;
  DateCreated: string;
  LastChanged: string;
  ServerId: number;
  IsDirectory: boolean;
  Checksum: string;
  ReplicatedZones: string;
  StorageZoneId: number;
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
      console.log(`Attempting to list files at path: ${path}`);
      const result = await this.makeRequest('GET', `/${path}/`);
      console.log(`Bunny.net response for ${path}:`, result);
      return Array.isArray(result) ? result : [];
    } catch (error: any) {
      console.log(`Bunny.net request failed for GET /${path}: ${error}`);
      
      // Try without trailing slash if it failed
      if (path && !error.message.includes('404')) {
        try {
          console.log(`Retrying without trailing slash: ${path}`);
          const result = await this.makeRequest('GET', `/${path}`);
          console.log(`Bunny.net response for ${path} (no slash):`, result);
          return Array.isArray(result) ? result : [];
        } catch (retryError: any) {
          console.log(`Retry also failed: ${retryError}`);
        }
      }
      
      // 404 errors are expected when directory doesn't exist yet
      if (error.message && (error.message.includes('404') || error.message.includes('Object Not Found'))) {
        console.log(`Directory ${path} doesn't exist yet - this is normal for new users`);
        return [];
      }
      console.error(`Failed to list files in ${path}:`, error);
      return [];
    }
  }

  async createBackup(userId: string | number, backupData: any): Promise<string> {
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

  async getUserBackups(userId: string | number): Promise<StorageFileInfo[]> {
    console.log(`Getting backups for user ${userId} from 'backups/user-${userId}' folder`);
    
    // Look directly in the user's backup folder
    const userFolder = `backups/user-${userId}`;
    const files = await this.listFiles(userFolder);
    console.log(`Found ${files.length} files in ${userFolder}`);
    
    if (files.length > 0) {
      console.log(`Backup files for user ${userId}:`, files.map(f => ({ 
        name: f.ObjectName, 
        size: f.Length, 
        date: f.DateCreated,
        isDirectory: f.IsDirectory 
      })));
      
      // Filter out directories and only return actual backup files
      const backupFiles = files.filter(file => 
        !file.IsDirectory && 
        (file.ObjectName.includes('backup') || file.ObjectName.includes('.json'))
      );
      
      console.log(`Found ${backupFiles.length} actual backup files for user ${userId}`);
      return backupFiles;
    }
    
    console.log(`No backup files found in ${userFolder}`);
    return [];
  }

  async cleanupOldBackups(userId: string | number, retentionDays: number): Promise<number> {
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

  async restoreBackup(userId: string | number, backupFilename: string): Promise<any> {
    const filePath = `backups/user-${userId}/${backupFilename}`;
    const backupData = await this.downloadFile(filePath);
    return JSON.parse(backupData);
  }

  async getBackupInfo(userId: string | number): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    const backups = await this.getUserBackups(userId);
    console.log(`Calculating backup info for ${backups.length} backups`);
    
    if (backups.length === 0) {
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }
    
    // Use Length field from Bunny.net instead of Size
    const totalSize = backups.reduce((sum, backup) => {
      const size = backup.Length || backup.Size || 0;
      console.log(`Backup ${backup.ObjectName}: ${size} bytes`);
      return sum + size;
    }, 0);
    
    console.log(`Total size calculated: ${totalSize} bytes`);
    
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