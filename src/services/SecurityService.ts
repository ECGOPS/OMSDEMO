import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

class SecurityService {
  private static instance: SecurityService;
  private loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();

  private constructor() {
    // Initialize auth state listener
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Only log minimal info in development
        if (process.env.NODE_ENV === 'development') {
          console.log('User authenticated');
        }
        this.resetLoginAttempts(user.email || '');
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('User signed out');
        }
      }
    });
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  private resetLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
  }

  private isRateLimited(email: string): boolean {
    const attempts = this.loginAttempts.get(email);
    if (!attempts) return false;

    const now = Date.now();
    const timeSinceLastAttempt = now - attempts.lastAttempt;
    
    // Reset attempts if enough time has passed
    if (timeSinceLastAttempt > 15 * 60 * 1000) { // 15 minutes
      this.resetLoginAttempts(email);
      return false;
    }

    return attempts.count >= 5; // Max 5 attempts
  }

  private incrementLoginAttempts(email: string): void {
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.loginAttempts.set(email, attempts);
  }

  public async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (this.isRateLimited(email)) {
      return {
        success: false,
        error: 'Too many login attempts. Please try again later.'
      };
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      this.resetLoginAttempts(email);
      return { success: true };
    } catch (error: any) {
      this.incrementLoginAttempts(email);
      return {
        success: false,
        error: error.message || 'Authentication failed'
      };
    }
  }

  public async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  public isAuthenticated(): boolean {
    return !!auth.currentUser;
  }

  public getCurrentUser() {
    return auth.currentUser;
  }

  public async checkRateLimit(ip: string): Promise<boolean> {
    const now = Date.now();
    const windowSize = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100;

    const requestData = this.requestCounts.get(ip) || { count: 0, windowStart: now };
    
    // Reset if window has passed
    if (now - requestData.windowStart > windowSize) {
      requestData.count = 0;
      requestData.windowStart = now;
    }

    // Check if limit exceeded
    if (requestData.count >= maxRequests) {
      return false;
    }

    // Increment count
    requestData.count++;
    this.requestCounts.set(ip, requestData);
    return true;
  }
}

export const securityService = SecurityService.getInstance(); 