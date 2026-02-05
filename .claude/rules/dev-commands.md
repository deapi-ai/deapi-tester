# Dev Commands

## Running the Project
Always use npm scripts from package.json. Never use `npx` for project commands.

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Dev Server Management
Use the `/dev-server` slash command for server lifecycle:
- `/dev-server start` — kill existing + start fresh
- `/dev-server stop` — kill server + free port
- `/dev-server restart` — same as start
- `/dev-server clean` — delete `.next/` cache + start fresh
- `/dev-server status` — check if running

## Troubleshooting
- If port 3000 is busy: use `/dev-server start` (auto-kills existing)
- If build fails with stale cache: use `/dev-server clean`
- If `@next/swc` version mismatch: run `npm install` to sync dependencies

## Rules
- Never use `npx next dev` — always `npm run dev`
- Never use `npx next build` — always `npm run build`
- Use consistent path format in commands (forward slashes on Windows in bash)
