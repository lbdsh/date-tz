import { DateTzDiffUnit, DateTzDurationLike, DateTzGranularity, DateTzInclusivity, IDateTz } from "./idate-tz";
import { timezones } from "./timezones";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const MS_PER_WEEK = MS_PER_DAY * 7;

// Epoch time constants
const epochYear = 1970;
const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const UNIT_ALIASES: Record<string, DateTzDiffUnit> = {
  ms: 'millisecond',
  millisecond: 'millisecond',
  milliseconds: 'millisecond',
  s: 'second',
  sec: 'second',
  second: 'second',
  seconds: 'second',
  m: 'minute',
  min: 'minute',
  minute: 'minute',
  minutes: 'minute',
  h: 'hour',
  hr: 'hour',
  hour: 'hour',
  hours: 'hour',
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  wk: 'week',
  week: 'week',
  weeks: 'week',
  M: 'month',
  mon: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  yr: 'year',
  year: 'year',
  years: 'year'
};

const GRANULARITY_UNITS: readonly DateTzGranularity[] = ['minute', 'hour', 'day', 'week', 'month', 'year'];

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Represents a date and time with a specific timezone.
 */
export class DateTz implements IDateTz {

  /**
 * The timestamp in milliseconds since the Unix epoch.
 */
  timestamp: number;

  /**
   * The timezone of the date.
   */
  timezone: string;

  /**
   * Cache for the most recently resolved timezone offset.
   */
  private offsetCache?: { timestamp: number; info: { offsetSeconds: number; isDst: boolean; }; };

  /**
   * The default date format used when converting to string.
   */
  public static defaultFormat = 'YYYY-MM-DD HH:mm:ss';

  /**
 * Creates an instance of DateTz.
 * @param value - The timestamp or an object implementing IDateTz.
 * @param tz - The timezone identifier (optional).
 */
  constructor(value: IDateTz);
  constructor(value: number, tz?: string);
  constructor(value: number | IDateTz, tz?: string) {
    if (typeof value === 'object') {
      this.timestamp = value.timestamp;
      this.timezone = value.timezone || 'UTC';
      if (!timezones[this.timezone]) {
        throw new Error(`Invalid timezone: ${value.timezone}`);
      }
    } else {
      this.timezone = tz || 'UTC';
      if (!timezones[this.timezone]) {
        throw new Error(`Invalid timezone: ${tz}`);
      }
      this.timestamp = this.stripSMs(value);
    }
    this.invalidateOffsetCache();
  }

  /**
   * Gets the timezone offset in minutes.
   */
  get timezoneOffset() {
    return timezones[this.timezone];
  }

  /**
 * Compares this DateTz instance with another.
 * @param other - The other DateTz instance to compare with.
 * @returns The difference in timestamps.
 * @throws Error if the timezones are different.
 */
  compare(other: IDateTz): number {
    if (this.isComparable(other)) {
      return this.timestamp - other.timestamp;
    }
    throw new Error('Cannot compare dates with different timezones');
  }

  /**
   * Checks if this DateTz instance is comparable with another.
   * @param other - The other DateTz instance to check.
   * @returns True if the timezones are the same, otherwise false.
   */
  isComparable(other: IDateTz): boolean {
    return this.timezone === other.timezone;
  }

