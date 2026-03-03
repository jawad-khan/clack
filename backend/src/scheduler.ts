import prisma from './db.js';
import { getIO } from './websocket/index.js';

const INTERVAL_MS = 30_000; // 30 seconds

export function startScheduler(): NodeJS.Timeout {
  console.log('Scheduler started — checking every 30s for due messages');

  const handle = setInterval(async () => {
    try {
      const due = await prisma.scheduledMessage.findMany({
        where: {
          sent: false,
          scheduledAt: { lte: new Date() },
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          channel: { select: { id: true, name: true } },
        },
        take: 50, // process up to 50 per tick
      });

      if (due.length === 0) return;

      const io = getIO();

      for (const scheduled of due) {
        try {
          // Create the actual message
          const message = await prisma.message.create({
            data: {
              content: scheduled.content,
              userId: scheduled.userId,
              channelId: scheduled.channelId,
            },
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
              files: {
                select: { id: true, filename: true, originalName: true, mimetype: true, size: true, url: true },
              },
            },
          });

          // Mark the scheduled message as sent
          await prisma.scheduledMessage.update({
            where: { id: scheduled.id },
            data: { sent: true },
          });

          // Broadcast via WebSocket to the channel
          if (io) {
            io.to(`channel:${scheduled.channelId}`).emit('message:new', message);
          }

          console.log(
            `Scheduler: sent message ${message.id} to channel ${scheduled.channelId} (was scheduled ${scheduled.id})`
          );
        } catch (err) {
          console.error(`Scheduler: failed to send scheduled message ${scheduled.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Scheduler tick error:', err);
    }
  }, INTERVAL_MS);

  return handle;
}
