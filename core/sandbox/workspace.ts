/**
 * WORKSPACE - Full Development Environment
 * 
 * A workspace is a complete development environment with:
 * - Git repositories
 * - Files (auto-saved, versioned)
 * - Functions
 * - Execution history
 * 
 * Everything is event-sourced:
 * - File changes → Events (immutable, versioned)
 * - Git operations → Events
 * - Executions → Events
 * 
 * File versioning:
 * - Every change creates a FileModified event
 * - Events stored in Event Store (DB)
 * - File content stored in Storage (S3)
 * - Content-addressed (hash = identity)
 */

import type { EntityId, Timestamp, ActorReference, Hash } from '../shared/types';
import type { Event } from '../schema/ledger';

// ============================================================================
// WORKSPACE AGGREGATE
// ============================================================================

export interface Workspace {
  readonly id: EntityId;
  readonly realmId: EntityId;
  
  // Identity
  readonly name: string;
  readonly description?: string;
  
  // Configuration
  readonly runtime: WorkspaceRuntime;
  readonly resources: WorkspaceResources;
  
  // Security
  readonly allowedImports: readonly string[];
  readonly blockedImports: readonly string[];
  readonly allowedGitHosts: readonly string[];
  readonly environmentVariables: Record<string, string>;
  
  // Contents
  readonly repositories: readonly RepositoryReference[];
  readonly files: readonly FileReference[];
  readonly functions: readonly EntityId[];
  
  // State
  readonly status: WorkspaceStatus;
  readonly version: number;
  readonly createdAt: Timestamp;
  readonly createdBy: ActorReference;
  readonly lastActivityAt: Timestamp;
}

export type WorkspaceRuntime = 'Node.js' | 'Python' | 'Deno' | 'WebAssembly' | 'Multi';

export interface WorkspaceResources {
  readonly cpuLimit: number;      // CPU cores
  readonly memoryLimit: number;   // MB
  readonly storageLimit: number;  // GB
  readonly timeoutMs: number;     // Max execution time
  readonly networkAccess: boolean;
  readonly gitAccess: boolean;
}

export type WorkspaceStatus = 'Active' | 'Suspended' | 'Terminated';

export interface RepositoryReference {
  readonly id: EntityId;
  readonly url: string;
  readonly branch: string;
  readonly commit: string;
  readonly localPath: string;
  readonly clonedAt: Timestamp;
  readonly lastPulledAt?: Timestamp;
}

export interface FileReference {
  readonly id: EntityId;
  readonly filename: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly contentHash: Hash;
  readonly version: number;
  readonly uploadedAt: Timestamp;
  readonly uploadedBy: ActorReference;
  readonly lastModifiedAt: Timestamp;
  readonly lastModifiedBy: ActorReference;
}

// ============================================================================
// WORKSPACE EVENTS
// ============================================================================

/**
 * WorkspaceCreated - Initial workspace creation
 */
export interface WorkspaceCreated extends Event {
  readonly type: 'WorkspaceCreated';
  readonly payload: {
    readonly name: string;
    readonly description?: string;
    readonly runtime: WorkspaceRuntime;
    readonly resources: WorkspaceResources;
    readonly createdBy: ActorReference;
  };
}

/**
 * FileUploaded - New file uploaded
 */
export interface FileUploaded extends Event {
  readonly type: 'FileUploaded';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly fileId: EntityId;
    readonly filename: string;
    readonly path: string;
    readonly sizeBytes: number;
    readonly contentHash: Hash;
    readonly storageLocation: string;
    readonly uploadedBy: ActorReference;
  };
}

/**
 * FileModified - File changed (auto-saved)
 * This is the versioning event - every change creates a new version
 */
export interface FileModified extends Event {
  readonly type: 'FileModified';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly fileId: EntityId;
    readonly previousVersionId: EntityId;  // Links to previous version
    readonly path: string;
    readonly sizeBytes: number;
    readonly contentHash: Hash;  // New content hash
    readonly storageLocation: string;
    readonly changes?: FileChanges;
    readonly modifiedBy: ActorReference;
  };
}

export interface FileChanges {
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly diff?: string;  // Optional: unified diff
}

/**
 * FileDeleted - File removed
 */
