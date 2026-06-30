import { loadConfig } from '@/lib/config';
import { updateJob, getJobByRequestId } from '@/lib/storage';

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
      if (status === 'done') {
        const updateData: Record<string, unknown> = {
          status: 'completed',
          rawResponse: data,
          resultUrl: data.data?.result_url,
          completedAt: new Date().toISOString(),
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
        });
      } else {
        updateJob(job.id, {
          status: 'processing',
          rawResponse: data,
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
