import { NextResponse } from 'next/server';
import { loadHistory, deleteJob, clearHistory, getJob, addJob, generateJobId } from '@/lib/storage';
import { getEndpointById } from '@/lib/endpoint-registry';
import { Job, JsonValue } from '@/lib/types';

// GET /api/history - Get all jobs or single job by ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const job = getJob(id);
      if (!job) {
        return NextResponse.json(
          { error: `Job '${id}' not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(job);
    }

    const history = loadHistory();
    // Return newest first
    return NextResponse.json(history.reverse());
  } catch (error) {
    console.error('[deapi-tester] GET /api/history error:', error);
    return NextResponse.json(
      { error: 'Failed to load history' },
      { status: 500 }
    );
  }
}

// POST /api/history - Create a 'sending' job stub immediately, before the proxy
// round-trip. The UI shows the job the moment Execute is clicked; the proxy then
// updates this same job (by id) with the request_id and real status.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const endpointId: string = body.endpointId;
    const params: Record<string, JsonValue> =
      body.params && typeof body.params === 'object' ? body.params : {};

    const endpoint = getEndpointById(endpointId);
    if (!endpoint) {
      return NextResponse.json(
        { error: `Unknown endpoint: ${endpointId}` },
        { status: 400 }
      );
    }

    const jobId = generateJobId();
    const job: Job = {
      id: jobId,
      requestId: '',
      // Store the API path (without leading slash), matching the proxy convention.
      endpointId: endpoint.path.replace(/^\//, ''),
      params,
      rawRequest: {
        method: endpoint.method,
        url: endpoint.path,
        headers: {},
        body: params,
      },
      status: 'sending',
      createdAt: new Date().toISOString(),
    };
    addJob(job);

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('[deapi-tester] POST /api/history error:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

// DELETE /api/history - Delete job(s)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');

    if (all === 'true') {
      clearHistory();
      return NextResponse.json({ success: true, message: 'All history cleared' });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id parameter. Use ?id=xxx or ?all=true' },
        { status: 400 }
      );
    }

    const deleted = deleteJob(id);
    if (!deleted) {
      return NextResponse.json(
        { error: `Job '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: `Job '${id}' deleted` });
  } catch (error) {
    console.error('[deapi-tester] DELETE /api/history error:', error);
    return NextResponse.json(
      { error: 'Failed to delete job(s)' },
      { status: 500 }
    );
  }
}
