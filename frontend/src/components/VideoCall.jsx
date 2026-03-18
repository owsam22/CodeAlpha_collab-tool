import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { HiOutlineMicrophone, HiOutlineVideoCamera, HiOutlineDesktopComputer, HiOutlineVolumeOff, HiOutlineEyeOff, HiOutlineX } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

const VideoCall = ({ roomId }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const createPeerConnection = useCallback((socketId, remoteUser) => {
    if (peersRef.current[socketId]) return peersRef.current[socketId];

    const pc = new RTCPeerConnection(ICE_CONFIG);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      setPeers((prev) => ({
        ...prev,
        [socketId]: { stream: event.streams[0], user: remoteUser },
      }));
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('video:ice-candidate', {
          to: socketId,
          candidate: event.candidate,
          from: socket.id,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeer(socketId);
      }
    };

    peersRef.current[socketId] = pc;
    return pc;
  }, [socket]);

  const removePeer = (socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }
    setPeers((prev) => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
  };

  // Initialize local media
  useEffect(() => {
    const initMedia = async () => {
      try {
        const constraints = { 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            facingMode: "user" 
          }, 
          audio: true 
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to get media devices:', err);
        // Try audio only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
        } catch (audioErr) {
          console.error('Failed to get audio:', audioErr);
        }
      }
    };
    initMedia();

    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peersRef.current).forEach((pc) => pc.close());
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const joinRoom = () => {
      console.log('Emitting video:join-room');
      socket.emit('video:join-room', { roomId, user });
    };

    // Delay slightly to ensure localStream usually finishes init first
    const joinTimeout = setTimeout(joinRoom, 1500);

    // When a new user joins, create offer
    socket.on('video:user-joined', async ({ socketId, user: remoteUser }) => {
      console.log('User joined, creating offer for:', socketId);
      toast.info(`${remoteUser?.name || 'A user'} joined the video call`, {
        position: "bottom-left",
        autoClose: 3000,
      });
      const pc = createPeerConnection(socketId, remoteUser);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('video:offer', { to: socketId, offer, from: socket.id, user });
    });

    // Receive offer, create answer
    socket.on('video:offer', async ({ from, offer, user: remoteUser }) => {
      console.log('Received offer from:', from);
      const pc = createPeerConnection(from, remoteUser);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('video:answer', { to: from, answer, from: socket.id });
    });

    // Receive answer
    socket.on('video:answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      const pc = peersRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Receive ICE candidate
    socket.on('video:ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    // Receive status update
    socket.on('video:status-update', ({ socketId, status }) => {
      setPeers((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: { ...prev[socketId], status },
        };
      });
    });

    // User left
    socket.on('video:user-left', ({ socketId }) => {
      const peer = peersRef.current[socketId];
      if (peer) {
        // We can't easily get the name here unless we store it, 
        // but room:user-left might be better for general notifications anyway.
        // For now, simple notification:
        toast.info(`A user left the video call`, { position: "bottom-left", autoClose: 3000 });
      }
      removePeer(socketId);
    });

    return () => {
      clearTimeout(joinTimeout);
      socket.off('video:user-joined');
      socket.off('video:offer');
      socket.off('video:answer');
      socket.off('video:ice-candidate');
      socket.off('video:status-update');
      socket.off('video:user-left');
      socket.emit('video:leave', { roomId });
    };
  }, [socket, roomId, createPeerConnection, user]);

  // Broadcast local status when it changes
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('video:status-update', {
        roomId,
        status: { isVideoOff, isMuted }
      });
    }
  }, [isVideoOff, isMuted, socket, roomId]);

  // Sync local tracks with existing peer connections once stream is ready
  useEffect(() => {
    if (!localStream) return;
    
    console.log('Local stream ready, syncing with existing peers:', Object.keys(peersRef.current));
    Object.values(peersRef.current).forEach(pc => {
      // Check if tracks already added
      const senders = pc.getSenders();
      localStream.getTracks().forEach(track => {
        const alreadyAdded = senders.some(s => s.track?.id === track.id);
        if (!alreadyAdded) {
          console.log('Adding missing track to peer:', track.kind);
          pc.addTrack(track, localStream);
        }
      });
    });
  }, [localStream]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing, revert to camera
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = cameraStream;
      setLocalStream(cameraStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = cameraStream;

      // Replace tracks in all peer connections
      Object.values(peersRef.current).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender && cameraStream.getVideoTracks()[0]) {
          videoSender.replaceTrack(cameraStream.getVideoTracks()[0]);
        }
      });

      socket.emit('screen:stop', { roomId });
      setIsScreenSharing(false);
    } else {
      if (!navigator.mediaDevices.getDisplayMedia) {
        alert('Screen sharing is not supported on this device/browser.');
        return;
      }
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;

        // Replace video track in local view
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

        // Replace tracks in all peer connections
        Object.values(peersRef.current).forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender && screenStream.getVideoTracks()[0]) {
            videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        });

        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        socket.emit('screen:start', { roomId, user });
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen sharing failed:', err);
      }
    }
  };

  const peerEntries = Object.entries(peers);
  
  // Categorize participants
  const videoParticipants = [];
  const avatarParticipants = [];

  // Local user
  if (isVideoOff) {
    avatarParticipants.push({ id: 'local', user, isLocal: true });
  } else {
    videoParticipants.push({ id: 'local', user, isLocal: true, stream: localStream });
  }

  // Remote users
  peerEntries.forEach(([socketId, data]) => {
    if (data.status?.isVideoOff) {
      avatarParticipants.push({ id: socketId, ...data });
    } else {
      videoParticipants.push({ id: socketId, ...data });
    }
  });

  const totalVideos = videoParticipants.length;
  const isMobile = window.innerWidth <= 768;
  
  // Grid columns for active video users
  let gridCols = totalVideos <= 1 ? 1 : totalVideos <= 4 ? 2 : 3;
  if (isMobile && totalVideos > 1) gridCols = 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', background: '#0f172a' }}>
      {/* Main Video/Avatar Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Active Video Grid */}
        <div className="video-grid" style={{
          flex: videoParticipants.length > 0 ? 1 : 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gridAutoRows: isMobile ? '220px' : '1fr',
          gap: 12, padding: 12, 
          overflow: 'auto',
          alignContent: 'center'
        }}>
          <AnimatePresence>
            {videoParticipants.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{ height: '100%', width: '100%', position: 'relative' }}
              >
                {p.isLocal ? (
                  <div style={{
                    position: 'relative', borderRadius: 16, overflow: 'hidden',
                    background: '#1a1a2e', height: '100%',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}>
                    <video
                      ref={localVideoRef} autoPlay muted playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isScreenSharing ? 'none' : 'scaleX(-1)' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 12, left: 12,
                      background: 'rgba(15, 23, 42, 0.7)', padding: '6px 12px',
                      borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                      backdropFilter: 'blur(4px)', color: 'white',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: isMuted ? '#ef4444' : '#22c55e' }} />
                      You {isScreenSharing && '(Screen)'}
                    </div>
                  </div>
                ) : (
                  <RemoteVideo stream={p.stream} user={p.user} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Minimized Avatars Row (Google Meet style at the bottom) */}
        {avatarParticipants.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px',
            justifyContent: 'center', borderTop: videoParticipants.length > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            maxHeight: '30%', overflow: 'auto'
          }}>
            <AnimatePresence>
              {avatarParticipants.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    width: isMobile ? 80 : 120, height: isMobile ? 80 : 90,
                    borderRadius: 12, background: 'rgba(30, 41, 59, 0.8)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, position: 'relative', border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <div style={{
                    width: isMobile ? 32 : 40, height: isMobile ? 32 : 40,
                    borderRadius: '50%', background: 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isMobile ? '0.8rem' : '1rem', fontWeight: 700, color: 'white'
                  }}>
                    {(p.user?.name || 'U')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'white', textAlign: 'center', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {p.isLocal ? 'You' : p.user?.name || 'User'}
                  </span>
                  {p.status?.isMuted && (
                    <div style={{ position: 'absolute', top: 4, right: 4, color: '#ef4444' }}>
                      <HiOutlineVolumeOff size={12} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Controls Overlay */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          position: isMobile ? 'fixed' : 'absolute',
          bottom: isMobile ? 0 : 32,
          left: isMobile ? 0 : '50%',
          right: isMobile ? 0 : 'auto',
          transform: isMobile ? 'none' : 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          gap: isMobile ? 20 : 16,
          background: isMobile ? 'rgba(15, 23, 42, 0.95)' : 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          padding: isMobile ? '16px 0 32px 0' : '12px 24px',
          borderRadius: isMobile ? 0 : 24,
          borderTop: isMobile ? '1px solid var(--glass-border)' : 'none',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          width: isMobile ? '100%' : 'auto',
        }}
      >
        <ControlButton
          icon={isMuted ? <HiOutlineVolumeOff /> : <HiOutlineMicrophone />}
          onClick={toggleMute}
          active={!isMuted}
          danger={isMuted}
        />
        <ControlButton
          icon={isVideoOff ? <HiOutlineEyeOff /> : <HiOutlineVideoCamera />}
          onClick={toggleVideo}
          active={!isVideoOff}
          danger={isVideoOff}
        />
        {!isMobile && (
          <ControlButton
            icon={isScreenSharing ? <HiOutlineX /> : <HiOutlineDesktopComputer />}
            onClick={toggleScreenShare}
            active={isScreenSharing}
            accent
          />
        )}
      </motion.div>
    </div>
  );
};

const ControlButton = ({ active, onClick, icon, label, danger, accent }) => (
  <motion.button
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    title={label}
    style={{
      width: 44, height: 44, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.2rem', cursor: 'pointer', border: 'none',
      background: active 
        ? (accent ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)') 
        : (danger ? '#ef4444' : 'rgba(255, 255, 255, 0.05)'),
      color: active || danger ? 'white' : 'var(--color-text-muted)',
      transition: 'background 0.2s, color 0.2s',
      boxShadow: active ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none',
    }}
  >
    {icon}
  </motion.button>
);

const RemoteVideo = ({ stream, user }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={{
      position: 'relative', borderRadius: 12, overflow: 'hidden',
      background: '#1a1a2e', height: '100%',
    }}>
      <video ref={ref} autoPlay playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(0,0,0,0.6)', padding: '4px 10px',
        borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
      }}>
        {user?.name || 'Participant'}
      </div>
    </div>
  );
};

export default VideoCall;
