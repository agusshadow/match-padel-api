import express from 'express';
const router = express.Router();

import authRoutes from './auth.js';
import userRoutes from './users.js';
import clubRoutes from './clubs.js';
import courtRoutes from './courts.js';
import courtSlotRoutes from './court-slots.js';
import courtReservationRoutes from './court-reservations.js';
import matchRoutes from './matches.js';
import matchScoreRoutes from './match-scores.js';
import userProfileRoutes from './user-profiles.js';
import experienceRoutes from './experience.js';
import notificationRoutes from './notifications.js';
import challengeRoutes from './challenges.js';
import cosmeticRoutes from './cosmetics.js';

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clubs', clubRoutes);
router.use('/courts', courtRoutes);
router.use('/court-slots', courtSlotRoutes);
router.use('/court-reservations', courtReservationRoutes);
router.use('/matches', matchRoutes);
router.use('/match-scores', matchScoreRoutes);
router.use('/user-profiles', userProfileRoutes);
router.use('/experience', experienceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/challenges', challengeRoutes);
router.use('/cosmetics', cosmeticRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando',
    timestamp: new Date().toISOString()
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Match Padel API',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      clubs: '/api/clubs',
      courts: '/api/courts',
      'court-slots': '/api/court-slots',
      'court-reservations': '/api/court-reservations',
      matches: '/api/matches',
      'match-scores': '/api/match-scores',
      'user-profiles': '/api/user-profiles',
      experience: '/api/experience',
      notifications: '/api/notifications',
      challenges: '/api/challenges',
      cosmetics: '/api/cosmetics',
      health: '/api/health'
    }
  });
});

export default router;