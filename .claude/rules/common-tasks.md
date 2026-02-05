# Common Tasks

## Adding a New Endpoint
1. Edit `src/lib/endpoint-registry.ts`
2. Add entry to `ENDPOINTS` array following existing patterns
3. Frontend form generates automatically — no component changes needed
4. Model options, limits, defaults load dynamically from `/api/models`

```typescript
{
  id: 'my-new-endpoint',
  name: 'My New Endpoint',
  group: 'image-generation',
  method: 'POST',
  path: '/my-endpoint',
  description: 'Does something cool',
  contentType: 'json', // or 'multipart' for file uploads
  isAsync: true,       // true if returns request_id for polling
  hasPriceCalc: true,
  priceCalcPath: '/my-endpoint/price-calculation',
  params: [
    { name: 'prompt', label: 'Prompt', type: 'textarea', required: true },
    { name: 'model', label: 'Model', type: 'select', required: true },
    // NO hardcoded options/limits — they come from /models API
  ]
}
```

## Adding a New Model
No code changes needed! Models are auto-discovered from deAPI `/models` endpoint.
Just ensure the model's `inference_types` matches the endpoint `id` (e.g. `txt2img`, `img2img`).

## Adding a New Form Field Type
1. Add type to `ParamType` in `src/lib/types.ts`
2. Handle rendering in `src/components/form/FormField.tsx`
3. Handle value processing in `src/components/EndpointForm.tsx` (buildRequestBody)

## Adding a New Job Status
1. Add to `Job['status']` type in `src/lib/types.ts`
2. Add colors to `STATUS_BG_COLORS` and `STATUS_TEXT_COLORS` in `src/lib/constants.ts`
3. Add icon to `STATUS_ICONS` in `src/lib/constants.ts`
4. Handle in `JobRow.tsx` if special behavior needed

## Debugging SSE Polling
1. Check browser DevTools Network tab for `/api/poll/[id]` requests
2. Look for `EventSource` connection in Network tab
3. Server logs: `[deapi-tester]` prefix in terminal
4. Common issues:
   - Connection closed early: check `maxPollingAttempts` in config
   - No updates: verify `request_id` is correct
   - CORS errors: should not happen (same-origin proxy)

## Debugging Proxy Issues
1. Check `/api/proxy/route.ts` for request handling
2. Verify config has valid `apiUrl` and `apiToken`
3. Test with curl directly: `curl -H "Authorization: Bearer TOKEN" API_URL/endpoint`
4. Check `data/history.json` for raw request/response logs

## Modifying Configuration
1. Config structure: `src/lib/types.ts` → `AppConfigFull`
2. Config loading: `src/lib/config.ts`
3. Config API: `src/app/api/config/route.ts`
4. Config UI: `src/components/ConfigDrawer.tsx`

## Adding a New React Context
1. Create `src/components/MyContext.tsx` with Provider and hook
2. Add to `src/components/Providers.tsx` wrapper
3. Follow existing patterns (BalanceContext, ModelsContext)

## Testing API Manually
```bash
# Load config
TOKEN=$(cat data/config.json | jq -r '.profiles[0].apiToken')
URL=$(cat data/config.json | jq -r '.profiles[0].apiUrl')

# Test endpoint
curl -X POST "$URL/txt2img" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "model": "flux-schnell"}'
```
