import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { HiOutlinePlus, HiOutlineCheckCircle, HiOutlineClock, HiOutlineTrash } from 'react-icons/hi';

const TaskList = ({ meetingId, teamId }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [meetingId, teamId]);

  const fetchTasks = async () => {
    try {
      const res = await API.get('/tasks', { params: { meetingId, teamId } });
      setTasks(res.data.tasks);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const res = await API.post('/tasks', {
        title: newTaskTitle,
        meeting: meetingId,
        team: teamId,
      });
      setTasks([...tasks, res.data.task]);
      setNewTaskTitle('');
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const toggleTaskStatus = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const res = await API.put(`/tasks/${task._id}`, { status: newStatus });
      setTasks(tasks.map(t => t._id === task._id ? res.data.task : t));
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const deleteTask = async (id) => {
    try {
      await API.delete(`/tasks/${id}`);
      setTasks(tasks.filter(t => t._id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Collaborative Tasks</h3>
      
      <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input 
          className="input-field" placeholder="Add a new task..."
          value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
          style={{ padding: '8px 12px' }}
        />
        <button className="btn-primary" type="submit" style={{ padding: '8px 12px' }}>
          <HiOutlinePlus size={18} />
        </button>
      </form>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 20 }}>No tasks yet.</p>
        ) : (
          tasks.map(task => (
            <div key={task._id} className="glass-card" style={{ 
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
              background: task.status === 'done' ? 'rgba(34,197,94,0.05)' : 'rgba(30,41,59,0.4)',
              opacity: task.status === 'done' ? 0.7 : 1
            }}>
              <button 
                onClick={() => toggleTaskStatus(task)}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', 
                  color: task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'
                }}
              >
                {task.status === 'done' ? <HiOutlineCheckCircle size={20} /> : <HiOutlineClock size={20} />}
              </button>
              <span style={{ 
                flex: 1, fontSize: '0.9rem', 
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                color: task.status === 'done' ? 'var(--color-text-muted)' : 'var(--color-text)'
              }}>
                {task.title}
              </span>
              {(task.createdBy?._id === user?.id || task.createdBy === user?.id || task.createdBy?._id === user?._id || task.createdBy === user?._id) && (
                <button 
                  onClick={() => deleteTask(task._id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', opacity: 0.6 }}
                >
                  <HiOutlineTrash size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskList;
