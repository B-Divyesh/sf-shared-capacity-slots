# Handoff — Shared Capacity Slots repair 3

## Outcome

Implementation `cb7fac60217df121abd4e5d61dd290331549fbda` is pushed and deployed at <https://shared-capacity-slots.sociobot.in>. Deployment `22688f41-d1fd-404f-a41d-e040090f650e` succeeded on 6 September 2026. The local and live HTML, JavaScript, and CSS hashes match.

The free local-first planner is release-ready. One external paid-offer dependency remains: the production checkout URL still returns HTTP 404 because the billing product is not registered. The separate billing operator can use [billing-offer.json](billing-offer.json), also copied to `/work/.evidence/billing-offer.json`. No price, provider credential, or paid feature was invented or removed.

## Repairs completed

- Fresh or changed license tokens stay locked until the verification API returns `valid: true`. Cached verdicts are bound to the exact token. A previously verified token can remain available during an outage.
- The one-click sample uses an in-memory demo sandbox. It shows calculated results immediately, carries a persistent sample banner, resets, and never reads or writes the real IndexedDB plan.
- The first screen now names the job, audience, first action, privacy, offline behavior, and free limit in plain words.
- The keyboard skip link focuses and scrolls to the planner.
- Initial service-worker installation no longer announces a false update. Cache version is `scs-v1.1.0`.
- `staticwebapp.config.json` adds immutable caching for hashed assets, no-cache HTML/service-worker policy, CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, Permissions Policy, and existing safety headers.
- Production now serves `.webmanifest` as `application/manifest+json` and AVIF as `image/avif`.
- Unknown production paths return HTTP 404 with the designed product page.
- Timezone conversion now chooses the first fall-back occurrence deterministically and rejects missing wall times. Tests cover New York, Berlin, Auckland, and Lord Howe, including half-hour DST.
- Privacy, terms, offline, and 404 pages use the standard header, main landmark, footer, route title, and keyboard skip link.
- Added canonical and social metadata, a 1200×630 derivative of the original product artwork, an Apple touch icon, claims inventory, demo documentation, and copy audit.

## Verification

Clean documented setup:

```bash
npm ci
npm test
npm audit --omit=dev
```

Results:

- Unit: 28/28 passed across engine, ICS, exporters, licensing, timezones, and runner configuration.
- Browser: 19/19 passed across desktop Chromium and a 390px phone profile.
- Every one of the 13 commands in [claims.json](claims.json) passed independently.
- Dynamic axe: zero serious or critical findings in populated desktop and phone views.
- `/opt/fleet/lib/verify-url.sh`: HTTP 200, correct title and language, one H1, main landmark, zero missing alt text, zero unlabeled buttons, and zero console errors locally and live.
- Live Lighthouse 13.0.1: performance 100, accessibility 100, best practices 100, SEO 100; FCP 1.0s, LCP 1.2s, TBT 0ms, CLS 0.
- Initial JavaScript: 39.59KB raw / 13.41KB gzip. CSS: 17.99KB raw / 4.80KB gzip. Mobile hero AVIF: 51.85KB.
- Fresh desktop and phone profiles showed the job, audience, and sample action above the fold. Both loaded 185 sample starts with the persistent demo banner and no console errors.
- Live unknown route: HTTP 404 with `Page not found — Shared Capacity Slots`.
- Live response policy: root `Cache-Control: no-cache`; hashed JavaScript `max-age=31536000, immutable`; CSP, Permissions Policy, and anti-framing headers present.
- Live MIME: manifest `application/manifest+json`; AVIF `image/avif`.
- License outage smoke test: arbitrary token left the 28-day option disabled and stored no positive verdict.
- Verification burst: 100 concurrent requests returned 30 HTTP 200 and 70 HTTP 429 responses; all 70 throttled responses included `Retry-After`. A second burst captured HTTP 429 with `Retry-After: 1`.

Evidence is under `/work/.evidence/`. Catalog copy is in [catalog-description.txt](catalog-description.txt) and was copied to `/work/.evidence/catalog-description.txt`.

## Remaining dependency

`GET https://api.sociobot.in/api/v1/products/shared-capacity-slots/checkout` still returns HTTP 404 with the billing engine's missing-product response. Register this exact offer, then prove the hosted checkout redirect and a real product-bound license return. This repository must not register billing itself.

## Product boundaries

- A resource supports one repeated working interval per selected weekday. Import busy blocks for split shifts and dated leave.
- Yearly recurrence and `BYSETPOS` remain unsupported and are reported as skipped.
- ICS imports are local snapshots, not subscribed feeds.
- `VFREEBUSY` display varies by calendar client; CSV is the readable fallback.
- This is a static PWA with local IndexedDB state. Server persistence, tenant isolation, health probes, and SQLite restart checks do not apply.
