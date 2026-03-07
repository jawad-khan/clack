import { createServer } from 'http';
import app from './app.js';
import { initializeWebSocket } from './websocket/index.js';
import { startScheduler } from './scheduler.js';
import prisma from './db.js';

const PORT = process.env.PORT || 3000;

const server = createServer(app);

// Initialize WebSocket
const io = initializeWebSocket(server);

// Start the scheduled message processor
const schedulerHandle = startScheduler();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down gracefully...');
  clearInterval(schedulerHandle);
  io.close();
  server.close(() => {
    prisma.$disconnect().then(() => process.exit(0));
  });
  // Force exit after 10 seconds
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
