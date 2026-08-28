# Independent verification — candidate `8c55d957`

**Verdict: FAIL**  
**Tested:** 2026-08-28 UTC  
**Candidate:** `8c55d9574e7a92c83da105e7c0e8e7adf456a8fb`  
**Live URL:** <https://shared-capacity-slots.sociobot.in>

The planner's free, local-first capacity workflow is functional and the live static artifact matches the candidate. Release acceptance nevertheless fails: production checkout is not registered, an unverified arbitrary token unlocks paid features whenever verification is unreachable, and the production verification endpoint did not rate-limit a 100-request burst.

## Candidate and deployment identity

- The checkout started clean at the requested SHA; `HEAD`, `main`, and `origin/main` all resolved to `8c55d9574e7a92c83da105e7c0e8e7adf456a8fb` before verification.
- Fresh `npm ci` installed 71 packages and reported zero vulnerabilities.
- The exact production build and live deployment match:
  - `dist/index.html` and live `/`: `be837135e6cefb191644deeb478030f27e3a6633d1b08597fb87241cde3ffa3a`
  - local and live `assets/index-DSOfXDWM.js`: `392762454a868a844f73dc43e0d9fa20311dfc38214099a25273a31aea85169d`
  - local and live `assets/style-B5PsRcPa.css`: `4867e5e54354c37712b363bf7b06ebab86d9456b43a99a6b601beee50e500a5d`
  - local and live `sw.js`: `a212399a2aff7ff855d65670a74b3701bdaf63a8f8fbb94fabc8a51ed40956fb`
- The live index reports `Last-Modified: Fri, 28 Aug 2026 07:01:38 GMT` and HTTP 200.

## Repository gates

Executed from the clean candidate checkout:

```text
npm ci                         PASS (71 packages; audit 0)
npm test                       PASS
  Vitest                       18/18 passed in 5 files
  tsc --noEmit + vite build    PASS
  Playwright                   12 passed, 4 intentional profile skips
npm audit --omit=dev           PASS (0 vulnerabilities)
```

There is no lint script or separate lint configuration in the repository. `npm test` runs the unit suite, strict TypeScript production build, and the complete E2E suite. The prior multi-worker browser crash did not recur: all browser cases ran serially through one worker. Repeating the uncached offline-navigation test five times produced 5/5 passes.

Production build output:

| Asset | Raw | Gzip | Contract |
| --- | ---: | ---: | ---: |
| Initial JS | 38.32 KB | 12.81 KB | ≤ 200 KB — pass |
| CSS | 17.40 KB | 4.71 KB | ≤ 50 KB — pass |
| Mobile AVIF hero | 51.85 KB | — | ≤ 300 KB — pass |
| Desktop AVIF hero | 157.97 KB | — | ≤ 300 KB — pass |
| Fonts | 0 KB | — | ≤ 120 KB — pass |

## End-to-end product evidence

Fresh local profiles and fresh live profiles were exercised in Chromium at 1440×900 and 390×844.

- Built a resource and service from empty state, reloaded, and confirmed IndexedDB persistence.
- Invalid equal start/end hours and zero selected weekdays produced actionable inline errors, then accepted corrected data.
- A requirement asking for two resources while only one was eligible produced an inline error, then accepted the corrected quantity.
- Empty ICS input reported `No calendar events were found in this ICS file.` A mixed file imported its valid event and visibly reported `skipped 1 unsupported or malformed events`.
- A 60-minute service with a 10:00–11:00 UTC busy event did not offer 09:30, 10:00, or 10:30 starts; 09:00 and 11:00 boundary starts remained valid.
- Invalid timezone input was rejected and recovery to UTC calculated successfully.
- CSV, advisory `VFREEBUSY` ICS, and JSON backup downloads contained the expected product/service data. The ICS contained no booking event.
- The free four-resource and three-service limits showed specific errors; the 28-day horizon remained disabled without a license.
- The live four-resource example calculated 183 offerable starts, avoided 79 conservative shared-calendar blocks, and reported 76% recovered capacity—well above the brief's 10% target. Allocation, overlap-boundary, parallel-capacity, and non-reuse unit tests passed.
- Destructive resource/block/plan actions require named confirmation. Free-flow requests remained same-origin, with no analytics, trackers, remote fonts, or calendar uploads.
- `/privacy/`, `/terms/`, and `/manifest.webmanifest` returned HTTP 200. The checkout link points only to the required Sociobot billing API. There is no sign-in flow, so Entra authority verification is not applicable.

## Browser, accessibility, and PWA evidence

