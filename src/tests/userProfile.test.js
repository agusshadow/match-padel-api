import request from 'supertest';
import app from '../app.js';
import { sequelize } from '../config/connection.js';

describe('User Profile Endpoints', () => {
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

  describe('GET /api/user-profiles/profile', () => {
    it('should get current user profile successfully', async () => {
      const response = await request(app)
        .get('/api/user-profiles/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user_id');
      expect(response.body.data).toHaveProperty('personal_information');
      expect(response.body.data).toHaveProperty('game_skills');
    });
  });

  describe('PUT /api/user-profiles/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        location: 'Barcelona, Spain',
        skill_serve: 8,
        favorite_position: 'left'
      };

      const response = await request(app)
        .put('/api/user-profiles/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify updated profile
      const getResponse = await request(app)
        .get('/api/user-profiles/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(getResponse.body.data.personal_information.location).toBe('Barcelona, Spain');
      expect(getResponse.body.data.game_skills.skill_serve).toBe(8);
      expect(getResponse.body.data.game_preferences.favorite_position).toBe('left');
    });

    it('should fail with invalid skill value', async () => {
      const updateData = {
        skill_serve: 15 // Max is 10
      };

      const response = await request(app)
        .put('/api/user-profiles/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
