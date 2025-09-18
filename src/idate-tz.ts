import { TimezoneOffset } from "./timezones";

export interface IDateTz {
  timestamp: number;
  timezone?: string;
  readonly timezoneOffset?: TimezoneOffset;
  compare?(other: IDateTz): number;
  isComparable?(other: IDateTz): boolean;
  toString?(): string;
  toString?(pattern: string): string;
  toString?(pattern: string, locale?: string): string;
  add?(value: number, unit: 'minute' | 'hour' | 'day' | 'month' | 'year'): IDateTz;
  set?(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute'): IDateTz;
  convertToTimezone?(tz: string): IDateTz;
  cloneToTimezone?(tz: string): IDateTz;
  readonly isDst?: boolean;
  readonly year?: number;
  readonly month?: number;
  readonly day?: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly dayOfWeek?: number;
}
