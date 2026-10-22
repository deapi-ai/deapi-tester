'use client';

import { useEffect, useState } from 'react';
import { EndpointDefinition } from '@/lib/types';
import { ProxyRequest } from '@/lib/form-payload';

export interface PriceResult {
  credits: number;
  // Inline boost fee, quoted separately — it is billed outside the job price.
  boostCredits?: number;
  error?: string;
}

interface UsePriceCheckOptions {
  endpoint: EndpointDefinition;
  // The same request Execute would send, marked as a price check.
  buildRequest: () => ProxyRequest;
  // Clears the shown price when it changes (endpoint switch, new prefill).
  resetKey: string;
  // Called after every check: the proxy logs it as a job, success or failure.
  onDone?: () => void;
}

/** The "Check Price" button: quote the current form through the endpoint's /price call. */
export function usePriceCheck({ endpoint, buildRequest, resetKey, onDone }: UsePriceCheckOptions) {
  const [isCheckingPrice, setIsCheckingPrice] = useState(false);
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);

  useEffect(() => {
    setPriceResult(null);
  }, [resetKey]);

  const checkPrice = async () => {
    if (!endpoint.hasPriceCalc) return;

    setIsCheckingPrice(true);
    setPriceResult(null);

    try {
      const { params, formData } = buildRequest();
      const res = formData
        ? await fetch('/api/proxy', { method: 'POST', body: formData })
        : await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });

      const data = await res.json();
      if (!data.success) {
        setPriceResult({ credits: 0, error: data.error || 'Failed to calculate' });
        return;
      }

      // Most price endpoints return { data: { price } }; prompt-enhancement returns
      // top-level { price }. With the inline boost on, the proxy quotes the boost
      // under `_tester` — it is charged on its own, so it is shown as an add-on.
      const price = data.rawResponse?.data?.price ?? data.rawResponse?.price ?? 0;
      const tester = data.rawResponse?._tester as { boost_price?: number; total_price?: number } | undefined;
      setPriceResult({ credits: price, boostCredits: tester?.boost_price || undefined });
    } catch (err) {
      setPriceResult({ credits: 0, error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setIsCheckingPrice(false);
      onDone?.();
    }
  };

  return { isCheckingPrice, priceResult, checkPrice };
}
