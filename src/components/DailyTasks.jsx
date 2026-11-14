import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';

const DailyTasks = ({ tasks, userEntries, onTaskCheck, competitionStartDate }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const toISODateString = (date) => {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000 ))
      .toISOString()
      .split("T")[0];
  }

  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const today = new Date();
  const isFutureDate = selectedDate > today;
  const isBeforeCompetition = selectedDate < new Date(competitionStartDate);

  const completedTasksForDay = useMemo(() => {
    const dateString = toISODateString(selectedDate);
    return new Set(userEntries.filter(e => e.date === dateString).map(e => e.taskId));
  }, [userEntries, selectedDate]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Daily Tasks</h3>
        <div className="flex items-center space-x-2">
          <button onClick={handlePrevDay} disabled={isBeforeCompetition} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-gray-300 tabular-nums">{toISODateString(selectedDate)}</span>
          <button onClick={handleNextDay} disabled={isFutureDate} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {tasks.map(task => {
          const isCompleted = completedTasksForDay.has(task.id);
          return (
            <div key={task.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
              <div className="flex items-center">
                <button onClick={() => onTaskCheck(task, selectedDate, !isCompleted)} disabled={isFutureDate} className="mr-3 text-indigo-400 disabled:opacity-50">
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

export default DailyTasks;
