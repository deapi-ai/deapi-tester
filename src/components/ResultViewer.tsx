'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Loader2, Check, Download } from 'lucide-react';
import { JsonValue } from '@/lib/types';

interface ResultViewerProps {
  resultUrl: string | null;
  resultData: JsonValue | null;
  endpointId: string;
  jobId: string | null;
}

type ResultType = 'image' | 'video' | 'audio' | 'text' | 'json';

export function ResultViewer({ resultUrl, resultData, endpointId, jobId }: ResultViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  if (!resultUrl && !resultData) {
    return null;
  }

  const getResultType = (): ResultType => {
    if (endpointId.includes('2txt') || endpointId.includes('ocr')) {
      return 'text';
    }
    if (endpointId.includes('video') || endpointId.startsWith('vid-')) {
      return 'video';
    }
    if (endpointId.includes('txt2img') || endpointId.includes('img2img') || endpointId.includes('rmbg') || endpointId.includes('upscale')) {
      return 'image';
    }
    if (endpointId.includes('audio') || endpointId.includes('txt2audio')) {
      return 'audio';
    }
    return 'json';
  };

  const resultType = getResultType();

  const handleDownload = async () => {
    if (!resultUrl) return;

    setIsDownloading(true);
    setDownloadStatus(null);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, resultUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Download failed');
      }

      setDownloadStatus(data.filename);
    } catch (err) {
      setDownloadStatus(`Error: ${err instanceof Error ? err.message : 'Download failed'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderResult = () => {
    switch (resultType) {
      case 'image':
        return resultUrl ? (
          <div className="flex items-center justify-center bg-[var(--surface-inset)] rounded-lg p-2 min-h-[200px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="Generated result"
              className="max-w-full max-h-[400px] rounded object-contain"
            />
          </div>
        ) : null;

      case 'video':
        return resultUrl ? (
          <div className="flex items-center justify-center bg-[var(--surface-inset)] rounded-lg p-2">
            <video
              src={resultUrl}
              controls
              className="max-w-full max-h-[400px] rounded"
            />
          </div>
        ) : null;

      case 'audio':
        return resultUrl ? (
          <div className="bg-[var(--surface-inset)] rounded-lg p-4">
            <audio src={resultUrl} controls className="w-full" />
          </div>
        ) : null;

      case 'text':
        const textContent = typeof resultData === 'string'
          ? resultData
          : typeof resultData === 'object' && resultData !== null && 'text' in resultData
          ? String((resultData as { text: unknown }).text)
          : JSON.stringify(resultData, null, 2);

        return (
          <div className="relative">
            <pre className="bg-[var(--surface-inset)] rounded-lg p-3 text-xs font-mono text-[var(--text-primary)] whitespace-pre-wrap max-h-[400px] overflow-auto">
              {textContent}
            </pre>
            <button
              onClick={() => copyToClipboard(textContent)}
              className="absolute top-2 right-2 p-1.5 bg-[var(--surface-2)] hover:bg-[var(--border-strong)] rounded text-[var(--text-secondary)] hover:text-[var(--text-emphasis)] transition-colors"
              title="Copy"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        );

      case 'json':
      default:
        const jsonContent = JSON.stringify(resultData || resultUrl, null, 2);
        return (
          <div className="relative">
            <pre className="bg-[var(--surface-inset)] rounded-lg p-3 text-[11px] font-mono text-[var(--text-secondary)] max-h-[400px] overflow-auto">
              {jsonContent}
            </pre>
            <button
              onClick={() => copyToClipboard(jsonContent)}
              className="absolute top-2 right-2 p-1.5 bg-[var(--surface-2)] hover:bg-[var(--border-strong)] rounded text-[var(--text-secondary)] hover:text-[var(--text-emphasis)] transition-colors"
              title="Copy"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Result</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[var(--muted)] capitalize">{resultType}</span>
        </div>

        {resultUrl && (resultType === 'image' || resultType === 'video' || resultType === 'audio') && (
          <div className="flex items-center gap-1">
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`p-1.5 rounded transition-colors ${
                downloadStatus && !downloadStatus.startsWith('Error')
                  ? 'text-green-400 bg-green-900/20'
                  : 'text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
              }`}
              title={downloadStatus || 'Save to output folder'}
            >
              {isDownloading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : downloadStatus && !downloadStatus.startsWith('Error') ? (
                <Check className="w-3 h-3" />
              ) : (
                <Download className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {renderResult()}

        {downloadStatus && (
          <p className={`mt-2 text-[10px] font-mono ${downloadStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {downloadStatus.startsWith('Error') ? downloadStatus : `Saved: ${downloadStatus}`}
          </p>
        )}
      </div>
    </div>
  );
}
