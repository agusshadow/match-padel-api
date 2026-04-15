import request from 'supertest';
import app from '../app.js';
import { sequelize } from '../config/connection.js';

describe('Auth Endpoints', () => {
  let token = '';

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'agustin@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('id');
      
      // Verify snake_case timestamps if they exist
      if (response.body.data.user.created_at) {
        expect(response.body.data.user).toHaveProperty('created_at');
      }

      token = response.body.data.token;
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get profile with valid token', async () => {
      // First login to get a fresh token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'agustin@example.com',
          password: 'password123'
        });
      
      const authToken = loginRes.body.data.token;

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('email', 'agustin@example.com');
    });

    it('should fail without token', async () => {
      const response = await request(app).get('/api/auth/profile');
      expect(response.status).toBe(401);
    });
  });
});
