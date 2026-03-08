import dotenv from 'dotenv';
dotenv.config(); // <-- THIS MUST BE THE FIRST LINE
import app from './app';
import { createServer } from 'http';
import { initSocketServer } from './socket';
import { RoomCleanupService } from './services/room-cleanup.service';

const PORT = Number(process.env.PORT) || 4000;
const httpServer = createServer(app);
const io = initSocketServer(httpServer);

httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`⚡ WebSockets initialized`);

  const cleanup = RoomCleanupService.getInstance();
  await cleanup.purgeStaleRooms();
  cleanup.start(60_000); // Sweep every 60 seconds
});
