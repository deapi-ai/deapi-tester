# deAPI Tester — Local Developer Testing App

## Project Description
Local developer application for testing deAPI.ai endpoints (unified AI inference API).
Allows easy request sending, raw JSON preview, async job status tracking,
history storage and result downloading.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Storage:** Local JSON files (data/history.json, data/config.json)
- **Output:** Configurable directory for downloaded results (default ./output/)

## Project Structure
```
deapi-tester/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main UI
│   │   ├── layout.tsx                  # Root layout
│   │   ├── api/
│   │   │   ├── proxy/route.ts          # Proxy to deAPI (adds auth, logs)
│   │   │   ├── poll/[id]/route.ts      # SSE stream for job status
│   │   │   ├── endpoints/route.ts      # GET endpoint registry
│   │   │   ├── history/route.ts        # CRUD job history
│   │   │   ├── config/route.ts         # GET/PUT configuration
│   │   │   ├── models/route.ts         # Proxy to deAPI /models
│   │   │   ├── balance/route.ts        # Proxy to deAPI /balance
│   │   │   └── download/route.ts       # Download results to output_dir
│   ├── lib/
│   │   ├── endpoint-registry.ts        # All deAPI endpoint definitions
│   │   ├── storage.ts                  # JSON file operations
│   │   ├── deapi-client.ts             # HTTP client for deAPI
│   │   ├── config.ts                   # Configuration management
│   │   ├── types.ts                    # Shared types
│   │   ├── constants.ts                # Shared constants (status colors, icons)
│   │   ├── format-utils.ts             # Formatting utilities (time, cost, file size)
│   │   └── form-utils.ts               # Form field utilities and categorization
│   ├── components/
│   │   ├── ConfigPanel.tsx             # Quick profile switcher (header)
│   │   ├── ConfigDrawer.tsx            # Full settings drawer (profiles CRUD)
│   │   ├── EndpointSelector.tsx        # Endpoint selection from groups
│   │   ├── EndpointForm.tsx            # Dynamic form from registry (orchestrator)
│   │   ├── RequestInspector.tsx        # Raw JSON request/response
│   │   ├── JobTracker.tsx              # Polling status, progress bar
│   │   ├── JobsPanel.tsx               # Main jobs panel (list/logs views)
│   │   ├── ResultViewer.tsx            # Preview img/video/audio/text
│   │   ├── HistoryPanel.tsx            # Previous jobs list
│   │   ├── ModelInfo.tsx               # Model metadata display
│   │   ├── PriceCalculator.tsx         # Pre-calc costs
│   │   ├── form/                       # Form field components
│   │   │   ├── FormField.tsx           # Generic form field renderer
│   │   │   └── FileUploadField.tsx     # File upload with preview
│   │   └── jobs/                       # Job-related components
│   │       ├── JobRow.tsx              # Single job row component
│   │       └── JobLogsView.tsx         # Logs view for jobs
│   └── hooks/
│       ├── useDeApi.ts                 # Main API hook
│       ├── usePolling.ts               # SSE/polling hook
│       └── useConfig.ts                # Configuration hook
├── data/                               # Local "database"
│   ├── history.json                    # Job history
│   └── config.json                     # Persisted configuration
├── output/                             # Downloaded results (configurable)
├── public/
├── .claude/                            # Claude Code config
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Code Conventions
- Components: functional components with hooks, one component per file
- Naming: PascalCase for components, camelCase for functions and variables
- Types: always explicit types, never `any`
- Imports: absolute paths via `@/` alias
- Error handling: try/catch with user-friendly messages
- API routes: always validate input, always proper HTTP status codes

## Component Organization
- Large components are split into smaller, focused sub-components
- Related components are grouped in subdirectories (e.g., `form/`, `jobs/`)
- Shared constants go to `lib/constants.ts` (status colors, icons)
- Shared formatting utilities go to `lib/format-utils.ts`
- Form-specific utilities go to `lib/form-utils.ts`
- Keep components under ~300 lines; split if larger

## Architecture Rules
- Frontend NEVER communicates directly with deAPI — always through backend proxy
- Proxy adds auth header, logs request/response to history
- Job status polling via Server-Sent Events (SSE) from backend to frontend
- Endpoint Registry is single source of truth — form generates automatically
- Adding new endpoint = adding entry in registry (one file)

## deAPI Base URL
- Production: https://api.deapi.ai/api/v1/client/
- Dev: configurable in settings (via profiles)

## Configuration (Multi-Profile)
The app supports multiple configuration profiles for different API keys/environments.

**Config structure (data/config.json):**
```json
{
  "activeProfileId": "default",
  "profiles": [
    {
      "id": "default",
      "name": "Production",
      "apiUrl": "https://api.deapi.ai/api/v1/client",
      "apiToken": "xxx"
    },
    {
      "id": "abc123",
      "name": "Staging",
      "apiUrl": "https://staging.deapi.ai/...",
      "apiToken": "yyy"
    }
  ],
  "outputDir": "./output",
  "pollingIntervalMs": 2000,
  "maxPollingAttempts": 120
}
```

**Profile management:**
- Profiles are stored as an array (easy to add/remove/reorder)
- Each profile has: id, name, apiUrl, apiToken
- Global settings (outputDir, polling) are shared across profiles
- UI allows: add profile, edit profile, delete profile, switch active profile
- Old config format (flat) is auto-migrated to new format on first load

## Notes
- App runs ONLY locally (no need for token security in localStorage)
- JSON storage is enough — do not add any database
- Simplicity > elegance — this is a dev tool, not a product
