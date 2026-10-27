'use client';

import { useCallback, useEffect, useState } from 'react';
import { EndpointDefinition, JsonValue } from '@/lib/types';
import { INLINE_BOOST_FIELD, supportsInlineBoost } from '@/lib/prompt-enhancement';

/**
 * Inline boost: instead of rewriting the prompt in the form first, the request
 * carries `enhance_prompt: true` and deAPI boosts it as a pre-step of the job.
 * Only a few endpoints accept the flag. The choice is remembered per endpoint.
 */
export function useInlineBoost(endpoint: EndpointDefinition) {
  const canInlineBoost = supportsInlineBoost(endpoint.path);
  const [inlineBoost, setInlineBoost] = useState(false);
  const storageKey = `deapi-inline-boost:${endpoint.id}`;

  useEffect(() => {
    if (!canInlineBoost) {
      setInlineBoost(false);
      return;
    }
    setInlineBoost(localStorage.getItem(storageKey) === '1');
  }, [canInlineBoost, storageKey]);

  const toggleInlineBoost = useCallback(
    (enabled: boolean) => {
      setInlineBoost(enabled);
      localStorage.setItem(storageKey, enabled ? '1' : '0');
    },
    [storageKey]
  );

  // The flag as the API expects it. Laravel's `boolean` rule accepts 1/0 but
  // not the string "true", so multipart requests send "1".
  const inlineBoostPayload = useCallback(
    (contentType: 'json' | 'multipart'): Record<string, JsonValue> =>
      canInlineBoost && inlineBoost ? { [INLINE_BOOST_FIELD]: contentType === 'multipart' ? '1' : true } : {},
    [canInlineBoost, inlineBoost]
  );

  return { canInlineBoost, inlineBoost, toggleInlineBoost, inlineBoostPayload };
}
