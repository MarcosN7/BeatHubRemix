import dotenv from 'dotenv';
dotenv.config(); // <-- THIS MUST BE THE FIRST LINE

import app from './app';
import { createServer } from 'http';
import { initSocketServer } from './socket';
import { RoomCleanupService } from './services/room-cleanup.service';

// Now process.env.PORT and others are guaranteed to be loaded
const PORT = process.env.PORT || 4000;

const httpServer = createServer(app);
const io = initSocketServer(httpServer);

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`⚡ WebSockets initialized`);

  // Purge stale rooms from previous sessions, then start periodic sweep
  const cleanup = RoomCleanupService.getInstance();
  await cleanup.purgeStaleRooms();
  cleanup.start(60_000); // Sweep every 60 seconds
});