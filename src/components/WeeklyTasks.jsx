import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';

// Helper to get the week number and the start of the week date
const getWeekInfo = (d) => {
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

const WeeklyTasks = ({ tasks, userEntries, onTaskCheck, competitionStartDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const today = new Date();
  const { year: currentYear, week: currentWeek, startDate: weekStartDate } = getWeekInfo(currentDate);

  const isFutureWeek =
    getWeekInfo(currentDate).week > getWeekInfo(today).week && getWeekInfo(currentDate).year >= getWeekInfo(today).year;
  const isBeforeCompetition = getWeekInfo(currentDate).startDate < new Date(competitionStartDate);

  const completedTasksForWeek = useMemo(() => {
    const weekDateString = weekStartDate.toISOString().split('T')[0];
    return new Set(userEntries.filter((e) => e.date === weekDateString).map((e) => e.taskId));
  }, [userEntries, weekStartDate]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Weekly Tasks</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevWeek}
            disabled={isBeforeCompetition}
            className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-gray-300 tabular-nums">{`Year ${currentYear}, Week ${currentWeek}`}</span>
          <button
            onClick={handleNextWeek}
            disabled={isFutureWeek}
            className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => {
          const isCompleted = completedTasksForWeek.has(task.id);
          return (
            <div key={task.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
              <div className="flex items-center">
                <button
                  onClick={() => onTaskCheck(task, weekStartDate, !isCompleted)}
                  disabled={isFutureWeek}
                  className="mr-3 text-indigo-400 disabled:opacity-50"
                >
                  {isCompleted ? <CheckSquare size={22} /> : <Square size={22} />}
                </button>
                <div>
                  <p className="font-semibold text-gray-200">{task.name}</p>
                </div>
              </div>
              <span className="font-bold text-yellow-400">+{task.points} PTS</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end mt-4">
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
          Submit Reports
        </button>
      </div>
    </div>
  );
};

export default WeeklyTasks;
