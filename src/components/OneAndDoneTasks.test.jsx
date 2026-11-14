import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OneAndDoneTasks from './OneAndDoneTasks';

const tasks = [
  { id: 'o1', name: 'Run a 5k', points: 50, frequency: 'once' },
  { id: 'o2', name: 'Sign up for a gym', points: 25, frequency: 'once' },
];

const renderOnce = (userEntries = []) => {
  const onTaskCheck = vi.fn();
  render(<OneAndDoneTasks tasks={tasks} userEntries={userEntries} onTaskCheck={onTaskCheck} />);
  // Buttons in render order: one checkbox per task, then submit.
  const checkboxes = screen.getAllByRole('button').slice(0, tasks.length);
  return { onTaskCheck, checkboxes };
};

describe('OneAndDoneTasks', () => {
  it('lists each task with its points', () => {
    renderOnce();
    expect(screen.getByText('One-and-Done Tasks')).toBeInTheDocument();
    expect(screen.getByText('Run a 5k')).toBeInTheDocument();
    expect(screen.getByText('+50 PTS')).toBeInTheDocument();
    expect(screen.getByText('Sign up for a gym')).toBeInTheDocument();
    expect(screen.getByText('+25 PTS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Reports' })).toBeInTheDocument();
  });

  it('completes a task that has no entry', () => {
    const { onTaskCheck, checkboxes } = renderOnce();
    fireEvent.click(checkboxes[0]);
    const [task, date, isCompleted] = onTaskCheck.mock.calls[0];
    expect(task).toBe(tasks[0]);
    expect(date).toBeInstanceOf(Date);
    expect(isCompleted).toBe(true);
  });

  it('un-completes a task with an entry on any date', () => {
    const { onTaskCheck, checkboxes } = renderOnce([{ taskId: 'o2', date: '2024-06-01' }]);
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(onTaskCheck.mock.calls[0][2]).toBe(true);
    expect(onTaskCheck.mock.calls[1][0]).toBe(tasks[1]);
    expect(onTaskCheck.mock.calls[1][2]).toBe(false);
  });

  it('renders nothing for an empty task list', () => {
    render(<OneAndDoneTasks tasks={[]} userEntries={[]} onTaskCheck={vi.fn()} />);
    expect(screen.queryByText(/PTS/)).not.toBeInTheDocument();
  });
});
