# Dev Server Management

Manage the Next.js dev server lifecycle. Argument: `start`, `stop`, `restart`, `clean`, or `status` (default: `start`).

- `start` — kill existing server if any, start fresh
- `stop` — kill server, free port
- `restart` — same as start
- `clean` — delete `.next/` cache, then start fresh (fixes cache corruption, ENOENT errors, stale builds)
- `status` — check if server is running

## Steps

### 1. Kill any existing dev server

Always do this first (for all actions except `status`):

- On Windows: Find process on port 3000 using `netstat -ano | findstr :3000 | findstr LISTENING` and kill with `taskkill //F //PID <pid>`
- On Unix: `lsof -ti:3000 | xargs kill -9 2>/dev/null`
- Also: Use `TaskStop` to stop any known background bash tasks running the dev server (check task list first)
- Wait 1 second after killing to let port release: `sleep 1` (or `timeout /t 1 /nobreak >nul` on Windows via cmd)

If the argument is `stop`, report that the server was stopped and finish.

### 2. Clean cache (for `clean` only)

- Delete the `.next/` directory: `rm -rf .next`
- Report that cache was cleared

### 3. Start the dev server (for `start`, `restart`, `clean`)

- Run `npm run dev` using the Bash tool with `run_in_background: true`
- Save the returned task ID — report it to the user so they know which task to reference
- Wait 3 seconds, then read the task output file to verify the server started successfully
- Look for "Ready in" in the output to confirm startup
- Report the URL (usually http://localhost:3000)

### 4. Status check (for `status`)

- Check if port 3000 is in use: `netstat -ano | findstr :3000 | findstr LISTENING`
- If yes: report server is running with the PID
- If no: report server is not running
- Also check for any background bash tasks that might be the dev server

## Important notes

- NEVER start a new dev server without killing existing ones first — port conflicts cause errors
- Always use `npm run dev`, never `npx next dev`
- The dev server runs on port 3000 by default
- If port 3000 is somehow still busy after kill, use `--port 3001` as fallback
- On Git Bash on Windows, use `//` for Windows command flags (e.g., `taskkill //F //PID`)
