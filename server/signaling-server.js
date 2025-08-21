import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store connected clients
const clients = new Map();
const rooms = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'SystemAccess Signaling Server Running' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle client registration
  socket.on('register', (data) => {
    const { clientId, clientType, roomId } = data;
    
    clients.set(socket.id, {
      clientId,
      clientType, // 'host' or 'client'
      roomId,
      socketId: socket.id
    });

    // Join room
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    rooms.get(roomId).push(socket.id);

    console.log(`Client ${clientId} (${clientType}) joined room ${roomId}`);
    
    // Notify other clients in the room
    socket.to(roomId).emit('clientJoined', {
      clientId,
      clientType,
      socketId: socket.id
    });
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const { targetId, offer, roomId } = data;
    console.log(`Forwarding offer from ${socket.id} to ${targetId}`);
    socket.to(roomId).emit('offer', {
      offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    const { targetId, answer, roomId } = data;
    console.log(`Forwarding answer from ${socket.id} to ${targetId}`);
    socket.to(roomId).emit('answer', {
      answer,
      from: socket.id
    });
  });

  socket.on('iceCandidate', (data) => {
    const { targetId, candidate, roomId } = data;
    console.log(`Forwarding ICE candidate from ${socket.id} to ${targetId}`);
    socket.to(roomId).emit('iceCandidate', {
      candidate,
      from: socket.id
    });
  });

  // Handle screen sharing requests
  socket.on('screenShareRequest', (data) => {
    const { targetId, roomId } = data;
    socket.to(roomId).emit('screenShareRequest', {
      from: socket.id
    });
  });

  // Handle file transfer requests
  socket.on('fileTransferRequest', (data) => {
    const { targetId, fileName, fileSize, roomId } = data;
    socket.to(roomId).emit('fileTransferRequest', {
      from: socket.id,
      fileName,
      fileSize
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const client = clients.get(socket.id);
    if (client) {
      const { roomId, clientId } = client;
      
      // Remove from room
      if (rooms.has(roomId)) {
        const roomClients = rooms.get(roomId);
        const index = roomClients.indexOf(socket.id);
        if (index > -1) {
          roomClients.splice(index, 1);
        }
        
        // Remove room if empty
        if (roomClients.length === 0) {
          rooms.delete(roomId);
        }
      }
      
      // Remove client
      clients.delete(socket.id);
      
      // Notify other clients
      socket.to(roomId).emit('clientLeft', {
        clientId,
        socketId: socket.id
      });
      
      console.log(`Client ${clientId} disconnected from room ${roomId}`);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    clients: clients.size,
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Get connected clients for a room
app.get('/room/:roomId/clients', (req, res) => {
  const { roomId } = req.params;
  const roomClients = rooms.get(roomId) || [];
  const clientDetails = roomClients.map(socketId => clients.get(socketId)).filter(Boolean);
  
  res.json({
    roomId,
    clients: clientDetails
  });
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
  console.log(`🚀 SystemAccess Signaling Server running on ${HOST}:${PORT}`);
  console.log(`📡 WebSocket server ready for WebRTC connections`);
  console.log(`🌐 Health check: http://192.168.1.5:${PORT}/health`);
  console.log(`🌐 Local health check: http://localhost:${PORT}/health`);
});