- `/opt/fleet/lib/verify-url.sh` returned HTTP 200 locally and live, the expected title, `lang=en`, one `h1`, a main landmark, no missing image alt, and no console errors. Its two “unlabelled” diagnostics are the script's text-only treatment of controls in a closed `<details>`; browser accessibility-tree analysis did not reproduce them.
- Dynamic axe after calculation found **0 serious and 0 critical** findings on local desktop, live desktop, and live 390px mobile.
- Browser monitoring found zero `console.error`, uncaught page errors, or failed requests through load/example/calculation on live desktop and mobile.
- At 390px, document and body widths were exactly 390px. Visible buttons met 44×44px minimums. Desktop and mobile screenshots were visually inspected; task content remained legible and usable.
- Keyboard tab navigation, tablist Arrow/Home/End operation, Enter/Space-operable native controls, and a visible 3px ochre focus outline were confirmed. See the manual skip-link defect below.
- With `prefers-reduced-motion: reduce`, the media query matched, smooth scrolling became `auto`, and animation duration reduced to `0.00001s`.
- The manifest has standalone display, versioned start URL, 192/512/maskable icons, and Chrome's manifest parser reported no errors.
- Service worker `scs-v1.0.1` became active and controlled the page, `registration.update()` completed with no waiting worker, and the expected shell/assets caches existed. Offline app-shell reload and the explicit uncached fallback passed in the repository suite; the latter also passed 5/5 repeated runs.

Live Lighthouse 13.0.1 default mobile simulation:

| Category/metric | Result |
| --- | ---: |
| Performance | 96 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |
| FCP | 1.0 s |
| LCP | 1.2 s |
| TBT | 220 ms |
| CLS | 0 |

INP is not produced by a one-shot lab navigation.

## Defects

### Critical — production purchase is unavailable

`GET https://api.sociobot.in/api/v1/products/shared-capacity-slots/checkout` returned HTTP 404 with:

```json
{"error":"enabled factory product","status":404}
```

The live page advertises and links a $29 one-time purchase, but a customer cannot purchase it. This reproduces the builder's uncompleted registration follow-up from fresh production evidence.

### High — an arbitrary unverified token unlocks paid features when verification is unavailable

In a fresh live browser with only `https://api.sociobot.in/**` blocked, pasting `anything-unverified` produced `Field kit unlocked on this device.` and enabled the 28-day option. Storage contained:

```json
{"license":"anything-unverified","verdict":"{\"valid\":true,\"checkedAt\":0}"}
```

With the API available, the same invalid-token class was correctly rejected with `License no longer active. The free planner is still available.` and the 28-day option stayed disabled. The offline path fabricates a positive cached verdict before any successful verification, allowing trivial paid-tier bypass.

### High — required verification-endpoint rate limiting is absent

A burst of 100 invalid-license verification requests was sent as four concurrent batches of 25 with the production product origin. Result: **100× HTTP 200, 0× HTTP 429**. No threshold or `Retry-After` header was observed. The acceptance contract explicitly requires product-unlock endpoints to start returning 429 with `Retry-After` under a rapid burst.

### Medium — live immutable-asset caching policy is not configured

The version-hashed JS/CSS and image assets all return `Cache-Control: public, must-revalidate, max-age=30`, the same short policy as HTML. They do not receive long-lived `immutable` caching as required by the performance contract. ETag revalidation works (conditional index request returned 304), and the service worker supplies cache-first runtime behavior after installation, but CDN/browser HTTP caching remains misconfigured.

### Medium — framing/content policy headers are absent

Live responses include HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`, but include neither Content-Security-Policy nor an anti-framing control (`frame-ancestors` or `X-Frame-Options`). `Permissions-Policy` is also absent. This leaves the planner/licensing UI frameable and lacks a browser-enforced resource allowlist.

### Medium — the keyboard skip link does not perform its stated action

The first Tab correctly reveals `Skip to planner` with a 3px focus outline. Activating it changes the fragment to `#main`, moves focus to `BODY`, and scrolls only 23px because `#main` begins above the hero. It does not focus or skip to the planner. Tablist Arrow/Home/End behavior otherwise works.

### Low — first service-worker installation falsely announces an update

On a fresh live browser profile, initial service-worker installation showed `App updated. Reload when convenient.` Chrome reported the service worker active and the manifest valid. The update listener treats the initial `clients.claim()` activation as an existing-app update.

### Low — response MIME types are generic

The live manifest and AVIF assets are served as `application/octet-stream` rather than `application/manifest+json` and `image/avif`. Chromium parsed the manifest without errors and rendered the images, so this is a compatibility/polish issue rather than a current functional failure.

### Coverage gap — DST testing is not exhaustive

The 18-test suite covers spring-forward before/after/nonexistent times, half-hour `Asia/Kolkata`, UTC/floating/TZID/all-day ICS, recurrence, EXDATE, and recurrence across spring DST. It does not cover fall-back ambiguous wall times, non-hour DST transitions, or both boundaries in multiple hemispheres. That does not satisfy the brief's request for exhaustive timezone/DST testing even though the exercised cases pass.

## Release decision

**FAIL.** Do not release the paid offer until checkout registration works, fresh unverified tokens cannot unlock during verification failure, and the verification endpoint returns 429 plus `Retry-After` under burst. Re-run this full verification after those changes; also correct caching/security headers and the skip link before claiming all acceptance requirements.
