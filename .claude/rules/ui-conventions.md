# UI Conventions

## Status Colors
Use constants from `lib/constants.ts` for consistent status styling:

```typescript
import { STATUS_BG_COLORS, STATUS_TEXT_COLORS, STATUS_ICONS } from '@/lib/constants';

// Background colors (for dots, badges)
STATUS_BG_COLORS['completed']  // 'bg-green-500'
STATUS_BG_COLORS['failed']     // 'bg-red-500'
STATUS_BG_COLORS['pending']    // 'bg-yellow-500'
STATUS_BG_COLORS['processing'] // 'bg-blue-500'

// Text colors
STATUS_TEXT_COLORS['completed'] // 'text-green-400'

// Icons (emoji)
STATUS_ICONS['completed'] // '✅'
```

## Toast Notifications
Use `useToast()` hook for user feedback:

```typescript
const { showError, showSuccess, showToast } = useToast();

// Errors — network failures, validation errors
showError('Failed to connect to API');

// Success — completed actions
showSuccess('Job completed successfully');

// Info/Warning — general notifications
showToast('Processing started', 'info');
showToast('Rate limit approaching', 'warning');
```

**When to use Toast vs inline error:**
- Toast: transient notifications, background events, success confirmations
- Inline error: form validation, field-specific errors, persistent state

## Icons
Use `lucide-react` for all icons:

```typescript
import { Play, Loader2, Check, X, RefreshCw } from 'lucide-react';

// Common patterns
<Play className="w-4 h-4" />           // Action buttons
<Loader2 className="w-4 h-4 animate-spin" />  // Loading state
<Check className="w-4 h-4 text-green-400" />  // Success
<X className="w-4 h-4 text-red-400" />        // Error/close
```

## Button Patterns
```tsx
// Primary action
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white">
  Execute
</button>

// Secondary action
<button className="px-3 py-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)] rounded text-[var(--text-emphasis)]">
  Cancel
</button>

// Danger action
<button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white">
  Delete
</button>

// Icon-only button
<button className="p-1.5 hover:bg-[var(--surface-2)] rounded">
  <RefreshCw className="w-4 h-4" />
</button>
```

## Theme System (Light/Dark Mode)
All chrome/surface colors use CSS variables defined in `globals.css`. Never use hardcoded `zinc-*` classes for surfaces, borders, or text — use CSS variable references instead.

**ThemeContext** (`useTheme` hook):
- Supports `'light' | 'dark' | 'system'` modes
- Persists to `localStorage` key `deapi-theme`
- Sets `data-theme` attribute on `<html>`
- `toggleTheme()` switches between light and dark
- Flash prevention via inline `<script>` in `layout.tsx`

**CSS Variable mapping (use these instead of zinc-*):**
| Role | Variable | Example class |
|---|---|---|
| Main background | `--background` | `bg-[var(--background)]` |
| Surface (cards) | `--surface` | `bg-[var(--surface)]` |
| Surface elevated | `--surface-2` | `bg-[var(--surface-2)]` |
| Surface inset | `--surface-inset` | `bg-[var(--surface-inset)]` |
| Hover overlay | `--hover` | `hover:bg-[var(--hover)]` |
| Border default | `--border` | `border-[var(--border)]` |
| Border strong | `--border-strong` | `border-[var(--border-strong)]` |
| Text primary | `--text-primary` | `text-[var(--text-primary)]` |
| Text secondary | `--text-secondary` | `text-[var(--text-secondary)]` |
| Text emphasis | `--text-emphasis` | `text-[var(--text-emphasis)]` |
| Text faint | `--text-faint` | `text-[var(--text-faint)]` |
| Muted | `--muted` | `text-[var(--muted)]` |

**What stays hardcoded (semantic colors):**
- Status colors: `bg-green-500`, `text-red-400`, `bg-blue-500/10` etc.
- Accent actions: `bg-blue-600`, `hover:bg-blue-500`
- Danger: `bg-red-600`, `text-red-400`
- These work in both themes without changes.

## Layout Colors
- Background: `bg-[var(--background)]` (main), `bg-[var(--surface)]` (cards/panels)
- Borders: `border-[var(--border)]`
- Text: `text-[var(--text-primary)]` (primary), `text-[var(--text-secondary)]` (secondary)
- Accent: `text-blue-400` (links, active states)

## Form Fields
- Labels: `text-sm text-[var(--text-secondary)]`
- Inputs: auto-styled via globals.css (use `var(--surface)` bg, `var(--border)` border)
- Help text: `text-xs text-[var(--muted)]`
