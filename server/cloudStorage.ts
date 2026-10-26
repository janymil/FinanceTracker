import { log } from './logger';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export interface StorageFileInfo {
  ObjectName: string;
  Guid: string;
  StorageZoneName: string;
  Path: string;
  ArrayNumber: number;
  Length: number;
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

export interface CloudStorageService {
  uploadFile(filePath: string, data: string | Buffer, contentType?: string): Promise<string>;
  downloadFile(filePath: string): Promise<string>;
  /** Raw bytes, for anything that is not text (a receipt photo). */
  downloadBuffer(filePath: string): Promise<{ data: Buffer; contentType: string | null }>;
  deleteFile(filePath: string): Promise<void>;
  listFiles(prefix?: string): Promise<StorageFileInfo[]>;
  createBackup(userId: string | number, backupData: any): Promise<string>;
  getUserBackups(userId: string | number): Promise<StorageFileInfo[]>;
  cleanupOldBackups(userId: string | number, retentionDays: number): Promise<number>;
  restoreBackup(userId: string | number, backupFilename: string): Promise<any>;
  getBackupInfo(userId: string | number): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }>;
  getPublicUrl(filePath: string): string;
}

// -------------------------------------------------------------
// Cloudflare R2 Provider (S3-compatible, 10 GB free, no egress fees)
// -------------------------------------------------------------
export class CloudflareR2Storage implements CloudStorageService {
  private client: S3Client | null = null;
  private bucket: string;
  private publicDomain: string;
  private isConfigured: boolean = false;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    this.bucket = process.env.R2_BUCKET_NAME || '';
    this.publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');

