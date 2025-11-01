# Date TZ ⏰✨

`DateTz` is the timezone swiss‑army knife for modern JavaScript and TypeScript projects. It keeps minute-precision timestamps aligned with IANA zones, gracefully glides across daylight-saving transitions, and exposes a lightweight API that feels familiar yet powerful. Whether you are building dashboards, schedulers, or automation pipelines, DateTz keeps your time math honest. 🌍

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Why DateTz?](#why-datetz)
4. [API Surface Overview](#api-surface-overview)
5. [Formatting Tokens](#formatting-tokens)
6. [Core Concepts & Recipes](#core-concepts--recipes)
7. [Daylight Saving Time Deep Dive](#daylight-saving-time-deep-dive)
8. [Real-World Playbook](#real-world-playbook)
9. [Build & Distribution](#build--distribution)
10. [TypeScript & Tooling](#typescript--tooling)
11. [Performance Tips](#performance-tips)
12. [FAQ & Troubleshooting](#faq--troubleshooting)
13. [Contributing](#contributing)
14. [License](#license)

---

## Quick Start

```ts
import { DateTz } from '@lbd-sh/date-tz';

// Create a meeting in Rome and preview it elsewhere
const rome = new DateTz(Date.UTC(2025, 5, 15, 7, 30), 'Europe/Rome');
const nyc = rome.cloneToTimezone('America/New_York');

rome.toString();                              // "2025-06-15 09:30:00"
rome.toString('DD LM YYYY HH:mm tz', 'en');   // "15 June 2025 09:30 Europe/Rome"
nyc.toString('YYYY-MM-DD HH:mm tz');          // "2025-06-15 03:30 America/New_York"

rome.add(2, 'day').set(11, 'hour');           // Mutating, still DST-safe
```

Need a full workflow? Jump to the [Real-World Playbook](#real-world-playbook). 👇

---

## Installation

```bash
npm install @lbd-sh/date-tz
# or
yarn add @lbd-sh/date-tz
# or
pnpm add @lbd-sh/date-tz
```

DateTz ships as CommonJS with TypeScript declarations. No runtime dependencies, no polyfills.

---

## Why DateTz?

- **Predictable math** 🧮 – timestamps are truncated to minutes so cron-like workflows never drift by milliseconds.
- **DST aware** 🌓 – offsets are sourced from the bundled `timezones` map and double-checked via `Intl.DateTimeFormat`.
- **Expressive formatting** 🖨️ – familiar tokens (`YYYY`, `MM`, `hh`, `AA`, `tz`, `LM`, etc.) with locale-aware month names.
- **Simple conversions** 🔁 – `convertToTimezone` and `cloneToTimezone` make cross-zone comparisons painless.
- **TypeScript-first** 📘 – strong typings, `IDateTz` contract, and declaration files baked in.
- **Zero dependencies** 🪶 – keep bundles lean while gaining runtime confidence.

---

## API Surface Overview

| Member | Description |
| ------ | ----------- |
| `new DateTz(value, tz?)` | Build from a timestamp or an `IDateTz`-compatible object (timezone defaults to `UTC`). |
| `DateTz.now(tz?)` | Current moment in the requested timezone. |
| `DateTz.parse(str, pattern?, tz?)` | Parse formatted strings into `DateTz` instances. |
| `DateTz.defaultFormat` | Default pattern used by `toString()` when no arguments are provided. |
| Getters | `year`, `month`, `day`, `hour`, `minute`, `dayOfWeek`, `isDst`, `timezoneOffset`. |
| Mutators | `add(value, unit)`, `set(value, unit)`, `convertToTimezone(tz)` (mutating), `cloneToTimezone(tz)` (immutable). |
| Comparison | `compare(other)`, `isComparable(other)` guard against cross-zone mistakes. |

---

## Formatting Tokens

| Token | Meaning | Example |
| ----- | ------- | ------- |
| `YYYY`, `yyyy` | Four-digit year | `2025` |
| `YY`, `yy` | Two-digit year | `25` |
| `MM` | Month (01–12) | `06` |
| `LM` | Locale month name (capitalised) | `June` |
| `DD` | Day of month (01–31) | `15` |
| `HH` | Hour (00–23) | `09` |
| `hh` | Hour (01–12) | `03` |
| `mm` | Minute (00–59) | `30` |
| `ss` | Second (00–59) | `00` |
| `aa` | Lowercase am/pm marker | `pm` |
| `AA` | Uppercase AM/PM marker | `PM` |
| `tz` | Timezone identifier | `Europe/Rome` |

> Literal text? Wrap it in square brackets: `YYYY-MM-DD[ @ ]HH:mm` → `2025-06-15 @ 09:30`.

---

## Core Concepts & Recipes

### Creating Dates

```ts
import { DateTz, IDateTz } from '@lbd-sh/date-tz';

const utc = new DateTz(Date.now(), 'UTC');
const tokyo = new DateTz({ timestamp: Date.now(), timezone: 'Asia/Tokyo' } satisfies IDateTz);
const la = DateTz.now('America/Los_Angeles');
```

### From Native Date

```ts
const native = new Date();
const madrid = new DateTz(native.getTime(), 'Europe/Madrid');
const alwaysUtc = new DateTz(native.getTime(), 'UTC').cloneToTimezone('Europe/Madrid');
```

### Formatting Showcases

```ts
const invoice = new DateTz(Date.UTC(2025, 10, 5, 16, 45), 'Europe/Paris');

invoice.toString();                                 // "2025-11-05 17:45:00"
invoice.toString('DD/MM/YYYY HH:mm');               // "05/11/2025 17:45"
invoice.toString('LM DD, YYYY hh:mm aa', 'fr');     // "Novembre 05, 2025 05:45 pm"
invoice.toString('[Order timezone:] tz');           // "Order timezone: Europe/Paris"
```

### Parsing Scenarios

```ts
DateTz.parse('2025-09-01 02:30', 'YYYY-MM-DD HH:mm', 'Asia/Singapore'); // 24h format
DateTz.parse('03-18-2025 07:15 PM', 'MM-DD-YYYY hh:mm AA', 'America/New_York'); // 12h
DateTz.parse('Sale closes 2025/03/31 @ 23:59', 'Sale closes YYYY/MM/DD [@] HH:mm', 'UTC'); // Literals
```

Parsing throws on invalid zones or incompatible patterns (e.g. `hh` without `aa`/`AA`).

### Arithmetic Cookbook

```ts
const sprint = new DateTz(Date.UTC(2025, 1, 1, 9, 0), 'Europe/Amsterdam');

sprint.add(14, 'day'); // Compose to simulate weeks
sprint.set(sprint.month + 1, 'month').set(1, 'day'); // First day of next month
while ([0, 6].includes(sprint.dayOfWeek)) sprint.add(1, 'day'); // Skip weekend
sprint.set(10, 'hour').set(0, 'minute'); // Move to 10:00
```

### Immutability Pattern

```ts
const base = DateTz.now('UTC');
const nextRun = new DateTz(base).add(1, 'day');
```

Mutators change the instance; use cloning when you need persistence.

### Comparing & Sorting

```ts
const slots = [
  DateTz.parse('2025-06-15 08:00', 'YYYY-MM-DD HH:mm', 'Europe/Rome'),
  DateTz.parse('2025-06-15 09:00', 'YYYY-MM-DD HH:mm', 'Europe/Rome'),
  DateTz.parse('2025-06-14 18:00', 'YYYY-MM-DD HH:mm', 'Europe/Rome'),
];

slots.sort((a, b) => a.compare(b));
```

Always guard cross-zone comparisons:

```ts
const rome = DateTz.now('Europe/Rome');
const ny = DateTz.now('America/New_York');

if (!rome.isComparable(ny)) ny.convertToTimezone(rome.timezone);
```

---

## Daylight Saving Time Deep Dive

```ts
const dstEdge = new DateTz(Date.UTC(2025, 2, 30, 0, 30), 'Europe/Rome'); // DST start night

dstEdge.toString();        // "2025-03-30 01:30:00"
dstEdge.add(1, 'hour');
dstEdge.toString();        // "2025-03-30 03:30:00" (skips 02:30)
dstEdge.isDst;             // true
```

Under the hood:

- Offsets are cached per timestamp (`offsetCache`) for speed.
- If `Intl.DateTimeFormat` is available, DateTz validates the actual offset at runtime.
- Without `Intl`, DateTz falls back to the static `timezones` map, so you can safely run on serverless or sandboxed environments.

### Timezone Conversion

```ts
const flight = new DateTz(Date.UTC(2025, 3, 28, 20, 0), 'Europe/London');

const takeoff = flight.cloneToTimezone('America/Los_Angeles'); // immutable
const landing = flight.cloneToTimezone('Asia/Tokyo');
```

Use `convertToTimezone` if you want to mutate the instance in-place.

---

## Real-World Playbook

### Scheduling Emails Across Offices 📧

```ts
const offices = [
  { tz: 'Europe/Rome', hour: 9 },
  { tz: 'America/New_York', hour: 9 },
  { tz: 'Asia/Tokyo', hour: 9 },
];

const base = DateTz.now('UTC').set(0, 'minute');

const sends = offices.map(({ tz, hour }) => {
  const local = new DateTz(base).convertToTimezone(tz);
  local.set(hour, 'hour');
  if (local.compare(base) < 0) local.add(1, 'day');
  return local;
});
```

### React Component Integration ⚛️

```tsx
import { useMemo } from 'react';
import { DateTz } from '@lbd-sh/date-tz';

export function Countdown({ timestamp, tz }: { timestamp: number; tz: string }) {
  const target = useMemo(() => new DateTz(timestamp, tz), [timestamp, tz]);
  return (
    <span title={target.toString('YYYY-MM-DD HH:mm tz')}>
      {target.toString('DD MMM YYYY, HH:mm', navigator.language)}
    </span>
  );
}
```

### Express Middleware 🛤️

```ts
app.use((req, _res, next) => {
  const headerTz = req.header('x-user-tz') ?? 'UTC';
  req.context = {
    now: () => DateTz.now(headerTz),
  };
  next();
});
```

### Testing Automation with Jest 🧪

```ts
import { DateTz } from '@lbd-sh/date-tz';

describe('billing cutoff', () => {
  it('moves to next business day when on weekend', () => {
    const friday = DateTz.parse('2025-06-13 17:00', 'YYYY-MM-DD HH:mm', 'Europe/Rome');
    friday.add(1, 'day');
    expect(friday.dayOfWeek).toBe(6);
    friday.add(2, 'day');
    expect(friday.dayOfWeek).toBe(1);
  });
});
```

---

## Build & Distribution

- The compiled CommonJS bundle plus declarations live in `dist/` (`index.js`, `index.d.ts`, maps, and helpers).
- `package.json` already points `main` and `types` at the compiled output, so consumers never need the TypeScript sources.
- Rebuild locally before opening a PR:

  ```bash
  npm ci
  npm run build
  ```

- Publishing to npm is handled by the maintainers. Contributors can stop at the build step and submit a pull request.

---

## TypeScript & Tooling

- `IDateTz` describes constructor-friendly shapes.
- `timezones` exports the full offset map (`Record<string, { sdt: number; dst: number }>`).
- Compatible with bundlers (Webpack, Vite, TurboPack). For ESM projects, use transpilation or `dynamic import`.

```ts
import type { IDateTz } from '@lbd-sh/date-tz';

function normalise(input: IDateTz): IDateTz {
  return new DateTz(input).cloneToTimezone('UTC');
}
```

---

## Performance Tips

1. **Reuse instances** when adjusting a datetime in a tight loop (mutating via `set`/`add` avoids allocations).
2. **Cache conversions**: if you often convert the same timestamp across timezones, keep the clones.
3. **Disable locale formatting** (`toString(pattern)` without the `locale` argument) for the fastest path.
4. **Tree-shake**: import only what you need (`import { DateTz }` instead of wildcard).

---

## FAQ & Troubleshooting

**Q: Can I format with seconds or milliseconds?**  
A: Seconds (`ss`) are supported. Milliseconds are intentionally dropped to keep arithmetic deterministic. Store them separately if needed.

**Q: Why can’t I compare two dates with different timezones?**  
A: `compare` guards against mistakes. Convert one date (`cloneToTimezone`) before comparing.

**Q: How do I add weeks?**  
A: Compose calls (`add(7, 'day')`). Weeks are not a native unit to keep the API small and explicit.

**Q: Do I need to ship the entire `timezones` map?**  
A: The map is ~40 KB minified. For extreme optimisation you can pre-prune zones before bundling.

---

## Contributing

- 💡 Open feature ideas or bug reports at [github.com/lbdsh/date-tz/issues](https://github.com/lbdsh/date-tz/issues).
- 🔁 Submit pull requests following the existing linting/build steps (`npm ci && npm run build`).
- 📦 Releases are automated through the GitHub workflow in `.github/workflows/production.yaml`.

Community feedback keeps DateTz sharp—thanks for being part of it! 🙌

---

## License

ISC © lbd-sh
