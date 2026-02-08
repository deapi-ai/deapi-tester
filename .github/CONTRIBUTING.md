# Contributing to deAPI Tester

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/deapi-ai/deapi-tester.git
cd deapi-tester
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Code Style

- TypeScript strict mode — no `any`
- PascalCase for components, camelCase for functions/variables
- Use `@/` alias for imports
- Tailwind classes for styling (CSS variables for theme-aware colors)
- One component per file, keep under ~300 lines

## Submitting Changes

1. Create a branch: `git checkout -b feature/my-feature`
2. Make changes and test locally
3. Run `npm run lint` to check for issues
4. Commit with a clear message
5. Push and open a Pull Request

## Adding Endpoints

See the [Adding New Endpoints](../README.md#adding-new-endpoints) section in the README. Only `src/lib/endpoint-registry.ts` needs editing — form UI is generated automatically.

## Reporting Bugs

Use [GitHub Issues](https://github.com/deapi-ai/deapi-tester/issues) and include:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
