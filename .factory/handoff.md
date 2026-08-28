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

Repair verification on 2026-08-28 (base candidate `d19a6766177d45e7bddca451cc71d05909c1c923`):

- Failure reproduced with the original exact clean command, `npm ci && npm test`. Unit tests (17/17) and the build passed, then Playwright reported `Running 16 tests using 2 workers`. Chromium headless shell revision 1208 (`chromium_headless_shell-1208`) received `signal 11 SEGV_MAPERR` during `browser.newContext`; the run ended with 11 passed, 4 skipped, and 1 failed (`[mobile] loads without browser errors`). This confirms a browser-process startup race rather than an application assertion failure.
- Focused regression: `npm run test:unit -- --run tests/unit/playwright-config.test.ts` passed 1/1. It locks `fullyParallel: false`, `workers: 1`, and both existing `chromium` and `mobile` projects.
- The complete browser suite was then run independently and passed: `Running 16 tests using 1 worker`; 12 passed and 4 intentional cross-profile skips.
- Final exact clean replay, `npm ci && npm test`: passed.
  - Vitest: 18/18 tests passed (capacity/allocation conflicts, parallel capacity, baseline recovery, overlap boundaries, DST transitions, half-hour zones, ICS variants/recurrence/exceptions, CSV/ICS semantics, backup validation, and Playwright serialization).
  - TypeScript + Vite production build: passed; `dist/index.html` exists.
  - Playwright: 12 passed, 4 intentionally project-skipped; desktop Chromium and Pixel 5 projects ran serially through one worker.
  - Browser coverage retained: complete create/import/calculate integration, keyboard tab navigation, 390px mobile overflow, dynamic axe analysis, console/page errors, installed-shell offline reload, and uncached-navigation offline fallback.
  - Dynamic axe analysis after calculation: zero serious or critical violations.
  - Both explicit `context.setOffline(true)` assertions passed. The service-worker update contract remains `scs-v1.0.1` with `skipWaiting`, stale-cache cleanup, and `clients.claim`.
  - Console check: zero `console.error` or uncaught page errors through load, example setup, and calculation.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173 <temporary-evidence-dir>`: HTTP 200, title `Shared Capacity Slots — map real service availability`, `lang=en`, one `h1`, main landmark, zero missing image alt attributes, and zero browser errors. Its simple `innerText` diagnostic reports two unlabeled buttons because two correctly text-labelled controls are inside a closed `<details>` element; the accessibility-tree axe check reports no serious/critical issue.
- Privacy smoke test after loading and calculating the four-resource example: 4 requests, all to `http://127.0.0.1:4173`; zero third-party origins. `/privacy/`, `/terms/`, and `/manifest.webmanifest` each returned HTTP 200. `npm audit --omit=dev` found zero vulnerabilities.
- Lighthouse 13.4.1, default mobile simulation against the production preview with Chromium 1208 and container-safe flags (`--no-sandbox --disable-gpu --disable-dev-shm-usage`):
  - Performance: **99**
  - Accessibility: **100**
  - Best Practices: **100**
  - SEO: **100**
  - LCP: **1.4s**, CLS: **0**, TBT: **140ms**, FCP: **1.0s**
- Production payload:
  - Initial app JavaScript: 38.32KB raw / 12.93KB gzip (budget ≤200KB)
  - CSS: 17.40KB raw / 4.71KB gzip (budget ≤50KB)
  - Hero: 157.97KB desktop AVIF, 51.85KB mobile AVIF; 266.25KB desktop WebP, 94.25KB mobile WebP (budget ≤300KB)
  - Fonts: 0KB; system stacks only

## Repair made

- Changed Playwright from fully parallel execution to one serial worker. This prevents simultaneous Chromium 1208 browser/context startup while preserving both projects, every assertion, and the no-retry policy.
- Added `tests/unit/playwright-config.test.ts` so concurrency cannot regress without failing the unit suite.
- Updated the README test contract and count. No product behavior, artifact class, service-worker behavior, or coverage was removed.

## Deployment

- Repair implementation commit: `bf1d95247aa52a4260f7ba7663e09644b6f8cdd2` (`fix: serialize Playwright browser contexts`).
- Static deployment command: `/opt/fleet/lib/deploy-static.sh shared-capacity-slots /work/repo/dist`.
- Azure Static Web Apps deployment `b66b4299-ece6-4e31-9bdb-a729850dcea4` completed successfully in `centralus` on 2026-08-28. The custom domain returned HTTP 200 after managed-TLS readiness.
- Artifact identity: local and live `index.html` SHA-256 both equal `be837135e6cefb191644deeb478030f27e3a6633d1b08597fb87241cde3ffa3a`; local and live `assets/index-DSOfXDWM.js` both equal `392762454a868a844f73dc43e0d9fa20311dfc38214099a25273a31aea85169d`.
- Live identity check: `/opt/fleet/lib/verify-url.sh https://shared-capacity-slots.sociobot.in <temporary-evidence-dir>` returned HTTP 200, the expected product title, `lang=en`, one `h1`, a main landmark, zero missing image alt attributes, and zero page/console errors. `/privacy/`, `/terms/`, and `/manifest.webmanifest` each returned HTTP 200.
- Live PWA smoke test in a fresh browser: `/sw.js` was active and controlled the page; after `context.setOffline(true)`, an uncached visit to `/not-cached-offline-route` showed “The field board is still on this device.” and its “Open the planner” action. The browser reported `navigator.onLine === false`.

## Known v1 boundaries

- A resource supports one regular daily working interval. Split shifts and date-specific leave should be imported as busy ICS events.
- Yearly and highly specialized RFC 5545 recurrence constructs such as `BYSETPOS` are not interpreted. Unsupported or malformed events are counted and surfaced after import rather than silently accepted.
- ICS import is a local snapshot, not a subscribed feed. The user must re-import after source calendars change.
- The exported standards-based `VFREEBUSY` file is intentionally advisory and may not be rendered by every calendar client; CSV remains the portable review format.
- INP is not produced for a one-shot Lighthouse lab run. TBT was 0ms and the interaction code contains no long-running network work.

## Factory follow-up

1. Register `shared-capacity-slots` in the Sociobot billing engine with a $29 one-time price and the production return URL.
2. Perform a live checkout/license-return smoke test after registration.
