## Change

Remove the three cards ("Rainstorm warning rumor", "MTR service update", "Housing policy claim") that appear below the Analyze card on `/verify`. They currently link back to `/verify` and add no value.

## Edits

- `src/routes/_app.verify.tsx`
  - Delete the trailing `<div className="mt-8 grid gap-3 sm:grid-cols-3">…</div>` block that renders the three cards.
  - Remove the now-unused `Link` import from `@tanstack/react-router` (keep `createFileRoute`, `useNavigate`).

No other files or mock data are affected.