import request from 'supertest';
import app from '../app.js';
import { sequelize } from '../config/connection.js';

describe('Matches Endpoints', () => {
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

  describe('GET /api/matches/detailed', () => {
    it('should get detailed matches successfully', async () => {
      const response = await request(app)
        .get('/api/matches/detailed')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const match = response.body.data[0];
        // Verify snake_case attributes
        expect(match).toHaveProperty('match_date_time');
        expect(match).toHaveProperty('reservation_id');
        expect(match).toHaveProperty('created_at');
        
        // Verify N:M relationship
        expect(match).toHaveProperty('participants');
        expect(Array.isArray(match.participants)).toBe(true);
        
        if (match.participants.length > 0) {
          const p = match.participants[0];
          expect(p).toHaveProperty('user_id');
          expect(p).toHaveProperty('match_id');
          expect(p).toHaveProperty('team_number');
        }
      }
    });
  });

  describe('GET /api/matches', () => {
    it('should get all matches', async () => {
      const response = await request(app)
        .get('/api/matches')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
