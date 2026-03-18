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
      socket.off('video:user-left');
      socket.emit('video:leave', { roomId });
    };
  }, [socket, roomId, createPeerConnection, user]);

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
  const totalVideos = 1 + peerEntries.length;
  
  // Responsive grid logic
  const isMobile = window.innerWidth <= 768;
  let gridCols;
  if (isMobile) {
    gridCols = totalVideos <= 1 ? 1 : 2;
  } else {
    gridCols = totalVideos <= 1 ? 1 : totalVideos <= 4 ? 2 : 3;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Video Grid */}
      <div className="video-grid" style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridAutoRows: isMobile ? '200px' : '1fr',
        gap: 12, padding: 12, overflow: 'auto',
      }}>
        {/* Local Video */}
        <motion.div 
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden',
            background: '#1a1a2e', minHeight: 180,
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
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
        </motion.div>

        {/* Remote Videos */}
        <AnimatePresence>
          {peerEntries.map(([socketId, { stream, user: remoteUser }]) => (
            <motion.div
              key={socketId}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{ height: '100%', width: '100%' }}
            >
              <RemoteVideo stream={stream} user={remoteUser} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Controls Overlay */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '12px 24px', borderRadius: 24,
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
          zIndex: 100,
        }}
      >
        <ControlButton 
          active={!isMuted} 
          onClick={toggleMute} 
          icon={isMuted ? <HiOutlineVolumeOff /> : <HiOutlineMicrophone />} 
          label={isMuted ? "Unmute" : "Mute"}
          danger={isMuted}
        />
        <ControlButton 
          active={!isVideoOff} 
          onClick={toggleVideo} 
          icon={isVideoOff ? <HiOutlineEyeOff /> : <HiOutlineVideoCamera />} 
          label={isVideoOff ? "Start Video" : "Stop Video"}
          danger={isVideoOff}
        />
        <ControlButton 
          active={isScreenSharing} 
          onClick={toggleScreenShare} 
          icon={<HiOutlineDesktopComputer />} 
          label={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          accent
        />
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
      background: '#1a1a2e', minHeight: 180,
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
