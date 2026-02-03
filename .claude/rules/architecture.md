# Architecture Rules

## Proxy Pattern
Frontend NEVER connects directly to deAPI.
All requests go through Next.js API routes in src/app/api/.
API route adds Authorization header and logs to history.

## Endpoint Registry
Endpoint Registry (src/lib/endpoint-registry.ts) is single source of truth.
Frontend generates forms dynamically based on registry.
Adding new endpoint does NOT require changes in React components.

## Storage
- data/config.json — configuration (token, api_url, output_dir)
- data/history.json — job history
- output/ — downloaded results
- Never add a database. JSON files are sufficient.

## Error Handling
- API routes: always try/catch, return { error: string } with proper status code
- Frontend: display user-friendly error toasts/alerts
- Never show raw error stack traces in UI
