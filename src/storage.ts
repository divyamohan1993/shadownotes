import type { VaultDB } from './vault';

export type StorageLevel = 'ok' | 'warning' | 'critical' | 'full';

export interface StorageStatus {
  level: StorageLevel;
  usedBytes: number;
  maxBytes: number;
  usedPercent: number;
}

export class StorageManager {
  constructor(private db: VaultDB) {}

  async getStatus(): Promise<StorageStatus> {
    const usedBytes = await this.db.getTotalSize();
    const maxBytes = await this.db.getMaxSize();
    const usedPercent = maxBytes > 0 ? (usedBytes / maxBytes) * 100 : 0;
    let level: StorageLevel;
    if (usedPercent >= 100) level = 'full';
    else if (usedPercent >= 90) level = 'critical';
    else if (usedPercent >= 75) level = 'warning';
    else level = 'ok';
    return { level, usedBytes, maxBytes, usedPercent };
  }

  async rotateIfNeeded(excludeSessionId?: string): Promise<number> {
    const maxBytes = await this.db.getMaxSize();
    let totalSize = await this.db.getTotalSize();
    if (totalSize <= maxBytes) return 0;
    const target = maxBytes * 0.95;
    const sessions = await this.db.getOldestSessions();
    let rotated = 0;
    for (const session of sessions) {
      if (totalSize <= target) break;
      if (session.id === excludeSessionId) continue;
      await this.db.deleteSession(session.id);
      totalSize -= session.sizeBytes;
      rotated++;
    }
    return rotated;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
