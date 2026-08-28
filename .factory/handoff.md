# Handoff — independent QA

## Verdict: FAIL

Candidate `8c55d9574e7a92c83da105e7c0e8e7adf456a8fb` was independently tested on 2026-08-28 against <https://shared-capacity-slots.sociobot.in>. The live HTML, hashed JS/CSS, and service worker exactly match the candidate build. This is not a stale-deployment result.

The free local-first planner works end to end, all repository gates pass, offline reload passes, serious/critical axe findings are zero, and live Lighthouse scores 96/100/100/100. Release is blocked by:

1. **Critical:** production checkout returns HTTP 404 (`{"error":"enabled factory product","status":404}`).
2. **High:** any arbitrary pasted token unlocks the paid 28-day horizon when license verification is unreachable.
3. **High:** 100 rapid production verification requests all returned 200; no 429 or `Retry-After` was observed.
4. **Medium:** hashed assets use only `max-age=30` rather than long-lived immutable caching.
5. **Medium:** CSP and anti-framing response policy are absent.
6. **Medium:** `Skip to planner` targets the top of `<main>`, leaves focus on `BODY`, and does not skip to the planner.

Lower-severity findings: initial service-worker install falsely announces an update; manifest/AVIF MIME types are `application/octet-stream`; DST tests omit fall-back ambiguity and non-hour DST transitions.

Full commands, evidence, scenario coverage, hashes, metrics, and defect reproduction are in [verification-1.md](verification-1.md).

## Verification commands

```bash
npm ci
npm test
npm audit --omit=dev
npm run build
```

Observed: Vitest 18/18 passed; Playwright 12 applicable tests passed with 4 intentional profile skips; TypeScript/Vite build passed and produced `dist/`; audit reported zero vulnerabilities. Repeating the uncached offline case yielded 5/5 passes.

## Required next steps

1. Register and enable the production billing product, then prove the checkout redirects to hosted checkout and returns a valid product-bound license.
2. Never create a positive cached verdict for a token until the verification API has returned `valid: true`; preserve only a previously verified cached unlock while offline.
3. Add production throttling to the verify endpoint and demonstrate the 429 threshold plus `Retry-After`.
4. Configure immutable caching for hashed assets and add CSP with `frame-ancestors` (plus a suitable Permissions Policy).
5. Point the skip link at a focusable planner target and distinguish initial service-worker installation from an update.
6. Add fall-back and non-hour/multi-hemisphere DST coverage, then rerun the entire clean and live verification.

No product code was modified during QA.
