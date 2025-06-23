# DateTz Class Documentation

## Overview

The `DateTz` class represents a date and time in a specific timezone. It provides utilities for formatting, parsing, comparing, and manipulating date and time values with full timezone support.

---

## Constructor

```ts
new DateTz(value: IDateTz)
new DateTz(value: number, tz?: string)
```

- Accepts either an `IDateTz` object or a Unix timestamp with an optional timezone.
- Throws an error if the provided timezone is invalid.

---

## Properties

### Instance Properties

- `timestamp: number` — Milliseconds since Unix epoch (UTC).
- `timezone: string` — The timezone identifier (e.g., `"UTC"`, `"Europe/Rome"`).

### Static Properties

- `DateTz.defaultFormat: string` — Default string format pattern: `'YYYY-MM-DD HH:mm:ss'`.

---

## Getters

- `timezoneOffset: number` — Returns the timezone offset in minutes.
- `year: number` — Returns the full year.
- `month: number` — Returns the month (0–11).
- `day: number` — Returns the day of the month (1–31).
- `hour: number` — Returns the hour (0–23).
- `minute: number` — Returns the minute (0–59).
- `dayOfWeek: number` — Returns the day of the week (0–6).

---

## Methods

### `compare(other: IDateTz): number`

Compares this instance with another `DateTz`. Throws if timezones differ.

### `isComparable(other: IDateTz): boolean`

Returns `true` if the two instances share the same timezone.

### `toString(pattern?: string): string`

Returns the string representation using the provided format.

#### Format Tokens

| Token | Meaning         |
|-------|-----------------|
| YYYY, yyyy | Full year       |
| YY, yy     | Last 2 digits   |
| MM         | Month (01–12)   |
| DD         | Day (01–31)     |
| HH         | Hour (00–23)    |
| hh         | Hour (01–12)    |
| mm         | Minute (00–59)  |
| ss         | Second (00–59)  |
| aa, AA     | AM/PM marker    |
| tz         | Timezone string |

### `add(value: number, unit: 'minute' | 'hour' | 'day' | 'month' | 'year'): this`

Adds the given time to the instance.

### `set(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute'): this`

Sets a specific part of the date/time.

### `convertToTimezone(tz: string): this`

Changes the timezone of the instance in place.

### `cloneToTimezone(tz: string): DateTz`

Returns a new instance in the specified timezone.

---

## Static Methods

### `DateTz.parse(dateString: string, pattern?: string, tz?: string): DateTz`

Parses a string to a `DateTz` instance.

### `DateTz.now(tz?: string): DateTz`

Returns the current date/time as a `DateTz` instance.

---

## Utility Methods (Private)

- `stripSMs(timestamp: number): number` — Removes seconds and milliseconds.
- `isLeapYear(year: number): boolean` — Determines if the year is a leap year.
- `daysInYear(year: number): number` — Returns days in a year.

---

## Example

```ts
const dt = new DateTz(1719146400000, 'Europe/Rome');
console.log(dt.toString());

dt.add(1, 'day');
console.log(dt.day);

const parsed = DateTz.parse("2025-06-23 14:00:00", "YYYY-MM-DD HH:mm:ss", "Europe/Rome");
console.log(parsed.toString());
```

---

## Error Handling

- Throws on invalid timezone.
- Throws if trying to compare across timezones.
- Throws if parsing a 12-hour format without AM/PM marker.

---

## Requirements

Requires:
- `timezones` object mapping timezone identifiers to UTC offsets.
- `daysPerMonth`, `MS_PER_DAY`, `MS_PER_HOUR`, `MS_PER_MINUTE`, `epochYear` constants.

---

## Summary

`DateTz` is ideal for handling precise and consistent date/time values across multiple timezones with customizable formatting, parsing, and manipulation options.

