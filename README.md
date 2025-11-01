# Date TZ

Powerful, dependency-free timezone utilities for JavaScript and TypeScript. `DateTz` keeps minute-precision timestamps aligned with IANA timezones, detects daylight-saving transitions automatically, and pairs a tiny API with comprehensive TypeScript definitions.

## TL;DR

```ts
import { DateTz } from '@lbd-sh/date-tz';

const rome = new DateTz(Date.UTC(2025, 5, 15, 7, 30), 'Europe/Rome');

rome.toString();                              // "2025-06-15 09:30:00"
rome.toString('DD LM YYYY HH:mm tz', 'en');   // "15 June 2025 09:30 Europe/Rome"
rome.isDst;                                   // true

const nyc = rome.cloneToTimezone('America/New_York');
nyc.toString('YYYY-MM-DD HH:mm tz');          // "2025-06-15 03:30 America/New_York"

rome.add(2, 'day').set(11, 'hour');
rome.toString('YYYY-MM-DD HH:mm');            // "2025-06-17 11:30"
```

## Installation

```bash
npm install @lbd-sh/date-tz
# or
yarn add @lbd-sh/date-tz
# or
pnpm add @lbd-sh/date-tz
```

## Why DateTz?

- **Predictable arithmetic** – timestamps are truncated to minutes to avoid millisecond drift.
- **DST aware** – offsets come from the bundled `timezones` map and are verified via `Intl.DateTimeFormat` when available.
- **Rich formatting/parsing** – reuse familiar tokens (`YYYY`, `MM`, `hh`, `AA`, `tz`, `LM` for locale month names, and more).
- **Lean footprint** – no runtime dependencies, CommonJS output plus type declarations.
- **Ergonomic conversions** – move or clone dates across timezones in one call.

## API Surface at a Glance

| Member | Description |
| ------ | ----------- |
| `new DateTz(value, tz?)` | Accepts a timestamp or an `IDateTz` compliant object plus an optional timezone id. |
| `DateTz.now(tz?)` | Returns the current moment in the given timezone (default `UTC`). |
| `DateTz.parse(string, pattern?, tz?)` | Creates a date from a formatted string. |
| `DateTz.defaultFormat` | Global default pattern used by `toString()` with no args. |
| Instance getters | `year`, `month`, `day`, `hour`, `minute`, `dayOfWeek`, `isDst`, `timezoneOffset`. |
| Instance methods | `toString(pattern?, locale?)`, `compare(other)`, `isComparable(other)`, `add(value, unit)`, `set(value, unit)`, `convertToTimezone(tz)`, `cloneToTimezone(tz)`. |

## Pattern Tokens

| Token | Meaning | Example |
| ----- | ------- | ------- |
| `YYYY`, `yyyy` | Four digit year | `2025` |
| `YY`, `yy` | Two digit year | `25` |
| `MM` | Month (01–12) | `06` |
| `LM` | Locale month name (capitalised) | `June` |
| `DD` | Day of month (01–31) | `15` |
| `HH` | Hour (00–23) | `09` |
| `hh` | Hour (01–12) | `03` |
| `mm` | Minute (00–59) | `30` |
| `ss` | Second (00–59) | `00` |
| `aa` | `am`/`pm` marker | `am` |
| `AA` | `AM`/`PM` marker | `PM` |
| `tz` | Timezone identifier | `Europe/Rome` |

> Need literal text? Keep it inside square brackets. Example: `YYYY-MM-DD[ @ ]HH:mm` → `2025-06-15 @ 09:30`. Characters inside brackets remain unchanged.

## Creating Dates

```ts
import { DateTz, IDateTz } from '@lbd-sh/date-tz';

// From a unix timestamp (milliseconds)
const utcMeeting = new DateTz(Date.UTC(2025, 0, 1, 12, 0), 'UTC');

// From another DateTz-like object
const seed: IDateTz = { timestamp: Date.now(), timezone: 'Asia/Tokyo' };
const tokyo = new DateTz(seed);

// Using the helper
const laNow = DateTz.now('America/Los_Angeles');
```

