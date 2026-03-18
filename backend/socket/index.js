const Meeting = require('../models/Meeting');
const Whiteboard = require('../models/Whiteboard');

// Track online users per room
const roomUsers = new Map();
// Track whiteboard locks per room: roomId -> { socketId, userId, userName }
const whiteboardLocks = new Map();

const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── Room Management ──────────────────────────────────
    socket.on('team:join', ({ teamId }) => {
      socket.join(`team:${teamId}`);
      console.log(`Socket ${socket.id} joined team:${teamId}`);
    });

    socket.on('room:join', async ({ roomId, user }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userData = user;

      // Track user in room
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      roomUsers.get(roomId).set(socket.id, user);

      // Notify others in room
      socket.to(roomId).emit('room:user-joined', {
        user,
        socketId: socket.id,
        users: Array.from(roomUsers.get(roomId).values()),
      });

      // Send current users list to the joiner
      socket.emit('room:users', {
        users: Array.from(roomUsers.get(roomId).values()),
      });

      // Send existing whiteboard data and current lock status
      try {
        const meeting = await Meeting.findOne({ roomId });
        if (meeting) {
          const whiteboard = await Whiteboard.findOne({ meeting: meeting._id });
          if (whiteboard) {
            socket.emit('whiteboard:load', { strokes: whiteboard.strokes });
          }

          // Send chat history
          socket.emit('chat:history', { messages: meeting.chatHistory || [] });
        }

        // Send whiteboard lock info
        if (whiteboardLocks.has(roomId)) {
          socket.emit('whiteboard:lock-update', { lock: whiteboardLocks.get(roomId) });
        } else {
          socket.emit('whiteboard:lock-update', { lock: null });
        }
      } catch (err) {
        console.error('Error loading room data:', err.message);
      }
    });

    socket.on('room:leave', ({ roomId }) => {
      handleLeaveRoom(socket, roomId, io);
    });

    // ─── Chat ─────────────────────────────────────────────
    socket.on('chat:send', async ({ roomId, message, sender, senderName }) => {
      const chatMessage = {
        sender,
        senderName,
        message,
        timestamp: new Date(),
      };

      // Broadcast to room
      io.to(roomId).emit('chat:receive', chatMessage);

      // Persist to DB
      try {
        const meeting = await Meeting.findOne({ roomId });
        if (meeting) {
          meeting.chatHistory.push(chatMessage);
          await meeting.save();
        }
      } catch (err) {
        console.error('Error saving chat message:', err.message);
      }

      // Send notification to room
      socket.to(roomId).emit('notification:new', {
        type: 'chat',
        message: `${senderName}: ${message.substring(0, 50)}`,
        timestamp: new Date(),
      });
    });

    // ─── Whiteboard ──────────────────────────────────────
    socket.on('whiteboard:draw', async ({ roomId, stroke }) => {
      // Check if sender has the lock
      const currentLock = whiteboardLocks.get(roomId);
      if (currentLock && currentLock.socketId !== socket.id) {
        return; // Ignore if not holding the lock
      }

      // Broadcast to others in room
      socket.to(roomId).emit('whiteboard:draw', { stroke });

      // Persist stroke
      try {
        const meeting = await Meeting.findOne({ roomId });
        if (meeting) {
          await Whiteboard.findOneAndUpdate(
            { meeting: meeting._id },
            { $push: { strokes: stroke }, lastUpdatedBy: stroke.userId },
          );
        }
      } catch (err) {
        console.error('Error saving whiteboard stroke:', err.message);
      }
    });

    socket.on('whiteboard:clear', async ({ roomId }) => {
      const currentLock = whiteboardLocks.get(roomId);
      if (currentLock && currentLock.socketId !== socket.id) return;

      socket.to(roomId).emit('whiteboard:clear');

      try {
        const meeting = await Meeting.findOne({ roomId });
        if (meeting) {
          await Whiteboard.findOneAndUpdate({ meeting: meeting._id }, { strokes: [] });
        }
      } catch (err) {
        console.error('Error clearing whiteboard:', err.message);
      }
    });

    socket.on('whiteboard:undo', async ({ roomId }) => {
      const currentLock = whiteboardLocks.get(roomId);
      if (currentLock && currentLock.socketId !== socket.id) return;

      try {
        const meeting = await Meeting.findOne({ roomId });
        if (meeting) {
          const whiteboard = await Whiteboard.findOne({ meeting: meeting._id });
          if (whiteboard && whiteboard.strokes.length > 0) {
            whiteboard.strokes.pop();
            await whiteboard.save();
            io.to(roomId).emit('whiteboard:undo', { strokes: whiteboard.strokes });
          }
        }
      } catch (err) {
        console.error('Error undoing whiteboard stroke:', err.message);
      }
    });

    socket.on('whiteboard:request-lock', ({ roomId }) => {
      if (!whiteboardLocks.has(roomId)) {
        const lockInfo = {
          socketId: socket.id,
          userId: socket.userData?.id || socket.userData?._id,
          userName: socket.userData?.name || 'Someone'
        };
        whiteboardLocks.set(roomId, lockInfo);
        io.to(roomId).emit('whiteboard:lock-update', { lock: lockInfo });
      }
    });

    socket.on('whiteboard:release-lock', ({ roomId }) => {
      const currentLock = whiteboardLocks.get(roomId);
      if (currentLock && currentLock.socketId === socket.id) {
        whiteboardLocks.delete(roomId);
        io.to(roomId).emit('whiteboard:lock-update', { lock: null });
      }
    });

    // ─── Video Signaling (WebRTC) ─────────────────────────
    socket.on('video:join-room', ({ roomId, user }) => {
      // Notify existing users so they can create offers
      socket.to(roomId).emit('video:user-joined', {
        socketId: socket.id,
        user,
      });
    });

    socket.on('video:offer', ({ to, offer, from, user }) => {
      io.to(to).emit('video:offer', { from, offer, user });
    });

    socket.on('video:answer', ({ to, answer, from }) => {
      io.to(to).emit('video:answer', { from, answer });
    });

    socket.on('video:ice-candidate', ({ to, candidate, from }) => {
      io.to(to).emit('video:ice-candidate', { from, candidate });
    });

    socket.on('video:leave', ({ roomId }) => {
      socket.to(roomId).emit('video:user-left', { socketId: socket.id });
    });

    socket.on('video:status-update', ({ roomId, status }) => {
      socket.to(roomId).emit('video:status-update', { socketId: socket.id, status });
    });

    // ─── Screen Share ─────────────────────────────────────
    socket.on('screen:start', ({ roomId, user }) => {
      socket.to(roomId).emit('screen:started', { socketId: socket.id, user });
    });

    socket.on('screen:stop', ({ roomId }) => {
      socket.to(roomId).emit('screen:stopped', { socketId: socket.id });
    });

    // ─── File Notifications ───────────────────────────────
    socket.on('file:uploaded', ({ roomId, file, userName }) => {
      socket.to(roomId).emit('file:new', { file });
      socket.to(roomId).emit('notification:new', {
        type: 'file',
        message: `${userName} uploaded ${file.originalName}`,
        timestamp: new Date(),
      });
    });

    // ─── Presence ─────────────────────────────────────────
    socket.on('presence:typing', ({ roomId, user }) => {
      socket.to(roomId).emit('presence:typing', { user });
    });

    socket.on('presence:stop-typing', ({ roomId, user }) => {
      socket.to(roomId).emit('presence:stop-typing', { user });
    });

    // ─── Disconnect ───────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.roomId) {
        handleLeaveRoom(socket, socket.roomId, io);
      }
    });
  });
};

function handleLeaveRoom(socket, roomId, io) {
  socket.leave(roomId);

  // Auto-release whiteboard lock if the user has it
  const currentLock = whiteboardLocks.get(roomId);
  if (currentLock && currentLock.socketId === socket.id) {
    whiteboardLocks.delete(roomId);
    io.to(roomId).emit('whiteboard:lock-update', { lock: null });
  }

  if (roomUsers.has(roomId)) {
    roomUsers.get(roomId).delete(socket.id);
    const remaining = Array.from(roomUsers.get(roomId).values());

    if (remaining.length === 0) {
      roomUsers.delete(roomId);
    }

    io.to(roomId).emit('room:user-left', {
      socketId: socket.id,
      user: socket.userData,
      users: remaining,
    });
  }
}

module.exports = initSocket;
