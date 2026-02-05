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
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">
  Execute
</button>

// Secondary action
<button className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-200">
  Cancel
</button>

// Danger action
<button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white">
  Delete
</button>

// Icon-only button
<button className="p-1.5 hover:bg-zinc-700 rounded">
  <RefreshCw className="w-4 h-4" />
</button>
```

## Layout Colors
- Background: `bg-zinc-900` (main), `bg-zinc-800` (cards/panels)
- Borders: `border-zinc-700`
- Text: `text-zinc-100` (primary), `text-zinc-400` (secondary)
- Accent: `text-blue-400` (links, active states)

## Form Fields
- Labels: `text-sm text-zinc-400`
- Inputs: `bg-zinc-800 border-zinc-600 focus:border-blue-500`
- Placeholders: `placeholder-zinc-500`
- Help text: `text-xs text-zinc-500`
