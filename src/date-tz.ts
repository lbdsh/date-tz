import {
  DateTzDiffUnit,
  DateTzDurationLike,
  DateTzGranularity,
  DateTzInclusivity,
  DateTzSerialized,
  IDateTz
} from './idate-tz';
import { TimezoneOffset, timezones } from './timezones';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;

type OffsetInfo = { offsetSeconds: number; isDst: boolean; };

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type PatternSegment =
  | { kind: 'token'; value: TokenKey; }
  | { kind: 'literal'; value: string; };

type TokenKey = 'YYYY' | 'yyyy' | 'YY' | 'yy' | 'MM' | 'LM' | 'DD' | 'HH' | 'hh' | 'mm' | 'ss' | 'aa' | 'AA' | 'tz';

const TOKEN_REGEX = /\[[^\]]*]|YYYY|yyyy|YY|yy|MM|LM|DD|HH|hh|mm|ss|aa|AA|tz/g;
const FORMAT_TOKEN_CHECK = /(YYYY|yyyy|YY|yy|MM|LM|DD|HH|hh|mm|ss|aa|AA|tz)/;

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

const DURATION_ALIASES: Record<string, DateTzDiffUnit | undefined> = {
  minute: 'minute',
  minutes: 'minute',
  hour: 'hour',
  hours: 'hour',
  day: 'day',
  days: 'day',
  week: 'week',
  weeks: 'week',
  month: 'month',
  months: 'month',
  year: 'year',
  years: 'year'
};

const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function ensureTimezone(id: string): TimezoneOffset {
  const info = timezones[id];
  if (!info) {
    throw new Error(`Invalid timezone: ${id}`);
  }
  return info;
}

