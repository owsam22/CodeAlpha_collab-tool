import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  HiOutlineVideoCamera, HiOutlineBell, HiOutlineUser, HiOutlineLogout, 
  HiOutlineMenu, HiOutlineX, HiOutlineHome, HiOutlineUserGroup, HiOutlineClipboardList 
} from 'react-icons/hi';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMobile from '../hooks/useMobile';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { notifications, clearNotifications, removeNotification } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMobile();
  
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsSidebarOpen(false);
  };

  const navLinks = [
    { name: 'Home', path: '/', icon: <HiOutlineHome size={20} /> },
    { name: 'Dashboard', path: '/dashboard', icon: <HiOutlineVideoCamera size={20} /> },
    { name: 'Teams', path: '/teams', icon: <HiOutlineUserGroup size={20} /> },
    { name: 'Tasks', path: '/tasks', icon: <HiOutlineClipboardList size={20} /> },
  ];

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Left: Hamburger + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isMobile && (
            <button 
              className="btn-icon" 
              onClick={() => setIsSidebarOpen(true)}
              style={{ padding: 0, width: 32, height: 32 }}
            >
              <HiOutlineMenu size={24} />
            </button>
          )}

          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
              borderRadius: 10, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HiOutlineVideoCamera size={20} color="white" />
            </div>
            {!isMobile && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
                Collab<span style={{ color: 'var(--color-primary-light)' }}>Space</span>
              </span>
            )}
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        {!isMobile && user && (
          <div className="nav-links" style={{ display: 'flex', gap: 24 }}>
            {navLinks.slice(1).map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                style={{ 
                  fontSize: '0.9rem', fontWeight: 600, 
                  color: location.pathname === link.path ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                  textDecoration: 'none', transition: 'color 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                {link.name}
              </Link>
            ))}
          </div>
        )}

        {/* Right side: Notifications, Profile, Login/Get Started */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <>
              {/* Notifications */}
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button className="btn-icon" onClick={() => setShowNotifs(!showNotifs)}
                  style={{ position: 'relative' }}>
                  <HiOutlineBell size={20} />
                  {notifications.length > 0 && (
                    <span style={{
                      position: 'absolute', top: -2, right: -2,
                      background: 'var(--color-danger)', color: 'white',
                      borderRadius: '50%', width: 18, height: 18,
                      fontSize: '0.7rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{notifications.length}</span>
                  )}
                </button>
                <AnimatePresence>
                  {showNotifs && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="glass-card glass-card-dropdown" 
                      style={{
                        position: 'absolute', right: 0, top: 48, width: 320,
                        maxHeight: 400, overflow: 'auto', padding: 8, zIndex: 1000
                      }}
                    >
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderBottom: '1px solid var(--glass-border)',
                      }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
                        {notifications.length > 0 && (
                          <button onClick={clearNotifications}
                            style={{ fontSize: '0.75rem', color: 'var(--color-primary-light)', background: 'none', border: 'none', cursor: 'pointer' }}>
                            Clear all
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <p style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          No notifications
                        </p>
                      ) : (
                        notifications.map((n, i) => (
                          <div key={i} style={{
                            padding: '10px 12px', borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                            <div>
                              <span style={{
                                fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                                color: n.type === 'chat' ? 'var(--color-accent)' : 'var(--color-warning)',
                                marginRight: 6,
                              }}>{n.type}</span>
                              <span style={{ fontSize: '0.85rem' }}>{n.message}</span>
                            </div>
                            <button onClick={() => removeNotification(i)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile - Desktop Only or Sidebar managed on Mobile */}
              {!isMobile && (
                <div ref={profileRef} style={{ position: 'relative' }}>
                  <button className="btn-icon" onClick={() => setShowProfile(!showProfile)}>
                    <HiOutlineUser size={20} />
                  </button>
                  <AnimatePresence>
                    {showProfile && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="glass-card glass-card-dropdown" 
                        style={{
                          position: 'absolute', right: 0, top: 48, width: 220, padding: 8, zIndex: 1000
                        }}
                      >
                        <div style={{ padding: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{user.email}</p>
                        </div>
                        <Link to="/profile" onClick={() => setShowProfile(false)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 12px', color: 'var(--color-text)', textDecoration: 'none',
                            borderRadius: 8, fontSize: '0.9rem',
                          }}>
                          <HiOutlineUser size={16} /> Profile
                        </Link>
                        <button onClick={handleLogout} style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '10px 12px', color: 'var(--color-danger)', background: 'none',
                          border: 'none', cursor: 'pointer', borderRadius: 8, fontSize: '0.9rem',
                        }}>
                          <HiOutlineLogout size={16} /> Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to="/login" style={{ 
                fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)',
                textDecoration: 'none', padding: '8px 16px', borderRadius: 8,
                transition: 'background 0.2s'
              }} onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.target.style.background = 'transparent'}>
                Login
              </Link>
              {!isMobile && (
                <Link to="/login" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 20px', fontSize: '0.9rem' }}>
                  Get Started
                </Link>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(4px)',
                zIndex: 1000,
              }}
            />
            {/* Sidebar Content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px',
                background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(16px)',
                borderRight: '1px solid var(--glass-border)',
                zIndex: 1001, display: 'flex', flexDirection: 'column', padding: '24px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Collab<span style={{ color: 'var(--color-primary-light)' }}>Space</span></span>
                <button className="btn-icon" onClick={() => setIsSidebarOpen(false)}>
                  <HiOutlineX size={24} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      textDecoration: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 600,
                      color: location.pathname === link.path ? 'var(--color-primary-light)' : 'var(--color-text)',
                      background: location.pathname === link.path ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    }}
                  >
                    {link.icon} {link.name}
                  </Link>
                ))}
                
                {user && (
                  <Link
                    to="/profile"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      textDecoration: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 600,
                      color: location.pathname === '/profile' ? 'var(--color-primary-light)' : 'var(--color-text)',
                      background: location.pathname === '/profile' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    }}
                  >
                    <HiOutlineUser size={20} /> Profile
                  </Link>
                )}
              </div>

              {user ? (
                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '0 8px' }}>
                    <div style={{ 
                      width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 
                    }}>
                      {user.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{user.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px',
                      background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)',
                      border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <HiOutlineLogout size={20} /> Logout
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Link to="/login" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
                    Login / Sign Up
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};


export default Navbar;
