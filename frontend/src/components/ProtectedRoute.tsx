import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Role } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated } = useAuthStore();
  const { addToast } = useNotificationStore();

  const token = localStorage.getItem('certiflow_token');

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Notify user of unauthorized access attempt
    addToast({
      title: 'Access Restricted',
      message: `Your role (${user.role.replace('_', ' ')}) is not authorized to access that desk.`,
      type: 'WARNING',
    });
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
