import { DateTz } from './date-tz';

describe('DateTz', () => {
  it('should create an instance with the correct date and timezone', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.datetime).toBe(1609459200000);
    expect(dateTz.timezone).toBe(0);
  });

  it('should compare two DateTz instances with the same timezone', () => {
    const dateTz1 = new DateTz(1609459200000, 0);
    const dateTz2 = new DateTz(1609545600000, 0); // 2021-01-02 00:00:00 UTC
    expect(dateTz1.compare(dateTz2)).toBeLessThan(0);
  });

  it('should throw an error when comparing two DateTz instances with different timezones', () => {
    const dateTz1 = new DateTz(1609459200000, 0);
    const dateTz2 = new DateTz(1609459200000, 1);
    expect(() => dateTz1.compare(dateTz2)).toThrow('Cannot compare dates with different timezones');
  });

  it('should format the date correctly with the default pattern', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.toString()).toBe('2021-01-01 00:00:00');
  });

  it('should format the date correctly with a custom pattern', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.toString('DD/MM/YYYY')).toBe('01/01/2021');
  });

  it('should add minutes correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(30, 'minute');
    expect(dateTz.toString()).toBe('2021-01-01 00:30:00');
  });

  it('should add hours correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(2, 'hour');
    expect(dateTz.toString()).toBe('2021-01-01 02:00:00');
  });

  it('should add days correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(1, 'day');
    expect(dateTz.toString()).toBe('2021-01-02 00:00:00');
  });

  it('should add months correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(1, 'month');
    expect(dateTz.toString()).toBe('2021-02-01 00:00:00');
  });

  it('should add years correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(1, 'year');
    expect(dateTz.toString()).toBe('2022-01-01 00:00:00');
  });

  it('should return the correct year', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.year).toBe(2021);
  });

  it('should return the correct month', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.month).toBe(0); // January
  });

  it('should return the correct day', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.day).toBe(1);
  });

  it('should return the correct hour', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.hour).toBe(0);
  });

  it('should return the correct minute', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.minute).toBe(0);
  });

  it('should create an instance with the correct date and timezone', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.datetime).toBe(1609459200000);
    expect(dateTz.timezone).toBe(0);
  });

  it('should compare two DateTz instances with the same timezone', () => {
    const dateTz1 = new DateTz(1609459200000, 0);
    const dateTz2 = new DateTz(1609545600000, 0); // 2021-01-02 00:00:00 UTC
    expect(dateTz1.compare(dateTz2)).toBeLessThan(0);
  });

  it('should throw an error when comparing two DateTz instances with different timezones', () => {
    const dateTz1 = new DateTz(1609459200000, 0);
    const dateTz2 = new DateTz(1609459200000, 1);
    expect(() => dateTz1.compare(dateTz2)).toThrow('Cannot compare dates with different timezones');
  });

  it('should format the date correctly with the default pattern', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.toString()).toBe('2021-01-01 00:00:00');
  });

  it('should format the date correctly with a custom pattern', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.toString('DD/MM/YYYY')).toBe('01/01/2021');
  });

  it('should add minutes correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(30, 'minute');
    expect(dateTz.toString()).toBe('2021-01-01 00:30:00');
  });

  it('should add hours correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(2, 'hour');
    expect(dateTz.toString()).toBe('2021-01-01 02:00:00');
  });

  it('should add days correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(1, 'day');
    expect(dateTz.toString()).toBe('2021-01-02 00:00:00');
  });

  it('should add months correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(1, 'month');
    expect(dateTz.toString()).toBe('2021-02-01 00:00:00');
  });

  it('should add years correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.add(1, 'year');
    expect(dateTz.toString()).toBe('2022-01-01 00:00:00');
  });

  it('should return the correct year', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.year).toBe(2021);
  });

  it('should return the correct month', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.month).toBe(0); // January
  });

  it('should return the correct day', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.day).toBe(1);
  });

  it('should return the correct hour', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.hour).toBe(0);
  });

  it('should return the correct minute', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    expect(dateTz.minute).toBe(0);
  });

  it('should parse a date string correctly', () => {
    const dateTz = DateTz.parse('2021--01-01 00:00:00', 'YYYY--MM-DD HH:mm', 0);
    expect(dateTz.datetime).toBe(1609459200000);
    expect(dateTz.timezone).toBe(0);
  });

  it('should set the year correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.set(2022, 'year');
    expect(dateTz.toString()).toBe('2022-01-01 00:00:00');
  });

  it('should set the month correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.set(2, 'month');
    expect(dateTz.toString()).toBe('2021-02-01 00:00:00');
  });

  it('should set the day correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.set(2, 'day');
    expect(dateTz.toString()).toBe('2021-01-02 00:00:00');
  });

  it('should set the hour correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.set(2, 'hour');
    expect(dateTz.toString()).toBe('2021-01-01 02:00:00');
  });

  it('should set the minute correctly', () => {
    const dateTz = new DateTz(1609459200000, 0); // 2021-01-01 00:00:00 UTC
    dateTz.set(30, 'minute');
    expect(dateTz.toString()).toBe('2021-01-01 00:30:00');
  });

  it('should convert timezone name to offset correctly', () => {
    expect(DateTz.tzNameToOffset('PST')).toBe(-8);
  });

  it('should convert timezone offset to name correctly', () => {
    expect(DateTz.tzOffsetToName(-8)).toBe('PST');
  });
});