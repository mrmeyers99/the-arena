import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DailyTasks from './DailyTasks';

const tasks = [
  { id: 't1', name: 'Drink water', points: 5, frequency: 'daily' },
  { id: 't2', name: 'Go for a run', points: 10, frequency: 'daily' }
];

const renderDaily = (props = {}) => {
  const onTaskCheck = vi.fn();
  render(
    <DailyTasks
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

// Buttons in render order: prev day, next day, one checkbox per task, submit.
const getNavButtons = () => {
  const buttons = screen.getAllByRole('button');
  return { prev: buttons[0], next: buttons[1], checkboxes: buttons.slice(2, 2 + tasks.length) };
};

describe('DailyTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists each task with its points and today's date", () => {
    renderDaily();
    expect(screen.getByText('Daily Tasks')).toBeInTheDocument();
    expect(screen.getByText('Drink water')).toBeInTheDocument();
    expect(screen.getByText('+5 PTS')).toBeInTheDocument();
    expect(screen.getByText('Go for a run')).toBeInTheDocument();
    expect(screen.getByText('+10 PTS')).toBeInTheDocument();
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
  });

  it('marks an incomplete task as completed for the selected day', () => {
    const { onTaskCheck } = renderDaily();
    fireEvent.click(getNavButtons().checkboxes[0]);
    expect(onTaskCheck).toHaveBeenCalledTimes(1);
    const [task, date, isCompleted] = onTaskCheck.mock.calls[0];
    expect(task).toBe(tasks[0]);
    expect(date.toISOString()).toBe('2025-01-15T12:00:00.000Z');
    expect(isCompleted).toBe(true);
  });

  it('un-marks a task that already has an entry for the selected day', () => {
    const { onTaskCheck } = renderDaily({
      userEntries: [
        { taskId: 't1', date: '2025-01-15' },
        { taskId: 't2', date: '2025-01-14' }
      ]
    });
    const { checkboxes } = getNavButtons();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(onTaskCheck.mock.calls[0][2]).toBe(false);
    expect(onTaskCheck.mock.calls[1][2]).toBe(true);
  });

  it('navigates to previous days and reflects their entries', () => {
    const { onTaskCheck } = renderDaily({ userEntries: [{ taskId: 't2', date: '2025-01-14' }] });
    fireEvent.click(getNavButtons().prev);
    expect(screen.getByText('2025-01-14')).toBeInTheDocument();
    fireEvent.click(getNavButtons().checkboxes[1]);
    const [task, date, isCompleted] = onTaskCheck.mock.calls[0];
    expect(task).toBe(tasks[1]);
    expect(date.toISOString().startsWith('2025-01-14')).toBe(true);
    expect(isCompleted).toBe(false);
  });

  it('disables checking tasks and moving forward on future days', () => {
    renderDaily();
    expect(getNavButtons().next).toBeEnabled();
    fireEvent.click(getNavButtons().next);
    expect(screen.getByText('2025-01-16')).toBeInTheDocument();
    const { next, checkboxes } = getNavButtons();
    expect(next).toBeDisabled();
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());
  });

  it('disables moving back before the competition starts', () => {
    renderDaily({ competitionStartDate: '2025-01-14' });
    expect(getNavButtons().prev).toBeEnabled();
    fireEvent.click(getNavButtons().prev);
    fireEvent.click(getNavButtons().prev);
    expect(screen.getByText('2025-01-13')).toBeInTheDocument();
    expect(getNavButtons().prev).toBeDisabled();
  });
});