### Working With Plain Date Objects

```ts
const native = new Date();
const madrid = new DateTz(native.getTime(), 'Europe/Madrid');

// Alternatively, keep everything UTC and convert when needed
const fromUtc = new DateTz(native.getTime(), 'UTC').cloneToTimezone('Europe/Madrid');
```

## Formatting Showcases

```ts
const order = new DateTz(Date.UTC(2025, 10, 5, 16, 45), 'Europe/Paris');

order.toString();                             // "2025-11-05 17:45:00"
order.toString('DD/MM/YYYY HH:mm');           // "05/11/2025 17:45"
order.toString('LM DD, YYYY hh:mm aa', 'fr'); // "Novembre 05, 2025 05:45 pm"
order.toString('[Order timezone:] tz');       // "Order timezone: Europe/Paris"
```

### Locale-sensitive Month Names

`LM` maps to `new Date(year, month, 3).toLocaleString(locale, { month: 'long' })` ensuring accurate localisation without full `Intl` formatting.

## Parsing Scenarios

```ts
// Standard 24h format
const release = DateTz.parse('2025-09-01 02:30', 'YYYY-MM-DD HH:mm', 'Asia/Singapore');

// 12h format (requires AM/PM marker)
const dinner = DateTz.parse('03-18-2025 07:15 PM', 'MM-DD-YYYY hh:mm AA', 'America/New_York');

// Custom tokens with literal text
const promo = DateTz.parse('Sale closes 2025/03/31 @ 23:59', 'Sale closes YYYY/MM/DD [@] HH:mm', 'UTC');
```

Parsing throws when the timezone id is missing or invalid, or when pattern/token combos are incompatible (for example `hh` without `aa`/`AA`).

## Arithmetic Cookbook

```ts
const sprint = new DateTz(Date.UTC(2025, 1, 1, 9, 0), 'Europe/Amsterdam');

sprint.add(2, 'week'); // ❌ week not supported
// Use compositions instead:
sprint.add(14, 'day');

// Move to first business day of next month
sprint.set(sprint.month + 1, 'month');
sprint.set(1, 'day');
while ([0, 6].includes(sprint.dayOfWeek)) {
  sprint.add(1, 'day');
}

// Shift to 10:00 local time
sprint.set(10, 'hour').set(0, 'minute');
```

`add` accepts `minute`, `hour`, `day`, `month`, `year`. Compose multiple calls for complex adjustments. Overflows and leap years are handled automatically.

### Immutable Patterns

`add`, `set`, and `convertToTimezone` mutate the instance. Use `cloneToTimezone` or spread semantics when immutability is preferred:

```ts
const base = DateTz.now('UTC');
const iteration = new DateTz(base);
iteration.add(1, 'day');
```

## Comparing & Sorting

```ts
const slots = [
  new DateTz(Date.UTC(2025, 6, 10, 8, 0), 'Europe/Rome'),
  new DateTz(Date.UTC(2025, 6, 10, 9, 0), 'Europe/Rome'),
  new DateTz(Date.UTC(2025, 6, 9, 18, 0), 'Europe/Rome'),
];

slots.sort((a, b) => a.compare(b));
```

`compare` throws if timezones differ:

```ts
const rome = DateTz.now('Europe/Rome');
const ny = DateTz.now('America/New_York');

if (!rome.isComparable(ny)) {
  ny.convertToTimezone(rome.timezone);
}

rome.compare(ny);
```

## Timezone Conversion Deep Dive

```ts
const flight = new DateTz(Date.UTC(2025, 3, 28, 20, 0), 'Europe/London');

const takeoff = flight.cloneToTimezone('America/Los_Angeles');
const landing = flight.cloneToTimezone('Asia/Tokyo');

takeoff.isDst; // false (London DST might not have started yet)
landing.isDst; // true or false depending on Tokyo rules
```

