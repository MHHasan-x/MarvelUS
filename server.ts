import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with CORS for development and production
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Memory Bank: Stores the status of every active room
// { roomId: { url, lastTime, isPlaying, lastUpdated } }
const roomStates = new Map<string, {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
}>();

io.on('connection', (socket) => {
  console.log('Agent Connected:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`Agent ${username} assigned to Channel: ${roomId}`);

    // GREET THE NEW AGENT WITH CURRENT DATA
    const state = roomStates.get(roomId);
    if (state) {
      // Calculate exactly where the movie should be based on time elapsed
      let syncTime = state.currentTime;
      if (state.isPlaying) {
        const elapsed = (Date.now() - state.lastUpdated) / 1000;
        syncTime += elapsed;
      }

      // Send the "Handshake" packet
      socket.emit('sync-video', {
        action: 'url-change',
        videoUrl: state.videoUrl,
        currentTime: syncTime,
        isPlaying: state.isPlaying
      });
    }

    // Broadcast "User Joined" to others
    socket.to(roomId).emit('user-joined', { username, id: socket.id });
  });

  socket.on('sync-video', (data) => {
    const { roomId, action, currentTime, videoUrl } = data;
    
    // Get or create room state
    let state = roomStates.get(roomId) || { 
      videoUrl: '', 
      currentTime: 0, 
      isPlaying: false, 
      lastUpdated: Date.now() 
    };

    // Update the memory bank based on the action
    if (action === 'url-change') {
      state.videoUrl = videoUrl;
      state.currentTime = 0;
      state.isPlaying = false;
    } else if (action === 'play') {
      state.isPlaying = true;
      if (currentTime !== undefined) state.currentTime = currentTime;
    } else if (action === 'pause') {
      state.isPlaying = false;
      if (currentTime !== undefined) state.currentTime = currentTime;
    } else if (action === 'seek') {
      if (currentTime !== undefined) state.currentTime = currentTime;
    }

    state.lastUpdated = Date.now();
    roomStates.set(roomId, state);

    // Broadcast the event to everyone else in the room
    socket.to(roomId).emit('sync-video', { action, currentTime, videoUrl });
  });

  socket.on('chat-message', (data) => {
    const { roomId, ...msg } = data;
    socket.to(roomId).emit('chat-message', msg);
  });

  socket.on('disconnect', () => {
    console.log('Agent Disconnected:', socket.id);
  });
});

// Production Setup: Serve the React Frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Mission Control live at PORT ${PORT}`);
});
