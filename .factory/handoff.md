# Handoff — Shared Capacity Slots

## Shipped

- A complete vanilla TypeScript/Vite offline PWA in the required `dist/` output.
- Resource modelling for people, rooms, equipment, and other constrained assets, with weekday working windows.
- Service requirements with alternative eligible resources, multiple mandatory layers, quantities, distinct assignment, and parallel-capacity calculation.
- Local ICS import assigned to a resource, including UTC/floating/TZID/all-day events, unfolded properties, recurrence (`DAILY`, `WEEKLY`, `MONTHLY`, `COUNT`, `UNTIL`, `BYDAY`, `BYMONTHDAY`) and `EXDATE`.
- A 7/14-day free calculator, paid 28-day horizon, conservative single-shared-calendar comparison, capacity recovery metric, exact result table, CSV export, and advisory `VFREEBUSY` ICS export.
- IndexedDB persistence, recent local change history, JSON backup/restore, explicit clear flow, offline shell, update feedback, manifest, 192/512/maskable icons, and install affordance.
- $29 one-time field-kit checkout and license restore/verify using the Sociobot billing contract. No product ID is hardcoded; only the required product slug is used.
- `/privacy/`, `/terms/`, offline fallback, robots, sitemap, README, and MIT license.
- Original topographic hero artwork with prompt and provenance in `assets/src/`; responsive AVIF/WebP/JPEG outputs are all under 300KB.

## Verification

Run from a clean clone:

```bash
npm ci
npm test
```

Final local results on 2026-08-28:

- `npm test`: passed.
  - Vitest: 17/17 tests passed (allocation conflicts, parallel capacity, baseline recovery, overlap boundaries, DST transitions, half-hour zones, ICS variants/recurrence/exceptions, CSV/ICS semantics, backup validation).
  - TypeScript + Vite production build: passed; `dist/index.html` exists.
  - Playwright: 11 passed, 3 intentionally project-skipped (desktop-only long/offline cases and mobile-only overflow case); Chromium and Pixel 5 profiles passed.
  - Dynamic axe scan after sample calculation: zero serious or critical violations.
  - Offline test: installed shell reloaded successfully with `context.setOffline(true)`.
  - Console test: zero `console.error` or uncaught page errors through load, sample, and calculation.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173 /tmp/scs-verify`: HTTP 200; title present; `lang=en`; one `h1`; main landmark; zero missing image alt text; zero console errors.
- Lighthouse 12.8.2, default mobile simulation against the production preview:
  - Performance: **100**
  - Accessibility: **100**
  - Best Practices: **100**
  - SEO: **100**
  - LCP: **1.5s**, CLS: **0**, TBT: **0ms**, FCP: **0.9s**
- Production payload:
  - Initial app JavaScript: 38.32KB raw / 12.93KB gzip (budget ≤200KB)
  - CSS: 17.40KB raw / 4.71KB gzip (budget ≤50KB)
  - Hero: 219KB desktop AVIF, 73KB mobile AVIF; 261KB desktop WebP, 93KB mobile WebP (budget ≤300KB)
  - Fonts: 0KB; system stacks only
- `npm audit`: zero known vulnerabilities.

## Known v1 boundaries

- A resource supports one regular daily working interval. Split shifts and date-specific leave should be imported as busy ICS events.
- Yearly and highly specialized RFC 5545 recurrence constructs such as `BYSETPOS` are not interpreted. Unsupported or malformed events are counted and surfaced after import rather than silently accepted.
- ICS import is a local snapshot, not a subscribed feed. The user must re-import after source calendars change.
- The exported standards-based `VFREEBUSY` file is intentionally advisory and may not be rendered by every calendar client; CSV remains the portable review format.
- INP is not produced for a one-shot Lighthouse lab run. TBT was 0ms and the interaction code contains no long-running network work.

## Factory follow-up

1. Register `shared-capacity-slots` in the Sociobot billing engine with a $29 one-time price and the production return URL.
2. Deploy the contents of `dist/`; ensure static hosting serves directory indexes for `/privacy/` and `/terms/`.
3. Perform a live checkout/license-return smoke test after registration.
