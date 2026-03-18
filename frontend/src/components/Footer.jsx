import { HiOutlineMail, HiOutlinePhone, HiOutlineLocationMarker } from 'react-icons/hi';
import { FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer style={{
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--glass-border)',
      padding: '48px 24px 24px',
      marginTop: 'auto',
      color: 'var(--color-text)'
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 32,
        marginBottom: 40
      }}>
        {/* Brand Section */}
        <div>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 16 
          }}>Collab Space</h2>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, fontSize: '0.9rem' }}>
            A premium real-time collaboration tool designed for high-performance teams. 
            Connect, share, and build together with zero friction.
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
            <a href="https://github.com/owsam22" style={{ color: 'var(--color-text-muted)', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--color-primary)'} onMouseOut={e => e.target.style.color = 'var(--color-text-muted)'}>
              <FaGithub size={20} />
            </a>
            <a href="https://x.com/owsam22" style={{ color: 'var(--color-text-muted)', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--color-primary)'} onMouseOut={e => e.target.style.color = 'var(--color-text-muted)'}>
              <FaTwitter size={20} />
            </a>
            <a href="https://www.linkedin.com/in/samarpan22/" style={{ color: 'var(--color-text-muted)', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--color-primary)'} onMouseOut={e => e.target.style.color = 'var(--color-text-muted)'}>
              <FaLinkedin size={20} />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Quick Links</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li><a href="/dashboard" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>Dashboard</a></li>
            <li><a href="/teams" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>Teams</a></li>
            <li><a href="/profile" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>Profile</a></li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Contact Us</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              <HiOutlineMail size={18} /> samarpan.works@gmail.com
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              <HiOutlinePhone size={18} /> <a href="https://github.com/owsam22">GitHub</a>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              <HiOutlineLocationMarker size={18} /> Dehradun, Uttarakhand, India
            </li>
          </ul>
        </div>
      </div>

      <div style={{
        borderTop: '1px solid var(--glass-border)',
        paddingTop: 24,
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.8rem'
      }}>
        © {new Date().getFullYear()} Collab Space. All rights reserved. Created for Code Alpha Internship.  
      </div>
    </footer>
  );
};

export default Footer;
