'use client';

import { useState } from 'react';
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
    if (endpointId.includes('txt2img') || endpointId.includes('img2img') || endpointId.includes('rmbg') || endpointId.includes('upscale')) {
      return 'image';
    }
    if (endpointId.includes('video')) {
      return 'video';
    }
    if (endpointId.includes('audio') || endpointId.includes('txt2audio')) {
      return 'audio';
    }
    if (endpointId.includes('2txt') || endpointId.includes('ocr')) {
      return 'text';
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
          <div className="flex items-center justify-center bg-zinc-950 rounded-lg p-2 min-h-[200px]">
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
          <div className="flex items-center justify-center bg-zinc-950 rounded-lg p-2">
            <video
              src={resultUrl}
              controls
              className="max-w-full max-h-[400px] rounded"
            />
          </div>
        ) : null;

      case 'audio':
        return resultUrl ? (
          <div className="bg-zinc-950 rounded-lg p-4">
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
            <pre className="bg-zinc-950 rounded-lg p-3 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-[400px] overflow-auto">
              {textContent}
            </pre>
            <button
              onClick={() => copyToClipboard(textContent)}
              className="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copy"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="5" width="9" height="9" rx="1" />
                <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
              </svg>
            </button>
          </div>
        );

      case 'json':
      default:
        const jsonContent = JSON.stringify(resultData || resultUrl, null, 2);
        return (
          <div className="relative">
            <pre className="bg-zinc-950 rounded-lg p-3 text-[11px] font-mono text-zinc-400 max-h-[400px] overflow-auto">
              {jsonContent}
            </pre>
            <button
              onClick={() => copyToClipboard(jsonContent)}
              className="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copy"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="5" width="9" height="9" rx="1" />
                <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
              </svg>
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
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Result</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500 capitalize">{resultType}</span>
        </div>

        {resultUrl && (resultType === 'image' || resultType === 'video' || resultType === 'audio') && (
          <div className="flex items-center gap-1">
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
              title="Open in new tab"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8V14H2V4h6M10 2h4v4M16 0L8 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`p-1.5 rounded transition-colors ${
                downloadStatus && !downloadStatus.startsWith('Error')
                  ? 'text-green-400 bg-green-900/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title={downloadStatus || 'Save to output folder'}
            >
              {isDownloading ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                  <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
                </svg>
              ) : downloadStatus && !downloadStatus.startsWith('Error') ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 8l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 2v8M4 7l4 4 4-4M2 12v2h12v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
