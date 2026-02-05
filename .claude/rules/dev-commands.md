# Dev Commands

## Running the Project
Always use npm scripts from package.json. Never use `npx` for project commands.

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Troubleshooting
- If port 3000 is busy: kill the process or use `npm run dev -- --port 3001`
- If build fails with stale cache: delete `.next/` directory and rebuild
- If `@next/swc` version mismatch: run `npm install` to sync dependencies

## Rules
- Never use `npx next dev` — always `npm run dev`
- Never use `npx next build` — always `npm run build`
- Use consistent path format in commands (forward slashes on Windows in bash)
