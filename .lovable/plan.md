# VeriHK — Frontend Build Plan

A polished, Apple-minimal, blue-and-white AI SaaS frontend for explainable fact verification. Mock data only; no backend.

## Design system
- Tokens in `src/styles.css` (OKLCH): trustworthy blue primary (`~oklch(0.55 0.18 250)`), soft ink foreground, near-white background, glass surface token, subtle border, elevated shadow, gradient-primary and gradient-hero. Full dark mode.
- Typography: Inter Tight (display) + Inter (body) via `<link>` in `__root.tsx` head. Large tracking-tight headings, generous leading.
- Components: rounded-2xl/3xl cards, glass panels (`bg-white/60 backdrop-blur-xl border border-white/40`), soft shadows, framer-motion for hero, page transitions, and stepper.
- Icons: lucide-react. Charts: recharts (pie, bar, timeline-as-area).

## Routes (TanStack Start, file-based)
```
src/routes/
  __root.tsx        (updated head: VeriHK title/desc/og, Inter link)
  _app.tsx          (layout: Sidebar + Topbar + <Outlet/>)
  _app.index.tsx    (Landing / Dashboard hero — "/")
  _app.dashboard.tsx
  _app.verify.tsx
  _app.processing.tsx
  _app.results.tsx
  _app.history.tsx
  _app.sources.tsx
  _app.about.tsx
```
Home `/` = landing hero + quick stats. Dashboard = charts + recent activity.

## Shared shell
- `AppSidebar` (shadcn sidebar, collapsible="icon"): Dashboard, Verify, History, Official Sources, About. Active state via `useRouterState`. VeriHK logo mark at top.
- `Topbar`: VeriHK wordmark + subtitle "AI-powered Explainable Fact Verification", right side: dark-mode toggle (class-based on `<html>`), profile avatar (shadcn Avatar with dropdown).

## Pages

**Landing (`/`)**
- Hero: gradient background, big headline "Verify Public Information Using Official Hong Kong Data", subtitle, primary "Start Verification" → `/verify`, secondary "Learn More" → `/about`.
- Illustration: SVG flow diagram User → AI → Gov Data → Report with animated connectors (framer-motion).
- Trust bar: HKO, Transport Dept, EDB, GovHK, data.gov.hk logos as text chips.
- Feature triptych cards (Explainable, Official-sourced, Real-time).

**Verify (`/verify`)**
- Large glass card with shadcn Tabs: Text | Image | PDF.
  - Text: big Textarea with placeholder.
  - Image: drag-drop zone (dashed border, upload icon), file input.
  - PDF: same pattern.
- Full-width "Analyze" button → navigates to `/processing`.

**Processing (`/processing`)**
- Centered card. 6-step animated stepper with icons; each step activates in sequence via `setTimeout` (~2s each). Animated progress bar. "Estimated 8–15s". Auto-navigate to `/results` on completion.

**Results (`/results`)** — core page
- Top: 5 summary stat cards (Total Claims, Supported, Refuted, Need More Evidence, Overall Confidence 96%) with icons + trend chips.
- "Uploaded Content" card showing mock news text.
- Extracted Claims: 3 claim cards with status badge (Supported/Refuted), confidence bar, expand-to-see-evidence.
- Evidence section: cards per source (HKO, Transport, EDB, GovNews, data.gov.hk) with source type, published/updated time, summary, citation blockquote, external link button.
- Reasoning: vertical timeline with numbered nodes and reasoning steps per claim.
- Suggestions: checklist cards with actionable recommendations.
- Charts row: Pie (Verification Distribution), Bar (Evidence Sources), Area (Verification Process timeline).

**Official Sources (`/sources`)**
- Responsive grid of source cards; each with icon, name, type chip, "Official" verified badge, description, "Visit" button.

**History (`/history`)**
- Vertical timeline of past reports. Each entry: date, claim count, overall result badge, confidence ring, "View report" link.

**About (`/about`)**
- Sections: Mission, How it works (3-step visual), Why Explainable AI matters, Official Data Sources (logo grid), Technology Stack (chips), Future Roadmap (timeline).

**Dashboard (`/dashboard`)**
- Greeting + KPI cards, Verification Distribution pie, recent verifications list, quick "New verification" CTA.

## Mock data
`src/lib/mock-data.ts` exporting: `claims`, `evidence`, `reasoningSteps`, `suggestions`, `officialSources`, `historyReports`, `chartData`.

## Dark mode
`useTheme` hook toggling `.dark` on `<html>`, persisted after mount (read in `useEffect` to avoid hydration mismatch).

## Dependencies
Already in template: shadcn/ui, tailwind v4, recharts, lucide-react, framer-motion (add if missing via `bun add framer-motion`).

## Head metadata
Update `__root.tsx` title/description/og to VeriHK. Each route sets its own `head()` with unique title + description + og:title/description.

## Out of scope
No real uploads, no API calls, no auth, no persistence — all interactions drive mock state and route transitions.
