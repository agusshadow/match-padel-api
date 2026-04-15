import request from 'supertest';
import app from '../app.js';
import { sequelize } from '../config/connection.js';
import { updateMatchStatuses } from '../services/matchStatusService.js';
import { cleanupExpiredChallenges } from '../services/challengeService.js';

describe('Challenges and Status Jobs', () => {
  let token = '';

  beforeAll(async () => {
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'agustin@example.com',
        password: 'password123'
      });
    token = loginRes.body.data.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should run updateMatchStatuses without errors', async () => {
    // This verifies the refactor in matchStatusService.js
    const results = await updateMatchStatuses();
    expect(results).toHaveProperty('cancelled');
    expect(results).toHaveProperty('started');
    expect(results).toHaveProperty('finished');
  });

  it('should run cleanupExpiredChallenges without errors', async () => {
    // This verifies the refactor in challengeService.js (specifically the expires_at issue)
    const cancelledCount = await cleanupExpiredChallenges();
    expect(typeof cancelledCount).toBe('number');
  });

  describe('GET /api/challenges', () => {
    it('should get user challenges successfully', async () => {
      const response = await request(app)
        .get('/api/challenges')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
