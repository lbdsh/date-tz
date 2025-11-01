# Date TZ

Powerful timezone-aware date utilities for JavaScript and TypeScript. `DateTz` keeps timestamps in sync with IANA timezones, handles daylight-saving changes transparently, and exposes a tiny, dependency-free API that stays close to the platform `Date` object while remaining predictable.

## Features

- Full TypeScript support with `DateTz`, `IDateTz`, and the bundled `timezones` catalog.
- Minute-precision timestamps normalised to UTC while exposing friendly getters (`year`, `month`, `day`, ...).
- Formatting and parsing with familiar tokens (`YYYY`, `MM`, `DD`, `HH`, `hh`, `aa`, `tz`, and more).
- Arithmetic helpers (`add`, `set`) that respect leap years, month lengths, and DST.
- Instant timezone conversion with `convertToTimezone` and `cloneToTimezone`, backed by automatic DST detection (`Intl.DateTimeFormat`).
- Works in Node.js and modern browsers without polyfills.

## Installation

```bash
npm install @lbd-sh/date-tz
# or
yarn add @lbd-sh/date-tz
```

## Quick Start

```ts
import { DateTz } from '@lbd-sh/date-tz';

// Create a Rome-based date for 2025-03-01 09:15
const meeting = new DateTz(Date.UTC(2025, 2, 1, 8, 15), 'Europe/Rome');

meeting.toString();                    // "2025-03-01 09:15:00"
meeting.toString('DD MMM YYYY HH:mm'); // "01 Mar 2025 09:15"

// Move the meeting forward and switch to New York time
meeting.add(1, 'day').add(2, 'hour');
const nyc = meeting.cloneToTimezone('America/New_York');

nyc.toString('YYYY-MM-DD HH:mm tz');   // "2025-03-02 05:15 America/New_York"
nyc.isDst;                             // true or false depending on the date
```

## Usage

### Creating Dates

```ts
import { DateTz, IDateTz } from '@lbd-sh/date-tz';

new DateTz(Date.now(), 'UTC');
new DateTz(1719753300000, 'Europe/Rome');
new DateTz({ timestamp: Date.now(), timezone: 'Asia/Tokyo' } satisfies IDateTz);

DateTz.now('America/Los_Angeles');
```

Notes:

- Timestamps are stored in milliseconds since the Unix epoch and are truncated to the nearest minute (`seconds` and `milliseconds` are dropped) for deterministic arithmetic.
- Timezone identifiers must exist in the bundled `timezones` map; an error is thrown otherwise.

### Formatting

`DateTz.toString` accepts an optional pattern and locale. Unspecified tokens fall back to the default `DateTz.defaultFormat` (`YYYY-MM-DD HH:mm:ss`).

```ts
const invoice = new DateTz(Date.UTC(2025, 5, 12, 12, 0), 'Europe/Paris');

invoice.toString();                            // "2025-06-12 14:00:00"
invoice.toString('DD/MM/YYYY HH:mm tz');       // "12/06/2025 14:00 Europe/Paris"
invoice.toString('LM DD, YYYY hh:mm aa', 'it'); // "Giugno 12, 2025 02:00 pm"
```

Available tokens:

| Token | Meaning | Example |
| ----- | ------- | ------- |
| `YYYY`, `yyyy` | Full year | `2025` |
| `YY`, `yy` | Year, two digits | `25` |
| `MM` | Month (01–12) | `06` |
| `LM` | Locale month name (capitalised) | `Giugno` |
| `DD` | Day of month (01–31) | `12` |
| `HH` | Hours (00–23) | `14` |
| `hh` | Hours (01–12) | `02` |
| `mm` | Minutes (00–59) | `00` |
| `ss` | Seconds (00–59) | `00` |
| `aa` | `am`/`pm` marker | `pm` |
| `AA` | `AM`/`PM` marker | `PM` |
| `tz` | Timezone identifier | `Europe/Paris` |

### Parsing strings

`DateTz.parse` mirrors `toString`: pass the source string, its pattern, and an optional timezone (default `UTC`).

```ts
import { DateTz } from '@lbd-sh/date-tz';

const parsed = DateTz.parse(
  '2025-06-12 02:00 PM',
  'YYYY-MM-DD hh:mm AA',
  'America/New_York'
);

parsed.timestamp;     // Milliseconds in UTC (minute precision)
parsed.timezone;      // "America/New_York"
parsed.isDst;         // true/false depending on the moment
```

> 12-hour patterns require both `hh` and the `AA`/`aa` markers when parsing. If you only need 24-hour formats, prefer `HH`.

### Arithmetic

Mutating helpers operate in-place and normalise overflows:

```ts
const endOfQuarter = new DateTz(Date.UTC(2025, 2, 31, 23, 0), 'UTC');

endOfQuarter.add(1, 'day');        // 2025-04-01 23:00
endOfQuarter.set(6, 'month');      // 2025-06-01 23:00
endOfQuarter.set(2026, 'year');    // 2026-06-01 23:00
```

All arithmetic respects leap years, month lengths, and daylight-saving changes via the offset cache.

### Comparing

```ts
const rome = DateTz.now('Europe/Rome');
const madrid = DateTz.now('Europe/Madrid');

rome.isComparable(madrid);  // false (different timezones)

const laterInRome = new DateTz(rome.timestamp + 60_000, 'Europe/Rome');
rome.compare(laterInRome);  // negative number
```

`compare` throws when timezones differ to avoid accidental cross-timezone comparisons. Use `isComparable` first, or convert one date.

### Timezone conversion

```ts
const departure = new DateTz(Date.UTC(2025, 4, 15, 6, 45), 'Europe/Rome');

departure.isDst; // true/false depending on the date

// Modify in place
departure.convertToTimezone('America/New_York');

// Clone to keep the original instance
const arrival = departure.cloneToTimezone('Asia/Tokyo');
```

Timezone changes refresh the internal offset cache and leverage `Intl.DateTimeFormat` when available to detect real-world DST shifts.

### Accessing components

```ts
const dt = DateTz.now('UTC');

dt.year;       // e.g. 2025
dt.month;      // 0-based (0 = January)
dt.day;        // 1-31
dt.hour;       // 0-23
dt.minute;     // 0-59
dt.dayOfWeek;  // 0 (Sunday) to 6 (Saturday)
dt.timezone;   // Timezone id provided at creation
dt.timezoneOffset; // { sdt, dst } seconds from UTC
```

## Type Definitions

The package ships with comprehensive typings:

- `DateTz` implements `IDateTz`.
- `IDateTz` describes objects that can seed the constructor.
- `timezones` is a `Record<string, { sdt: number; dst: number }>` that exposes offsets in seconds.

Import what you need:

```ts
import { DateTz, IDateTz, timezones } from '@lbd-sh/date-tz';
```

## Timezone catalogue

- Contains 500+ IANA identifiers with both standard (`sdt`) and daylight (`dst`) offsets in seconds.
- When `dst === sdt`, the zone does not observe daylight saving time.
- You can inspect or extend the map in `timezones.ts` before bundling into your application.

## Publishing & Packaging

- Build with `npm run build` (TypeScript emits to `dist/` with declarations and source maps).
- `package.json` maps `main` and `types` to the compiled output, so consumers do not need TypeScript.
- The GitHub Action (`.github/workflows/production.yaml`) compiles, versions, and publishes to npm as `@lbd-sh/date-tz`.

## License

ISC © lbd-sh
