import { describe, expect, it } from 'vitest';
import {
  buildEntryId,
  getAvailableTabs,
  getCompletedTaskIds,
  getCompletedTaskIdsForDate,
  getPointsToSubtract,
  groupTasksByFrequency,
  sortByScore,
} from './tasks';

const daily = { id: 'd1', frequency: 'daily' };
const daily2 = { id: 'd2', frequency: 'daily' };
const weekly = { id: 'w1', frequency: 'weekly' };
const once = { id: 'o1', frequency: 'once' };

describe('groupTasksByFrequency', () => {
  it('groups tasks by frequency, preserving order', () => {
    expect(groupTasksByFrequency([daily, weekly, once, daily2])).toEqual({
      daily: [daily, daily2],
      weekly: [weekly],
      'one-and-done': [once],
    });
  });

  it('returns empty groups for no tasks', () => {
    expect(groupTasksByFrequency([])).toEqual({ daily: [], weekly: [], 'one-and-done': [] });
  });

  it('drops tasks with an unknown frequency', () => {
    const groups = groupTasksByFrequency([{ id: 'x', frequency: 'monthly' }, daily]);
    expect(groups.daily).toEqual([daily]);
    expect(groups.weekly).toEqual([]);
    expect(groups['one-and-done']).toEqual([]);
  });
});

describe('getAvailableTabs', () => {
  it('lists every non-empty group in display order', () => {
    expect(getAvailableTabs(groupTasksByFrequency([once, weekly, daily]))).toEqual([
      'daily',
      'weekly',
      'one-and-done',
    ]);
  });

  it('skips empty groups', () => {
    expect(getAvailableTabs(groupTasksByFrequency([once]))).toEqual(['one-and-done']);
    expect(getAvailableTabs(groupTasksByFrequency([weekly, once]))).toEqual(['weekly', 'one-and-done']);
    expect(getAvailableTabs(groupTasksByFrequency([daily]))).toEqual(['daily']);
  });

  it('returns no tabs when there are no tasks', () => {
    expect(getAvailableTabs(groupTasksByFrequency([]))).toEqual([]);
  });
});

describe('buildEntryId', () => {
  it('uses one id per user for one-and-done tasks', () => {
    expect(buildEntryId('u1', once, '2025-01-01')).toBe('u1_o1');
    expect(buildEntryId('u1', once, '2025-02-01')).toBe('u1_o1');
  });

  it('includes the date for daily tasks', () => {
    expect(buildEntryId('u1', daily, '2025-01-01')).toBe('u1_d1_2025-01-01');
  });

  it('includes the date for weekly tasks', () => {
    expect(buildEntryId('u1', weekly, '2025-01-05')).toBe('u1_w1_2025-01-05');
  });
});

describe('getCompletedTaskIdsForDate', () => {
  const entries = [
    { taskId: 'd1', date: '2025-01-01' },
    { taskId: 'd2', date: '2025-01-01' },
    { taskId: 'd1', date: '2025-01-02' },
  ];

  it('returns ids of tasks completed on that date', () => {
    expect(getCompletedTaskIdsForDate(entries, '2025-01-01')).toEqual(new Set(['d1', 'd2']));
    expect(getCompletedTaskIdsForDate(entries, '2025-01-02')).toEqual(new Set(['d1']));
  });

  it('returns an empty set when nothing matches', () => {
    expect(getCompletedTaskIdsForDate(entries, '2025-01-03').size).toBe(0);
    expect(getCompletedTaskIdsForDate([], '2025-01-01').size).toBe(0);
  });
});

describe('getCompletedTaskIds', () => {
  it('returns the unique ids of all entries', () => {
    const entries = [
      { taskId: 'o1', date: '2025-01-01' },
      { taskId: 'd1', date: '2025-01-02' },
      { taskId: 'o1', date: '2025-01-03' },
    ];
    expect(getCompletedTaskIds(entries)).toEqual(new Set(['o1', 'd1']));
  });

  it('ignores entries without a task id', () => {
    expect(getCompletedTaskIds([{ date: '2025-01-01' }, { taskId: '' }])).toEqual(new Set());
  });
});

describe('getPointsToSubtract', () => {
  it('uses the points awarded on the entry', () => {
    expect(getPointsToSubtract({ pointsAwarded: 15 }, 10)).toBe(15);
  });

  it('falls back to the task points when none were recorded', () => {
    expect(getPointsToSubtract({}, 10)).toBe(10);
    expect(getPointsToSubtract({ pointsAwarded: 0 }, 10)).toBe(10);
  });
});

describe('sortByScore', () => {
  it('sorts by score, highest first', () => {
    const sorted = sortByScore([
      { id: 'a', score: 5 },
      { id: 'b', score: 20 },
      { id: 'c', score: 10 },
    ]);
    expect(sorted.map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('treats a missing score as zero', () => {
    const sorted = sortByScore([{ id: 'a' }, { id: 'b', score: 1 }, { id: 'c', score: -1 }]);
    expect(sorted.map(p => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps the original order for ties', () => {
    const sorted = sortByScore([{ id: 'a', score: 1 }, { id: 'b', score: 1 }, { id: 'c', score: 2 }]);
    expect(sorted.map(p => p.id)).toEqual(['c', 'a', 'b']);
  });

  it('does not mutate the input', () => {
    const input = [{ id: 'a', score: 1 }, { id: 'b', score: 2 }];
    const copy = [...input];
    sortByScore(input);
    expect(input).toEqual(copy);
  });
});
