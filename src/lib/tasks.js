// Pure helpers for competition tasks, entries and scoring.

// Split a competition's tasks into the three task tabs.
export const groupTasksByFrequency = (tasks) => ({
  daily: tasks.filter((t) => t.frequency === 'daily'),
  weekly: tasks.filter((t) => t.frequency === 'weekly'),
  'one-and-done': tasks.filter((t) => t.frequency === 'once')
});

// The task tabs that have at least one task, in display order.
export const getAvailableTabs = (taskGroups) => {
  const tabs = [];
  if (taskGroups.daily.length > 0) tabs.push('daily');
  if (taskGroups.weekly.length > 0) tabs.push('weekly');
  if (taskGroups['one-and-done'].length > 0) tabs.push('one-and-done');
  return tabs;
};

// Firestore document id for a task completion entry. One-and-done tasks have a
// single entry per user; recurring tasks have one per period date. Entries are
// written by the toggleTaskEntry Cloud Function; keep functions/validate.js
// buildEntryId in sync with this.
export const buildEntryId = (userId, task, entryDate) => {
  return task.frequency === 'once' ? `${userId}_${task.id}` : `${userId}_${task.id}_${entryDate}`;
};

// Ids of tasks with an entry on the given YYYY-MM-DD date.
export const getCompletedTaskIdsForDate = (entries, dateString) => {
  return new Set(entries.filter((e) => e.date === dateString).map((e) => e.taskId));
};

// Ids of every task with an entry, regardless of date.
export const getCompletedTaskIds = (entries) => {
  return new Set(entries.filter((e) => e.taskId).map((e) => e.taskId));
};

// Sort participants or teams by score, highest first (missing score = 0).
// Returns a new array.
export const sortByScore = (items) => {
  return [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
};
