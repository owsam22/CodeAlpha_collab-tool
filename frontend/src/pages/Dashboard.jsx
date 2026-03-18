import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { HiOutlinePlus, HiOutlineVideoCamera, HiOutlineClock, HiOutlineUserGroup, HiOutlineTrash } from 'react-icons/hi';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [meetingRes, teamRes, taskRes] = await Promise.all([
          API.get('/meetings'),
          API.get('/teams'),
          API.get('/tasks'),
        ]);
        setMeetings(meetingRes.data.meetings);
        setTeams(teamRes.data.teams);
        setTasks(taskRes.data.tasks);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();

    // Auto-sync every 10 seconds for real-time status updates (Google Meet style)
    const syncInterval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(syncInterval);
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await API.get('/meetings');
      setMeetings(res.data.meetings);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post('/meetings', { 
        title, 
        description,
        team: selectedTeamId || undefined
      });
      setMeetings([res.data.meeting, ...meetings]);
      setTitle('');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      console.error('Failed to create meeting:', err);
    }
  };

  const deleteMeeting = async (id) => {
    if (!window.confirm('Delete this meeting?')) return;
    try {
      await API.delete(`/meetings/${id}`);
      setMeetings(meetings.filter((m) => m._id !== id));
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  };

  const joinMeeting = (meeting) => {
    navigate(`/meeting/${meeting.roomId}`);
  };

  const statusColors = {
    scheduled: 'var(--color-warning)',
    active: 'var(--color-success)',
    ended: 'var(--color-text-muted)',
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div className="animate-fade-in" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 32, flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            Welcome, <span style={{ color: 'var(--color-primary-light)' }}>{user?.name}</span>
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>
            Manage your meetings and collaboration sessions
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)} disabled={teams.length === 0}>
          <HiOutlinePlus size={18} /> New Meeting
        </button>
      </div>

      {teams.length === 0 && (
        <div className="glass-card animate-fade-in" style={{ padding: '24px 32px', marginBottom: 32, border: '1px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <HiOutlineUserGroup size={32} color="var(--color-warning)" />
            <div>
              <p style={{ fontWeight: 700 }}>You are not in any teams!</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>You must join or create a team before you can host a meeting.</p>
              <Link to="/teams" style={{ display: 'inline-block', marginTop: 8, fontSize: '0.85rem', color: 'var(--color-primary-light)', fontWeight: 600 }}>Go to Teams &rarr;</Link>
            </div>
          </div>
        </div>
      )}

      {/* Create Meeting Form */}
      {showCreate && (
        <div className="glass-card animate-slide-up" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Create New Meeting</h3>
          <form onSubmit={createMeeting} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              id="meeting-title"
              className="input-field" type="text" placeholder="Meeting Title"
              value={title} onChange={(e) => setTitle(e.target.value)} required
            />
            <textarea
              id="meeting-desc"
              className="input-field" placeholder="Description (optional)"
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} style={{ resize: 'vertical' }}
            />
            <select 
              className="input-field"
              value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}
              required
            >
              <option value="" disabled style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>Select a Team to start meeting</option>
              {teams.map(t => (
                <option key={t._id} value={t._id} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>Team: {t.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 12 }}>
              <button id="create-meeting-btn" className="btn-primary" type="submit">Create & Start</button>
              <button className="btn-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Meetings', value: meetings.length, icon: <HiOutlineVideoCamera size={22} />, color: 'var(--color-primary)' },
          { label: 'My Teams', value: teams.length, icon: <HiOutlineUserGroup size={22} />, color: 'var(--color-accent)', link: '/teams' },
          { label: 'Assigned Tasks', value: tasks.filter(t => t.status !== 'done').length, icon: <HiOutlineClock size={22} />, color: 'var(--color-warning)', link: '/tasks' },
        ].map((stat, i) => (
          stat.link ? (
            <Link key={i} to={stat.link} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="glass-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--glass-border)' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
              >
                <div style={{
                  background: `${stat.color}22`, color: stat.color,
                  width: 44, height: 44, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{stat.icon}</div>
                <div>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{stat.label}</p>
                </div>
              </div>
            </Link>
          ) : (
            <div key={i} className="glass-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                background: `${stat.color}22`, color: stat.color,
                width: 44, height: 44, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{stat.icon}</div>
              <div>
                <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{stat.label}</p>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Meeting List */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Your Meetings</h2>
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>Loading...</div>
        ) : meetings.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: 48, gridColumn: '1 / -1' }}>
            <HiOutlineVideoCamera size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
            <p style={{ color: 'var(--color-text-muted)' }}>No meetings yet. Create one to get started!</p>
          </div>
        ) : (
          meetings.map((meeting, i) => (
            <div key={meeting._id} className="glass-card animate-fade-in" style={{
              padding: 20, cursor: 'pointer', transition: 'all 0.2s',
              animationDelay: `${i * 0.05}s`,
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 4 }}>{meeting.title}</h3>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                      color: statusColors[meeting.status],
                      background: `${statusColors[meeting.status]}18`,
                      padding: '3px 10px', borderRadius: 6,
                    }}>{meeting.status}</span>
                    {meeting.team && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                        color: 'var(--color-accent)',
                        background: 'rgba(236,72,153,0.1)',
                        padding: '3px 10px', borderRadius: 6,
                      }}>Team</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 16,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HiOutlineUserGroup size={14} /> {meeting.participants?.length || 0}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HiOutlineClock size={14} /> {new Date(meeting.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className={`btn-primary ${meeting.status === 'active' ? 'pulse' : ''}`} 
                  onClick={() => joinMeeting(meeting)} 
                  style={{ 
                    flex: 1, justifyContent: 'center', padding: '8px 16px',
                    background: meeting.status === 'active' ? 'var(--color-success)' : 'var(--color-primary)'
                  }}
                >
                  <HiOutlineVideoCamera size={16} /> {meeting.status === 'active' ? 'Join Now (Live)' : 'Join'}
                </button>
                {(meeting.host._id === user?.id || meeting.host === user?.id || user?.role === 'admin') && (
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteMeeting(meeting._id); }}
                    style={{ color: 'var(--color-danger)' }}>
                    <HiOutlineTrash size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tasks Section */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 48, marginBottom: 16 }}>Your Tasks</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tasks.length === 0 ? (
          <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No tasks assigned to you.
          </div>
        ) : (
          tasks.map(task => (
            <div key={task._id} className="glass-card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{task.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {task.team?.name ? `Team: ${task.team.name}` : task.meeting?.title ? `Meeting: ${task.meeting.title}` : 'Personal'}
                </div>
              </div>
              <span style={{ 
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6,
                background: task.status === 'done' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                color: task.status === 'done' ? 'var(--color-success)' : 'var(--color-warning)'
              }}>
                {task.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;

