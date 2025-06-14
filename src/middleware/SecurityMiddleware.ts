import { securityService } from '../services/SecurityService';
import { auth } from '../config/firebase';

export const securityMiddleware = async (req: any, res: any, next: any) => {
  try {
    // Get client IP
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Check rate limit
    const isAllowed = await securityService.checkRateLimit(ip);
    if (!isAllowed) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }

    // Check authentication
    const isAuthenticated = securityService.isAuthenticated();
    if (!isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Get current user
    const user = securityService.getCurrentUser();
    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    // Add user to request
    req.user = user;

    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Security middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Session timeout middleware
export const sessionTimeoutMiddleware = (req: any, res: any, next: any) => {
  const user = auth.currentUser;
  if (user) {
    // Check if the request is from a mobile device
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
    
    // Skip session timeout for mobile devices
    if (isMobile) {
      return next();
    }

    // Check if session is expired
    const lastSignInTime = user.metadata.lastSignInTime;
    if (lastSignInTime) {
      const sessionTimeout = 3600 * 1000; // 1 hour in milliseconds
      const now = new Date().getTime();
      const lastSignIn = new Date(lastSignInTime).getTime();
      
      if (now - lastSignIn > sessionTimeout) {
        // Session expired, sign out
        securityService.logout();
        return res.status(401).json({
          error: 'Session expired. Please log in again.'
        });
      }
    }
  }
  next();
}; 