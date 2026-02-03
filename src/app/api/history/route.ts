import { NextResponse } from 'next/server';
import { loadHistory, deleteJob, clearHistory, getJob } from '@/lib/storage';

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
