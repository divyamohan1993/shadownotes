import type { StorageStatus } from '../storage';

interface Props {
  status: StorageStatus;
  formatSize: (bytes: number) => string;
}

export function StorageBanner({ status, formatSize }: Props) {
  if (status.level === 'ok') return null;

  const message = status.level === 'critical' || status.level === 'full'
    ? `Storage nearly full (${formatSize(status.usedBytes)}/${formatSize(status.maxBytes)}). Oldest sessions will be auto-rotated.`
    : `Storage: ${formatSize(status.usedBytes)}/${formatSize(status.maxBytes)} used. Consider cleaning old sessions.`;

  return (
    <div className={`storage-banner ${status.level === 'critical' || status.level === 'full' ? 'storage-critical' : 'storage-warning'}`}>
      {'\u26A0'} {message}
    </div>
  );
}