  /**
 * Converts the DateTz instance to a string representation.
 * @param pattern - The format pattern (optional).
 * @returns The formatted date string.
 */
  toString(): string;
  toString(locale: string): string;
  toString(pattern: string, locale?: string): string;
  toString(patternOrLocale?: string, maybeLocale?: string): string {
    const tokenRegex = /(YYYY|yyyy|YY|yy|MM|LM|DD|HH|hh|mm|ss|aa|AA|tz)/;
    let pattern = DateTz.defaultFormat;
    let locale = 'en';
    const hasLocaleArgument = typeof maybeLocale === 'string' && maybeLocale.length > 0;

    if (hasLocaleArgument) {
      locale = maybeLocale as string;
    }

    if (typeof patternOrLocale === 'string' && patternOrLocale.length > 0) {
      if (hasLocaleArgument || tokenRegex.test(patternOrLocale)) {
        pattern = patternOrLocale;
      } else if (this.isLikelyLocale(patternOrLocale)) {
        locale = patternOrLocale;
      } else {
        pattern = patternOrLocale;
      }
    } else if (patternOrLocale === undefined && hasLocaleArgument) {
      pattern = DateTz.defaultFormat;
    }

    // Calculate year, month, day, hours, minutes, seconds
    const offsetInfo = this.getOffsetInfo();
    const offset = offsetInfo.offsetSeconds * 1000;
    let remainingMs = this.timestamp + offset;
    let year = epochYear;

    // Calculate year
    while (true) {
      const daysInYear = this.isLeapYear(year) ? 366 : 365;
      const msInYear = daysInYear * MS_PER_DAY;

      if (remainingMs >= msInYear) {
        remainingMs -= msInYear;
        year++;
      } else {
        break;
      }
    }

    // Calculate month
    let month = 0;
    while (month < 12) {
      const daysInMonth = month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
      const msInMonth = daysInMonth * MS_PER_DAY;

      if (remainingMs >= msInMonth) {
        remainingMs -= msInMonth;
        month++;
      } else {
        break;
      }
    }

    // Calculate day
    const day = Math.floor(remainingMs / MS_PER_DAY) + 1;
    remainingMs %= MS_PER_DAY;

    // Calculate hour
    const hour = Math.floor(remainingMs / MS_PER_HOUR);
    remainingMs %= MS_PER_HOUR;

    // Calculate minute
    const minute = Math.floor(remainingMs / MS_PER_MINUTE);
    remainingMs %= MS_PER_MINUTE;

    // Calculate second
    const second = Math.floor(remainingMs / 1000);

    const pm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert to 12-hour format

    let monthStr = new Date(year, month, 3).toLocaleString(locale, { month: 'long' });
    monthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

    // Map components to pattern tokens
    const tokens: Record<string, any> = {
      YYYY: year,
      YY: String(year).slice(-2),
      yyyy: year.toString(),
      yy: String(year).slice(-2),
      MM: String(month + 1).padStart(2, '0'),
      LM: monthStr,
      DD: String(day).padStart(2, '0'),
      HH: String(hour).padStart(2, '0'),
      mm: String(minute).padStart(2, '0'),
      ss: String(second).padStart(2, '0'),
      aa: pm.toLowerCase(),
      AA: pm,
      hh: hour12.toString().padStart(2, '0'),
      tz: this.timezone,
    };

    // Replace pattern tokens with actual values
    return pattern.replace(/YYYY|yyyy|YY|yy|MM|LM|DD|HH|hh|mm|ss|aa|AA|tz/g, (match) => tokens[match]);
  }

  /**
 * Adds a specified amount of time to the DateTz instance.
 * @param value - The amount of time to add.
 * @param unit - The unit of time ('minute', 'hour', 'day', 'month', 'year').
 * @returns The updated DateTz instance.
 * @throws Error if the unit is unsupported.
 */
  add(value: number, unit: 'minute' | 'hour' | 'day' | 'month' | 'year') {
    let remainingMs = this.timestamp;

    // Extract current date components
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);
    remainingMs %= MS_PER_DAY;
    let hour = Math.floor(remainingMs / MS_PER_HOUR);
    remainingMs %= MS_PER_HOUR;
    let minute = Math.floor(remainingMs / MS_PER_MINUTE);
    let second = Math.floor((remainingMs % MS_PER_MINUTE) / 1000);

