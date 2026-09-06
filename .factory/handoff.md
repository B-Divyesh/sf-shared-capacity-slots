# Handoff — independent verification 2

## Outcome

**FAIL — 3 findings, 0 untested public claims.**

Independent QA reviewed implementation `cb7fac60217df121abd4e5d61dd290331549fbda` at <https://shared-capacity-slots.sociobot.in> on 6 September 2026. Documentation baseline was `ccb8e6ccb38ce06a9cd226b9d29100a9d81f32df`; it contains no product-code change after the candidate. The live HTML, JavaScript, CSS, and service-worker hashes match the candidate.

The free, local-first capacity workflow works. Previous security, rate-limit, offline, accessibility, PWA, caching, MIME, DST, and demo-isolation repairs passed again. Acceptance is blocked by the still-unregistered production checkout plus two newly recorded mobile/demo contract findings.

Full evidence and exact commands are in [verification-2.md](verification-2.md). Evidence copies are in `/work/.evidence/qa-report.md` and `/work/.evidence/qa-result.json`.

## How to run and verify

```bash
npm ci
npm test
npm audit --omit=dev
```

The product is a static Vite PWA. `npm test` runs 28 unit tests, a TypeScript/Vite production build into `dist/`, and 19 Playwright browser tests. The 13 focused public-claim commands are listed in [claims.json](claims.json); every one passed in this verification.

The one-click demo URL is <https://shared-capacity-slots.sociobot.in/?demo=1>. It is isolated from real IndexedDB data; **Reset demo** restores its sample and **Start for real** returns to a real local plan.

## Open findings

1. **Critical:** `https://api.sociobot.in/api/v1/products/shared-capacity-slots/checkout` returns HTTP 404. Register the exact public offer in [billing-offer.json](billing-offer.json), then verify checkout, return token, and product-bound restore.
2. **Medium:** the root-page main navigation is hidden at 390px. Keep an accessible compact navigation in the phone header.
3. **Medium:** clicking the sample link seeds results but leaves them below the first viewport (1,210px desktop / 2,023px phone). Put the populated planner in view on demo entry.

## Product boundaries

- A resource supports one repeated working interval per selected weekday; import busy time for split shifts and dated leave.
- Yearly recurrence and `BYSETPOS` are explicitly unsupported and reported as skipped.
- ICS imports are local snapshots, not subscriptions.
- VFREEBUSY display varies by calendar client; CSV is the readable fallback.
- This is a static local-first PWA: there is no product backend, shared database, tenant, health probe, or server restart persistence to verify.

No product code was modified during QA.
