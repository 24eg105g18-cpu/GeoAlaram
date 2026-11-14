import api from './api';

export const authService = {
  // Register a new user
  async register(name, email, password) {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },

  // Login existing user
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Get current authenticated user profile
  async getMe() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Update user profile or password
  async updateProfile(profileData) {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  },
};
