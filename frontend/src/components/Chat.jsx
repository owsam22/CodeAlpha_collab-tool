import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { HiOutlinePaperAirplane } from 'react-icons/hi';

const Chat = ({ roomId }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat:history', ({ messages: history }) => {
      setMessages(history);
    });

    socket.on('chat:receive', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('presence:typing', ({ user: typingUser }) => {
      if (typingUser?.id !== user?.id) {
        setIsTyping(typingUser?.name);
        setTimeout(() => setIsTyping(null), 3000);
      }
    });

    socket.on('presence:stop-typing', () => {
      setIsTyping(null);
    });

    return () => {
      socket.off('chat:history');
      socket.off('chat:receive');
      socket.off('presence:typing');
      socket.off('presence:stop-typing');
    };
  }, [socket, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (socket) {
      socket.emit('presence:typing', { roomId, user: { id: user.id, name: user.name } });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('presence:stop-typing', { roomId, user: { id: user.id, name: user.name } });
      }, 2000);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('chat:send', {
      roomId,
      message: input.trim(),
      sender: user.id,
      senderName: user.name,
    });
    setInput('');
    socket.emit('presence:stop-typing', { roomId, user: { id: user.id, name: user.name } });
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--glass-border)',
        fontWeight: 600, fontSize: '0.95rem',
      }}>
        Chat
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 32 }}>
            No messages yet. Say hello! 👋
          </p>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.sender === user?.id || msg.sender === user?._id || msg.senderName === user?.name;
          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isOwn ? 'flex-end' : 'flex-start',
              animation: 'fadeIn 0.2s ease-out',
            }}>
              {!isOwn && (
                <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-light)', marginBottom: 2, fontWeight: 600 }}>
                  {msg.senderName}
                </span>
              )}
              <div style={{
                background: isOwn
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))'
                  : 'var(--color-surface-lighter)',
                padding: '8px 14px', borderRadius: 12,
                borderBottomRightRadius: isOwn ? 4 : 12,
                borderBottomLeftRadius: isOwn ? 12 : 4,
                maxWidth: '80%', wordBreak: 'break-word',
              }}>
                <p style={{ fontSize: '0.87rem', lineHeight: 1.4 }}>{msg.message}</p>
              </div>
              <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <div style={{
          padding: '4px 16px', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic',
        }}>
          {isTyping} is typing...
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} style={{
        display: 'flex', gap: 8, padding: 12,
        borderTop: '1px solid var(--glass-border)',
      }}>
        <input
          id="chat-input"
          className="input-field" type="text"
          placeholder="Type a message..."
          value={input} onChange={handleInputChange}
          style={{ flex: 1, padding: '10px 14px' }}
        />
        <button id="send-message-btn" className="btn-primary" type="submit" disabled={!input.trim()}
          style={{ padding: '10px 14px' }}>
          <HiOutlinePaperAirplane size={18} />
        </button>
      </form>
    </div>
  );
};

export default Chat;
