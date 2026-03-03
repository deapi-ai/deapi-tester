/**
 * Formatting utilities for dates, times, and file sizes
 */

/**
 * Format ISO date string to HH:MM:SS time
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Format ISO date string to relative time (e.g., "5m ago")
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Format bytes to human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format cost/credits for display
 */
export function formatCost(cost: number): string {
  if (cost !== 0 && Math.abs(cost) < 0.000001) {
    return cost.toFixed(10).replace(/\.?0+$/, '');
  }
  return String(cost);
}

/**
 * Determine result type based on endpoint ID
 */
export function getResultType(endpointId: string): 'image' | 'video' | 'audio' | 'other' {
  if (
    endpointId.includes('txt2img') ||
    endpointId.includes('img2img') ||
    endpointId.includes('rmbg') ||
    endpointId.includes('upscale')
  ) {
    return 'image';
  }
  if (endpointId.includes('video')) {
    return 'video';
  }
  if (endpointId.includes('audio') || endpointId.includes('txt2audio') || endpointId.includes('music')) {
    return 'audio';
  }
  return 'other';
}
