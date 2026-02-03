import { loadConfig } from '@/lib/config';
import { updateJob, getJobByRequestId } from '@/lib/storage';

// GET /api/poll/[id] - SSE stream for job status polling
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params;
  const config = loadConfig();

  if (!config.apiToken) {
    return new Response(
      JSON.stringify({ error: 'API token not configured' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let attempts = 0;
      const maxAttempts = config.maxPollingAttempts || 120;
      const interval = config.pollingIntervalMs || 2000;

      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        while (attempts < maxAttempts) {
          attempts++;

          // Fetch status from deAPI
          const resultUrl = `${config.apiUrl.replace(/\/$/, '')}/request-status/${requestId}`;
          const response = await fetch(resultUrl, {
            headers: {
              'Authorization': `Bearer ${config.apiToken}`,
              'Accept': 'application/json',
            },
          });

          const data = await response.json();

          // Send status update
          sendEvent({
            attempt: attempts,
            maxAttempts,
            ...data,
          });

          // Update job in storage
          // deAPI status values: "pending", "processing", "done", "error"
          const job = getJobByRequestId(requestId);
          if (job) {
            const status = data.data?.status || data.status;
            if (status === 'done') {
              // Only update costCredits if API returns it, otherwise keep the estimated price
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
              updateJob(job.id, {
                status: 'failed',
                rawResponse: data,
                error: data.data?.error || data.error,
                completedAt: new Date().toISOString(),
              });
            } else {
              updateJob(job.id, {
                status: 'processing',
                rawResponse: data,
              });
            }
          }

          // Check if job is done (deAPI returns "done" or "error")
          const status = data.data?.status || data.status;
          if (status === 'done' || status === 'error') {
            controller.close();
            return;
          }

          // Wait before next poll
          await new Promise(resolve => setTimeout(resolve, interval));
        }

        // Timeout
        sendEvent({
          status: 'timeout',
          message: `Polling timed out after ${maxAttempts} attempts`,
        });
        controller.close();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendEvent({
          status: 'error',
          error: errorMessage,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