    // Calculate current year
    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    // Calculate current month
    let month = 0;
    while (days >= (month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    let day = days + 1;

    // Add time based on the unit
    switch (unit) {
      case 'minute':
        minute += value;
        break;
      case 'hour':
        hour += value;
        break;
      case 'day':
        day += value;
        break;
      case 'month':
        month += value;
        break;
      case 'year':
        year += value;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    // Normalize overflow for minutes, hours, and days
    while (minute >= 60) {
      minute -= 60;
      hour++;
    }
    while (hour >= 24) {
      hour -= 24;
      day++;
    }

    // Normalize overflow for months and years
    while (month >= 12) {
      month -= 12;
      year++;
    }

    // Normalize day overflow
    while (day > (month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month])) {
      day -= month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
      if (month >= 12) {
        month = 0;
        year++;
      }
    }

    // Convert back to timestamp
    const newTimestamp = (() => {
      let totalMs = 0;

      // Add years
      for (let y = 1970; y < year; y++) {
        totalMs += this.daysInYear(y) * MS_PER_DAY;
      }

      // Add months
      for (let m = 0; m < month; m++) {
        totalMs += (m === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[m]) * MS_PER_DAY;
      }

      // Add days, hours, minutes, and seconds
      totalMs += (day - 1) * MS_PER_DAY;
      totalMs += hour * MS_PER_HOUR;
      totalMs += minute * MS_PER_MINUTE;
      totalMs += second * 1000;

      return totalMs;
    })();

    this.timestamp = newTimestamp;
    this.invalidateOffsetCache();
    return this;
  }

  /**
   * Subtracts a specified amount of time from the DateTz instance.
   * @param value - The amount of time to subtract.
   * @param unit - The unit of time.
   */
  subtract(value: number, unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year') {
    this.shift(unit, -value);
    return this;
  }

  /**
   * Adds a duration object to the DateTz instance (Luxon-style).
   * @param duration - Object containing duration components.
   */
  plus(duration: DateTzDurationLike = {}) {
    for (const [rawUnit, rawValue] of Object.entries(duration)) {
      if (rawValue === undefined || rawValue === 0) {
        continue;
      }
      const normalized = this.normalizeDiffUnit(rawUnit);
      const value = rawValue as number;
      if (normalized === 'millisecond' || normalized === 'second') {
        throw new Error(`Unsupported duration unit: ${rawUnit}`);
      }
      this.shift(normalized, value);
    }
    return this;
  }

  /**
   * Subtracts a duration object from the DateTz instance (Luxon-style).
   * @param duration - Object containing duration components.
   */
  minus(duration: DateTzDurationLike = {}) {
    const inverted: DateTzDurationLike = {};
    for (const [unit, rawValue] of Object.entries(duration)) {
      if (rawValue === undefined || rawValue === 0) {
        continue;
      }
      inverted[unit as keyof DateTzDurationLike] = -(rawValue as number);
    }
    return this.plus(inverted);
  }

  /**
   * Computes the difference between this instance and another.
   * @param other - The date to compare with.
   * @param unit - The unit of the resulting difference.
   * @param asFloat - Whether to return a floating point result.
   */
  diff(other: IDateTz, unit: DateTzDiffUnit = 'millisecond', asFloat = false): number {
    const normalized = this.normalizeDiffUnit(unit);
    const comparable = this.ensureComparable(other);
    const delta = this.timestamp - comparable.timestamp;

    switch (normalized) {
      case 'millisecond':
        return this.roundDiff(delta, asFloat);
      case 'second':
        return this.roundDiff(delta / MS_PER_SECOND, asFloat);
      case 'minute':
        return this.roundDiff(delta / MS_PER_MINUTE, asFloat);
      case 'hour':
        return this.roundDiff(delta / MS_PER_HOUR, asFloat);
      case 'day':
        return this.roundDiff(delta / MS_PER_DAY, asFloat);
      case 'week':
        return this.roundDiff(delta / MS_PER_WEEK, asFloat);
      case 'month': {
        const months = this.diffInMonths(comparable, true);
        return this.roundDiff(months, asFloat);
      }
      case 'year': {
        const years = this.diffInMonths(comparable, true) / 12;
        return this.roundDiff(years, asFloat);
      }
      default:
        return this.roundDiff(delta, asFloat);
    }
  }

  /**
   * Moves the instance to the start of the provided unit (Moment-style).
   * @param unit - The time unit to reset to its lower bound.
   */
  startOf(unit: DateTzGranularity) {
    const granularity = this.normalizeGranularity(unit);
    switch (granularity) {
      case 'minute':
        this.setLocalComponents({ second: 0 });
        break;
      case 'hour':
        this.setLocalComponents({ minute: 0, second: 0 });
        break;
      case 'day':
        this.setLocalComponents({ hour: 0, minute: 0, second: 0 });
        break;
      case 'week': {
        this.startOf('day');
        const dayOfWeek = this.dayOfWeek;
        if (dayOfWeek !== 0) {
          this.shift('day', -dayOfWeek);
          this.startOf('day');
        }
        break;
      }
      case 'month':
        this.setLocalComponents({ day: 1, hour: 0, minute: 0, second: 0 });
        break;
      case 'year':
        this.setLocalComponents({ month: 0, day: 1, hour: 0, minute: 0, second: 0 });
        break;
    }
    return this;
  }

  /**
   * Moves the instance to the end of the provided unit (Moment-style).
   * @param unit - The time unit to advance to its upper bound.
   */
  endOf(unit: DateTzGranularity) {
    const granularity = this.normalizeGranularity(unit);
    switch (granularity) {
      case 'minute':
        return this;
      case 'hour':
        this.startOf('hour');
        this.shift('hour', 1);
        this.shift('minute', -1);
        break;
      case 'day':
        this.startOf('day');
        this.shift('day', 1);
        this.shift('minute', -1);
        break;
      case 'week':
        this.startOf('week');
        this.shift('week', 1);
        this.shift('minute', -1);
        break;
      case 'month':
        this.startOf('month');
        this.shift('month', 1);
        this.shift('minute', -1);
        break;
      case 'year':
        this.startOf('year');
        this.shift('year', 1);
        this.shift('minute', -1);
        break;
    }
    return this;
  }

  /**
   * Creates a shallow clone of the instance.
   */
  clone(): IDateTz {
    return new DateTz(this);
  }

  /**
   * Returns the underlying timestamp as a JavaScript Date instance.
   */
  toJSDate(): Date {
    return new Date(this.timestamp);
  }

  /**
   * Returns an ISO 8601 string (UTC, minute precision).
   */
  toISOString(): string {
    return this.toJSDate().toISOString();
  }

  /**
   * Synonym for toISOString (Luxon compatibility).
   */
  toISO(): string {
    return this.toISOString();
  }

  /**
   * Returns the Unix timestamp in seconds.
   */
  toUnix(): number {
    return Math.floor(this.timestamp / 1000);
  }

  /**
   * Returns the primitive value of the instance (ms since epoch).
   */
  valueOf(): number {
    return this.timestamp;
  }

  /**
   * Checks if this instance occurs before another when rounded to the given unit.
   */
  isBefore(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) < 0;
  }

