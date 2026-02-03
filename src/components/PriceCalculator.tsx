'use client';

import { useState } from 'react';
import { EndpointDefinition, JsonValue } from '@/lib/types';

interface PriceCalculatorProps {
  endpoint: EndpointDefinition;
  params: Record<string, JsonValue>;
}

interface PriceResult {
  estimated_credits?: number;
  details?: string;
}

export function PriceCalculator({ endpoint, params }: PriceCalculatorProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [price, setPrice] = useState<PriceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only show if endpoint supports price calculation
  if (!endpoint.hasPriceCalc || !endpoint.priceCalcPath) {
    return null;
  }

  const calculatePrice = async () => {
    setIsCalculating(true);
    setError(null);
    setPrice(null);

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          _endpointId: endpoint.id,
          _priceCalc: true,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to calculate price');
      }

      // Extract price from response
      const responseData = data.rawResponse?.data || data.rawResponse;
      setPrice({
        estimated_credits: responseData?.estimated_credits || responseData?.cost,
        details: responseData?.details || responseData?.breakdown,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate price');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={calculatePrice}
        disabled={isCalculating}
        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
      >
        {isCalculating ? 'Calculating...' : 'Calculate Price'}
      </button>

      {price && (
        <span className="text-sm text-green-400">
          ~{price.estimated_credits?.toFixed(4) || '?'} credits
          {price.details && (
            <span className="text-zinc-500 ml-2">({price.details})</span>
          )}
        </span>
      )}

      {error && (
        <span className="text-sm text-red-400">{error}</span>
      )}
    </div>
  );
}
