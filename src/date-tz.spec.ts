import { describe, expect, it } from 'vitest';
import { DateTz } from './date-tz';
import { IDateTz } from './idate-tz';

const BASE_TIMESTAMP = Date.UTC(2021, 0, 1, 0, 0); // 2021-01-01 00:00 UTC

describe('DateTz', () => {
  it('creates an instance from a timestamp and timezone', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(dateTz.timestamp).toBe(BASE_TIMESTAMP);
    expect(dateTz.timezone).toBe('UTC');
  });

  it('creates an instance from an IDateTz-like object', () => {
    const dateTz = new DateTz({ timestamp: BASE_TIMESTAMP, timezone: 'Europe/Rome' });
    expect(dateTz.timestamp).toBe(BASE_TIMESTAMP);
    expect(dateTz.timezone).toBe('Europe/Rome');
  });

  it('compares two instances in the same timezone', () => {
    const earlier = new DateTz(BASE_TIMESTAMP, 'UTC');
    const later = new DateTz(BASE_TIMESTAMP + 24 * 60 * 60 * 1000, 'UTC');
    expect(earlier.compare(later)).toBeLessThan(0);
  });

  it('returns zero when comparing identical timestamps', () => {
    const a = new DateTz(BASE_TIMESTAMP, 'UTC');
    const b = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(a.compare(b)).toBe(0);
  });

  it('compares against plain IDateTz objects', () => {
    const deltaMinutes = 5;
    const a = new DateTz(BASE_TIMESTAMP + deltaMinutes * 60_000, 'UTC');
    const other: IDateTz = { timestamp: BASE_TIMESTAMP, timezone: 'UTC' };
    expect(a.compare(other)).toBe(deltaMinutes * 60_000);
  });

  it('throws when comparing instances from different timezones', () => {
    const utc = new DateTz(BASE_TIMESTAMP, 'UTC');
    const rome = new DateTz(BASE_TIMESTAMP, 'Europe/Rome');
    expect(() => utc.compare(rome)).toThrow('Cannot compare dates with different timezones');
  });

  it('formats using the default pattern', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(dateTz.toString()).toBe('2021-01-01 00:00:00');
  });

  it('rounds timestamps down to the nearest minute', () => {
    const withSeconds = BASE_TIMESTAMP + 45_000 + 500;
    const dateTz = new DateTz(withSeconds, 'UTC');
    expect(dateTz.timestamp).toBe(BASE_TIMESTAMP);
    expect(dateTz.toString()).toBe('2021-01-01 00:00:00');
  });

  it('formats using a custom pattern and timezone token', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'Europe/Rome');
    expect(dateTz.toString('DD/MM/YYYY HH:mm tz')).toBe('01/01/2021 01:00 Europe/Rome');
  });

  it('formats using month names and 12-hour tokens', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(dateTz.toString('LM DD, YYYY hh:mm aa')).toBe('January 01, 2021 12:00 am');
  });

  it('retains chaining behaviour for add', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    const result = dateTz.add(1, 'day');
    expect(result).toBe(dateTz);
  });

  it('adds time in different units', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    dateTz.add(90, 'minute'); // +1h30
    expect(dateTz.toString()).toBe('2021-01-01 01:30:00');
    dateTz.add(1, 'day');
    expect(dateTz.toString()).toBe('2021-01-02 01:30:00');
    dateTz.add(1, 'month');
    expect(dateTz.toString()).toBe('2021-02-02 01:30:00');
    dateTz.add(1, 'year');
    expect(dateTz.toString()).toBe('2022-02-02 01:30:00');
  });

  it('sets specific components of the date', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    dateTz.set(2023, 'year')
      .set(2, 'month') // February (1-based)
      .set(15, 'day')
      .set(9, 'hour')
      .set(45, 'minute');
    expect(dateTz.toString()).toBe('2023-02-15 09:45:00');
  });

  it('handles leap year arithmetic when adding days', () => {
    const leap = new DateTz(Date.UTC(2020, 1, 28, 0, 0), 'UTC');
    leap.add(1, 'day');
    expect(leap.toString()).toBe('2020-02-29 00:00:00');
    leap.add(1, 'day');
    expect(leap.toString()).toBe('2020-03-01 00:00:00');
  });

  it('parses a date string with a custom pattern', () => {
    const parsed = DateTz.parse('2021-01-05 18:30:00', 'YYYY-MM-DD HH:mm:ss', 'UTC');
    expect(parsed.toString()).toBe('2021-01-05 18:30:00');
    expect(parsed.timezone).toBe('UTC');
  });

  it('parses using a non-UTC timezone', () => {
    const parsed = DateTz.parse('2021-01-05 18:30:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    expect(parsed.timezone).toBe('Europe/Rome');
    expect(parsed.toString('YYYY-MM-DD HH:mm tz')).toBe('2021-01-05 18:30 Europe/Rome');
  });

  it('parses the DST spring-forward gap by rolling forward to the first valid instant', () => {
    const parsed = DateTz.parse('2021-03-14 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'America/New_York');
    expect(parsed.toString('YYYY-MM-DD HH:mm tz')).toBe('2021-03-14 03:30 America/New_York');
    expect(parsed.isDst).toBe(true);
  });

  it('prefers the DST occurrence when parsing ambiguous fall-back times', () => {
    const parsed = DateTz.parse('2021-11-07 01:30:00', 'YYYY-MM-DD HH:mm:ss', 'America/New_York');
    expect(parsed.toString('YYYY-MM-DD HH:mm tz')).toBe('2021-11-07 01:30 America/New_York');
    expect(parsed.isDst).toBe(true);
  });

  it('throws when parsing a 12-hour pattern without an AM/PM marker', () => {
    expect(() => DateTz.parse('2021-01-05 06:30', 'YYYY-MM-DD hh:mm', 'UTC'))
      .toThrow('AM/PM marker (aa or AA) is required when using 12-hour format (hh)');
  });

  it('throws when parsing with an unknown timezone', () => {
    expect(() => DateTz.parse('2021-01-05 06:30:00', 'YYYY-MM-DD HH:mm:ss', 'Mars/Phobos'))
      .toThrow('Invalid timezone: Mars/Phobos');
  });

  it('clones to a different timezone without mutating the original', () => {
    const original = new DateTz(BASE_TIMESTAMP, 'UTC');
    const clone = original.cloneToTimezone('Europe/Rome');
    expect(original.timezone).toBe('UTC');
    expect(clone.timezone).toBe('Europe/Rome');
    expect(clone.toString()).toBe('2021-01-01 01:00:00');
    expect(clone.timestamp).toBe(original.timestamp);
    expect(clone).not.toBe(original);
  });

  it('converts to a different timezone in place', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    const originalTimestamp = dateTz.timestamp;
    const result = dateTz.convertToTimezone('Europe/Rome');
    expect(result).toBe(dateTz);
    expect(dateTz.timezone).toBe('Europe/Rome');
    expect(dateTz.toString()).toBe('2021-01-01 01:00:00');
    expect(dateTz.timestamp).toBe(originalTimestamp);
  });

  it('exposes timezone offset information', () => {
    const la = new DateTz(BASE_TIMESTAMP, 'America/Los_Angeles');
    expect(la.timezoneOffset).toEqual({ sdt: -28800, dst: -25200 });
  });

  it('preserves timezone information during implicit serialization', () => {
    const rome = new DateTz(BASE_TIMESTAMP, 'Europe/Rome');
    const plain = { timestamp: BASE_TIMESTAMP, timezone: 'Europe/Rome' };
    expect(rome.toObject()).toEqual(plain);
    expect(rome.toJSON()).toEqual(plain);
    expect(rome.valueOf()).toEqual(plain);
    expect(Number(rome)).toBe(BASE_TIMESTAMP);
  });

  it('reports comparability correctly', () => {
    const utc = new DateTz(BASE_TIMESTAMP, 'UTC');
    const rome = new DateTz(BASE_TIMESTAMP, 'Europe/Rome');
    expect(utc.isComparable(rome)).toBe(false);
    expect(utc.isComparable(new DateTz(BASE_TIMESTAMP, 'UTC'))).toBe(true);
    const plain: IDateTz = { timestamp: BASE_TIMESTAMP, timezone: 'UTC' };
    expect(utc.isComparable(plain)).toBe(true);
  });

  it('exposes date parts adjusted for timezone', () => {
    const rome = new DateTz(BASE_TIMESTAMP, 'Europe/Rome');
    expect(rome.year).toBe(2021);
    expect(rome.month).toBe(0);
    expect(rome.day).toBe(1);
    expect(rome.hour).toBe(1);
    expect(rome.minute).toBe(0);
    expect(rome.dayOfWeek).toBe(5);
  });

  it('detects daylight saving time boundaries', () => {
    const winter = new DateTz(Date.UTC(2021, 0, 1, 20, 0), 'America/Los_Angeles');
    const summer = new DateTz(Date.UTC(2021, 6, 1, 19, 0), 'America/Los_Angeles');
    expect(winter.isDst).toBe(false);
    expect(summer.isDst).toBe(true);
  });

  it('reports isDst as false for timezones without daylight saving time', () => {
    const accra = new DateTz(BASE_TIMESTAMP, 'Africa/Accra');
    expect(accra.isDst).toBe(false);
  });

  it('instantiates via now with the requested timezone', () => {
    const current = DateTz.now('Europe/Rome');
    expect(current.timezone).toBe('Europe/Rome');
  });

  it('defaults to UTC when calling now without arguments', () => {
    const current = DateTz.now();
    expect(current.timezone).toBe('UTC');
  });

  it('rejects unknown timezones on construction and conversion', () => {
    expect(() => new DateTz(BASE_TIMESTAMP, 'Mars/Phobos')).toThrow('Invalid timezone: Mars/Phobos');
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(() => dateTz.convertToTimezone('Mars/Phobos')).toThrow('Invalid timezone: Mars/Phobos');
  });

  it('rejects unknown timezones when cloning', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(() => dateTz.cloneToTimezone('Mars/Phobos')).toThrow('Invalid timezone: Mars/Phobos');
  });

  it('subtracts time using calendar and fixed units', () => {
    const dateTz = new DateTz(Date.UTC(2021, 2, 15, 12, 0), 'UTC');
    dateTz.subtract(1, 'day');
    expect(dateTz.toString()).toBe('2021-03-14 12:00:00');
    dateTz.subtract(1, 'month');
    expect(dateTz.toString()).toBe('2021-02-14 12:00:00');
    dateTz.subtract(1, 'year');
    expect(dateTz.toString()).toBe('2020-02-14 12:00:00');
  });

  it('supports plus/minus duration helpers', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    dateTz.plus({ days: 2, hours: 3, minutes: 15 });
    expect(dateTz.toString()).toBe('2021-01-03 03:15:00');
    dateTz.minus({ weeks: 1 });
    expect(dateTz.toString()).toBe('2020-12-27 03:15:00');
  });

  it('computes differences across granularities', () => {
    const start = new DateTz(BASE_TIMESTAMP, 'UTC');
    const end = new DateTz(Date.UTC(2021, 0, 3, 3, 0), 'UTC');
    expect(end.diff(start, 'minute')).toBe(3060); // 2 days 3 hours
    expect(end.diff(start, 'hour')).toBe(51);
    expect(end.diff(start, 'day', true)).toBeCloseTo(2.125, 6);
    const march = new DateTz(Date.UTC(2021, 2, 1, 0, 0), 'UTC');
    expect(march.diff(start, 'month')).toBe(2);
    expect(march.diff(start, 'year', true)).toBeCloseTo(0.1667, 4);
  });

  it('throws when diffing across timezones', () => {
    const utc = new DateTz(BASE_TIMESTAMP, 'UTC');
    const rome = new DateTz(BASE_TIMESTAMP, 'Europe/Rome');
    expect(() => utc.diff(rome)).toThrow('Cannot compare dates with different timezones');
  });

  it('moves to start and end boundaries', () => {
    const dateTz = new DateTz(Date.UTC(2021, 5, 16, 10, 45), 'UTC');
    dateTz.startOf('day');
    expect(dateTz.toString()).toBe('2021-06-16 00:00:00');
    dateTz.endOf('day');
    expect(dateTz.toString()).toBe('2021-06-16 23:59:00');
    dateTz.startOf('week');
    expect(dateTz.toString()).toBe('2021-06-13 00:00:00');
  });

  it('creates independent clones', () => {
    const original = new DateTz(BASE_TIMESTAMP, 'UTC');
    const clone = original.clone();
    clone.plus({ day: 1 });
    expect(original.toString()).toBe('2021-01-01 00:00:00');
    expect(clone.toString()).toBe('2021-01-02 00:00:00');
  });

  it('exposes conversion helpers', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(dateTz.valueOf()).toEqual({ timestamp: BASE_TIMESTAMP, timezone: 'UTC' });
    expect(Number(dateTz)).toBe(BASE_TIMESTAMP);
    expect(dateTz.toUnix()).toBe(BASE_TIMESTAMP / 1000);
    expect(dateTz.toJSDate().getTime()).toBe(BASE_TIMESTAMP);
    expect(dateTz.toISO()).toBe(new Date(BASE_TIMESTAMP).toISOString());
    expect(dateTz.toISOString()).toBe(dateTz.toISO());
  });

  it('provides comparison helpers', () => {
    const first = new DateTz(BASE_TIMESTAMP, 'UTC');
    const second = new DateTz(Date.UTC(2021, 0, 1, 0, 30), 'UTC');
    expect(first.isBefore(second)).toBe(true);
    expect(second.isAfter(first, 'hour')).toBe(false);
    expect(second.isSame(first, 'hour')).toBe(true);
    expect(second.isSameOrAfter(first)).toBe(true);
    expect(first.isSameOrBefore(second)).toBe(true);
  });

  it('checks ranges with isBetween', () => {
    const start = new DateTz(BASE_TIMESTAMP, 'UTC');
    const middle = new DateTz(Date.UTC(2021, 0, 1, 12, 0), 'UTC');
    const end = new DateTz(Date.UTC(2021, 0, 2, 0, 0), 'UTC');
    expect(middle.isBetween(start, end)).toBe(true);
    expect(middle.isBetween(start, end, 'day', '[]')).toBe(true);
    expect(start.isBetween(start, end, 'minute', '()')).toBe(false);
    expect(start.isBetween(start, end, 'minute', '[]')).toBe(true);
  });

  it('rejects conversion to plain offsets by id mismatch', () => {
    const dateTz = new DateTz(BASE_TIMESTAMP, 'UTC');
    expect(() => dateTz.convertToTimezone('GMT+1')).toThrow('Invalid timezone: GMT+1');
  });
});
