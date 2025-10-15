import { securityService } from '../services/SecurityService';
import { securityMiddleware, sessionTimeoutMiddleware } from '../middleware/SecurityMiddleware';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionService } from '@/services/PermissionService';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// Protected route wrapper
const ProtectedRoute = ({ children, requiredFeature }: { children: React.ReactNode; requiredFeature?: string }) => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[ProtectedRoute] Not authenticated, redirecting to login');
      window.location.href = '/login';
      return;
    }

    if (requiredFeature && user) {
      const hasAccess = permissionService.canAccessFeature(user.role, requiredFeature);
      console.log('[ProtectedRoute] Checking feature access:', { 
        feature: requiredFeature, 
        role: user.role, 
        hasAccess 
      });

      if (!hasAccess) {
        console.log('[ProtectedRoute] User does not have access, redirecting to unauthorized');
        navigate('/unauthorized');
        return;
      }
    }
  }, [isAuthenticated, user, requiredFeature, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  if (requiredFeature && user && !permissionService.canAccessFeature(user.role, requiredFeature)) {
    return null;
  }

  return <>{children}</>;
};

export { ProtectedRoute }; 