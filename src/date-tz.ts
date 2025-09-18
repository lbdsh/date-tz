import { IDateTz } from "./idate-tz";
import { timezones } from "./timezones";

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

// Epoch time constants
const epochYear = 1970;
const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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
      this.timezone = tz || 'UCT';
      if (!timezones[this.timezone]) {
        throw new Error(`Invalid timezone: ${tz}`);
      }
      this.timestamp = this.stripSMs(value);
    }
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
  toString(pattern: string): string;
  toString(pattern?: string, locale?: string): string {
    if (!pattern) pattern = 'YYYY-MM-DD HH:mm:ss';

    // Calculate year, month, day, hours, minutes, seconds
    const offset = (this.isDst ? timezones[this.timezone].dst : timezones[this.timezone].sdt) * 1000;
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

    if (!locale) locale = 'en';
    let monthStr = new Date(year, month, 3).toLocaleString(locale || 'en', { month: 'long' });
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
    return this;
  }


  private _year(considerDst = false) {
    const offset = considerDst ? (timezones[this.timezone].dst * 1000) : (timezones[this.timezone].sdt * 1000);
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
    const offset = considerDst ? (timezones[this.timezone].dst * 1000) : (timezones[this.timezone].sdt * 1000);
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
    const offset = considerDst ? (timezones[this.timezone].dst * 1000) : (timezones[this.timezone].sdt * 1000);
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
    const offset = considerDst ? (timezones[this.timezone].dst * 1000) : (timezones[this.timezone].sdt * 1000);
    let remainingMs = this.timestamp + offset;
    remainingMs %= MS_PER_DAY;
    let hour = Math.floor(remainingMs / MS_PER_HOUR);
    return hour;
  }

  private _minute(considerDst = false) {
    const offset = considerDst ? (timezones[this.timezone].dst * 1000) : (timezones[this.timezone].sdt * 1000);
    let remainingMs = this.timestamp + offset;
    remainingMs %= MS_PER_HOUR;
    let minute = Math.floor(remainingMs / MS_PER_MINUTE);
    return minute;
  }

  private _dayOfWeek(considerDst = false) {
    const offset = considerDst ? (timezones[this.timezone].dst * 1000) : (timezones[this.timezone].sdt * 1000);
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
  static parse(dateString: string, pattern?: string, tz?: string): DateTz {
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

    const daysInYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;
    const daysInMonth = (year: number, month: number) => month === 1 && daysInYear(year) === 366 ? 29 : daysPerMonth[month];

    let timestamp = 0;

    // Add years
    for (let y = 1970; y < year; y++) {
      timestamp += daysInYear(y) * MS_PER_DAY;
    }

    // Add months
    for (let m = 0; m < month; m++) {
      timestamp += daysInMonth(year, m) * MS_PER_DAY;
    }
    // Add days, hours, minutes, and seconds
    timestamp += (day - 1) * MS_PER_DAY;
    timestamp += hour * MS_PER_HOUR;
    timestamp += minute * MS_PER_MINUTE;
    timestamp += second * 1000;

    const offset = (timezones[tz].sdt) * 1000;
    let remainingMs = timestamp - offset;
    const date = new DateTz(remainingMs, tz);
    date.timestamp -= date.isDst ? (timezones[tz].dst - timezones[tz].sdt) * 1000 : 0;
    return date;
  }

  /**
   * Gets the current date and time as a DateTz instance.
   * @param tz - The timezone identifier (optional). Defaults to 'UTC'.
   * @returns A new DateTz instance representing the current date and time.
   */
  static now(tz?: string): DateTz {
    if (!tz) tz = 'UTC';
    const timezone = timezones[tz];
    if (!timezone) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    const date = new DateTz(Date.now(), tz);
    return date;
  }

  get isDst(): boolean {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const janD = Date.UTC(this._year(), 0, 1, this._hour() - timezones[this.timezone].sdt / 3600, this._minute(), 0);
    const jan = formatter.format(+janD);
    const now = formatter.format(this.timestamp);
    const janMinutes = this.hhmmToMinutes(jan);
    const nowMinutes = this.hhmmToMinutes(now);
    return nowMinutes !== janMinutes;
  }

  private hhmmToMinutes(hhmm: string): number {
    const [hours, minutes] = hhmm.split(':').map(Number);
    return hours * 60 + minutes;
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