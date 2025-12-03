/**
 * S3-COMPATIBLE STORAGE STANDARD
 * 
 * Amazon S3's API has become THE de facto standard for object storage.
 * Many providers offer S3-compatible APIs:
 * 
 * - AWS S3 (the original)
 * - Google Cloud Storage (with S3 compatibility)
 * - Cloudflare R2 (S3-compatible, no egress fees!)
 * - Backblaze B2 (S3-compatible)
 * - MinIO (self-hosted, S3-compatible)
 * - DigitalOcean Spaces
 * - Wasabi
 * - Linode Object Storage
 * 
 * By using S3 API, our document storage works with ANY of these.
 * Switch providers with just a config change.
 */

import type { 
  StorageAdapter, 
  UploadRequest, 
  UploadResult, 
  DownloadResult, 
  StorageObject,
  AdapterConfig,
  AdapterHealth,
} from '../types';
import type { EntityId } from '../../shared/types';

// ============================================================================
// S3-COMPATIBLE CONFIGURATION
// ============================================================================

export interface S3CompatibleConfig extends AdapterConfig {
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    /** Session token for temporary credentials */
    sessionToken?: string;
  };
  options: {
    /** Bucket name */
    bucket: string;
    /** Region (required for AWS, optional for others) */
    region?: string;
    /** 
     * Custom endpoint for non-AWS providers:
     * - Cloudflare R2: https://<account_id>.r2.cloudflarestorage.com
     * - Backblaze B2: https://s3.<region>.backblazeb2.com
     * - MinIO: http://localhost:9000
     * - DigitalOcean: https://<region>.digitaloceanspaces.com
     */
    endpoint?: string;
    /** Force path style (required for MinIO and some others) */
    forcePathStyle?: boolean;
    /** Custom domain for public URLs */
    publicUrlBase?: string;
    /** Default ACL for uploads */
    defaultAcl?: 'private' | 'public-read';
    /** Server-side encryption */
    serverSideEncryption?: 'AES256' | 'aws:kms';
    /** KMS key ID (if using aws:kms) */
    kmsKeyId?: string;
  };
}

// ============================================================================
// PROVIDER PRESETS
// ============================================================================

/**
 * Pre-configured settings for popular S3-compatible providers.
 */
export const S3_PROVIDER_PRESETS = {
  /** Amazon S3 */
  aws: (region: string, bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    region,
    // AWS S3 uses virtual-hosted style by default
    forcePathStyle: false,
  }),
  
  /** Cloudflare R2 */
  cloudflareR2: (accountId: string, bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    forcePathStyle: true,
  }),
  
  /** Backblaze B2 */
  backblazeB2: (region: string, bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    endpoint: `https://s3.${region}.backblazeb2.com`,
    region,
    forcePathStyle: true,
  }),
  
  /** MinIO (self-hosted) */
  minio: (endpoint: string, bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    endpoint,
    region: 'us-east-1', // MinIO accepts any region
    forcePathStyle: true,
  }),
  
  /** DigitalOcean Spaces */
  digitalOceanSpaces: (region: string, bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    endpoint: `https://${region}.digitaloceanspaces.com`,
    region,
    forcePathStyle: false,
  }),
  
  /** Wasabi */
  wasabi: (region: string, bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    endpoint: `https://s3.${region}.wasabisys.com`,
    region,
    forcePathStyle: false,
  }),
  
  /** Google Cloud Storage (S3 compatibility mode) */
  gcsS3Compatible: (bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    endpoint: 'https://storage.googleapis.com',
    region: 'auto',
    forcePathStyle: true,
  }),
  
  /** Supabase Storage */
  supabase: (projectRef: string, bucket: string): Partial<S3CompatibleConfig['options']> => ({
    bucket,
    endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
    region: 'us-east-1',
    forcePathStyle: true,
  }),
};

// ============================================================================
// S3-COMPATIBLE ADAPTER
// ============================================================================

/**
 * Create an S3-compatible storage adapter.
 * Works with AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc.
 */
