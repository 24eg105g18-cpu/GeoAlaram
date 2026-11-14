import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateAlarmPage from './pages/CreateAlarmPage';
import MyAlarmsPage from './pages/MyAlarmsPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/common/ProtectedRoute';
import AlarmTriggerModal from './components/tracking/AlarmTriggerModal';

function App() {
  return (
    <>
      {/* Global In-App Alarm Alert Modal */}
      <AlarmTriggerModal />

      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/alarms"
          element={
            <ProtectedRoute>
              <MyAlarmsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/alarms/create"
          element={
            <ProtectedRoute>
              <CreateAlarmPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Fallback for unmatched routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
