# Independent verification 2 — Shared Capacity Slots

**Verdict: FAIL**

Tested 6 September 2026 UTC against <https://shared-capacity-slots.sociobot.in>.

- Implementation candidate: `cb7fac60217df121abd4e5d61dd290331549fbda`
- Documentation baseline: `ccb8e6ccb38ce06a9cd226b9d29100a9d81f32df`
- Live runtime: matches the candidate build (see identity evidence below).
- Findings: 3 (1 critical, 2 medium). Untested public claims: 0.

Shared Capacity Slots is a local planner for small service teams to find times when the required people, rooms, and equipment are all free. The first action is **Try it with sample data**. That job, audience, and action were clear above the fold in fresh 1440×900 desktop and 390×844 phone profiles.

## Release decision

**FAIL. Do not declare the product accepted.** The paid offer cannot be purchased in production, and the phone navigation and demo entry do not meet the supplied site-structure and demo-sandbox contracts. The free planner itself is functional and the previous security and reliability repairs remain effective.

## Findings

### Critical — production checkout is unavailable

The live paid link targets the required Sociobot billing URL, but a fresh request to:

```text
https://api.sociobot.in/api/v1/products/shared-capacity-slots/checkout
```

returned HTTP `404` with the billing engine's missing-product response. The page promises a $29 one-time Field kit, so a customer cannot complete the advertised purchase. This is the known external billing-registration dependency recorded in [billing-offer.json](billing-offer.json); it must be registered by the billing operator, then the hosted checkout redirect and returned product-bound license must be proved.

### Medium — phone header removes the main navigation

At 390px the root page's `.site-header nav` computes to `display: none` with a zero-sized box. The fresh phone screenshots show only the wordmark and install button; **Demo**, **Planner**, and **Privacy** are absent. They remain in the footer after a long scroll, but the contract requires a consistent header with navigation on every route. Provide an accessible compact navigation control or retain the links on the phone layout.

### Medium — entering the one-click sample leaves the populated planner below the first screen

Clicking **Try it with sample data** from a fresh page navigates to `/?demo=1` and correctly seeds 185 calculated starts, but the browser remains at `scrollY: 0`. The populated planner begins 1,210px below the desktop viewport and 2,023px below the phone viewport. The direct demo URL behaves the same way. This does not meet the demo-sandbox requirement that the first screen after the action already look like the product in use. Entering demo should focus/scroll to the populated planner (while keeping the persistent demo banner visible).

## Repository and claim evidence

All commands below were run from a separate clean checkout at implementation SHA `cb7fac6` after `npm ci`.

```text
npm ci                         PASS — 71 packages installed; audit during install found 0 vulnerabilities
npm test                       PASS — 28 unit tests, production TypeScript/Vite build, 19 Playwright tests
npm audit --omit=dev           PASS — 0 vulnerabilities
```

The build produced `dist/index.html`. Initial bundle sizes were 39.59 KB JavaScript raw / 13.41 KB gzip and 17.99 KB CSS raw / 4.80 KB gzip.

Every command declared in [claims.json](claims.json) was run individually from that checkout. All 13 passed; therefore there are no untested or false listed public claims:

| Claim | Result |
| --- | --- |
| `sample-sandbox` | PASS — real plan survives demo mutation, reset, and exit |
| `local-calendar-privacy` | PASS — sample ICS flow made only same-origin requests |
| `conflict-free-slots` | PASS |
| `csv-export` | PASS |
| `advisory-ics-export` | PASS |
| `json-backup` | PASS |
| `local-persistence` | PASS |
| `offline-reload` | PASS |
| `paid-field-kit` | PASS — recorded valid verification response |
| `license-fail-closed` | PASS |
| `end-to-end-plan` | PASS |
| `shared-calendar-comparison` | PASS |
| `timezone-boundaries` | PASS |

The landing copy, README, privacy and terms pages were cross-checked against the claims inventory. No unlisted public product claim was found. The documented limitations (one working interval, unsupported yearly/BYSETPOS recurrence, snapshot imports, and variable VFREEBUSY display) are explicit boundaries, not hidden promises.

## Live browser, accessibility, and PWA evidence

