import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import WeeklyTasks from './WeeklyTasks';

const tasks = [
  { id: 'w1', name: 'Read a book', points: 20, frequency: 'weekly' },
  { id: 'w2', name: 'Call a friend', points: 15, frequency: 'weekly' }
];

const renderWeekly = (props = {}) => {
  const onTaskCheck = vi.fn();
  render(
    <WeeklyTasks
      tasks={tasks}
      userEntries={[]}
      onTaskCheck={onTaskCheck}
      competitionStartDate="2025-01-01"
      competitionEndDate="2025-12-31"
      {...props}
    />
  );
  return { onTaskCheck };
};

// Buttons in render order: prev week, next week, one checkbox per task, submit.
const getNavButtons = () => {
  const buttons = screen.getAllByRole('button');
  return { prev: buttons[0], next: buttons[1], checkboxes: buttons.slice(2, 2 + tasks.length) };
};

describe('WeeklyTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Wednesday of ISO week 3, 2025 (week starts Sunday 2025-01-12).
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the current week and its tasks', () => {
    renderWeekly();
    expect(screen.getByText('Weekly Tasks')).toBeInTheDocument();
    expect(screen.getByText('Year 2025, Week 3')).toBeInTheDocument();
    expect(screen.getByText('Read a book')).toBeInTheDocument();
    expect(screen.getByText('+20 PTS')).toBeInTheDocument();
    expect(screen.getByText('Call a friend')).toBeInTheDocument();
  });

  it('checks tasks against the start of the week', () => {
    const { onTaskCheck } = renderWeekly();
    fireEvent.click(getNavButtons().checkboxes[1]);
    const [task, date, isCompleted] = onTaskCheck.mock.calls[0];
    expect(task).toBe(tasks[1]);
    expect(date.toISOString()).toBe('2025-01-12T00:00:00.000Z');
    expect(isCompleted).toBe(true);
  });

  it('un-checks tasks completed this week', () => {
    const { onTaskCheck } = renderWeekly({
      userEntries: [
        { taskId: 'w1', date: '2025-01-12' },
        { taskId: 'w2', date: '2025-01-05' }
      ]
    });
    const { checkboxes } = getNavButtons();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(onTaskCheck.mock.calls[0][2]).toBe(false);
    expect(onTaskCheck.mock.calls[1][2]).toBe(true);
  });

  it('navigates to the previous week', () => {
    const { onTaskCheck } = renderWeekly({ userEntries: [{ taskId: 'w2', date: '2025-01-05' }] });
    fireEvent.click(getNavButtons().prev);
    expect(screen.getByText('Year 2025, Week 2')).toBeInTheDocument();
    fireEvent.click(getNavButtons().checkboxes[1]);
    const [, date, isCompleted] = onTaskCheck.mock.calls[0];
    expect(date.toISOString()).toBe('2025-01-05T00:00:00.000Z');
    expect(isCompleted).toBe(false);
  });

  it('disables future weeks', () => {
    renderWeekly();
    expect(getNavButtons().next).toBeEnabled();
    fireEvent.click(getNavButtons().next);
    expect(screen.getByText('Year 2025, Week 4')).toBeInTheDocument();
    const { next, checkboxes } = getNavButtons();
    expect(next).toBeDisabled();
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());
  });

  it('disables moving back past the competition start', () => {
    renderWeekly({ competitionStartDate: '2025-01-12' });
    expect(getNavButtons().prev).toBeEnabled();
    fireEvent.click(getNavButtons().prev);
    expect(screen.getByText('Year 2025, Week 2')).toBeInTheDocument();
    expect(getNavButtons().prev).toBeDisabled();
  });
});
