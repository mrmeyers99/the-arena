import React, { useMemo } from 'react';
import { CheckSquare, Square } from 'lucide-react';

const OneAndDoneTasks = ({ tasks, userEntries, onTaskCheck }) => {

  const completedTasks = useMemo(() => {
    return new Set(userEntries.filter(e => e.taskId).map(e => e.taskId));
  }, [userEntries]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">One-and-Done Tasks</h3>
      </div>
      <div className="space-y-3">
        {tasks.map(task => {
          const isCompleted = completedTasks.has(task.id);
          return (
            <div key={task.id} className="bg-gray-700 p-4 rounded-lg flex justify-between items-center">
              <div className="flex items-center">
                <button onClick={() => onTaskCheck(task, new Date(), !isCompleted)} className="mr-3 text-indigo-400">
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

export default OneAndDoneTasks;
