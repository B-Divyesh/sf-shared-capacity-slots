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

Repair verification on 2026-08-28 (base candidate `fcfc6216377ef69c0315b06441ae793e08dff3bc`):

- Initial clean replay, exactly `npm ci && npm test`: passed. The reported Chromium 1208 SIGSEGV while creating an offline-test context did **not** reproduce.
- After the repair, a second exact clean replay, `npm ci && npm test`: passed.
  - Vitest: 17/17 tests passed (allocation conflicts, parallel capacity, baseline recovery, overlap boundaries, DST transitions, half-hour zones, ICS variants/recurrence/exceptions, CSV/ICS semantics, backup validation).
  - TypeScript + Vite production build: passed; `dist/index.html` exists.
  - Playwright: 12 passed, 4 intentionally project-skipped (desktop-only long/offline cases and mobile-only workflow/overflow cases); Chromium and Pixel 5 profiles passed.
  - Dynamic axe scan after sample calculation: zero serious or critical violations.
  - Offline/update coverage: the installed shell reloaded successfully with `context.setOffline(true)`; a new focused Chromium regression also confirms an uncached offline navigation shows the precached offline guide and its “Open the planner” action. The service-worker cache revision is `scs-v1.0.1`; it continues to use `skipWaiting` and `clients.claim` for updates.
  - Console test: zero `console.error` or uncaught page errors through load, sample, and calculation.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173 <temporary-evidence-dir>`: HTTP 200; title present; `lang=en`; one `h1`; main landmark; zero missing image alt text; zero console errors.
- Privacy smoke test after sample calculation requested only `http://127.0.0.1:4173`; no analytics, CDN, or other third-party origin was contacted. `npm audit --omit=dev`: zero vulnerabilities.
- Lighthouse 13.4.1, default mobile simulation against the production preview with the container-safe Chromium flags (`--disable-gpu --disable-dev-shm-usage`):
  - Performance: **100**
  - Accessibility: **100**
  - Best Practices: **100**
  - SEO: **100**
  - LCP: **1.5s**, CLS: **0**, TBT: **30ms**, FCP: **0.9s**
  - The first Lighthouse run using Chromium 1208 crashed during its final full-page screenshot after completing audits (the report still scored 100/100/100/100). The retry above passed completely, corroborating a browser-runner flake rather than an application failure.
- Production payload:
  - Initial app JavaScript: 38.32KB raw / 12.93KB gzip (budget ≤200KB)
  - CSS: 17.40KB raw / 4.71KB gzip (budget ≤50KB)
  - Hero: 219KB desktop AVIF, 73KB mobile AVIF; 261KB desktop WebP, 93KB mobile WebP (budget ≤300KB)
  - Fonts: 0KB; system stacks only

## Repair made

- The original crash was not reproducible in either full clean test run, so no product change was made to paper over a runner SIGSEGV.
- A separate reproducible offline defect was corrected: a request for an unvisited route while offline was incorrectly given the planner shell. The service worker now serves the explicit cached offline guide for that case, while an already visited page still returns from cache. The behavior is covered in `tests/e2e/app.spec.ts`.

## Deployment

- Repair commit: `c1caafee0c99bfef4b146b1411fd437c08c20fbd` (`fix: serve offline fallback for uncached routes`), pushed to `origin/main`.
- Static deployment command: `/opt/fleet/lib/deploy-static.sh shared-capacity-slots /work/repo/dist`.
- Azure Static Web Apps upload `51c15dce-e08e-4079-97c8-f75f0a89d84e` completed successfully on 2026-08-28. The deployed static app is live at `https://shared-capacity-slots.sociobot.in`.
- Live identity check: `/opt/fleet/lib/verify-url.sh https://shared-capacity-slots.sociobot.in <temporary-evidence-dir>` returned HTTP 200, title `Shared Capacity Slots — map real service availability`, `lang=en`, one `h1`, a main landmark, zero missing image alt attributes, and zero page/console errors. `/privacy/`, `/terms/`, and `/manifest.webmanifest` each returned HTTP 200.
- Live PWA smoke test: the deployed `/sw.js` reports cache revision `scs-v1.0.1`; after installation, an offline visit to `/not-cached-offline-route` showed “The field board is still on this device.”

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