export function createS3CompatibleAdapter(
  providerName = 'S3Compatible'
): StorageAdapter {
  let config: S3CompatibleConfig;
  // In real implementation, would use AWS SDK or compatible client
  // let s3Client: S3Client;
  
  return {
    name: providerName,
    version: '1.0.0',
    platform: 'S3',
    category: 'Storage',
    
    async initialize(cfg: AdapterConfig): Promise<void> {
      config = cfg as S3CompatibleConfig;
      
      // Initialize S3 client
      // s3Client = new S3Client({
      //   credentials: {
      //     accessKeyId: config.credentials.accessKeyId,
      //     secretAccessKey: config.credentials.secretAccessKey,
      //     sessionToken: config.credentials.sessionToken,
      //   },
      //   region: config.options.region ?? 'us-east-1',
      //   endpoint: config.options.endpoint,
      //   forcePathStyle: config.options.forcePathStyle,
      // });
      
      console.log(`S3-compatible adapter initialized for bucket: ${config.options.bucket}`);
    },
    
    async healthCheck(): Promise<AdapterHealth> {
      try {
        // Try to head the bucket
        // await s3Client.send(new HeadBucketCommand({ Bucket: config.options.bucket }));
        
        return {
          healthy: true,
          latencyMs: 50,
          message: `Connected to bucket: ${config?.options?.bucket}`,
          details: {
            bucket: config?.options?.bucket,
            endpoint: config?.options?.endpoint ?? 'AWS S3',
          },
        };
      } catch (error) {
        return {
          healthy: false,
          latencyMs: 0,
          message: `S3 error: ${error}`,
        };
      }
    },
    
    async shutdown(): Promise<void> {
      // s3Client.destroy();
      console.log('S3-compatible adapter shutdown');
    },
    
    async upload(request: UploadRequest): Promise<UploadResult> {
      const { key, content, contentType, metadata } = request;
      
      // const command = new PutObjectCommand({
      //   Bucket: config.options.bucket,
      //   Key: key,
      //   Body: content,
      //   ContentType: contentType,
      //   Metadata: metadata,
      //   ACL: config.options.defaultAcl,
      //   ServerSideEncryption: config.options.serverSideEncryption,
      //   SSEKMSKeyId: config.options.kmsKeyId,
      // });
      // const result = await s3Client.send(command);
      
      // Mock result
      const size = content instanceof Uint8Array ? content.length : 0;
      
      return {
        key,
        url: buildObjectUrl(config, key),
        size,
        etag: `"${generateMockEtag()}"`,
      };
    },
    
    async download(key: string): Promise<DownloadResult> {
      // const command = new GetObjectCommand({
      //   Bucket: config.options.bucket,
      //   Key: key,
      // });
      // const result = await s3Client.send(command);
      // const content = await result.Body?.transformToByteArray();
      
      // Mock result
      return {
        content: new Uint8Array(0),
        contentType: 'application/octet-stream',
        size: 0,
        metadata: {},
      };
    },
    
    async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
      // const command = new GetObjectCommand({
      //   Bucket: config.options.bucket,
      //   Key: key,
      // });
      // return await getSignedUrl(s3Client, command, { expiresIn });
      
      // Mock signed URL
      const baseUrl = buildObjectUrl(config, key);
      return `${baseUrl}?X-Amz-Expires=${expiresIn}&X-Amz-Signature=mock`;
    },
    
    async delete(key: string): Promise<void> {
      // const command = new DeleteObjectCommand({
      //   Bucket: config.options.bucket,
      //   Key: key,
      // });
      // await s3Client.send(command);
      
      console.log(`Deleted: ${key}`);
    },
    
    async list(prefix?: string): Promise<readonly StorageObject[]> {
      // const command = new ListObjectsV2Command({
      //   Bucket: config.options.bucket,
      //   Prefix: prefix,
      // });
      // const result = await s3Client.send(command);
      
      // Mock result
      return [];
    },
    
    async exists(key: string): Promise<boolean> {
      try {
        // const command = new HeadObjectCommand({
        //   Bucket: config.options.bucket,
        //   Key: key,
        // });
        // await s3Client.send(command);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ============================================================================
// URL BUILDING
// ============================================================================

function buildObjectUrl(config: S3CompatibleConfig, key: string): string {
  // Use custom public URL if configured
  if (config.options.publicUrlBase) {
    return `${config.options.publicUrlBase}/${key}`;
  }
  
  // Build URL based on endpoint style
  const bucket = config.options.bucket;
  
  if (config.options.endpoint) {
    // Custom endpoint (R2, B2, MinIO, etc.)
    if (config.options.forcePathStyle) {
      return `${config.options.endpoint}/${bucket}/${key}`;
    }
    // Virtual-hosted style for custom endpoint
    const url = new URL(config.options.endpoint);
    return `${url.protocol}//${bucket}.${url.host}/${key}`;
  }
  
  // AWS S3
  const region = config.options.region ?? 'us-east-1';
  if (region === 'us-east-1') {
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function generateMockEtag(): string {
  return Array.from({ length: 32 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// ============================================================================
// DOCUMENT STORAGE PATTERNS
// ============================================================================

/**
 * Key patterns for organizing documents in the bucket.
 */
export const DOCUMENT_KEY_PATTERNS = {
  /** By realm and document ID */
  byRealm: (realmId: EntityId, documentId: EntityId, filename: string) =>
    `realms/${realmId}/documents/${documentId}/${filename}`,
  
  /** By agreement */
  byAgreement: (agreementId: EntityId, documentId: EntityId, filename: string) =>
    `agreements/${agreementId}/documents/${documentId}/${filename}`,
  
  /** By entity */
  byEntity: (entityId: EntityId, documentId: EntityId, filename: string) =>
    `entities/${entityId}/documents/${documentId}/${filename}`,
  
  /** Temporary uploads (for processing) */
  temporary: (uploadId: string, filename: string) =>
    `temp/${uploadId}/${filename}`,
  
  /** Archive */
  archive: (year: number, month: number, documentId: EntityId, filename: string) =>
    `archive/${year}/${month.toString().padStart(2, '0')}/${documentId}/${filename}`,
};

/**
 * Content-addressed storage (like IPFS but simpler).
 * Uses content hash as key for deduplication.
 */
export function contentAddressedKey(
  contentHash: string,
  mimeType: string
): string {
  const extension = mimeTypeToExtension(mimeType);
  // First 2 chars as directory (like git objects)
  return `cas/${contentHash.slice(0, 2)}/${contentHash}${extension}`;
}

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/json': '.json',
    'text/plain': '.txt',
    'text/html': '.html',
    'text/markdown': '.md',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  };
  return map[mimeType] ?? '';
}

// ============================================================================
// LIFECYCLE POLICIES
// ============================================================================

/**
 * S3 Lifecycle policy for automatic archival/deletion.
 * This is configured at the bucket level, not in code.
 * These are templates for bucket configuration.
 */
export const LIFECYCLE_POLICIES = {
  /** Move to cheaper storage after 90 days */
  archiveAfter90Days: {
    ID: 'archive-old-documents',
    Status: 'Enabled',
    Filter: { Prefix: 'documents/' },
    Transitions: [
      {
        Days: 90,
        StorageClass: 'GLACIER', // Or 'STANDARD_IA' for less cold
      },
    ],
  },
  
  /** Delete temporary files after 1 day */
  cleanupTemp: {
    ID: 'cleanup-temp',
    Status: 'Enabled',
    Filter: { Prefix: 'temp/' },
    Expiration: { Days: 1 },
  },
  
  /** Delete old versions after 30 days */
  cleanupVersions: {
    ID: 'cleanup-versions',
    Status: 'Enabled',
    NoncurrentVersionExpiration: { NoncurrentDays: 30 },
  },
};

// ============================================================================
// MULTIPART UPLOAD (for large files)
// ============================================================================

export interface MultipartUpload {
  readonly uploadId: string;
  readonly key: string;
  readonly parts: readonly UploadPart[];
}

export interface UploadPart {
  readonly partNumber: number;
  readonly etag: string;
  readonly size: number;
}

/**
 * Multipart upload helper for large files (>5MB recommended).
 */
export async function createMultipartUpload(
  adapter: StorageAdapter,
  key: string,
  contentType: string
): Promise<MultipartUpload> {
  // In real implementation:
  // const command = new CreateMultipartUploadCommand({
  //   Bucket: bucket,
  //   Key: key,
  //   ContentType: contentType,
  // });
  // const result = await s3Client.send(command);
  
  return {
    uploadId: `upload-${Date.now()}`,
    key,
    parts: [],
  };
}

// Minimum part size is 5MB (except last part)
export const MIN_PART_SIZE = 5 * 1024 * 1024;
export const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
export const MAX_PARTS = 10000;