export interface FileDeleted extends Event {
  readonly type: 'FileDeleted';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly fileId: EntityId;
    readonly path: string;
    readonly deletedBy: ActorReference;
    readonly reason?: string;
  };
}

/**
 * RepositoryCloned - Git repo cloned
 */
export interface RepositoryCloned extends Event {
  readonly type: 'RepositoryCloned';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly repositoryId: EntityId;
    readonly url: string;
    readonly branch: string;
    readonly commit: string;
    readonly localPath: string;
    readonly clonedBy: ActorReference;
  };
}

/**
 * RepositoryPulled - Git repo updated
 */
export interface RepositoryPulled extends Event {
  readonly type: 'RepositoryPulled';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly repositoryId: EntityId;
    readonly fromCommit: string;
    readonly toCommit: string;
    readonly branch: string;
    readonly pulledBy: ActorReference;
  };
}

/**
 * RepositoryPushed - Changes pushed to remote
 */
export interface RepositoryPushed extends Event {
  readonly type: 'RepositoryPushed';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly repositoryId: EntityId;
    readonly branch: string;
    readonly commit: string;
    readonly pushedBy: ActorReference;
  };
}

/**
 * FunctionExecuted - Code execution
 */
export interface FunctionExecuted extends Event {
  readonly type: 'FunctionExecuted';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly functionId: EntityId;
    readonly input: unknown;
    readonly output: unknown;
    readonly error?: ExecutionError;
    readonly resources: ResourceUsage;
    readonly executedBy: ActorReference;
    readonly agreementId: EntityId;
    readonly logs: readonly string[];
  };
}

export interface ExecutionError {
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
}

export interface ResourceUsage {
  readonly cpuTimeMs: number;
  readonly memoryPeakMB: number;
  readonly durationMs: number;
}

/**
 * WorkspaceExported - Export created
 */
export interface WorkspaceExported extends Event {
  readonly type: 'WorkspaceExported';
  readonly payload: {
    readonly workspaceId: EntityId;
    readonly exportId: EntityId;
    readonly format: 'zip' | 'tar' | 'json';
    readonly contents: readonly string[];
    readonly exportedBy: ActorReference;
    readonly downloadUrl: string;
    readonly expiresAt: Timestamp;
  };
}

// ============================================================================
// FILE VERSIONING
// ============================================================================

/**
 * File version chain - reconstructed from events
 */
export interface FileVersion {
  readonly version: number;
  readonly eventId: EntityId;
  readonly timestamp: Timestamp;
  readonly contentHash: Hash;
  readonly sizeBytes: number;
  readonly modifiedBy: ActorReference;
  readonly changes?: FileChanges;
  readonly previousVersionId?: EntityId;
}

/**
 * Get file version history by querying events
 */
export async function getFileVersions(
  eventStore: import('../store/event-store').EventStore,
  fileId: EntityId
): Promise<readonly FileVersion[]> {
  const versions: FileVersion[] = [];
  
  // Query all events for this file
  for await (const event of eventStore.getByAggregate('File' as any, fileId)) {
    if (event.type === 'FileUploaded') {
      versions.push({
        version: 1,
        eventId: event.id,
        timestamp: event.timestamp,
        contentHash: event.payload.contentHash,
        sizeBytes: event.payload.sizeBytes,
        modifiedBy: event.payload.uploadedBy,
      });
    } else if (event.type === 'FileModified') {
      const prevVersion = versions[versions.length - 1];
      versions.push({
        version: prevVersion ? prevVersion.version + 1 : 1,
        eventId: event.id,
        timestamp: event.timestamp,
        contentHash: event.payload.contentHash,
        sizeBytes: event.payload.sizeBytes,
        modifiedBy: event.payload.modifiedBy,
        changes: event.payload.changes,
        previousVersionId: event.payload.previousVersionId,
      });
    }
  }
  
  return versions;
}

/**
 * Get file at specific version
 */
export async function getFileAtVersion(
  eventStore: import('../store/event-store').EventStore,
  fileId: EntityId,
  version: number
): Promise<FileVersion | null> {
  const versions = await getFileVersions(eventStore, fileId);
  return versions.find(v => v.version === version) || null;
}

