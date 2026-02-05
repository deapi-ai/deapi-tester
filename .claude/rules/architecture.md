# Architecture Rules

## Proxy Pattern
Frontend NEVER connects directly to deAPI.
All requests go through Next.js API routes in src/app/api/.
API route adds Authorization header and logs to history.

## Endpoint Registry & Dynamic Models
Endpoint Registry (src/lib/endpoint-registry.ts) defines form STRUCTURE only:
- Field names, types, required flags, descriptions, placeholders
- NO hardcoded model slugs, options, limits, or defaults

All model data comes dynamically from `/api/models` → `ModelsContext`:
- Model dropdown options: filtered by `inference_type` matching `endpoint.id`
- Numeric field limits (min/max/step): from `model.info.limits`
- Numeric field defaults: from `model.info.defaults`
- Voice/language options (TTS): from `model.languages[]`
- LoRA adapters: from `model.loras[]`

EndpointForm applies model data via:
- `getDynamicSelectOptions()` — dynamic select options for model, voice, lang
- `getEffectiveParam()` — overlays model limits/defaults onto param definitions
- `buildFilteredValues()` — sends model defaults for disabled nullable fields

Adding new endpoint = adding entry in registry (one file).
Adding new model to deAPI = ZERO code changes (auto-discovered via /models API).

## Storage
- data/config.json — configuration (token, api_url, output_dir)
- data/history.json — job history
- output/ — downloaded results
- Never add a database. JSON files are sufficient.

## Error Handling
- API routes: always try/catch, return { error: string } with proper status code
- Frontend: display user-friendly error toasts/alerts
- Never show raw error stack traces in UI
