import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db.js';
import { JWT_SECRET } from '../config.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().max(72),
});

// Account lockout: track failed login attempts per email
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Unable to complete registration' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Auto-join default channels (general, random) - create if they don't exist
    for (const channelName of ['general', 'random']) {
      try {
        let channel = await prisma.channel.findFirst({
          where: { name: channelName, isPrivate: false },
        });
        if (!channel) {
          try {
            channel = await prisma.channel.create({
              data: { name: channelName, isPrivate: false },
            });
          } catch {
            // Race condition: another request created it concurrently
            channel = await prisma.channel.findFirst({
              where: { name: channelName, isPrivate: false },
            });
          }
        }
        if (channel) {
          await prisma.channelMember.create({
            data: { userId: user.id, channelId: channel.id },
          }).catch(() => {
            // Ignore if already a member
          });
        }
      } catch {
        // Non-critical: don't fail registration if auto-join fails
      }
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });

    res.status(201).json({ user, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Check account lockout
    const attempts = loginAttempts.get(email);
    if (attempts && attempts.lockedUntil > Date.now()) {
      res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Track failed attempt even for non-existent users (prevent enumeration timing)
      const current = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
      current.count++;
      if (current.count >= MAX_FAILED_ATTEMPTS) {
        current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        current.count = 0;
      }
      loginAttempts.set(email, current);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const current = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
      current.count++;
      if (current.count >= MAX_FAILED_ATTEMPTS) {
        current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        current.count = 0;
      }
      loginAttempts.set(email, current);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Clear failed attempts on successful login
    loginAttempts.delete(email);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

export default router;
