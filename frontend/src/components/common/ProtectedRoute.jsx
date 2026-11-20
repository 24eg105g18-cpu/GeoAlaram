import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1020] text-[#F8FAFC]">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-14 h-14">
            <div className="w-14 h-14 rounded-full border-4 border-purple-500/20 border-t-[#3B82F6] border-r-[#8B5CF6] animate-spin"></div>
            <div className="absolute inset-0 rounded-full blur-md bg-gradient-to-tr from-[#3B82F6]/20 to-[#8B5CF6]/20 animate-pulse"></div>
          </div>
          <p className="text-sm font-medium text-slate-400 tracking-wide">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
