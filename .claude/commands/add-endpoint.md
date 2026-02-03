# Add New deAPI Endpoint

Add a new endpoint to the endpoint registry. User will provide:
- endpoint name (e.g. "txt2video")
- API path (e.g. "/txt2video")
- HTTP method
- group (e.g. "generation", "transcription", "utility")
- parameters (name, type, required/optional, default value)

Steps:
1. Add endpoint definition in `src/lib/endpoint-registry.ts`
2. Ensure types are correct
3. Frontend will automatically generate form from registry

Follow existing endpoints in registry as examples.
