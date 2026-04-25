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

  // Socket.io Logic
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, username }) => {
      socket.join(roomId);
      console.log(`User ${username} (${socket.id}) joined room: ${roomId}`);
      
      // Notify others in the room
      socket.to(roomId).emit('user-joined', { username, id: socket.id });
    });

    socket.on('sync-video', (data) => {
      // data: { roomId, action: 'play' | 'pause' | 'seek', currentTime, videoUrl }
      const { roomId, ...event } = data;
      socket.to(roomId).emit('sync-video', event);
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
