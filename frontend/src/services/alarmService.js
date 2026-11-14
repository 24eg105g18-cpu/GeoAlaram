import api from './api';

export const alarmService = {
  // Get all alarms for authenticated user (supports ?status=active|paused|completed)
  async getAlarms(status = '') {
    const url = status ? `/alarms?status=${status}` : '/alarms';
    const response = await api.get(url);
    return response.data;
  },

  // Get a single alarm by ID
  async getAlarmById(id) {
    const response = await api.get(`/alarms/${id}`);
    return response.data;
  },

  // Create a new location alarm
  async createAlarm(alarmData) {
    const response = await api.post('/alarms', alarmData);
    return response.data;
  },

  // Update an existing alarm
  async updateAlarm(id, alarmData) {
    const response = await api.put(`/alarms/${id}`, alarmData);
    return response.data;
  },

  // Delete an alarm
  async deleteAlarm(id) {
    const response = await api.delete(`/alarms/${id}`);
    return response.data;
  },

  // Update status (active, paused, completed)
  async updateStatus(id, status) {
    const response = await api.patch(`/alarms/${id}/status`, { status });
    return response.data;
  },
};
