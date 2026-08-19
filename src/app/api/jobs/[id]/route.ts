import { loadConfig } from '@/lib/config';
import { updateJob, getJobByRequestId } from '@/lib/storage';
import { Job } from '@/lib/types';

// deAPI reports what a request actually cost on the job status, but only once
// the request is terminal (`price` is null while it runs). For partner models
// the charge settles after inference, so `is_estimated` can still be true —
// keep the flag so the UI can mark the figure as not final.
function readFinalPrice(data: Record<string, unknown> | undefined): Job['finalPrice'] {
  const price = data?.price as { amount?: unknown; is_estimated?: unknown } | null | undefined;
  if (!price || typeof price.amount !== 'number') return undefined;
  return { amount: price.amount, isEstimated: price.is_estimated === true };
}

// Inline prompt booster (`enhance_prompt`) outcome. `prompt_boost` is non-null
// only once the boost has actually run.
function readPromptBoost(data: Record<string, unknown> | undefined): Job['promptBoost'] {
  const boost = data?.prompt_boost as Record<string, unknown> | null | undefined;
  if (!boost) return undefined;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    prompt: str(boost.prompt),
    promptOriginal: str(boost.prompt_original),
    negativePrompt: str(boost.negative_prompt),
    negativePromptOriginal: str(boost.negative_prompt_original),
  };
}

// GET /api/jobs/[id] - One-shot job status fetch + persist.
//
// This is the reconciliation/fallback layer behind the WebSocket: the client
// calls it on a slow interval (fallbackPollIntervalMs) for active jobs, and
// immediately when the socket reports "done". It fetches deAPI /jobs/{id},
// persists the result to history, and returns the raw deAPI payload so the UI
// can render status / progress / preview / result_url.
//
// Failures (`error`) only ever arrive here — deAPI delivers them via webhooks,
// never over the WebSocket — so this poll is what surfaces failed jobs.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params;
  const config = loadConfig();

  if (!config.apiToken) {
    return new Response(JSON.stringify({ error: 'API token not configured' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = `${config.apiUrl.replace(/\/$/, '')}/jobs/${requestId}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Persist to history. deAPI status values: pending, processing, done, error.
    const job = getJobByRequestId(requestId);
    if (job) {
      const status = data.data?.status || data.status;
      // Price and boost details ride along with every status payload; they are
      // only populated once the request is terminal.
      const finalPrice = readFinalPrice(data.data);
      const promptBoost = readPromptBoost(data.data);
      const boostFields: Partial<Job> = {};
      if (finalPrice) boostFields.finalPrice = finalPrice;
      if (data.data?.prompt_boosted !== undefined) {
        boostFields.promptBoosted = data.data.prompt_boosted === true;
      }
      if (promptBoost) boostFields.promptBoost = promptBoost;

      if (status === 'done') {
        const updateData: Record<string, unknown> = {
          status: 'completed',
          rawResponse: data,
          resultUrl: data.data?.result_url,
          completedAt: new Date().toISOString(),
          ...boostFields,
        };
        if (data.data?.cost_credits !== undefined) {
          updateData.costCredits = data.data.cost_credits;
        }
        updateJob(job.id, updateData);
      } else if (status === 'error') {
        // v2 reports failures via error_message / error_code (not "error").
        updateJob(job.id, {
          status: 'failed',
          rawResponse: data,
          error:
            data.data?.error_message ||
            data.data?.error ||
            data.error ||
            (data.data?.error_code ? `Error: ${data.data.error_code}` : undefined),
          completedAt: new Date().toISOString(),
          ...boostFields,
        });
      } else {
        // A queued job (pending/in_queue/waiting) stays 'pending' (waiting) — it
        // only becomes 'processing' once a worker actually starts. This keeps the
        // fallback poll consistent with the WebSocket path.
        const jobStatus =
          status === 'pending' ||
          status === 'queued' ||
          status === 'in_queue' ||
          status === 'waiting'
            ? 'pending'
            : 'processing';
        updateJob(job.id, {
          status: jobStatus,
          rawResponse: data,
          ...boostFields,
        });
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