- `convertToTimezone` mutates the instance.
- `cloneToTimezone` returns a new instance.
- Both refresh the cached offset and leverage the `Intl` API to detect real-world DST offsets (falling back to the static map).

### DST Transition Example

```ts
const dstEdge = new DateTz(Date.UTC(2025, 2, 30, 0, 30), 'Europe/Rome'); // Night DST starts

dstEdge.toString();          // "2025-03-30 01:30:00"
dstEdge.add(1, 'hour');
dstEdge.toString();          // "2025-03-30 03:30:00" (skips 02:30 automatically)
dstEdge.isDst;               // true
```

## Working with Collections

```ts
const timeline = [
  DateTz.parse('2025-06-15 09:30', 'YYYY-MM-DD HH:mm', 'Europe/Rome'),
  DateTz.parse('2025-06-15 10:00', 'YYYY-MM-DD HH:mm', 'Europe/Rome'),
  DateTz.parse('2025-06-15 09:45', 'YYYY-MM-DD HH:mm', 'Europe/Rome'),
];

const sorted = timeline.slice().sort((a, b) => a.compare(b));

// Group by day
const byDate = sorted.reduce<Record<string, DateTz[]>>((acc, slot) => {
  const key = slot.toString('YYYY-MM-DD');
  (acc[key] ||= []).push(slot);
  return acc;
}, {});
```

## Serialization Tips

```ts
const payload = {
  createdAt: DateTz.now('UTC').toString(),
  timestamp: Date.now(),
};

// Later...
const restored = new DateTz(payload.timestamp, 'UTC');
```

Prefer storing the timestamp (UTC) and timezone id. When deserialising, feed both back into the constructor for deterministic results.

## Extending the Timezone Map

```ts
import { timezones } from '@lbd-sh/date-tz';

timezones['Custom/Island'] = { sdt: 32_400, dst: 36_000 }; // Offsets in seconds

const island = new DateTz(Date.now(), 'Custom/Island');
```

> Ensure keys follow IANA naming conventions. Offsets are seconds from UTC (negative for west, positive for east).

## TypeScript Excellence

```ts
import type { IDateTz } from '@lbd-sh/date-tz';

function normalise(date: IDateTz): IDateTz {
  const instance = new DateTz(date);
  return instance.cloneToTimezone('UTC');
}
```

`IDateTz` lets you accept plain objects from APIs while still benefiting from compile-time guarantees.

## Interoperability Patterns

### With Fetch / APIs

```ts
const response = await fetch('/api/events');
const body: { timestamp: number; timezone: string }[] = await response.json();

const events = body.map(({ timestamp, timezone }) => new DateTz(timestamp, timezone));
```

### With Cron-like Scheduling

```ts
const job = new DateTz(Date.UTC(2025, 5, 1, 5, 0), 'America/New_York');

while (job.compare(DateTz.now('America/New_York')) < 0) {
  job.add(1, 'day');
}
```

## Packaging Notes

- The published CommonJS bundle lives in `dist/index.js`; declarations and maps ship alongside (`index.d.ts`, `*.map`).
- `package.json` exposes `main` and `types` from the compiled output, so consumers do not need to run TypeScript.
- Build locally with:

  ```bash
  npm install
  npm run build
  ```

- The GitHub Action (`.github/workflows/production.yaml`) produces the build, versions using GitVersion, and publishes to npm as `@lbd-sh/date-tz`.

## Roadmap Ideas

- Add optional ESM build targets.
- Ship a companion utilities layer (diffs, ranges, calendars).
- Expand token set with `W` (ISO week) and `ddd` (weekday short names).

Contributions and feature requests are welcome — open an issue at [github.com/lbdsh/date-tz/issues](https://github.com/lbdsh/date-tz/issues).

## License

ISC © lbd-sh
