import { useState, useEffect, Component } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import VideoCall from '../components/VideoCall';
import Chat from '../components/Chat';
import Whiteboard from '../components/Whiteboard';
import FileUpload from '../components/FileUpload';
import TaskList from '../components/TaskList';
import { HiOutlineVideoCamera, HiOutlineChatAlt2, HiOutlinePencilAlt, HiOutlineDocument, HiOutlineUserGroup, HiOutlineArrowLeft, HiOutlineDuplicate, HiOutlineInformationCircle, HiOutlineTrash } from 'react-icons/hi';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Component Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-danger)' }}>
          <h3>Something went wrong in this panel.</h3>
          <button className="btn-primary" onClick={() => this.setState({ hasError: false })}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PANELS = {
  CHAT: 'chat',
  WHITEBOARD: 'whiteboard',
  FILES: 'files',
  TASKS: 'tasks',
};

const MeetingRoom = () => {
  const { roomId } = useParams();
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [activePanel, setActivePanel] = useState(PANELS.CHAT);
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const res = await API.get(`/meetings/room/${roomId}`);
        setMeeting(res.data.meeting);
        setParticipants(res.data.meeting.participants || []);

        // Join the meeting via REST
        await API.post(`/meetings/${res.data.meeting._id}/join`);
      } catch (err) {
        console.error('Failed to load meeting:', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
  }, [roomId]);

  // Join socket room
  useEffect(() => {
    if (!socket || !meeting || !user) return;

    socket.emit('room:join', { roomId, user: { id: user.id || user._id, name: user.name, avatar: user.avatar } });

    socket.on('room:users', ({ users }) => {
      setParticipants(users);
    });

    socket.on('room:user-joined', ({ users }) => {
      setParticipants(users);
    });

    socket.on('room:user-left', ({ users }) => {
      setParticipants(users);
    });

    return () => {
      socket.emit('room:leave', { roomId });
      socket.off('room:users');
      socket.off('room:user-joined');
      socket.off('room:user-left');
    };
  }, [socket, meeting, roomId]);

  const leaveMeeting = async () => {
    try {
      if (meeting) await API.post(`/meetings/${meeting._id}/leave`);
    } catch (err) { /* ignore */ }
    navigate('/dashboard');
  };

  const handleDeleteMeeting = async () => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete this meeting for everyone?')) return;
    try {
      await API.delete(`/meetings/${meeting._id}`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      alert('Failed to delete meeting');
    }
  };

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    // Ideally we'd show a toast here, but for now we'll just have the user see the visual feedback if we added any
    alert('Meeting link copied to clipboard!');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <div className="animate-pulse-glow" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="meeting-layout" style={{ 
      display: 'flex', 
      height: 'calc(100vh - 64px)', 
      overflow: 'hidden',
      flexDirection: activePanel === PANELS.WHITEBOARD ? 'row-reverse' : 'row'
    }}>
      {/* Main Video Area */}
      <div style={{ 
        flex: activePanel === PANELS.WHITEBOARD ? '0 0 300px' : 1, 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        borderRight: activePanel === PANELS.WHITEBOARD ? '1px solid var(--glass-border)' : 'none',
        background: activePanel === PANELS.WHITEBOARD ? 'rgba(15,23,42,0.8)' : 'transparent',
      }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', borderBottom: '1px solid var(--glass-border)',
          background: 'rgba(15,23,42,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon" onClick={leaveMeeting} style={{ width: 34, height: 34 }}>
              <HiOutlineArrowLeft size={16} />
            </button>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{meeting?.title || 'Meeting'}</h2>
              <span style={{
                fontSize: '0.65rem', color: 'var(--color-success)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                Live
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="btn-secondary" onClick={copyInviteLink} 
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem' }}>
              <HiOutlineDuplicate size={16} /> Copy Invite
            </button>
            <button className="btn-icon mobile-hide" onClick={() => setShowParticipants(!showParticipants)}
              style={{ width: 34, height: 34, position: 'relative' }}>
              <HiOutlineUserGroup size={16} />
              <span style={{
                position: 'absolute', top: -2, right: -2,
                background: 'var(--color-primary)', color: 'white',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: '0.6rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{participants.length}</span>
            </button>
            <button className="btn-icon mobile-show-flex" onClick={() => setIsMobilePanelOpen(!isMobilePanelOpen)}
              style={{ width: 34, height: 34, display: 'none' }}>
               <HiOutlineChatAlt2 size={16} />
            </button>
            {(meeting?.host._id === user?.id || meeting?.host === user?.id || meeting?.host?._id === user?._id) && (
              <button className="btn-icon" onClick={handleDeleteMeeting} 
                style={{ width: 34, height: 34, color: 'var(--color-danger)' }} title="Delete Meeting">
                <HiOutlineTrash size={16} />
              </button>
            )}
            <button className="btn-danger" onClick={leaveMeeting} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              Leave
            </button>
          </div>
        </div>

        {/* Video area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <VideoCall roomId={roomId} />

          {/* Participants overlay */}
          {showParticipants && (
            <div className="glass-card animate-fade-in" style={{
              position: 'absolute', top: 8, right: 8, width: 'calc(100% - 16px)', maxWidth: 220,
              padding: 12, maxHeight: 300, overflow: 'auto', zIndex: 5,
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 12 }}>Participants ({participants.length})</h4>
              {participants.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {(p.name || 'U')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.82rem' }}>{p.name || 'User'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      <div 
        className={`side-panel ${isMobilePanelOpen ? 'open' : ''}`}
        style={{
          flex: activePanel === PANELS.WHITEBOARD ? 1 : '0 0 360px',
          borderLeft: activePanel === PANELS.WHITEBOARD ? 'none' : '1px solid var(--glass-border)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(30, 41, 59, 0.95)',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Mobile Header for Panel */}
        <div className="mobile-only" style={{ 
          padding: '12px 16px', display: 'none', 
          justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--color-surface-light)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Options</h3>
          <button onClick={() => setIsMobilePanelOpen(false)} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', fontSize: '1.2rem' }}>&times;</button>
        </div>

        {/* Panel Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--glass-border)',
          overflowX: 'auto'
        }}>
          {[
            { key: PANELS.CHAT, icon: <HiOutlineChatAlt2 size={18} />, label: 'Chat' },
            { key: PANELS.WHITEBOARD, icon: <HiOutlinePencilAlt size={18} />, label: 'Board' },
            { key: PANELS.FILES, icon: <HiOutlineDocument size={18} />, label: 'Files' },
            { key: PANELS.TASKS, icon: <HiOutlineInformationCircle size={18} />, label: 'Tasks' },
          ].map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActivePanel(tab.key)}
              style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                background: activePanel === tab.key ? 'var(--color-surface-lighter)' : 'transparent',
                color: activePanel === tab.key ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                borderBottom: activePanel === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                minWidth: '80px'
              }}>
              {tab.icon} <span className="mobile-hide">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Panel Content - Persistent Mounting */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <ErrorBoundary>
            <div style={{ display: activePanel === PANELS.CHAT ? 'block' : 'none', height: '100%' }}>
              <Chat roomId={roomId} />
            </div>
            <div style={{ display: activePanel === PANELS.WHITEBOARD ? 'block' : 'none', height: '100%' }}>
              <Whiteboard roomId={roomId} isActive={activePanel === PANELS.WHITEBOARD} />
            </div>
            <div style={{ display: activePanel === PANELS.FILES ? 'block' : 'none', height: '100%' }}>
              <FileUpload roomId={roomId} meetingId={meeting?._id} />
            </div>
            <div style={{ display: activePanel === PANELS.TASKS ? 'block' : 'none', height: '100%' }}>
              <TaskList meetingId={meeting?._id} teamId={meeting?.team?._id || meeting?.team} />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;
