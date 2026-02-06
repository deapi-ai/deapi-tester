# deAPI Tester

A local developer tool for testing [deAPI.ai](https://deapi.ai) endpoints - unified AI inference API for image generation, video creation, audio synthesis, and more.

## Features

- **Endpoint Browser** - Browse and select from all available deAPI endpoints organized by category
- **Dynamic Forms** - Automatically generated forms based on endpoint parameters
- **Async Job Tracking** - Real-time polling with SSE for async operations (image/video generation)
- **Request Inspector** - View raw request/response JSON for debugging
- **Job History** - Persistent history of all requests with status, cost, and results
- **Result Preview** - Thumbnail previews for images and videos
- **Download Manager** - Save generated results to local directory
- **Output Picker** - Reuse previously downloaded images as input (e.g. use txt2img result in img2img)
- **Random Prompts** - Dice button fills in creative prompts for quick testing
- **Balance Display** - Track your deAPI credit balance
- **Multi-Profile Config** - Switch between API keys/environments

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Storage:** Local JSON files (no database required)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- deAPI account and API token from [deapi.ai](https://deapi.ai)

### Installation

```bash
# Clone the repository
git clone https://github.com/deapi-ai/deapi-develop-tester.git
cd deapi-develop-tester
```

### Docker (recommended)

```bash
docker compose up -d
```

Open [http://localhost:1337](http://localhost:1337) — enter your API token in the settings drawer that opens automatically.

### Manual

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

The app supports two configuration methods that work together:

**Option 1: Environment Variables (Recommended for permanent setup)**

Create a `.env.local` file in the root directory:

```env
DEAPI_API_TOKEN=your_token_here
DEAPI_API_URL=https://api.deapi.ai/api/v1/client
DEAPI_OUTPUT_DIR=./output
DEAPI_POLLING_INTERVAL_MS=2000
DEAPI_MAX_POLLING_ATTEMPTS=120
```

**Option 2: UI Configuration (Convenient for testing)**

1. Click the **gear icon** in the top right corner
2. Enter your deAPI token and other settings
3. Configuration is saved to `data/config.json`

**How it works (Hybrid approach):**
- If `.env.local` exists → Environment variables take **priority** (secure, permanent)
- If no `.env.local` → Uses `data/config.json` from UI (convenient for local testing)
- UI can still update `config.json`, but `.env.local` will override it if present

**Security:**
- `.env.local` - excluded from git (safe to store tokens)
- `data/config.json` - excluded from git (local configuration)
- `data/history.json` - excluded from git (your job history)
- `output/` - excluded from git (generated files can be large)

## Usage

1. **Select an endpoint** from the left sidebar (grouped by category: Image, Video, Audio, etc.)
2. **Fill in the form** with required parameters (prompt, model, dimensions, etc.)
3. **Click Execute** to send the request
4. **Track progress** in the Jobs panel below:
   - View polling status for async operations
   - Click "Raw" to see the full request JSON
   - Expand polling entries to see each response
   - Preview results with thumbnails
   - Download completed results

## Project Structure

```
deapi-tester/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main UI layout
│   │   ├── api/
│   │   │   ├── proxy/            # Proxy requests to deAPI
│   │   │   ├── poll/[id]/        # SSE polling for async jobs
│   │   │   ├── history/          # Job history CRUD
│   │   │   ├── config/           # Configuration management
│   │   │   └── download/         # Download results
│   │   └── ...
│   ├── components/
│   │   ├── EndpointSelector.tsx  # Endpoint browser
│   │   ├── EndpointForm.tsx      # Dynamic form generator
│   │   ├── JobsPanel.tsx         # Job tracking & history
│   │   ├── ConfigDrawer.tsx      # Settings panel
│   │   ├── form/                 # Form field components
│   │   │   ├── FormField.tsx     # Generic form field renderer
│   │   │   ├── FileUploadField.tsx # File upload with preview
│   │   │   └── OutputPicker.tsx  # Pick images from output directory
│   │   ├── jobs/                 # Job-related components
│   │   │   ├── JobRow.tsx        # Single job row
│   │   │   └── JobLogsView.tsx   # Logs view
│   │   └── ...
│   └── lib/
│       ├── endpoint-registry.ts  # All endpoint definitions
│       ├── storage.ts            # JSON file operations
│       ├── types.ts              # TypeScript types
│       ├── constants.ts          # Shared constants
│       ├── format-utils.ts       # Formatting utilities
│       └── form-utils.ts         # Form utilities
├── data/                         # Local storage (auto-created)
│   ├── config.json              # User configuration
│   └── history.json             # Job history
├── output/                       # Downloaded results (configurable)
└── ...
```

## Adding New Endpoints

Endpoints are defined in `src/lib/endpoint-registry.ts`. To add a new endpoint:

```typescript
{
  id: 'my-new-endpoint',
  name: 'My New Endpoint',
  group: 'Image',
  method: 'POST',
  path: '/my-endpoint',
  isAsync: true,
  params: [
    { name: 'prompt', label: 'Prompt', type: 'textarea', required: true },
    { name: 'model', label: 'Model', type: 'select', options: [...] },
    // ... more params
  ]
}
```

The form will be automatically generated based on the parameter definitions.

## Architecture

- All requests to deAPI go through the backend proxy (`/api/proxy`) which:
  - Adds the Authorization header
  - Logs requests to history
  - Handles async job creation
- Async job polling uses Server-Sent Events (SSE) from `/api/poll/[id]`
- Configuration and history are stored in local JSON files

## License

MIT

## Links

- [deAPI.ai](https://deapi.ai) - AI inference API
- [deAPI Documentation](https://docs.deapi.ai) - API documentation
