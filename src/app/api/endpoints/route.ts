import { NextResponse } from 'next/server';
import { ENDPOINTS, ENDPOINT_GROUPS, getEndpointsByGroup, getEndpointById } from '@/lib/endpoint-registry';

// GET /api/endpoints - Get all endpoints and groups
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get('group');
    const id = searchParams.get('id');

    // If id is provided, return single endpoint
    if (id) {
      const endpoint = getEndpointById(id);
      if (!endpoint) {
        return NextResponse.json(
          { error: `Endpoint '${id}' not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(endpoint);
    }

    // If group is provided, return endpoints for that group
    if (group) {
      const endpoints = getEndpointsByGroup(group);
      return NextResponse.json({
        group,
        endpoints,
      });
    }

    // Otherwise return all endpoints and groups
    return NextResponse.json({
      groups: ENDPOINT_GROUPS,
      endpoints: ENDPOINTS,
    });
  } catch (error) {
    console.error('[deapi-tester] GET /api/endpoints error:', error);
    return NextResponse.json(
      { error: 'Failed to load endpoints' },
      { status: 500 }
    );
  }
}
