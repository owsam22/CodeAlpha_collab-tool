import { useState, useEffect } from 'react';
import API from '../api/axios';
import { HiOutlineClipboardList, HiOutlineCheckCircle, HiOutlineClock, HiOutlineTrash, HiOutlineFilter } from 'react-icons/hi';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, todo, in-progress, done
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('all');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [taskRes, teamRes] = await Promise.all([
        API.get('/tasks'),
        API.get('/teams')
      ]);
      setTasks(taskRes.data.tasks);
      setTeams(teamRes.data.teams);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
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
    if (!window.confirm('Delete this task?')) return;
    try {
      await API.delete(`/tasks/${id}`);
      setTasks(tasks.filter(t => t._id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesStatus = filter === 'all' || t.status === filter;
    const matchesTeam = selectedTeam === 'all' || t.team?._id === selectedTeam;
    return matchesStatus && matchesTeam;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Task Dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Manage all your collaborative and personal tasks</p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
            <HiOutlineFilter size={18} color="var(--color-text-muted)" />
            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--color-text)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>All Status</option>
              <option value="todo" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>To Do</option>
              <option value="in-progress" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>In Progress</option>
              <option value="done" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>Done</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
            <select 
              value={selectedTeam} 
              onChange={e => setSelectedTeam(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--color-text)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>All Teams</option>
              {teams.map(team => (
                <option key={team._id} value={team._id} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>{team.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--color-text-muted)' }}>Loading your tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: 64 }}>
          <HiOutlineClipboardList size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 16 }} />
          <p style={{ color: 'var(--color-text-muted)' }}>No tasks found matching your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {filteredTasks.map(task => (
            <div key={task._id} className="glass-card animate-fade-in" style={{ 
              padding: 24, 
              borderLeft: `4px solid ${task.status === 'done' ? 'var(--color-success)' : task.status === 'in-progress' ? 'var(--color-primary)' : 'var(--color-warning)'}`,
              transition: 'transform 0.2s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: task.status === 'done' ? 'var(--color-text-muted)' : 'var(--color-text)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                    {task.title}
                  </h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <span style={{ 
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', 
                      background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, color: 'var(--color-text-muted)'
                    }}>
                      {task.team?.name || 'Personal'}
                    </span>
                  </div>
                </div>
                <button onClick={() => toggleTaskStatus(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {task.status === 'done' ? <HiOutlineCheckCircle size={24} /> : <HiOutlineClock size={24} />}
                </button>
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                {task.description || 'No description provided.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Created {new Date(task.createdAt).toLocaleDateString()}
                </div>
                <button onClick={() => deleteTask(task._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', opacity: 0.6 }}>
                  <HiOutlineTrash size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tasks;
