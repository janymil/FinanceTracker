import fs from 'fs/promises';
import path from 'path';

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

export class LocalBackupStorage {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
    }
  }

  private async ensureUserDirectory(userId: number): Promise<string> {
    const userDir = path.join(this.baseDir, `user-${userId}`);
    await fs.mkdir(userDir, { recursive: true });
    return userDir;
  }

  async uploadFile(filePath: string, data: string | Buffer): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  async downloadFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.baseDir, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    await fs.unlink(fullPath);
  }

  async listFiles(dirPath = ''): Promise<StorageFileInfo[]> {
    try {
      const fullPath = path.join(this.baseDir, dirPath);
      const files = await fs.readdir(fullPath);
      const fileInfos: StorageFileInfo[] = [];

      for (const file of files) {
        const filePath = path.join(fullPath, file);
        const stats = await fs.stat(filePath);
        
        fileInfos.push({
          ObjectName: file,
          Guid: `${Date.now()}-${Math.random()}`,
          StorageZoneName: 'local',
          Path: path.join(dirPath, file),
          ObjectId: `${Date.now()}`,
          ServerUrl: 'localhost',
          ArrayNumber: 0,
          Size: stats.size,
          UserId: dirPath.split('-')[1] || '0',
          ContentType: 'application/json',
          DateCreated: stats.birthtime.toISOString(),
          LastChanged: stats.mtime.toISOString(),
          ServerId: 1,
          IsDirectory: stats.isDirectory(),
          Checksum: '',
          ReplicatedZones: 'local'
        });
      }

      return fileInfos;
    } catch (error) {
      return [];
    }
  }

  async createBackup(userId: number, backupData: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = `user-${userId}/${filename}`;
    
    const backupContent = JSON.stringify(backupData, null, 2);
    
    await this.uploadFile(filePath, backupContent);
    
    return filename;
  }

  async getUserBackups(userId: number): Promise<StorageFileInfo[]> {
    return await this.listFiles(`user-${userId}`);
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
          await this.deleteFile(`user-${userId}/${backup.ObjectName}`);
          deletedCount++;
        } catch (error) {
        }
      }
    }
    
    return deletedCount;
  }

  async restoreBackup(userId: number, backupFilename: string): Promise<any> {
    const filePath = `user-${userId}/${backupFilename}`;
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

export const localBackupStorage = new LocalBackupStorage();