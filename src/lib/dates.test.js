import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, getWeekInfo, toISODateString } from './dates';

describe('formatDate', () => {
  it('returns N/A for empty values', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate(undefined)).toBe('N/A');
    expect(formatDate('')).toBe('N/A');
  });

  it('formats objects with a toDate() method (Firestore Timestamps)', () => {
    const timestamp = { toDate: () => new Date(2025, 0, 5) };
    expect(formatDate(timestamp)).toBe('Jan 5, 2025');
  });

  it('formats Date instances', () => {
    expect(formatDate(new Date(2024, 11, 31))).toBe('Dec 31, 2024');
  });

  it('formats date strings', () => {
    // Competition dates are stored as YYYY-MM-DD strings (parsed as UTC).
    expect(formatDate('2025-03-15')).toBe('Mar 15, 2025');
  });

  it('formats epoch milliseconds', () => {
    expect(formatDate(Date.UTC(2023, 6, 4))).toBe('Jul 4, 2023');
  });
});

describe('toISODateString', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the YYYY-MM-DD date', () => {
    expect(toISODateString(new Date(2025, 1, 3, 12, 30))).toBe('2025-02-03');
  });

  it('zero-pads month and day', () => {
    expect(toISODateString(new Date(2025, 0, 1))).toBe('2025-01-01');
  });

  it('handles the last moment of a day', () => {
    expect(toISODateString(new Date(2025, 5, 30, 23, 59, 59, 999))).toBe('2025-06-30');
  });

  it('uses the local calendar date when behind UTC', () => {
    // 2025-02-04T02:00Z is still Feb 3 at UTC-5.
    const date = new Date('2025-02-04T02:00:00Z');
    vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(300);
    expect(toISODateString(date)).toBe('2025-02-03');
  });

  it('uses the local calendar date when ahead of UTC', () => {
    // 2025-02-03T22:00Z is already Feb 4 at UTC+9.
    const date = new Date('2025-02-03T22:00:00Z');
    vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(-540);
    expect(toISODateString(date)).toBe('2025-02-04');
  });

  it('does not mutate its argument', () => {
    const date = new Date(2025, 1, 3, 12);
    const before = date.getTime();
    toISODateString(date);
    expect(date.getTime()).toBe(before);
  });
});

describe('getWeekInfo', () => {
  const iso = (d) => d.toISOString().split('T')[0];

  it('returns the ISO week number and year', () => {
    // Wednesday 2025-01-15 is in ISO week 3 of 2025.
    const info = getWeekInfo(new Date(2025, 0, 15));
    expect(info.year).toBe(2025);
    expect(info.week).toBe(3);
  });

  it('returns the Sunday starting the week as startDate', () => {
    const info = getWeekInfo(new Date(2025, 0, 15));
    expect(iso(info.startDate)).toBe('2025-01-12');
    expect(info.startDate.getUTCDay()).toBe(0);
  });

  it('treats Sunday as the last day of the ISO week', () => {
    // Sunday 2025-01-19 belongs to ISO week 3 (Mon Jan 13 - Sun Jan 19).
    const info = getWeekInfo(new Date(2025, 0, 19));
    expect(info.week).toBe(3);
    expect(iso(info.startDate)).toBe('2025-01-12');
  });

  it('starts a new week on Monday', () => {
    expect(getWeekInfo(new Date(2025, 0, 20)).week).toBe(4);
  });

  it('assigns early-January days to the previous year when appropriate', () => {
    // Friday 2021-01-01 is in ISO week 53 of 2020.
    const info = getWeekInfo(new Date(2021, 0, 1));
    expect(info.year).toBe(2020);
    expect(info.week).toBe(53);
  });

  it('assigns late-December days to the next year when appropriate', () => {
    // Monday 2024-12-30 is in ISO week 1 of 2025.
    const info = getWeekInfo(new Date(2024, 11, 30));
    expect(info.year).toBe(2025);
    expect(info.week).toBe(1);
  });

  it('gives every day of the same ISO week the same result', () => {
    const days = [13, 14, 15, 16, 17, 18, 19].map(d => getWeekInfo(new Date(2025, 0, d)));
    for (const info of days) {
      expect(info.week).toBe(3);
      expect(iso(info.startDate)).toBe('2025-01-12');
    }
  });

  it('ignores the time of day', () => {
    const morning = getWeekInfo(new Date(2025, 0, 15, 0, 0, 1));
    const night = getWeekInfo(new Date(2025, 0, 15, 23, 59, 59));
    expect(morning).toEqual(night);
  });

  it('does not mutate its argument', () => {
    const date = new Date(2025, 0, 15, 10);
    const before = date.getTime();
    getWeekInfo(date);
    expect(date.getTime()).toBe(before);
  });
});
