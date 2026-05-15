---
name: project-redesign-f1-theme
description: F1-inspired redesign applied to the Fantasy F1 app — dark theme, Titillium Web font, mobile bottom nav
metadata:
  type: project
---

Completed a full F1-inspired visual redesign on the `feat/design` branch.

**Why:** User requested a modern, less vanilla look matching formula1.com — dark theme, F1 red accents, mobile-first UX.

**Key changes:**
- Default theme switched to `dark` (was `light`) — existing users keep their preference
- Font changed to Titillium Web (Google Fonts) — close match to F1's proprietary font
- Mobile layout: replaced hamburger sidebar with a fixed bottom tab bar (5 tabs: Team, AI Picks, History, Prices, Rules)
- Desktop layout: dark sidebar (`#0F0F13`) with F1 red active states
- DriverCard: team color left-border (4px) + number badge in team color
- ConstructorCard: team color top-bar + dark surface
- Card component: rounded-xl, dark-surface by default in dark mode
- Color palette added to tailwind: `f1-black` (#15151E), `f1-surface` (#1E1E2E), `f1-elevated` (#2A2A3A), `f1-border` (#3A3A4A), `f1-muted` (#8F8FA0)
- PriceManager redesigned as a list (not card grid) — better for mobile price editing
- All pages use `px-4 py-5` instead of `container mx-auto px-4 py-6`
- Typography: `font-black uppercase tracking-tight` for all major headings

**How to apply:** Changes are already committed to `feat/design`. Deploy with `npm run deploy`.