    if (accountId && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
      log.info('✅ Cloudflare R2 Storage initialized for bucket:', this.bucket);
    } else {
      log.warn('⚠️ Cloudflare R2 credentials not fully set in .env');
    }
  }

  public get configured(): boolean {
    return this.isConfigured && this.client !== null;
  }

  private ensureConfigured(): S3Client {
    if (!this.client || !this.isConfigured) {
      throw new Error('Cloudflare R2 storage credentials are not properly configured.');
    }
    return this.client;
  }

  getPublicUrl(filePath: string): string {
    const cleanPath = filePath.replace(/^\/+/, '');
    if (this.publicDomain) {
      const url = this.publicDomain.startsWith('http')
        ? this.publicDomain
        : `https://${this.publicDomain}`;
      return `${url}/${cleanPath}`;
    }
    // Fallback if no custom domain attached yet
    const accountId = process.env.R2_ACCOUNT_ID;
    return `https://${this.bucket}.${accountId}.r2.cloudflarestorage.com/${cleanPath}`;
  }

  async uploadFile(filePath: string, data: string | Buffer, contentType = 'application/json'): Promise<string> {
    const client = this.ensureConfigured();
    const cleanKey = filePath.replace(/^\/+/, '');
    const bodyBuffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
        Body: bodyBuffer,
        ContentType: contentType,
      })
    );

    return this.getPublicUrl(cleanKey);
  }

  async downloadFile(filePath: string): Promise<string> {
    const client = this.ensureConfigured();
    const cleanKey = filePath.replace(/^\/+/, '');

    const response = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      })
    );

    if (!response.Body) {
      throw new Error(`Empty response body from R2 for ${filePath}`);
    }

    if (response.Body instanceof Readable) {
      return new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        (response.Body as Readable).on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        (response.Body as Readable).on('error', (err) => reject(err));
        (response.Body as Readable).on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      });
    }

    // Node 18+ Web ReadableStream fallback
    const byteArray = await (response.Body as any).transformToByteArray();
    return Buffer.from(byteArray).toString('utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    const client = this.ensureConfigured();
    const cleanKey = filePath.replace(/^\/+/, '');

    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      })
    );
  }

  /**
   * The object as bytes. `downloadFile` decodes to UTF-8, which is right for a backup and
   * corrupts a JPEG, so anything binary comes through here.
   */
  async downloadBuffer(filePath: string): Promise<{ data: Buffer; contentType: string | null }> {
    const client = this.ensureConfigured();
    const cleanKey = filePath.replace(/^\/+/, '');

    const response = await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: cleanKey,
      })
    );

    if (!response.Body) {
      throw new Error(`Empty response body from R2 for ${filePath}`);
    }

    const contentType = (response as any).ContentType ?? null;

    if (response.Body instanceof Readable) {
      const data = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        (response.Body as Readable).on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        (response.Body as Readable).on('error', (err) => reject(err));
        (response.Body as Readable).on('end', () => resolve(Buffer.concat(chunks)));
      });
      return { data, contentType };
    }

    const byteArray = await (response.Body as any).transformToByteArray();
    return { data: Buffer.from(byteArray), contentType };
  }

  async listFiles(prefix = ''): Promise<StorageFileInfo[]> {
    const client = this.ensureConfigured();
    const cleanPrefix = prefix.replace(/^\/+/, '');

    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: cleanPrefix,
      })
    );

    if (!response.Contents) {
      return [];
    }

    return response.Contents.map((item) => {
      const fileName = item.Key ? item.Key.split('/').pop() || item.Key : '';
      const dateStr = item.LastModified ? item.LastModified.toISOString() : new Date().toISOString();
      const size = item.Size || 0;

      return {
        ObjectName: fileName,
        Guid: item.ETag ? item.ETag.replace(/"/g, '') : fileName,
        StorageZoneName: this.bucket,
        Path: item.Key || '',
        ArrayNumber: 0,
        Length: size,
        UserId: '',
        ContentType: 'application/octet-stream',
        DateCreated: dateStr,
        LastChanged: dateStr,
        ServerId: 1,
        IsDirectory: false,
        Checksum: item.ETag ? item.ETag.replace(/"/g, '') : '',
        ReplicatedZones: '',
        StorageZoneId: 1,
      };
    });
  }

  async createBackup(userId: string | number, backupData: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = `backups/user-${userId}/${filename}`;
    const backupContent = JSON.stringify(backupData, null, 2);

    await this.uploadFile(filePath, backupContent, 'application/json');
    log.info(`Cloudflare R2: Backup created successfully at ${filePath}`);
    return filename;
  }

  async getUserBackups(userId: string | number): Promise<StorageFileInfo[]> {
    const prefix = `backups/user-${userId}/`;
    try {
      const files = await this.listFiles(prefix);
      const backupFiles = files.filter(
        (f) => f.ObjectName.includes('backup') && f.ObjectName.endsWith('.json')
      );
      return backupFiles.sort(
        (a, b) => new Date(b.DateCreated).getTime() - new Date(a.DateCreated).getTime()
      );
    } catch (error) {
      log.warn(`Cloudflare R2: Error listing backups for user ${userId}:`, error);
      return [];
    }
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
          log.error(`Cloudflare R2: Failed to delete old backup ${backup.ObjectName}:`, error);
        }
      }
    }
    return deletedCount;
  }

  async restoreBackup(userId: string | number, backupFilename: string): Promise<any> {
    const filePath = `backups/user-${userId}/${backupFilename}`;
    const rawContent = await this.downloadFile(filePath);
    return JSON.parse(rawContent);
  }

  async getBackupInfo(userId: string | number): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    const backups = await this.getUserBackups(userId);
    if (backups.length === 0) {
      return { totalBackups: 0, totalSize: 0, oldestBackup: null, newestBackup: null };
    }

    const totalSize = backups.reduce((sum, b) => sum + (b.Length || 0), 0);
    const sorted = backups.sort(
      (a, b) => new Date(a.DateCreated).getTime() - new Date(b.DateCreated).getTime()
    );

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: sorted[0]?.DateCreated || null,
      newestBackup: sorted[sorted.length - 1]?.DateCreated || null,
    };
  }
}

// -------------------------------------------------------------
// Legacy Bunny.net Provider (Kept as fallback if Bunny keys set)
// -------------------------------------------------------------
export class BunnyStorage implements CloudStorageService {
  private config: { storageZone: string; accessKey: string; storagePassword: string; pullzoneUrl: string };
  private baseUrl: string;

  constructor() {
    this.config = {
      storageZone: process.env.BUNNY_STORAGE_ZONE || '',
      accessKey: process.env.BUNNY_ACCESS_KEY || '',
      storagePassword: process.env.BUNNY_STORAGE_PASSWORD || '',
      pullzoneUrl: process.env.BUNNY_PULLZONE_URL || 'https://kaptia.b-cdn.net',
    };
    this.baseUrl = `https://la.storage.bunnycdn.com/${this.config.storageZone}`;
  }

  public get configured(): boolean {
    return Boolean(this.config.storageZone && this.config.accessKey && this.config.storagePassword);
  }

  getPublicUrl(filePath: string): string {
    const cleanKey = filePath.replace(/^\/+/, '');
    return `${this.config.pullzoneUrl.replace(/\/$/, '')}/${cleanKey}`;
  }

