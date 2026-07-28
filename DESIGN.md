# CP Platform — Design System

## Typography

### Font Families
- **Headings:** Sora — geometric, modern, distinctive. Not a generic AI default.
- **Body:** DM Sans — clean, warm, highly legible. Chosen for readability across accessibility needs.
- **Mono:** JetBrains Mono — used only for code/data displays.

### Font Size Scale (rem-based, accessible)
| Token | Size | Use |
|-------|------|-----|
| xs | 0.75rem (12px) | Labels, captions, meta text |
| sm | 0.875rem (14px) | Body text, table cells, secondary content |
| base | 1rem (16px) | Default body, primary content |
| lg | 1.125rem (18px) | Card titles, section subtitles |
| xl | 1.25rem (20px) | Page subtitles |
| 2xl | 1.5rem (24px) | Page titles, hero metrics |
| 3xl | 1.875rem (30px) | Dashboard hero heading |

### Typography Rules
- **DO** use Sora for all headings (h1-h6) and display text
- **DO** use DM Sans for all body text, labels, and UI elements
- **DO** use `-0.02em` letter-spacing on headings for tightness
- **DON'T** use Inter, Plus Jakarta Sans, Roboto, or Geist — these are overused AI defaults
- **DON'T** use gradient text (`background-clip: text`) — it's an AI tell
- **DON'T** use font sizes below 10px — minimum 12px for accessibility

## Color Palette

### Brand Colors
| Name | Token | Hex | Use |
|------|-------|-----|-----|
| Purple 500 | cp-purple-500 | #8b46ff | Primary actions, active states |
| Purple 600 | cp-purple-600 | #7c22ff | Button backgrounds, links |
| Purple 700 | cp-purple-700 | #6d10eb | Hover states |
| Coral 500 | cp-coral-500 | #ff6b4a | Destructive actions, urgency, notifications |
| Teal 500 | cp-teal-500 | #14b8a0 | Success states, completion |
| Mustard 400 | cp-mustard-400 | #ffd633 | Warnings, highlights, attention |

### Neutral Palette
| Token | Hex | Use |
|-------|-----|-----|
| surface | #fafafc | Page background |
| surface-elevated | #ffffff | Card/panel backgrounds |
| surface-sunken | #f1f1f6 | Hover fills, muted areas |
| text-primary | #1a1a2e | Primary text (softer than black) |
| text-secondary | #6b6b80 | Supporting text |
| text-muted | #9898ac | Placeholder, meta |
| border-default | #e4e4ef | Default borders |
| border-strong | #c8c8d8 | Emphasized borders |

### Color Rules
- **DO** use semantic tokens (--color-status-*, --color-priority-*) for status indicators
- **DO** maintain 4.5:1 contrast ratio minimum for text (WCAG AA)
- **DON'T** use arbitrary hex values in JSX — always use theme tokens
- **DON'T** use pure black (#000) for text — use text-primary (#1a1a2e)

## Spacing & Layout

### Spacing Scale
4px base unit. Use: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16

### Border Radius
| Token | Value | Use |
|-------|-------|-----|
| sm | 6px | Badges, small elements |
| md | 10px | Buttons, inputs, cards |
| lg | 14px | Cards, dialogs, panels |
| xl | 20px | Hero banners, feature cards |

### Layout Rules
- **DO** use consistent 24px (p-6) page padding
- **DO** use 16px (gap-4) between cards in a grid
- **DO** use max-width for text content (~65ch for readability)
- **DON'T** nest cards inside cards
- **DON'T** use more than 3 levels of visual nesting

## Shadows
| Token | Value | Use |
|-------|-------|-----|
| shadow-sm | 0 1px 2px rgba(26,26,46,0.05) | Subtle elevation |
| shadow-md | 0 4px 12px rgba(26,26,46,0.08) | Cards on hover |
| shadow-lg | 0 8px 30px rgba(26,26,46,0.12) | Dropdowns, popovers |
| shadow-xl | 0 20px 60px rgba(26,26,46,0.15) | Modals, dialogs |

## Motion
- **DO** use `ease-out` for entrances, `ease-in` for exits
- **DO** keep durations between 150ms–300ms
- **DO** use `active:scale-[0.98]` on buttons for tactile feedback
- **DON'T** use bounce or elastic easing — it feels unprofessional
- **DON'T** animate layout shifts — only transform and opacity

## Components
- All buttons use `rounded-[10px]` (md radius)
- All cards use `rounded-[14px]` (lg radius)
- Avatars are always circles (rounded-full)
- Status indicators use 8px dots
- Minimum touch target: 36px (h-9)

## Anti-Patterns to Avoid
1. ❌ Gradient text on headings or metrics
2. ❌ Overused fonts (Inter, Plus Jakarta Sans, Roboto, Geist)
3. ❌ Generic purple/indigo card backgrounds without brand grounding
4. ❌ Nested cards (card inside card)
5. ❌ Text wider than ~80 characters without max-width
6. ❌ Font sizes below 12px for readable text
7. ❌ Pure black (#000) backgrounds or text
8. ❌ Decorative animations that don't serve a purpose
