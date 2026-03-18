import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { HiOutlinePencilAlt, HiOutlineTrash, HiOutlineLockClosed, HiOutlineLockOpen } from 'react-icons/hi';
import { toast } from 'react-toastify';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#ffffff'];
const WIDTHS = [2, 4, 6, 8];

const Whiteboard = ({ roomId, isActive }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(2);
  const [tool, setTool] = useState('pen');
  const [lock, setLock] = useState(null); // { socketId, userId, userName }
  const currentStrokeRef = useRef([]);
  const allStrokesRef = useRef([]);

  const isOwner = lock?.socketId === socket?.id;
  const isLocked = !!lock;

  const drawStroke = useCallback((stroke) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx || !stroke || !stroke.points || stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#0f172a' : stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.width * 4 : stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const startX = stroke.points[0].x * canvas.width;
    const startY = stroke.points[0].y * canvas.height;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < stroke.points.length; i++) {
      const x = stroke.points[i].x * canvas.width;
      const y = stroke.points[i].y * canvas.height;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, []);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (allStrokesRef.current && Array.isArray(allStrokesRef.current)) {
      allStrokesRef.current.forEach(stroke => drawStroke(stroke));
    }
  }, [drawStroke]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      contextRef.current = ctx;
      redrawAll();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redrawAll]);

  // Handle active state (tab switching)
  useEffect(() => {
    if (isActive) {
      const resize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        contextRef.current = ctx;
        redrawAll();
      };
      setTimeout(resize, 50);
    }
  }, [isActive, redrawAll]);

  // Load existing strokes and listen for new ones
  useEffect(() => {
    if (!socket) return;

    socket.on('whiteboard:load', ({ strokes }) => {
      allStrokesRef.current = strokes;
      redrawAll();
    });

    socket.on('whiteboard:draw', ({ stroke }) => {
      allStrokesRef.current.push(stroke);
      drawStroke(stroke);
    });

    socket.on('whiteboard:undo', (data) => {
      const strokes = data?.strokes || [];
      allStrokesRef.current = strokes;
      redrawAll();
    });

    socket.on('whiteboard:clear', () => {
      allStrokesRef.current = [];
      const canvas = canvasRef.current;
      if (canvas && contextRef.current) {
        contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    socket.on('whiteboard:lock-update', ({ lock }) => {
      setLock(lock);
    });

    return () => {
      socket.off('whiteboard:load');
      socket.off('whiteboard:draw');
      socket.off('whiteboard:undo');
      socket.off('whiteboard:clear');
      socket.off('whiteboard:lock-update');
    };
  }, [socket, redrawAll, drawStroke]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    
    return { 
      x: (clientX - rect.left) / rect.width, 
      y: (clientY - rect.top) / rect.height 
    };
  };

  const startDrawing = (e) => {
    if (isLocked && !isOwner) return;
    if (!isLocked) {
      toast.warn("You must click 'Start Editing' to draw", { autoClose: 2000, position: 'top-center' });
      return;
    }

    e.preventDefault();
    const pos = getPos(e);
    currentStrokeRef.current = [pos];
    setIsDrawing(true);

    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!ctx || !canvas) return;

    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
    ctx.moveTo(pos.x * canvas.width, pos.y * canvas.height);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    currentStrokeRef.current.push(pos);

    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!ctx || !canvas) return;

    ctx.lineTo(pos.x * canvas.width, pos.y * canvas.height);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokeRef.current.length >= 2 && socket) {
      const stroke = {
        tool,
        color,
        width: lineWidth,
        points: currentStrokeRef.current,
        userId: user?.id || user?._id,
        userName: user?.name,
        timestamp: new Date(),
      };
      if (allStrokesRef.current) allStrokesRef.current.push(stroke);
      socket.emit('whiteboard:draw', { roomId, stroke });
    }
    currentStrokeRef.current = [];
  };

  const handleUndo = () => {
    if (socket) {
      socket.emit('whiteboard:undo', { roomId });
    }
  };

  const clearBoard = () => {
    if (!window.confirm('Clear everything?')) return;
    const canvas = canvasRef.current;
    if (canvas && contextRef.current) {
      contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
      if (socket) {
        socket.emit('whiteboard:clear', { roomId });
      }
    }
  };

  const handleRequestLock = () => {
    if (socket) socket.emit('whiteboard:request-lock', { roomId });
  };

  const handleReleaseLock = () => {
    if (socket) socket.emit('whiteboard:release-lock', { roomId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a' }}>
      {/* Lock Bar / Status */}
      <div style={{
        padding: '8px 16px', background: isLocked ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLocked ? <HiOutlineLockClosed size={16} color="var(--color-primary)" /> : <HiOutlineLockOpen size={16} color="var(--color-success)" />}
          <span style={{ fontWeight: 600, color: isLocked ? 'var(--color-text)' : 'var(--color-success)' }}>
            {isLocked ? (isOwner ? 'You are editing' : `${lock.userName} is editing`) : 'Board is available'}
          </span>
        </div>
        
        {isOwner ? (
          <button className="btn-secondary" onClick={handleReleaseLock} style={{ padding: '4px 12px', fontSize: '0.75rem', height: '28px' }}>
            Stop Editing
          </button>
        ) : (
          <button className="btn-primary" onClick={handleRequestLock} disabled={isLocked}
            style={{ padding: '4px 12px', fontSize: '0.75rem', height: '28px', opacity: isLocked ? 0.5 : 1 }}>
            {isLocked ? 'Locked' : 'Start Editing'}
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap',
        minHeight: 52, background: 'rgba(15, 23, 42, 0.6)',
        opacity: (isLocked && !isOwner) ? 0.4 : 1,
        pointerEvents: (isLocked && !isOwner) ? 'none' : 'auto',
        transition: 'opacity 0.3s'
      }}>
        <button className={`btn-icon ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => setTool('pen')} style={{ width: 36, height: 36, flexShrink: 0 }}>
          <HiOutlinePencilAlt size={18} />
        </button>
        <button className={`btn-icon ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => setTool('eraser')} style={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
          E
        </button>

        <div style={{ width: 1, height: 24, background: 'var(--glass-border)', margin: '0 4px' }} />

        {/* Colors */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button key={c} onClick={() => { setColor(c); setTool('pen'); }}
              style={{
                width: 22, height: 22, borderRadius: '50%', background: c,
                border: color === c ? '2px solid var(--color-primary-light)' : '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer', transition: 'transform 0.15s',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--glass-border)', margin: '0 4px' }} />

        {/* Width selector */}
        <div style={{ display: 'flex', gap: 6 }}>
          {WIDTHS.map((w) => (
            <button key={w} onClick={() => setLineWidth(w)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: lineWidth === w ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}>
              <div style={{ width: w + 1, height: w + 1, borderRadius: '50%', background: 'white' }} />
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <button className="btn-icon" onClick={handleUndo} style={{ width: 36, height: 36, flexShrink: 0 }} title="Undo">
          <HiOutlineTrash style={{ transform: 'rotate(180deg)' }} />
        </button>

        <button className="btn-icon" onClick={clearBoard} style={{ width: 36, height: 36, color: 'var(--color-danger)', flexShrink: 0 }} title="Clear All">
          <HiOutlineTrash size={16} />
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', background: '#0f172a', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ cursor: (isLocked && !isOwner) ? 'not-allowed' : (tool === 'eraser' ? 'cell' : 'crosshair'), touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />
        {isLocked && !isOwner && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.1)', cursor: 'not-allowed', zIndex: 1
          }} />
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