  private async makeRequest(method: string, path: string, data?: string | Buffer, contentType?: string): Promise<any> {
    if (!this.configured) {
      throw new Error('Bunny.net credentials not properly configured');
    }
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      AccessKey: this.config.storagePassword,
    };
    if (data) {
      headers['Content-Type'] = contentType || 'application/octet-stream';
    }

    const fetchModule = await import('node-fetch');
    const fetchFn = (fetchModule.default || fetchModule) as any;
    const response = await fetchFn(url, { method, headers, body: data });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bunny.net API error: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return null;
  }

  async uploadFile(filePath: string, data: string | Buffer, contentType = 'application/json'): Promise<string> {
    await this.makeRequest('PUT', `/${filePath.replace(/^\/+/, '')}`, data, contentType);
    return this.getPublicUrl(filePath);
  }

  async downloadFile(filePath: string): Promise<string> {
    if (!this.configured) throw new Error('Bunny.net credentials not configured');
    const fetchModule = await import('node-fetch');
    const fetchFn = (fetchModule.default || fetchModule) as any;
    const response = await fetchFn(`${this.baseUrl}/${filePath.replace(/^\/+/, '')}`, {
      method: 'GET',
      headers: { AccessKey: this.config.storagePassword },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.text();
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.makeRequest('DELETE', `/${filePath.replace(/^\/+/, '')}`);
  }

  /** Raw bytes for anything binary (a receipt photo); `downloadFile` decodes UTF-8. */
  async downloadBuffer(filePath: string): Promise<{ data: Buffer; contentType: string | null }> {
    if (!this.configured) throw new Error('Bunny.net credentials not configured');
    const fetchModule = await import('node-fetch');
    const fetchFn = (fetchModule.default || fetchModule) as any;
    const response = await fetchFn(`${this.baseUrl}/${filePath.replace(/^\/+/, '')}`, {
      method: 'GET',
      headers: { AccessKey: this.config.storagePassword },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return {
      data: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type'),
    };
  }

  async listFiles(path = ''): Promise<StorageFileInfo[]> {
    try {
      const cleanPath = path.replace(/^\/+/, '');
      const result = await this.makeRequest('GET', `/${cleanPath}/`);
      if (Array.isArray(result)) return result;
      return [];
    } catch {
      return [];
    }
  }

  async createBackup(userId: string | number, backupData: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = `backups/user-${userId}/${filename}`;
    const backupContent = JSON.stringify(backupData, null, 2);
    await this.uploadFile(filePath, backupContent, 'application/json');
    return filename;
  }

  async getUserBackups(userId: string | number): Promise<StorageFileInfo[]> {
    const files = await this.listFiles(`backups/user-${userId}`);
    return files
      .filter((file) => !file.IsDirectory && file.ObjectName.endsWith('.json'))
      .sort((a, b) => new Date(b.DateCreated).getTime() - new Date(a.DateCreated).getTime());
  }

  async cleanupOldBackups(userId: string | number, retentionDays: number): Promise<number> {
    const backups = await this.getUserBackups(userId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    let deletedCount = 0;
    for (const backup of backups) {
      if (new Date(backup.DateCreated) < cutoffDate) {
        await this.deleteFile(`backups/user-${userId}/${backup.ObjectName}`);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async restoreBackup(userId: string | number, backupFilename: string): Promise<any> {
    const filePath = `backups/user-${userId}/${backupFilename}`;
    const content = await this.downloadFile(filePath);
    return JSON.parse(content);
  }

  async getBackupInfo(userId: string | number): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    const backups = await this.getUserBackups(userId);
    if (backups.length === 0) {
      return { totalBackups: 0, totalSize: 0, oldestBackup: null, newestBackup: null };
    }
    const totalSize = backups.reduce((sum, b) => sum + (b.Length || 0), 0);
    const sorted = backups.sort((a, b) => new Date(a.DateCreated).getTime() - new Date(b.DateCreated).getTime());
    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: sorted[0]?.DateCreated || null,
      newestBackup: sorted[sorted.length - 1]?.DateCreated || null,
    };
  }
}

// -------------------------------------------------------------
// Unified Storage Dispatcher
// Automatically prefers Cloudflare R2 if R2 env vars are present,
// falls back to Bunny.net if present.
// -------------------------------------------------------------
function getPrimaryStorage(): CloudStorageService {
  const r2 = new CloudflareR2Storage();
  if (r2.configured) {
    return r2;
  }

  const bunny = new BunnyStorage();
  if (bunny.configured) {
    return bunny;
  }

  // Return R2 instance as default (graceful error messages when called)
  return r2;
}

export const cloudStorage: CloudStorageService = getPrimaryStorage();
// Backwards compatibility alias
export const bunnyStorage = cloudStorage;
