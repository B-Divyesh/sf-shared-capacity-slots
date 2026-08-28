# Shared Capacity Slots

Shared Capacity Slots is a private, offline-first capacity planner for two-to-five-person service businesses. It finds the appointments that a single shared calendar hides by modelling the actual people, rooms, and equipment each service can use.

Live product: <https://shared-capacity-slots.sociobot.in>

## What it does

- Defines people, rooms, equipment, and other constrained resources with regular working windows.
- Models each service as one or more requirements. Resources within a requirement are alternatives; separate requirements must all be satisfied.
- Imports `.ics` busy time into a selected resource without uploading the file.
- Handles UTC, floating, `TZID`, and all-day events plus daily, weekly, and monthly recurrence, `COUNT`, `UNTIL`, `BYDAY`, `BYMONTHDAY`, and `EXDATE`.
- Calculates conflict-free starts and exact parallel capacity in a chosen IANA timezone.
- Compares real capacity with the conservative “one shared busy calendar” baseline.
- Exports an availability CSV, advisory `VFREEBUSY` ICS, and a complete JSON backup.
- Persists the plan in IndexedDB and keeps working after installation without a network.

It deliberately does not accept bookings, write to source calendars, take payments directly, or monitor staff.

## Who it is for

Small mixed-service shops—such as clinics, studios, repair teams, and training rooms—where different appointments can be delivered by different combinations of staff and resources.

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open <http://localhost:5173>. No environment variables or backend are required.

## Test and build

```bash
npm test
npm run build
```

`npm test` runs 17 deterministic unit tests, a strict TypeScript production build, and Playwright flows in desktop Chromium and a 390px-class mobile viewport. The browser suite covers a complete create/import/calculate flow, keyboard navigation, axe checks, console errors, offline reload, and page overflow.

The exact deploy command is `npm run build`. Static output lands in `dist/`, with `dist/index.html` at its root. Deploy that directory as-is.

Optional asset regeneration:

```bash
npm run assets:icons
npm run assets:hero
```

The original generated hero and its prompt/provenance are in `assets/src/`. See [the visual thesis](.factory/design.md).

## Capacity rules

For each candidate start, the engine:

1. Checks each eligible resource’s regular working window.
2. Removes resources whose imported busy blocks overlap any part of the service.
3. Finds allocations that satisfy every service requirement with distinct resources.
4. Finds the maximum number of mutually disjoint allocations to report parallel capacity.

The comparison baseline treats any busy eligible resource as blocking the shared calendar. Results are advisory: always recheck live source calendars before confirming a booking.

## Local data and paid unlock

Planner data stays in browser IndexedDB. License tokens and their cached daily verification result use local storage. The app contains no analytics, trackers, remote fonts, or runtime CDN dependencies. See the in-product [privacy policy](https://shared-capacity-slots.sociobot.in/privacy/) and [terms](https://shared-capacity-slots.sociobot.in/terms/).

The free planner supports four resources, three services, and a 14-day horizon. The $29 one-time field kit unlocks unlimited saved resources and services plus a 28-day horizon. Checkout and license verification use only the Sociobot billing API; the factory registers the slug separately.

## V1 boundaries

- Each resource has one repeated working interval for its selected weekdays; split shifts and dated leave should be represented by ICS busy blocks.
- Complex recurrence constructs outside the documented set (for example yearly rules or `BYSETPOS`) are reported as skipped rather than silently interpreted.
- Imported calendars are file snapshots, not subscribed URLs. Re-import to reflect source-calendar changes.
- `VFREEBUSY` rendering varies by calendar client; CSV is the universal human-readable export.

## License

MIT. See [LICENSE](LICENSE).
