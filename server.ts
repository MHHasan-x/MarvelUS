import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Track room state
  const roomStates = new Map<string, {
    videoUrl?: string;
    currentTime: number;
    isPlaying: boolean;
    lastUpdated: number;
  }>();

  // Socket.io Logic
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, username }) => {
      socket.join(roomId);
      console.log(`User ${username} (${socket.id}) joined room: ${roomId}`);
      
      // Send current state to new user
      const state = roomStates.get(roomId);
      if (state) {
        socket.emit('sync-video', {
          action: state.isPlaying ? 'play' : 'pause',
          currentTime: state.currentTime + (state.isPlaying ? (Date.now() - state.lastUpdated) / 1000 : 0),
          videoUrl: state.videoUrl
        });
      }

      // Notify others in the room
      socket.to(roomId).emit('user-joined', { username, id: socket.id });
    });

    socket.on('sync-video', (data) => {
      // data: { roomId, action: 'play' | 'pause' | 'seek' | 'url-change', currentTime, videoUrl }
      const { roomId, action, currentTime, videoUrl } = data;
      
      let state = roomStates.get(roomId) || { currentTime: 0, isPlaying: false, lastUpdated: Date.now() };
      
      if (action === 'play') {
        state.isPlaying = true;
        state.lastUpdated = Date.now();
        if (currentTime !== undefined) state.currentTime = currentTime;
      } else if (action === 'pause') {
        state.isPlaying = false;
        state.lastUpdated = Date.now();
        if (currentTime !== undefined) state.currentTime = currentTime;
      } else if (action === 'seek') {
        if (currentTime !== undefined) state.currentTime = currentTime;
        state.lastUpdated = Date.now();
      } else if (action === 'url-change') {
        state.videoUrl = videoUrl;
        state.currentTime = 0;
        state.isPlaying = false;
        state.lastUpdated = Date.now();
      }

      roomStates.set(roomId, state);
      socket.to(roomId).emit('sync-video', { action, currentTime, videoUrl });
    });

    socket.on('chat-message', (data) => {
      // data: { roomId, username, message, timestamp }
      const { roomId, ...msg } = data;
      socket.to(roomId).emit('chat-message', msg);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
