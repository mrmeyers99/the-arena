// Date helpers shared by the app and the task components.

const DISPLAY_FORMAT = { month: 'short', day: 'numeric', year: 'numeric' };

// Format a Firestore Timestamp, Date, or date-like value for display
// (e.g. "Jan 5, 2025"). Returns 'N/A' for empty values.
export const formatDate = (date) => {
  if (!date) return 'N/A';
  if (date.toDate) {
    return date.toDate().toLocaleDateString('en-US', DISPLAY_FORMAT);
  }
  return new Date(date).toLocaleDateString('en-US', DISPLAY_FORMAT);
};

// Return the local calendar date of `date` as YYYY-MM-DD.
export const toISODateString = (date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

// Get the ISO-8601 week number/year for a date, plus the Sunday that starts
// the week containing that week's Thursday (as a UTC midnight Date).
export const getWeekInfo = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  // Get the start of the week (Sunday)
  const firstDayOfWeek = new Date(d);
  firstDayOfWeek.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return { year: d.getUTCFullYear(), week: weekNo, startDate: firstDayOfWeek };
};