  /**
   * Checks if this instance occurs after another when rounded to the given unit.
   */
  isAfter(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) > 0;
  }

  /**
   * Checks if two instances are the same when rounded to the given unit.
   */
  isSame(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) === 0;
  }

  /**
   * Checks if this instance is the same or before another when rounded to the given unit.
   */
  isSameOrBefore(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) <= 0;
  }

  /**
   * Checks if this instance is the same or after another when rounded to the given unit.
   */
  isSameOrAfter(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) >= 0;
  }

  /**
   * Checks if this instance lies within a range.
   * @param start - Start of the range.
   * @param end - End of the range.
   * @param unit - Comparison unit.
   * @param inclusivity - Inclusivity string ((), (], [), []).
   */
  isBetween(
    start: IDateTz,
    end: IDateTz,
    unit: DateTzDiffUnit = 'millisecond',
    inclusivity: DateTzInclusivity = '()'
  ): boolean {
    if (inclusivity.length !== 2 || !['(', '['].includes(inclusivity[0]) || ![')', ']'].includes(inclusivity[1])) {
      throw new Error(`Invalid inclusivity token: ${inclusivity}`);
    }
    const normalized = this.normalizeDiffUnit(unit);
    const rangeStart = this.ensureComparable(start);
    const rangeEnd = this.ensureComparable(end);
    if (rangeStart.timestamp > rangeEnd.timestamp) {
      throw new Error('Start date must be before end date');
    }
    const [lower, upper] = inclusivity.split('') as [string, string];
    const lowerCmp = this.compareWithUnitDate(rangeStart, normalized);
    const upperCmp = this.compareWithUnitDate(rangeEnd, normalized);
    const lowerPass = lower === '(' ? lowerCmp > 0 : lowerCmp >= 0;
    const upperPass = upper === ')' ? upperCmp < 0 : upperCmp <= 0;
    return lowerPass && upperPass;
  }


  private _year(considerDst = false) {
    const offset = this.getOffsetSeconds(considerDst) * 1000;
    let remainingMs = this.timestamp + offset;
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);

    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    return year;
  }

  private _month(considerDst = false) {
    const offset = this.getOffsetSeconds(considerDst) * 1000;
    let remainingMs = this.timestamp + offset;
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);

    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    let month = 0;
    while (days >= (month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    return month;
  }

  private _day(considerDst = false) {
    const offset = this.getOffsetSeconds(considerDst) * 1000;
    let remainingMs = this.timestamp + offset;
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);

    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    let month = 0;
    while (days >= (month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    return days + 1;
  }

  private _hour(considerDst = false) {
    const offset = this.getOffsetSeconds(considerDst) * 1000;
    let remainingMs = this.timestamp + offset;
    remainingMs %= MS_PER_DAY;
    let hour = Math.floor(remainingMs / MS_PER_HOUR);
    return hour;
  }

  private _minute(considerDst = false) {
    const offset = this.getOffsetSeconds(considerDst) * 1000;
    let remainingMs = this.timestamp + offset;
    remainingMs %= MS_PER_HOUR;
    let minute = Math.floor(remainingMs / MS_PER_MINUTE);
    return minute;
  }

  private _dayOfWeek(considerDst = false) {
    const offset = this.getOffsetSeconds(considerDst) * 1000;
    let remainingMs = this.timestamp + offset;
    const date = new Date(remainingMs);
    return date.getDay();
  }

  /**
 * Converts the DateTz instance to a different timezone.
 * @param tz - The target timezone identifier.
 * @returns The updated DateTz instance.
 * @throws Error if the timezone is invalid.
 */
  convertToTimezone(tz: string) {
    if (!timezones[tz]) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    this.timezone = tz;
    this.invalidateOffsetCache();
    return this;
  }

  /**
   * Clones the DateTz instance to a different timezone.
   * @param tz - The target timezone identifier.
   * @returns A new DateTz instance in the target timezone.
   * @throws Error if the timezone is invalid.
   */
  cloneToTimezone(tz: string) {
    if (!timezones[tz]) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    const clone = new DateTz(this);
    clone.timezone = tz;
    clone.invalidateOffsetCache();
    return clone;
  }

  /**
   * Strips seconds and milliseconds from the timestamp.
   * @param timestamp - The original timestamp.
   * @returns The timestamp without seconds and milliseconds.
   */
  private stripSMs(timestamp: number): number {
    // Calculate the time components
    const days = Math.floor(timestamp / MS_PER_DAY);
    const remainingAfterDays = timestamp % MS_PER_DAY;

    const hours = Math.floor(remainingAfterDays / MS_PER_HOUR);
    const remainingAfterHours = remainingAfterDays % MS_PER_HOUR;

    const minutes = Math.floor(remainingAfterHours / MS_PER_MINUTE);

    // Reconstruct the timestamp without seconds and milliseconds
    return days * MS_PER_DAY + hours * MS_PER_HOUR + minutes * MS_PER_MINUTE;
  }

  private isLikelyLocale(candidate: string): boolean {
    try {
      return Intl.getCanonicalLocales(candidate).length > 0;
    } catch {
      return false;
    }
  }

  private invalidateOffsetCache() {
    this.offsetCache = undefined;
  }

  private getOffsetSeconds(considerDst: boolean): number {
    const tzInfo = timezones[this.timezone];
    if (!tzInfo) {
      throw new Error(`Invalid timezone: ${this.timezone}`);
    }
    if (!considerDst) {
      return tzInfo.sdt;
    }
    return this.getOffsetInfo().offsetSeconds;
  }

  private getOffsetInfo(): { offsetSeconds: number; isDst: boolean; } {
    if (this.offsetCache && this.offsetCache.timestamp === this.timestamp) {
      return this.offsetCache.info;
    }
    const info = this.computeOffsetInfo();
    this.offsetCache = { timestamp: this.timestamp, info };
    return info;
  }

  private computeOffsetInfo(): { offsetSeconds: number; isDst: boolean; } {
    const tzInfo = timezones[this.timezone];
    if (!tzInfo) {
      throw new Error(`Invalid timezone: ${this.timezone}`);
    }
    if (tzInfo.dst === tzInfo.sdt) {
      return { offsetSeconds: tzInfo.sdt, isDst: false };
    }
    const actual = this.getIntlOffsetSeconds(this.timestamp);
    if (actual !== null) {
      if (actual !== tzInfo.sdt && actual !== tzInfo.dst) {
        return { offsetSeconds: actual, isDst: actual > tzInfo.sdt };
      }
      return { offsetSeconds: actual, isDst: actual === tzInfo.dst };
    }
    return { offsetSeconds: tzInfo.sdt, isDst: false };
  }

  private getIntlOffsetSeconds(timestamp: number): number | null {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: this.timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const parts = formatter.formatToParts(new Date(timestamp));
      const lookup = (type: string) => {
        const part = parts.find(p => p.type === type);
        if (!part) {
          throw new Error(`Missing part ${type}`);
        }
        return Number(part.value);
      };
      const adjusted = Date.UTC(
        lookup('year'),
        lookup('month') - 1,
        lookup('day'),
        lookup('hour'),
        lookup('minute'),
        lookup('second')
      );
      return Math.round((adjusted - timestamp) / 1000);
    } catch {
      return null;
    }
  }

  private getLocalParts(considerDst = true): LocalParts {
    return {
      year: this._year(considerDst),
      month: this._month(considerDst),
      day: this._day(considerDst),
      hour: this._hour(considerDst),
      minute: this._minute(considerDst),
      second: 0
    };
  }

  private setLocalComponents(update: Partial<LocalParts>) {
    const current = this.getLocalParts(true);
    const next: LocalParts = {
      ...current,
      ...update
    };
    const pattern = 'YYYY-MM-DD HH:mm:ss';
    const dateString = [
      String(next.year).padStart(4, '0'),
      String(next.month + 1).padStart(2, '0'),
      String(next.day).padStart(2, '0')
    ].join('-') + ' ' + [
      String(next.hour).padStart(2, '0'),
      String(next.minute).padStart(2, '0'),
      String(next.second).padStart(2, '0')
    ].join(':');
    const parsed = DateTz.parse(dateString, pattern, this.timezone);
    this.timestamp = parsed.timestamp;
    this.invalidateOffsetCache();
  }

  private toDateInstance(other: IDateTz): DateTz {
    if (other instanceof DateTz) {
      return other;
    }
    const tz = other.timezone ?? this.timezone;
    return new DateTz(other.timestamp, tz);
  }

  private ensureComparable(other: IDateTz): DateTz {
    const instance = this.toDateInstance(other);
    if (!this.isComparable(instance)) {
      throw new Error('Cannot compare dates with different timezones');
    }
    return instance;
  }

  private normalizeDiffUnit(unit?: string): DateTzDiffUnit {
    if (!unit) {
      return 'millisecond';
    }
    const normalized = UNIT_ALIASES[unit.toLowerCase()];
    if (!normalized) {
      throw new Error(`Unsupported unit: ${unit}`);
    }
    return normalized;
  }

  private normalizeGranularity(unit: string): DateTzGranularity {
    const normalized = this.normalizeDiffUnit(unit);
    if (normalized === 'millisecond' || normalized === 'second') {
      throw new Error(`Unsupported granularity: ${unit}`);
    }
    return normalized as DateTzGranularity;
  }

  private diffInMonths(other: DateTz, asFloat: boolean): number {
    const earlier = this.timestamp < other.timestamp ? new DateTz(this) : new DateTz(other);
    const later = this.timestamp < other.timestamp ? new DateTz(other) : new DateTz(this);
    let anchor = new DateTz(earlier);
    let months = 0;
    let next = new DateTz(anchor).add(1, 'month');
    while (next.timestamp <= later.timestamp) {
      anchor = next;
      months++;
      next = new DateTz(anchor).add(1, 'month');
    }

    if (!asFloat) {
      return this.timestamp < other.timestamp ? -months : months;
    }

    const spanStart = anchor.timestamp;
    const spanEnd = next.timestamp;
    const span = spanEnd - spanStart;
    const remainder = later.timestamp - spanStart;
    const fractional = span !== 0 ? remainder / span : 0;
    const value = months + fractional;
    return this.timestamp < other.timestamp ? -value : value;
  }

  private roundDiff(value: number, asFloat: boolean): number {
    if (asFloat) {
      return value;
    }
    return value < 0 ? Math.ceil(value) : Math.floor(value);
  }

  private compareWithUnitDate(other: DateTz, unit: DateTzDiffUnit): number {
    const normalized = this.normalizeDiffUnit(unit);
    if (normalized === 'millisecond' || normalized === 'second') {
      return this.timestamp - other.timestamp;
    }
    const granularity = normalized as DateTzGranularity;
    const left = this.clone().startOf(granularity);
    const right = other.clone().startOf(granularity);
    return left.timestamp - right.timestamp;
  }

  private compareWithUnit(other: IDateTz, unit: DateTzDiffUnit): number {
    const instance = this.ensureComparable(other);
    return this.compareWithUnitDate(instance, unit);
  }

  private shift(unit: DateTzDiffUnit, value: number) {
    if (value === 0) {
      return this;
    }
    switch (unit) {
      case 'minute':
        this.timestamp += value * MS_PER_MINUTE;
        break;
      case 'hour':
        this.timestamp += value * MS_PER_HOUR;
        break;
      case 'day':
        this.timestamp += value * MS_PER_DAY;
        break;
      case 'week':
        this.timestamp += value * MS_PER_WEEK;
        break;
      case 'month':
        this.shiftCalendar('month', value);
        return this;
      case 'year':
        this.shiftCalendar('year', value);
        return this;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    this.invalidateOffsetCache();
    return this;
  }

  private shiftCalendar(unit: 'month' | 'year', value: number) {
    if (value === 0) {
      return;
    }
    const current = this.getLocalParts(true);
    let year = current.year;
    let month = current.month;
    let day = current.day;

    if (unit === 'year') {
      year += value;
    } else {
      let totalMonths = year * 12 + month + value;
      year = Math.floor(totalMonths / 12);
      month = totalMonths % 12;
      if (month < 0) {
        month += 12;
        year -= 1;
      }
    }

    const maxDay = month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
    if (day > maxDay) {
      day = maxDay;
    }

    this.setLocalComponents({ year, month, day });
  }

  /**
 * Sets a specific component of the date or time.
 * @param value - The value to set.
 * @param unit - The unit to set ('year', 'month', 'day', 'hour', 'minute').
 * @returns The updated DateTz instance.
 * @throws Error if the unit is unsupported.
 */
  set(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute') {
    let remainingMs = this.timestamp;

    // Extract current date components
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);
    remainingMs %= MS_PER_DAY;
    let hour = Math.floor(remainingMs / MS_PER_HOUR);
    remainingMs %= MS_PER_HOUR;
    let minute = Math.floor(remainingMs / MS_PER_MINUTE);
    let second = Math.floor((remainingMs % MS_PER_MINUTE) / 1000);

    // Calculate current year
    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    // Calculate current month
    let month = 0;
    while (days >= (month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    let day = days + 1;

    // Set the value based on the unit
    switch (unit) {
      case 'year':
        year = value;
        break;
      case 'month':
        month = value - 1;
        break;
      case 'day':
        day = value;
        break;
      case 'hour':
        hour = value;
        break;
      case 'minute':
        minute = value;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    // Normalize overflow for months and years
    while (month >= 12) {
      month -= 12;
      year++;
    }

    // Normalize day overflow
    while (day > (month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month])) {
      day -= month === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
      if (month >= 12) {
        month = 0;
        year++;
      }
    }

    // Convert back to timestamp
    const newTimestamp = (() => {
      let totalMs = 0;

      // Add years
      for (let y = 1970; y < year; y++) {
        totalMs += this.daysInYear(y) * MS_PER_DAY;
      }

      // Add months
      for (let m = 0; m < month; m++) {
        totalMs += (m === 1 && this.isLeapYear(year) ? 29 : daysPerMonth[m]) * MS_PER_DAY;
      }

      // Add days, hours, minutes, and seconds
      totalMs += (day - 1) * MS_PER_DAY;
      totalMs += hour * MS_PER_HOUR;
      totalMs += minute * MS_PER_MINUTE;
      totalMs += second * 1000;

      return totalMs;
    })();

    this.timestamp = newTimestamp;
    this.invalidateOffsetCache();
    return this;
  }

  /**
 * Checks if a given year is a leap year.
 * @param year - The year to check.
 * @returns True if the year is a leap year, otherwise false.
 */
  private isLeapYear(year: number) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * Gets the number of days in a given year.
   * @param year - The year to check.
   * @returns The number of days in the year.
   */
  private daysInYear(year: number) {
    return this.isLeapYear(year) ? 366 : 365;
  }

  /**
 * Parses a date string into a DateTz instance.
 * @param dateString - The date string to parse.
 * @param pattern - The format pattern (optional).
 * @param tz - The timezone identifier (optional).
 * @returns A new DateTz instance.
 */
  static parse(dateString: string, pattern?: string, tz?: string): IDateTz {
    if (!pattern) pattern = DateTz.defaultFormat;
    if (!tz) tz = 'UTC';
    if (!timezones[tz]) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    if (pattern.includes('hh') && (!pattern.includes('aa') || !pattern.includes('AA'))) {
      throw new Error('AM/PM marker (aa or AA) is required when using 12-hour format (hh)');
    }

    const regex = /YYYY|yyyy|MM|DD|HH|hh|mm|ss|aa|AA/g;
    const dateComponents: { [key: string]: number | string; } = {
      YYYY: 1970,
      yyyy: 1970,
      MM: 0,
      DD: 0,
      HH: 0,
      hh: 0,
      aa: 'am',
      AA: "AM",
      mm: 0,
      ss: 0,
    };

    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = regex.exec(pattern)) !== null) {
      const token = match[0];
      const value = parseInt(dateString.substring(match.index, match.index + token.length), 10);
      dateComponents[token] = value;
      index += token.length + 1;
    }

    const year = (dateComponents.YYYY as number) || (dateComponents.yyyy as number);
    const month = (dateComponents.MM as number) - 1; // Months are zero-based
    const day = dateComponents.DD as number;
    let hour = 0;
    const ampm = (dateComponents.a || dateComponents.A) as string;
    if (ampm) {
      hour = ampm.toUpperCase() === 'AM' ? (dateComponents.hh as number) : (dateComponents.hh as number) + 12;
    } else {
      hour = dateComponents.HH as number;
    }
    const minute = dateComponents.mm as number;
    const second = dateComponents.ss as number;

    const daysInYear = (yr: number) => (yr % 4 === 0 && yr % 100 !== 0) || (yr % 400 === 0) ? 366 : 365;
    const daysInMonth = (yr: number, mon: number) => mon === 1 && daysInYear(yr) === 366 ? 29 : daysPerMonth[mon];

    let timestamp = 0;

    for (let y = 1970; y < year; y++) {
      timestamp += daysInYear(y) * MS_PER_DAY;
    }

    for (let m = 0; m < month; m++) {
      timestamp += daysInMonth(year, m) * MS_PER_DAY;
    }

    timestamp += (day - 1) * MS_PER_DAY;
    timestamp += hour * MS_PER_HOUR;
    timestamp += minute * MS_PER_MINUTE;
    timestamp += second * 1000;

    const tzInfo = timezones[tz];
    const offsets = Array.from(new Set([tzInfo.sdt, tzInfo.dst]));
    const targetUtc = Date.UTC(year, month, day, hour, minute, 0);

    type CandidateRecord = { date: DateTz; delta: number; isDst: boolean; };
    const exactMatches: CandidateRecord[] = [];
    let nextCandidate: CandidateRecord | undefined;
    let previousCandidate: CandidateRecord | undefined;

    for (const offsetSeconds of offsets) {
      const candidateTs = timestamp - offsetSeconds * 1000;
      const candidate = new DateTz(candidateTs, tz);
      const candidateUtc = Date.UTC(candidate.year, candidate.month, candidate.day, candidate.hour, candidate.minute, 0);
      const delta = candidateUtc - targetUtc;
      const record: CandidateRecord = { date: candidate, delta, isDst: candidate.isDst };

      if (delta === 0) {
        exactMatches.push(record);
        continue;
      }
      if (delta > 0) {
        if (!nextCandidate || delta < nextCandidate.delta || (delta === nextCandidate.delta && record.isDst && !nextCandidate.isDst)) {
          nextCandidate = record;
        }
        continue;
      }
      if (!previousCandidate || delta > previousCandidate.delta || (delta === previousCandidate.delta && record.isDst && !previousCandidate.isDst)) {
        previousCandidate = record;
      }
    }

    let result: DateTz | undefined;
    if (exactMatches.length > 0) {
      exactMatches.sort((a, b) => Number(b.isDst) - Number(a.isDst));
      result = exactMatches[0].date;
    } else if (nextCandidate) {
      result = nextCandidate.date;
    } else if (previousCandidate) {
      result = previousCandidate.date;
    }

    if (!result) {
      result = new DateTz(timestamp, tz);
    }

    result.invalidateOffsetCache();
    return result;
  }

  /**
   * Gets the current date and time as a DateTz instance.
   * @param tz - The timezone identifier (optional). Defaults to 'UTC'.
   * @returns A new DateTz instance representing the current date and time.
   */
  static now(tz?: string): IDateTz {
    if (!tz) tz = 'UTC';
    const timezone = timezones[tz];
    if (!timezone) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    const date = new DateTz(Date.now(), tz);
    return date;
  }

  get isDst(): boolean {
    return this.getOffsetInfo().isDst;
  }




  /**
 * Gets the year component of the date.
 */
  get year() {
    return this._year(true);
  }

  /**
   * Gets the month component of the date.
   */
  get month() {
    return this._month(true);
  }

  /**
   * Gets the day component of the date.
   */
  get day() {
    return this._day(true);
  }

  /**
* Gets the hour component of the time.
*/
  get hour() {
    return this._hour(true);
  }

  /**
   * Gets the minute component of the time.
   */
  get minute() {
    return this._minute(true);
  }

  /**
   * Gets the day of the week.
   */
  get dayOfWeek(): number {
    return this._dayOfWeek(true);
  }

}