function floorToMinute(timestamp: number): number {
  return Math.floor(timestamp / MS_PER_MINUTE) * MS_PER_MINUTE;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function capitalise(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function containsFormattingToken(value: string): boolean {
  return FORMAT_TOKEN_CHECK.test(value);
}

function tokenizePattern(pattern: string): PatternSegment[] {
  const segments: PatternSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const matcher = new RegExp(TOKEN_REGEX);
  while ((match = matcher.exec(pattern)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'literal', value: pattern.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('[') && raw.endsWith(']')) {
      segments.push({ kind: 'literal', value: raw.slice(1, -1) });
    } else {
      segments.push({ kind: 'token', value: raw as TokenKey });
    }
    lastIndex = matcher.lastIndex;
  }

  if (lastIndex < pattern.length) {
    segments.push({ kind: 'literal', value: pattern.slice(lastIndex) });
  }

  return segments;
}

function convertTwoDigitYear(value: number): number {
  return value + (value >= 70 ? 1900 : 2000);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 1) {
    return isLeapYear(year) ? 29 : 28;
  }
  return daysPerMonth[month];
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

function computeIntlOffsetSeconds(timezone: string, timestamp: number): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const lookup = (type: Intl.DateTimeFormatPartTypes) => {
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
    return Math.round((adjusted - timestamp) / MS_PER_SECOND);
  } catch {
    return null;
  }
}

function computeOffsetInfo(timezone: string, timestamp: number): OffsetInfo {
  const tzInfo = ensureTimezone(timezone);
  if (tzInfo.dst === tzInfo.sdt) {
    return { offsetSeconds: tzInfo.sdt, isDst: false };
  }
  const intlOffset = computeIntlOffsetSeconds(timezone, timestamp);
  if (intlOffset === null) {
    return { offsetSeconds: tzInfo.sdt, isDst: false };
  }
  if (intlOffset !== tzInfo.sdt && intlOffset !== tzInfo.dst) {
    return { offsetSeconds: intlOffset, isDst: intlOffset > tzInfo.sdt };
  }
  return { offsetSeconds: intlOffset, isDst: intlOffset === tzInfo.dst };
}

function normalizeDiffUnit(unit?: string): DateTzDiffUnit {
  if (!unit) {
    return 'millisecond';
  }
  const normalized = UNIT_ALIASES[unit.toLowerCase()];
  if (!normalized) {
    throw new Error(`Unsupported unit: ${unit}`);
  }
  return normalized;
}

function normalizeGranularity(unit: string): DateTzGranularity {
  const normalized = normalizeDiffUnit(unit);
  if (normalized === 'millisecond' || normalized === 'second') {
    throw new Error(`Unsupported granularity: ${unit}`);
  }
  return normalized as DateTzGranularity;
}

function normalizeInclusivity(token: DateTzInclusivity): [LowerBound: '(' | '[', UpperBound: ')' | ']'] {
  if (token.length !== 2) {
    throw new Error(`Invalid inclusivity token: ${token}`);
  }
  const lower = token[0];
  const upper = token[1];
  if (!['(', '['].includes(lower) || ![')', ']'].includes(upper)) {
    throw new Error(`Invalid inclusivity token: ${token}`);
  }
  return [lower as '(' | '[', upper as ')' | ']'];
}

function roundDiff(value: number, asFloat: boolean): number {
  if (asFloat) {
    return value;
  }
  return value < 0 ? Math.ceil(value) : Math.floor(value);
}

function hasDurationUnit(key: string): key is keyof DateTzDurationLike {
  return Object.prototype.hasOwnProperty.call(DURATION_ALIASES, key);
}

function getDurationUnit(key: string): DateTzDiffUnit {
  const normalized = DURATION_ALIASES[key];
  if (!normalized) {
    throw new Error(`Unsupported duration unit: ${key}`);
  }
  return normalized;
}

/**
 * Represents a date and time with a specific timezone.
 */
export class DateTz implements IDateTz {
  timestamp: number;
  timezone: string;
  private offsetCache?: { timestamp: number; info: OffsetInfo; };

  public static defaultFormat = 'YYYY-MM-DD HH:mm:ss';

  constructor(value: IDateTz);
  constructor(value: number, tz?: string);
  constructor(value: number | IDateTz, tz?: string) {
    if (typeof value === 'object') {
      const timezone = value.timezone ?? 'UTC';
      ensureTimezone(timezone);
      this.timestamp = floorToMinute(value.timestamp);
      this.timezone = timezone;
    } else {
      const timezone = tz ?? 'UTC';
      ensureTimezone(timezone);
      this.timestamp = floorToMinute(value);
      this.timezone = timezone;
    }
    this.offsetCache = undefined;
  }

  get timezoneOffset(): TimezoneOffset | undefined {
    return timezones[this.timezone];
  }

  compare(other: IDateTz): number {
    const comparable = this.ensureComparable(other);
    return this.timestamp - comparable.timestamp;
  }

  isComparable(other: IDateTz): boolean {
    return this.timezone === other.timezone;
  }

  toString(): string;
  toString(locale: string): string;
  toString(pattern: string, locale?: string): string;
  toString(patternOrLocale?: string, maybeLocale?: string): string {
    const tokens: Record<TokenKey, string> = {
      YYYY: '',
      yyyy: '',
      YY: '',
      yy: '',
      MM: '',
      LM: '',
      DD: '',
      HH: '',
      hh: '',
      mm: '',
      ss: '',
      aa: '',
      AA: '',
      tz: this.timezone
    };

    let pattern = DateTz.defaultFormat;
    let locale = 'en';
    const hasLocaleArgument = typeof maybeLocale === 'string' && maybeLocale.length > 0;

    if (hasLocaleArgument) {
      locale = maybeLocale!;
    }

    if (typeof patternOrLocale === 'string' && patternOrLocale.length > 0) {
      if (hasLocaleArgument || containsFormattingToken(patternOrLocale)) {
        pattern = patternOrLocale;
      } else if (this.isLikelyLocale(patternOrLocale)) {
        locale = patternOrLocale;
      } else {
        pattern = patternOrLocale;
      }
    } else if (patternOrLocale === undefined && hasLocaleArgument) {
      pattern = DateTz.defaultFormat;
    }

    const parts = this.getLocalParts(true);
    const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
    const ampm = parts.hour >= 12 ? 'PM' : 'AM';

    const monthName = capitalise(
      new Date(Date.UTC(parts.year, parts.month, 3))
        .toLocaleString(locale, { month: 'long', timeZone: 'UTC' })
    );

    tokens.YYYY = String(parts.year);
    tokens.yyyy = tokens.YYYY;
    tokens.YY = tokens.YYYY.slice(-2);
    tokens.yy = tokens.YY;
    tokens.MM = pad(parts.month + 1);
    tokens.LM = monthName;
    tokens.DD = pad(parts.day);
    tokens.HH = pad(parts.hour);
    tokens.hh = pad(hour12);
    tokens.mm = pad(parts.minute);
    tokens.ss = pad(parts.second);
    tokens.aa = ampm.toLowerCase();
    tokens.AA = ampm;

    return pattern.replace(TOKEN_REGEX, (match) => {
      if (match.startsWith('[') && match.endsWith(']')) {
        return match.slice(1, -1);
      }
      const token = match as TokenKey;
      return tokens[token] ?? match;
    });
  }

  add(value: number, unit: 'minute' | 'hour' | 'day' | 'month' | 'year') {
    if (value === 0) {
      return this;
    }
    if (unit === 'month' || unit === 'year') {
      this.shift(unit, value);
    } else {
      this.shift(unit, value);
    }
    return this;
  }

  subtract(value: number, unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year') {
    if (value === 0) {
      return this;
    }
    this.shift(unit, -value);
    return this;
  }

  plus(duration: DateTzDurationLike = {}) {
    for (const [key, rawValue] of Object.entries(duration)) {
      if (!hasDurationUnit(key)) {
        throw new Error(`Unsupported duration unit: ${key}`);
      }
      const value = rawValue ?? 0;
      if (!value) {
        continue;
      }
      const unit = getDurationUnit(key);
      if (unit === 'millisecond' || unit === 'second') {
        throw new Error(`Unsupported duration unit: ${key}`);
      }
      this.shift(unit, value);
    }
    return this;
  }

  minus(duration: DateTzDurationLike = {}) {
    const inverted: DateTzDurationLike = {};
    for (const [key, rawValue] of Object.entries(duration)) {
      if (!hasDurationUnit(key)) {
        throw new Error(`Unsupported duration unit: ${key}`);
      }
      if (!rawValue) {
        continue;
      }
      inverted[key as keyof DateTzDurationLike] = -(rawValue as number);
    }
    return this.plus(inverted);
  }

  diff(other: IDateTz, unit: DateTzDiffUnit = 'millisecond', asFloat = false): number {
    const normalized = normalizeDiffUnit(unit);
    const comparable = this.ensureComparable(other);
    const delta = this.timestamp - comparable.timestamp;

    switch (normalized) {
      case 'millisecond':
        return roundDiff(delta, asFloat);
      case 'second':
        return roundDiff(delta / MS_PER_SECOND, asFloat);
      case 'minute':
        return roundDiff(delta / MS_PER_MINUTE, asFloat);
      case 'hour':
        return roundDiff(delta / MS_PER_HOUR, asFloat);
      case 'day':
        return roundDiff(delta / MS_PER_DAY, asFloat);
      case 'week':
        return roundDiff(delta / MS_PER_WEEK, asFloat);
      case 'month': {
        const months = this.diffInMonths(comparable, asFloat);
        return roundDiff(months, asFloat);
      }
      case 'year': {
        const months = this.diffInMonths(comparable, asFloat);
        return roundDiff(months / 12, asFloat);
      }
      default:
        return roundDiff(delta, asFloat);
    }
  }

  startOf(unit: DateTzGranularity) {
    const normalized = normalizeGranularity(unit);
    const parts = this.getLocalParts(true);

    switch (normalized) {
      case 'minute':
        parts.second = 0;
        break;
      case 'hour':
        parts.minute = 0;
        parts.second = 0;
        break;
      case 'day':
        parts.hour = 0;
        parts.minute = 0;
        parts.second = 0;
        break;
      case 'week': {
        this.startOf('day');
        const dayOfWeek = this.dayOfWeek;
        if (dayOfWeek !== 0) {
          this.shift('day', -dayOfWeek);
          this.startOf('day');
        }
        return this;
      }
      case 'month':
        parts.day = 1;
        parts.hour = 0;
        parts.minute = 0;
        parts.second = 0;
        break;
      case 'year':
        parts.month = 0;
        parts.day = 1;
        parts.hour = 0;
        parts.minute = 0;
        parts.second = 0;
        break;
    }

    this.setFromLocalParts(parts);
    return this;
  }

  endOf(unit: DateTzGranularity) {
    const normalized = normalizeGranularity(unit);
    switch (normalized) {
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

  clone(): DateTz {
    return new DateTz(this);
  }

  toJSDate(): Date {
    return new Date(this.timestamp);
  }

  toISOString(): string {
    return this.toJSDate().toISOString();
  }

  toISO(): string {
    return this.toISOString();
  }

  toUnix(): number {
    return Math.floor(this.timestamp / MS_PER_SECOND);
  }

  toObject(): DateTzSerialized {
    return { timestamp: this.timestamp, timezone: this.timezone };
  }

  toJSON(): DateTzSerialized {
    return this.toObject();
  }

  toBSON(): DateTzSerialized {
    return this.toObject();
  }

  valueOf(): DateTzSerialized {
    return this.toObject();
  }

  [Symbol.toPrimitive](hint: string) {
    if (hint === 'number' || hint === 'default') {
      return this.timestamp;
    }
    return this.toString();
  }

  isBefore(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) < 0;
  }

  isAfter(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) > 0;
  }

  isSame(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) === 0;
  }

  isSameOrBefore(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) <= 0;
  }

  isSameOrAfter(other: IDateTz, unit: DateTzDiffUnit = 'millisecond'): boolean {
    return this.compareWithUnit(other, unit) >= 0;
  }

  isBetween(
    start: IDateTz,
    end: IDateTz,
    unit: DateTzDiffUnit = 'millisecond',
    inclusivity: DateTzInclusivity = '()'
  ): boolean {
    const [lower, upper] = normalizeInclusivity(inclusivity);
    const normalized = normalizeDiffUnit(unit);
    const rangeStart = this.ensureComparable(start);
    const rangeEnd = this.ensureComparable(end);
    if (rangeStart.timestamp > rangeEnd.timestamp) {
      throw new Error('Start date must be before end date');
    }
    const lowerCmp = this.compareWithUnitDate(rangeStart, normalized);
    const upperCmp = this.compareWithUnitDate(rangeEnd, normalized);
    const lowerPass = lower === '(' ? lowerCmp > 0 : lowerCmp >= 0;
    const upperPass = upper === ')' ? upperCmp < 0 : upperCmp <= 0;
    return lowerPass && upperPass;
  }

  convertToTimezone(tz: string) {
    ensureTimezone(tz);
    this.timezone = tz;
    this.invalidateOffsetCache();
    return this;
  }

  cloneToTimezone(tz: string) {
    ensureTimezone(tz);
    const clone = new DateTz(this);
    clone.timezone = tz;
    clone.invalidateOffsetCache();
    return clone;
  }

  set(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute') {
    const parts = this.getLocalParts(true);
    switch (unit) {
      case 'year':
        parts.year = value;
        break;
      case 'month':
        parts.month = value - 1;
        break;
      case 'day':
        parts.day = value;
        break;
      case 'hour':
        parts.hour = value;
        break;
      case 'minute':
        parts.minute = value;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    parts.day = clampDay(parts.year, parts.month, parts.day);
    parts.hour = Math.max(0, Math.min(23, parts.hour));
    parts.minute = Math.max(0, Math.min(59, parts.minute));
    parts.second = 0;
    this.setFromLocalParts(parts);
    return this;
  }

  get isDst(): boolean {
    return this.getOffsetInfo().isDst;
  }

  get year(): number {
    return this.getLocalParts(true).year;
  }

  get month(): number {
    return this.getLocalParts(true).month;
  }

  get day(): number {
    return this.getLocalParts(true).day;
  }

  get hour(): number {
    return this.getLocalParts(true).hour;
  }

  get minute(): number {
    return this.getLocalParts(true).minute;
  }

  get dayOfWeek(): number {
    const offsetSeconds = this.resolveOffsetSeconds(true);
    const localDate = new Date(this.timestamp + offsetSeconds * MS_PER_SECOND);
    return localDate.getUTCDay();
  }

  static parse(dateString: string, pattern?: string, tz?: string): DateTz {
    const format = pattern && pattern.length > 0 ? pattern : DateTz.defaultFormat;
    const segments = tokenizePattern(format);

    if (segments.some(segment => segment.kind === 'token' && segment.value === 'hh')) {
      const hasAmPm = segments.some(segment => segment.kind === 'token' && (segment.value === 'aa' || segment.value === 'AA'));
      if (!hasAmPm) {
        throw new Error('AM/PM marker (aa or AA) is required when using 12-hour format (hh)');
      }
    }

    const state: {
      year?: number;
      yearTwoDigit?: number;
      month?: number;
      day?: number;
      hour24?: number;
      hour12?: number;
      minute?: number;
      second?: number;
      ampm?: string;
      timezone?: string;
    } = {};

    let cursor = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.kind === 'literal') {
        const literal = segment.value;
        if (dateString.slice(cursor, cursor + literal.length) !== literal) {
          throw new Error(`Failed to parse date string: expected '${literal}' at position ${cursor}`);
        }
        cursor += literal.length;
        continue;
      }

      const token = segment.value;
      const readFixed = (length: number) => {
        const chunk = dateString.slice(cursor, cursor + length);
        if (chunk.length !== length) {
          throw new Error(`Invalid date string at token ${token}`);
        }
        cursor += length;
        return chunk;
      };
      const readNumber = (length: number) => {
        const chunk = readFixed(length);
        const value = Number(chunk);
        if (!Number.isFinite(value)) {
          throw new Error(`Invalid numeric value for token ${token}`);
        }
        return value;
      };

      switch (token) {
        case 'YYYY':
        case 'yyyy':
          state.year = readNumber(4);
          break;
        case 'YY':
        case 'yy':
          state.yearTwoDigit = readNumber(2);
          break;
        case 'MM':
          state.month = readNumber(2);
          break;
        case 'DD':
          state.day = readNumber(2);
          break;
        case 'HH':
          state.hour24 = readNumber(2);
          break;
        case 'hh':
          state.hour12 = readNumber(2);
          break;
        case 'mm':
          state.minute = readNumber(2);
          break;
        case 'ss':
          state.second = readNumber(2);
          break;
        case 'aa':
        case 'AA':
          state.ampm = readFixed(2);
          break;
        case 'tz': {
          let value: string;
          let nextLiteral: string | undefined;
          for (let j = i + 1; j < segments.length; j++) {
            if (segments[j].kind === 'literal' && segments[j].value.length > 0) {
              nextLiteral = segments[j].value;
              break;
            }
          }
          if (nextLiteral) {
            const nextIndex = dateString.indexOf(nextLiteral, cursor);
            if (nextIndex === -1) {
              throw new Error('Failed to parse timezone identifier');
            }
            value = dateString.slice(cursor, nextIndex);
            cursor = nextIndex;
          } else {
            value = dateString.slice(cursor);
            cursor = dateString.length;
          }
          state.timezone = value.trim();
          break;
        }
        case 'LM':
          throw new Error('Parsing locale month names (LM) is not supported');
        default:
          throw new Error(`Unsupported token ${token}`);
      }
    }

    if (cursor !== dateString.length) {
      throw new Error('Failed to consume entire date string');
    }

    const year = state.year ?? (state.yearTwoDigit !== undefined ? convertTwoDigitYear(state.yearTwoDigit) : 1970);
    const month = (state.month ?? 1) - 1;
    const day = state.day ?? 1;
    const minute = state.minute ?? 0;
    const second = state.second ?? 0;

    let hour: number;
    if (state.hour24 !== undefined) {
      hour = state.hour24;
    } else if (state.hour12 !== undefined) {
      if (!state.ampm) {
        throw new Error('Missing AM/PM marker for 12-hour format');
      }
      const isPm = state.ampm.toUpperCase() === 'PM';
      hour = state.hour12 % 12 + (isPm ? 12 : 0);
    } else {
      hour = 0;
    }

    const timezone = (state.timezone && state.timezone.length > 0)
      ? state.timezone
      : tz ?? 'UTC';
    ensureTimezone(timezone);

    const baseUtc = Date.UTC(year, month, day, hour, minute, second);
    const tzInfo = ensureTimezone(timezone);
    const offsets = Array.from(new Set([tzInfo.sdt, tzInfo.dst]));

    const targetUtc = Date.UTC(year, month, day, hour, minute, 0);

    type CandidateRecord = { date: DateTz; delta: number; isDst: boolean; };
    const exactMatches: CandidateRecord[] = [];
    let nextCandidate: CandidateRecord | undefined;
    let previousCandidate: CandidateRecord | undefined;

    for (const offsetSeconds of offsets) {
      const candidateTimestamp = baseUtc - offsetSeconds * MS_PER_SECOND;
      const candidate = new DateTz(candidateTimestamp, timezone);
      const candidateUtc = Date.UTC(
        candidate.year,
        candidate.month,
        candidate.day,
        candidate.hour,
        candidate.minute,
        0
      );
      const delta = candidateUtc - targetUtc;
      const record: CandidateRecord = { date: candidate, delta, isDst: candidate.isDst };

      if (delta === 0) {
        exactMatches.push(record);
        continue;
      }
      if (delta > 0) {
        if (!nextCandidate || delta < nextCandidate.delta ||
          (delta === nextCandidate.delta && record.isDst && !nextCandidate.isDst)) {
          nextCandidate = record;
        }
        continue;
      }
      if (!previousCandidate || delta > previousCandidate.delta ||
        (delta === previousCandidate.delta && record.isDst && !previousCandidate.isDst)) {
        previousCandidate = record;
      }
    }

    let result: DateTz;
    if (exactMatches.length > 0) {
      exactMatches.sort((a, b) => Number(b.isDst) - Number(a.isDst));
      result = exactMatches[0].date;
    } else if (nextCandidate) {
      result = nextCandidate.date;
    } else if (previousCandidate) {
      result = previousCandidate.date;
    } else {
      result = new DateTz(baseUtc - tzInfo.sdt * MS_PER_SECOND, timezone);
    }

    result.invalidateOffsetCache();
    return result;
  }

  static now(tz?: string): DateTz {
    const timezone = tz ?? 'UTC';
    ensureTimezone(timezone);
    return new DateTz(Date.now(), timezone);
  }

  static isSerialized(value: unknown): value is DateTzSerialized {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as { [key: string]: unknown; };
    if (typeof candidate.timestamp !== 'number' || typeof candidate.timezone !== 'string') {
      return false;
    }
    try {
      DateTz.hydrate(candidate as { timestamp: number; timezone: string; });
      return true;
    } catch {
      return false;
    }
  }

  static from(value: unknown, tz?: string): DateTz {
    if (value instanceof DateTz) {
      return value;
    }
    if (value instanceof Date) {
      return new DateTz(value.getTime(), tz ?? 'UTC');
    }
    if (typeof value === 'number') {
      return new DateTz(value, tz);
    }
    const hydrated = DateTz.maybeHydrate(value, tz);
    if (hydrated) {
      return hydrated;
    }
    throw new Error('Unable to coerce value into a DateTz instance');
  }

  static hydrate<T extends { timestamp: number; timezone?: string; [key: string]: unknown; }>(
    value: T,
    tz?: string
  ): T & DateTz;
  static hydrate(value: null | undefined, tz?: string): null | undefined;
  static hydrate(value: { timestamp: number; timezone?: string; [key: string]: unknown; } | null | undefined, tz?: string) {
    if (value === null || value === undefined) {
      return value;
    }
    if (value instanceof DateTz) {
      return value;
    }
    if (typeof value !== 'object') {
      throw new Error('DateTz.hydrate expects an object with a timestamp property');
    }
    const candidate = value as { timestamp?: unknown; timezone?: unknown; [key: string]: unknown; };
    if (typeof candidate.timestamp !== 'number') {
      throw new Error('DateTz.hydrate requires a numeric timestamp');
    }
    const timezone = typeof candidate.timezone === 'string' ? candidate.timezone : tz ?? 'UTC';
    const instance = new DateTz(candidate.timestamp, timezone);
    Object.setPrototypeOf(candidate, DateTz.prototype);
    candidate.timestamp = instance.timestamp;
    candidate.timezone = instance.timezone;
    return candidate;
  }

  static compare(left: unknown, right: unknown): number {
    const first = DateTz.coerce(left);
    const second = DateTz.coerce(right, first.timezone);
    return first.compare(second);
  }

  static diff(left: unknown, right: unknown, unit: DateTzDiffUnit = 'millisecond', asFloat = false): number {
    const first = DateTz.coerce(left);
    const second = DateTz.coerce(right, first.timezone);
    return first.diff(second, unit, asFloat);
  }

  static isBefore(left: unknown, right: unknown, unit: DateTzDiffUnit = 'millisecond'): boolean {
    const first = DateTz.coerce(left);
    const second = DateTz.coerce(right, first.timezone);
    return first.isBefore(second, unit);
  }

  static isAfter(left: unknown, right: unknown, unit: DateTzDiffUnit = 'millisecond'): boolean {
    const first = DateTz.coerce(left);
    const second = DateTz.coerce(right, first.timezone);
    return first.isAfter(second, unit);
  }

  static isSame(left: unknown, right: unknown, unit: DateTzDiffUnit = 'millisecond'): boolean {
    const first = DateTz.coerce(left);
    const second = DateTz.coerce(right, first.timezone);
    return first.isSame(second, unit);
  }

  static isSameOrBefore(left: unknown, right: unknown, unit: DateTzDiffUnit = 'millisecond'): boolean {
    const first = DateTz.coerce(left);
    const second = DateTz.coerce(right, first.timezone);
    return first.isSameOrBefore(second, unit);
  }

  static isSameOrAfter(left: unknown, right: unknown, unit: DateTzDiffUnit = 'millisecond'): boolean {
    const first = DateTz.coerce(left);
    const second = DateTz.coerce(right, first.timezone);
    return first.isSameOrAfter(second, unit);
  }

  static isBetween(
    value: unknown,
    start: unknown,
    end: unknown,
    unit: DateTzDiffUnit = 'millisecond',
    inclusivity: DateTzInclusivity = '()'
  ): boolean {
    const target = DateTz.coerce(value);
    const rangeStart = DateTz.coerce(start, target.timezone);
    const rangeEnd = DateTz.coerce(end, target.timezone);
    return target.isBetween(rangeStart, rangeEnd, unit, inclusivity);
  }

  static maybeHydrate(value: unknown, tz?: string): DateTz | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    if (value instanceof DateTz) {
      return value;
    }
    const candidate = value as { timestamp?: unknown; timezone?: unknown; [key: string]: unknown; };
    if (typeof candidate.timestamp !== 'number') {
      return undefined;
    }
    const timezone = typeof candidate.timezone === 'string' ? candidate.timezone : tz ?? 'UTC';
    return DateTz.hydrate(candidate as { timestamp: number; timezone?: string; }, timezone);
  }

  private static coerce(value: unknown, fallbackTz?: string): DateTz {
    const hydrated = DateTz.maybeHydrate(value, fallbackTz);
    if (hydrated) {
      return hydrated;
    }
    if (typeof value === 'number') {
      return new DateTz(value, fallbackTz);
    }
    throw new Error('Unable to coerce value into a DateTz instance');
  }

  private diffInMonths(other: DateTz, asFloat: boolean): number {
    const forward = this.timestamp >= other.timestamp;
    const earlier = forward ? other.clone() : this.clone();
    const later = forward ? this.clone() : other.clone();

    let months = 0;
    let anchor = earlier.clone();
    let next = anchor.clone();
    next.add(1, 'month');

    while (next.timestamp <= later.timestamp) {
      anchor = next;
      months += 1;
      next = anchor.clone();
      next.add(1, 'month');
    }

    if (!asFloat) {
      return forward ? months : -months;
    }

    const span = next.timestamp - anchor.timestamp;
    const remainder = later.timestamp - anchor.timestamp;
    const fractional = span === 0 ? 0 : remainder / span;
    const value = months + fractional;
    return forward ? value : -value;
  }

  private compareWithUnitDate(other: DateTz, unit: DateTzDiffUnit): number {
    const normalized = normalizeDiffUnit(unit);
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
      case 'year':
        this.shiftCalendar(unit, value);
        return this;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }
    this.timestamp = floorToMinute(this.timestamp);
    this.invalidateOffsetCache();
    return this;
  }

  private shiftCalendar(unit: 'month' | 'year', value: number) {
    if (value === 0) {
      return;
    }
    const parts = this.getLocalParts(true);
    if (unit === 'year') {
      parts.year += value;
    } else {
      let totalMonths = parts.year * 12 + parts.month + value;
      let year = Math.floor(totalMonths / 12);
      let month = totalMonths % 12;
      if (month < 0) {
        month += 12;
        year -= 1;
      }
      parts.year = year;
      parts.month = month;
    }
    parts.day = clampDay(parts.year, parts.month, parts.day);
    this.setFromLocalParts(parts);
  }

  private getLocalParts(considerDst = true): LocalDateTime {
    const offsetSeconds = this.resolveOffsetSeconds(considerDst);
    const local = new Date(this.timestamp + offsetSeconds * MS_PER_SECOND);
    return {
      year: local.getUTCFullYear(),
      month: local.getUTCMonth(),
      day: local.getUTCDate(),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
      second: local.getUTCSeconds()
    };
  }

  private setFromLocalParts(parts: LocalDateTime) {
    const safeDay = clampDay(parts.year, parts.month, parts.day);
    const formatted =
      `${pad(parts.year, 4)}-${pad(parts.month + 1)}-${pad(safeDay)} ` +
      `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
    const parsed = DateTz.parse(formatted, 'YYYY-MM-DD HH:mm:ss', this.timezone);
    this.timestamp = parsed.timestamp;
    this.timezone = parsed.timezone;
    this.invalidateOffsetCache();
  }

  private resolveOffsetSeconds(considerDst: boolean): number {
    if (!considerDst) {
      return ensureTimezone(this.timezone).sdt;
    }
    return this.getOffsetInfo().offsetSeconds;
  }

  private getOffsetInfo(): OffsetInfo {
    if (this.offsetCache && this.offsetCache.timestamp === this.timestamp) {
      return this.offsetCache.info;
    }
    const info = computeOffsetInfo(this.timezone, this.timestamp);
    this.offsetCache = { timestamp: this.timestamp, info };
    return info;
  }

  private invalidateOffsetCache() {
    this.offsetCache = undefined;
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

  private isLikelyLocale(candidate: string): boolean {
    try {
      return Intl.getCanonicalLocales(candidate).length > 0;
    } catch {
      return false;
    }
  }
}