- Fresh desktop and phone browser profiles loaded with no console errors, page errors, or failed requests. Screenshots are in `/work/.evidence/scs-live-{desktop,phone}-{landing,demo}.png`.
- The first screen states the job, audience, and sample action in plain words. The phone landing has no horizontal overflow (390px document width) and visible controls meet 44px targets.
- The sample contains Maya, Leo, a room, a treatment table, two services, four busy blocks, and 185 calculated starts. Its banner says `Demo — sample data, nothing is saved`; deleting Maya, resetting, and leaving demo restored the sample and retained a separately saved real resource.
- `/opt/fleet/lib/verify-url.sh` passed live: HTTP 200, title, `lang=en`, one H1, a main landmark, image alt text, labelled buttons, and zero console errors.
- Dynamic axe on populated desktop and phone demo views reported zero serious or critical violations. Keyboard skip-link testing focused `#planner` and scrolled to it. Tablist keyboard navigation, native controls, and reduced-motion behavior also pass in the browser suite.
- A fresh live profile registered and was controlled by `/sw.js`. After the first visit, the demo reloaded offline with its banner and calculated results; it reported `Offline; planner remains available`.
- `/privacy/`, `/terms/`, manifest, legal-page titles, designed 404, canonical/metadata, robots, sitemap, and legal contact links were checked. The deliberate unknown-route HTTP 404 is expected and is not a defect.

## Security, privacy, and earlier-finding disposition

| Earlier item | Current disposition and evidence |
| --- | --- |
| Checkout HTTP 404 | **Still open — critical finding above.** |
| Arbitrary token unlocked during outage | Fixed. With the verify endpoint blocked, an arbitrary token showed `Paid features stay locked until a check succeeds` and the 28-day option stayed disabled. |
| Verification endpoint had no rate limit | Fixed. A fresh 100-request invalid-license burst returned 30×200 and 70×429; all 70 throttled responses carried `Retry-After` (sample value: 4). |
| Hashed assets lacked immutable caching | Fixed. The live hashed JavaScript has `Cache-Control: public, max-age=31536000, immutable`. |
| CSP, anti-framing, and Permissions Policy absent | Fixed. Live responses include the configured CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Permissions-Policy`, `Referrer-Policy`, and `X-Content-Type-Options`. |
| Skip link did not target planner | Fixed. Live keyboard activation focused `#planner` and scrolled to `scrollY: 793`. |
| False update notice on first service-worker install | Fixed by the passing first-install browser test; no false update toast or console error was observed. |
| Manifest and AVIF served generically | Fixed. Live MIME types are `application/manifest+json` and `image/avif`. |
| DST coverage gap | Fixed in the candidate's 28-unit-test suite and its `timezone-boundaries` claim: New York, Berlin, Auckland, and Lord Howe cover spring gaps, fall repeats, both hemispheres, and half-hour changes. |

The free planning flow stayed same-origin. Calendar content is processed in browser storage; no analytics, remote fonts, or third-party scripts were observed. There is no product backend, shared database, tenant, health endpoint, or server restart state to test; this is a static local-first PWA.

## Candidate and response identity

The fresh candidate build exactly matches live response bytes:

| File | SHA-256 |
| --- | --- |
| `index.html` | `90032fa211fbc2dc6a3e45eeba3c67a5ae7136462b12bd745db00826ac015868` |
| `assets/index-CO5QK4Bo.js` | `9ce946b40696722c79d8a977f18b49cd67bef3d64faee6db9de86f62b4e023a9` |
| `assets/style-DRMhblY2.css` | `673fc8c90ea01f32673da22b5f0b3fa25dbb21ccc4747618ce16f721a5dd0e99` |
| `sw.js` | `894d30512bf7ea6c2a463b7dcaafbb8299dd9c0be8845a8877eb462502aa49ef` |

## Required next steps

1. Register the offer in `billing-offer.json` with the billing operator and re-test checkout, payment return, restore, and product-bound verification.
2. Keep a reachable, labelled main navigation in the phone header.
3. Make the sample action and `/?demo=1` put the populated planner in view immediately, then re-run this full verification.

No product code was modified during this verification.
