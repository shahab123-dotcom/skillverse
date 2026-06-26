require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const socketHandler = require('./sockets');
const seedAdmin = require('./seedAdmin');
const paymentRoutes = require('./paymentRoutes');
const { releaseDuePayments, HOLD_DAYS } = require('./escrow');

const ESCROW_CHECK_MS = Number(process.env.ESCROW_CHECK_INTERVAL_MS) || 60 * 60 * 1000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Serve uploaded voice audio files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Share io with REST routes for real-time notifications
app.set('io', io);

// Routes
app.use('/api', routes);
app.use('/api/payment', paymentRoutes);

// Hello/Health endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Skillsverse API is running smoothly.' });
});

// Bind WebSocket Server
socketHandler(io);

// DB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Haseeb:haseeb123@cluster0.eg6vwrs.mongodb.net/skillverse?appName=Cluster0';
console.log('Connecting to MongoDB...');

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Cluster.');
    
    // Seed Administrator Account
    seedAdmin();

    // Scheduled escrow release — runs every hour (configurable via ESCROW_CHECK_INTERVAL_MS)
    setInterval(async () => {
      try {
        await releaseDuePayments();
      } catch (err) {
        console.error('[Escrow] Scheduled release error:', err);
      }
    }, ESCROW_CHECK_MS);
    console.log(`Escrow auto-release scheduled every ${ESCROW_CHECK_MS / 60000} min (${HOLD_DAYS}-day hold, worker gets 90%)`);

    // Run once on startup so due payments release without waiting for the hour
    releaseDuePayments().catch(err => console.error('[Escrow] Startup release check failed:', err));
    
    // Start Server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Skillsverse Backend Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
