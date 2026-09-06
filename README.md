# Shared Capacity Slots

Shared Capacity Slots finds open service times across staff, rooms, and equipment. It is for small teams whose services need different resource combinations.

Live product: <https://shared-capacity-slots.sociobot.in>

One-click demo: <https://shared-capacity-slots.sociobot.in/?demo=1>

## What it does

- Defines people, rooms, equipment, working hours, and service requirements.
- Imports local ICS busy time for each resource.
- Calculates starts with complete, conflict-free resource assignments.
- Compares actual capacity with a conservative shared-calendar result.
- Exports availability CSV, advisory `VFREEBUSY` ICS, and a complete JSON backup.
- Stores real plans in browser IndexedDB and reloads offline after the first visit.
- Handles timezone gaps and repeated times across northern, southern, and half-hour DST transitions.

It does not accept bookings, edit source calendars, process payments, or monitor staff.

## Try the isolated demo

Open `/?demo=1` or select **Try it with sample data**. The demo immediately calculates a four-resource studio plan. Its state stays in memory and never reads or writes the real IndexedDB plan. **Reset demo** restores the sample. **Start for real** discards demo changes.

## Run locally

Install Node.js 22 or newer, then run:

```bash
npm ci
npm run dev
```

Open <http://localhost:5173>. No environment variables or backend are required.

## Test and build

From a clean checkout, run:

```bash
npm ci
npm test
npm audit --omit=dev
```

`npm test` runs unit tests, strict TypeScript compilation, the production build, and desktop/mobile Playwright tests. Browser projects use one worker because the supplied Chromium build is unstable under concurrent startup in constrained containers.

Each public product claim and its focused command is listed in [`.factory/claims.json`](.factory/claims.json). The production build is written to `dist/`, with `dist/index.html` at its root.

Optional asset regeneration:

```bash
npm run assets:icons
npm run assets:hero
```

The original generated illustration and its provenance are in `assets/src/` and [`.factory/design.md`](.factory/design.md).

## Capacity rules

For each candidate start, the engine checks working hours, removes busy resources, satisfies every requirement with distinct resources, and reports parallel capacity. Results are advisory. Check current source calendars before accepting a booking.

## Local data and paid field kit

Real planner data uses browser IndexedDB. License tokens and verified daily verdicts use local storage. The free flow sends no calendar data, analytics, trackers, fonts, or scripts to another origin. License verification uses only the Sociobot billing API after a token is entered.

The free planner supports four resources, three services, and 14-day planning. A verified $29 one-time field-kit license adds unlimited saved resources and services plus 28-day planning. Fresh or changed tokens stay locked until the billing API returns a valid result. The separate billing operator must register the offer before production checkout can accept a purchase; public registration metadata is in [`.factory/billing-offer.json`](.factory/billing-offer.json).

See the [privacy policy](https://shared-capacity-slots.sociobot.in/privacy/) and [terms](https://shared-capacity-slots.sociobot.in/terms/).

## Current boundaries

- A resource has one repeated daily working interval. Use imported busy time for split shifts and dated leave.
- Yearly recurrence and `BYSETPOS` are reported as unsupported instead of being silently interpreted.
- ICS imports are snapshots, not subscribed feeds. Re-import after a source calendar changes.
- Calendar clients vary in how they display `VFREEBUSY`; CSV is the readable fallback.

## License

MIT. See [LICENSE](LICENSE).
