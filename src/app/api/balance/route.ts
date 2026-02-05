import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { addJob, generateJobId, updateJob } from '@/lib/storage';
import { Job } from '@/lib/types';

// Force dynamic to prevent caching - config can change
export const dynamic = 'force-dynamic';

// GET /api/balance - Proxy to deAPI /balance endpoint
export async function GET(request: Request) {
  // Check if job creation is requested
  const url = new URL(request.url);
  const createJob = url.searchParams.get('createJob') === 'true';

  try {
    const config = loadConfig();

    if (!config.apiToken) {
      return NextResponse.json(
        { error: 'API token not configured' },
        { status: 401 }
      );
    }

    const apiUrl = `${config.apiUrl.replace(/\/$/, '')}/balance`;

    // Create job if requested
    let jobId: string | undefined;
    if (createJob) {
      jobId = generateJobId();
      const job: Job = {
        id: jobId,
        requestId: '',
        endpointId: 'balance',
        params: {},
        rawRequest: {
          method: 'GET',
          url: apiUrl,
          headers: { Authorization: 'Bearer ***' },
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      addJob(job);
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (jobId) {
        updateJob(jobId, {
          rawResponse: data,
          status: 'failed',
          error: data.error || data.message || `HTTP ${response.status}`,
          completedAt: new Date().toISOString(),
        });
      }
      return NextResponse.json(
        { error: data.error || data.message || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    // Update job with response and balance
    if (jobId) {
      updateJob(jobId, {
        rawResponse: data,
        status: 'completed',
        completedAt: new Date().toISOString(),
        // Store balance as costCredits so it shows on the job
        costCredits: data.data?.balance,
      });
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[deapi-tester] GET /api/balance error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
