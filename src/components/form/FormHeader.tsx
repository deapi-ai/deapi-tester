'use client';

import { Loader2, CircleDollarSign, Play } from 'lucide-react';
import { EndpointDefinition } from '@/lib/types';
import { formatCost } from '@/lib/format-utils';
import type { PriceResult } from '@/hooks/usePriceCheck';

interface FormHeaderProps {
  endpoint: EndpointDefinition;
  priceResult: PriceResult | null;
  isCheckingPrice: boolean;
  isSubmitting: boolean;
  onCheckPrice: () => void;
}

/** Endpoint name, method and path, the last price quote, and the form's two actions. */
export function FormHeader({ endpoint, priceResult, isCheckingPrice, isSubmitting, onCheckPrice }: FormHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
      <h3 className="text-sm font-medium text-[var(--text-emphasis)]">{endpoint.name}</h3>
      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[var(--muted)]">
        {endpoint.method}
      </span>
      <span className="text-[10px] font-mono text-[var(--text-faint)]">{endpoint.path}</span>
      {endpoint.isAsync && (
        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">async</span>
      )}
      <div className="flex-1" />

      {priceResult && (
        <span className={`text-xs font-mono ${priceResult.error ? 'text-red-400' : 'text-green-400'}`}>
          {priceResult.error ? priceResult.error : `~$${priceResult.credits}`}
          {!priceResult.error && priceResult.boostCredits !== undefined && (
            <span className="text-purple-300 ml-1" title="Prompt boost is billed separately from the inference">
              + boost ${formatCost(priceResult.boostCredits)}
            </span>
          )}
        </span>
      )}

      {endpoint.hasPriceCalc && (
        <button
          type="button"
          onClick={onCheckPrice}
          disabled={isCheckingPrice || isSubmitting}
          className="bg-[var(--border-strong)] hover:bg-[var(--muted)] disabled:bg-[var(--surface-2)] disabled:cursor-not-allowed rounded px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isCheckingPrice ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <CircleDollarSign className="w-3 h-3" />
              Check Price
            </>
          )}
        </button>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Play className="w-2.5 h-2.5 fill-current" />
            Execute
          </>
        )}
      </button>
    </div>
  );
}
