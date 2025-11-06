import { TimezoneOffset } from "./timezones";

export type DateTzDiffUnit =
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

export type DateTzGranularity = Exclude<DateTzDiffUnit, 'millisecond' | 'second'>;

export type DateTzInclusivity = '()' | '(]' | '[)' | '[]';

export type DateTzDurationLike = Partial<{
  minute: number;
  minutes: number;
  hour: number;
  hours: number;
  day: number;
  days: number;
  week: number;
  weeks: number;
  month: number;
  months: number;
  year: number;
  years: number;
}>;

export interface IDateTz {
  timestamp: number;
  timezone?: string;
  readonly timezoneOffset?: TimezoneOffset;
  compare?(other: IDateTz): number;
  isComparable?(other: IDateTz): boolean;
  toString?(pattern?: string, locale?: string): string;
  add?(value: number, unit: 'minute' | 'hour' | 'day' | 'month' | 'year'): IDateTz;
  subtract?(value: number, unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'): IDateTz;
  plus?(duration: DateTzDurationLike): IDateTz;
  minus?(duration: DateTzDurationLike): IDateTz;
  diff?(other: IDateTz, unit?: DateTzDiffUnit, asFloat?: boolean): number;
  set?(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute'): IDateTz;
  startOf?(unit: DateTzGranularity): IDateTz;
  endOf?(unit: DateTzGranularity): IDateTz;
  convertToTimezone?(tz: string): IDateTz;
  cloneToTimezone?(tz: string): IDateTz;
  clone?(): IDateTz;
  toJSDate?(): Date;
  toISOString?(): string;
  toISO?(): string;
  toUnix?(): number;
  toObject?(): IDateTz;
  toJSON?(): IDateTz;
  toBSON?(): IDateTz;
  valueOf?(): number | IDateTz;
  isBefore?(other: IDateTz, unit?: DateTzDiffUnit): boolean;
  isAfter?(other: IDateTz, unit?: DateTzDiffUnit): boolean;
  isSame?(other: IDateTz, unit?: DateTzDiffUnit): boolean;
  isSameOrBefore?(other: IDateTz, unit?: DateTzDiffUnit): boolean;
  isSameOrAfter?(other: IDateTz, unit?: DateTzDiffUnit): boolean;
  isBetween?(start: IDateTz, end: IDateTz, unit?: DateTzDiffUnit, inclusivity?: DateTzInclusivity): boolean;
  readonly isDst?: boolean;
  readonly year?: number;
  readonly month?: number;
  readonly day?: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly dayOfWeek?: number;
}
