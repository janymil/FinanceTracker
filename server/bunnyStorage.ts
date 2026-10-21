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
      console.warn('Bunny.net credentials not configured - cloud storage features will be unavailable until configured.');
    }

    this.baseUrl = `https://la.storage.bunnycdn.com/${this.config.storageZone}`;
  }

  private async makeRequest(
    method: string,
    path: string,
    data?: string | Buffer,
    contentType?: string
  ): Promise<any> {
    if (!this.config.storageZone || !this.config.accessKey || !this.config.storagePassword) {
      throw new Error('Bunny.net credentials not properly configured');
    }
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
    try {
      await this.makeRequest('PUT', `/${filePath}`, data, contentType);
    } catch (error) {
      console.error(`Upload failed for ${filePath}:`, error);
      throw error;
    }
  }

  async downloadFile(filePath: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/${filePath}`, {
        method: 'GET',
        headers: {
          'AccessKey': this.config.storagePassword,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Return raw text content for backup files
      return await response.text();
    } catch (error) {
      console.error(`Download failed for ${filePath}:`, error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.makeRequest('DELETE', `/${filePath}`);
  }

  async listFiles(path = ''): Promise<StorageFileInfo[]> {
    try {
      // Try multiple path variations to handle different Bunny.net behaviors
      const pathVariations = [
        `/${path}/`,
        `/${path}`,
        path.endsWith('/') ? `/${path}` : `/${path}/`,
        path
      ];
      
      for (const tryPath of pathVariations) {
        try {
          const result = await this.makeRequest('GET', tryPath);
          
          if (Array.isArray(result)) {
            return result;
          }
          
          // Sometimes Bunny.net returns an object with array inside
          if (result && typeof result === 'object') {
            if (result.data && Array.isArray(result.data)) {
              return result.data;
            }
            if (result.files && Array.isArray(result.files)) {
              return result.files;
            }
            if (result.objects && Array.isArray(result.objects)) {
              return result.objects;
            }
          }
        } catch (pathError: any) {
          console.log(`Path ${tryPath} failed: ${pathError.message}`);
          continue;
        }
      }
      
      return [];
    } catch (error: any) {
      console.log(`Bunny.net request failed for all path variations of ${path}: ${error}`);
      
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
    // Try multiple folder path formats including the actual format used
    const folderVariations = [
      `backups/user-${userId}`,
      `backups/user-${userId}/`,
      `user-${userId}`,
      `${userId}`,
      `backups/${userId}`,
      `backups/user-user_${userId}`,
      `backups/user-user_${userId}/`
    ];
    
    for (const userFolder of folderVariations) {
      console.log(`Checking backup folder: ${userFolder}`);
      const files = await this.listFiles(userFolder);
      console.log(`Found ${files.length} files in ${userFolder}`);
      
      if (files.length > 0) {
        // Filter out directories and only return actual backup files
        const backupFiles = files.filter(file => 
          !file.IsDirectory && 
          (file.ObjectName.includes('backup') || file.ObjectName.includes('.json') || file.ObjectName.endsWith('.json'))
        );
        
        console.log(`Filtered to ${backupFiles.length} backup files in ${userFolder}`);
        
        if (backupFiles.length > 0) {
          console.log(`Returning ${backupFiles.length} backup files from ${userFolder}`);
          return backupFiles.sort((a, b) => new Date(b.DateCreated).getTime() - new Date(a.DateCreated).getTime());
        }
      }
    }
    
    // No backup files found in any folder variation
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
    
    // Handle case where downloadFile returns an object instead of string
    if (typeof backupData === 'object') {
      return backupData;
    }
    
    // Handle string response
    if (typeof backupData === 'string') {
      return JSON.parse(backupData);
    }
    
    throw new Error('Invalid backup data format');
  }

  async getBackupInfo(userId: string | number): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    const backups = await this.getUserBackups(userId);
    console.log(`Calculating backup info for ${backups.length} backups for user ${userId}`);
    
    if (backups.length === 0) {
      console.log(`No backups found for user ${userId}, returning zero values`);
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
      };
    }
    
    // Use Length field from Bunny.net instead of Size, with better fallback
    const totalSize = backups.reduce((sum, backup) => {
      const size = backup.Length || backup.Size || 0;
      console.log(`Backup ${backup.ObjectName}: ${size} bytes (Length: ${backup.Length}, Size: ${backup.Size})`);
      return sum + size;
    }, 0);
    
    console.log(`Total size calculated: ${totalSize} bytes for ${backups.length} backups`);
    
    const sortedBackups = backups.sort((a, b) => 
      new Date(a.DateCreated).getTime() - new Date(b.DateCreated).getTime()
    );
    
    const result = {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: sortedBackups[0]?.DateCreated || null,
      newestBackup: sortedBackups[sortedBackups.length - 1]?.DateCreated || null,
    };
    
    console.log(`Final backup info for user ${userId}:`, result);
    return result;
  }
}

export const bunnyStorage = new BunnyStorage();