// Pure helpers for the scoring function. No Firebase imports, so they can be
// unit-tested without an emulator.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Firestore document id for a task completion entry. Must match
// src/lib/tasks.js buildEntryId so the client can find its own entries.
export const buildEntryId = (userId, task, entryDate) =>
  task.frequency === 'once' ? `${userId}_${task.id}` : `${userId}_${task.id}_${entryDate}`;

// Check the shape of a toggleTaskEntry request. Returns an error message, or
// null when the request is well formed.
export const validateRequest = (data) => {
  if (!data || typeof data !== 'object') return 'Request must be an object.';
  const { competitionId, taskId, date, completed, timezone } = data;
  if (typeof competitionId !== 'string' || competitionId.length === 0 || competitionId.includes('/'))
    return 'competitionId must be a non-empty string.';
  if (typeof taskId !== 'string' || taskId.length === 0) return 'taskId must be a non-empty string.';
  if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))
    return 'date must be a YYYY-MM-DD string.';
  if (typeof completed !== 'boolean') return 'completed must be a boolean.';
  if (timezone !== undefined && (typeof timezone !== 'string' || timezone.length > 100))
    return 'timezone must be a string.';
  return null;
};

// A completion can't be recorded for a day that hasn't started anywhere yet.
// The client sends its local date, so allow up to one day ahead of UTC.
export const isFutureDate = (date, now = new Date()) => {
  const latest = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return date > latest;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const isDateString = (value) => typeof value === 'string' && DATE_RE.test(value);

// Check that an entry's date fits the task and the competition window.
// Returns an error message, or null when the date is allowed.
//
// Weekly entries are keyed by the Sunday the app uses as the week's key
// (src/lib/dates.js getWeekInfo), so one week can only score once. That
// Sunday can fall up to 6 days before the competition starts.
export const checkEntryDate = (task, date, startDate, endDate) => {
  if (!isDateString(startDate) || !isDateString(endDate)) return 'Competition has no valid start and end dates.';
  if (task.frequency === 'weekly') {
    if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 0) return 'Weekly entries must use the week-start Sunday.';
    if (addDays(date, 6) < startDate || date > endDate) return 'Date is outside the competition.';
    return null;
  }
  if (date < startDate || date > endDate) return 'Date is outside the competition.';
  return null;
};

// Points for a task as defined by the competition (never by the caller).
// Returns null when the value isn't a usable whole number.
export const taskPoints = (task) => {
  const points = typeof task.points === 'number' ? task.points : parseInt(task.points, 10);
  return Number.isInteger(points) ? points : null;
};
