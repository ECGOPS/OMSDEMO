import { collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { SecurityEvent } from '@/lib/types';

export const EVENT_TYPES = {
  LOGIN_ATTEMPT: 'login_attempt',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  PASSWORD_CHANGE: 'password_change',
  ROLE_CHANGE: 'role_change',
  USER_DISABLED: 'user_disabled',
  USER_ENABLED: 'user_enabled'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS: 5,
  WINDOW_MINUTES: 15,
  LOCKOUT_MINUTES: 30
} as const;

class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private readonly collectionRef = collection(db, 'securityEvents');

  private constructor() {}

  private async fetchIpAddress(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Error fetching IP address:', error);
      return 'unknown';
    }
  }

  // Check if a user has exceeded login attempts
  async checkRateLimit(userId: string): Promise<{ blocked: boolean; remainingAttempts: number }> {
    try {
      const windowStart = Timestamp.fromDate(
        new Date(Date.now() - RATE_LIMIT_CONFIG.WINDOW_MINUTES * 60 * 1000)
      );

      const q = query(
        this.collectionRef,
        where('userId', '==', userId),
        where('eventType', 'in', [EVENT_TYPES.LOGIN_ATTEMPT, EVENT_TYPES.LOGIN_FAILURE]),
        where('timestamp', '>=', windowStart),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const attempts = snapshot.docs.length;

      // Check if user is in lockout period
      const lastFailedLogin = snapshot.docs.find(doc => 
        doc.data().eventType === EVENT_TYPES.LOGIN_FAILURE
      );

      if (lastFailedLogin) {
        const lastFailureTime = lastFailedLogin.data().timestamp.toDate();
        const lockoutEnds = new Date(lastFailureTime.getTime() + RATE_LIMIT_CONFIG.LOCKOUT_MINUTES * 60 * 1000);
        
        if (attempts >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS && lockoutEnds > new Date()) {
          return { 
            blocked: true, 
            remainingAttempts: 0 
          };
        }
      }

      return { 
        blocked: attempts >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS,
        remainingAttempts: Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS - attempts)
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Default to allowing the attempt if there's an error checking
      return { blocked: false, remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
    }
  }

  async getEvents(limitCount: number = 100) {
    try {
      // Check if user is admin before allowing to fetch events
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Cannot fetch security events: User not authenticated');
        return [];
      }

      const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", currentUser.email)));
      const userData = userDoc.docs[0]?.data();
      
      if (!userData || userData.role !== 'system_admin') {
        console.error('Cannot fetch security events: User is not a system admin');
        return [];
      }

      const q = query(
        this.collectionRef,
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const events = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Raw Firestore document:', JSON.stringify(data, null, 2));

        // Convert Firestore Timestamp to ISO string if it exists
        let timestamp = new Date().toISOString();
        if (data.timestamp && typeof data.timestamp === 'object' && 'toDate' in data.timestamp) {
          timestamp = data.timestamp.toDate().toISOString();
        } else if (typeof data.timestamp === 'string') {
          timestamp = data.timestamp;
        }

        // Ensure event type is one of the defined types
        const eventType = Object.values(EVENT_TYPES).includes(data.eventType as EventType)
          ? data.eventType as EventType
          : EVENT_TYPES.SUSPICIOUS_ACTIVITY;

        const event = {
          id: doc.id,
          timestamp,
          eventType,
          details: data.details || this.getDefaultDetails(eventType),
          severity: data.severity || this.getDefaultSeverity(eventType),
          status: data.status || 'new',
          userId: data.userId,
          metadata: data.metadata || {}
        } as SecurityEvent;

        console.log('Transformed event:', JSON.stringify(event, null, 2));
        return event;
      });

      console.log('All transformed events:', JSON.stringify(events, null, 2));
      return events;
    } catch (error) {
      console.error('Error fetching security events:', error);
      throw error;
    }
  }

  private getDefaultDetails(eventType: EventType): string {
    switch (eventType) {
      case EVENT_TYPES.LOGIN_ATTEMPT:
        return 'User attempted to log in';
      case EVENT_TYPES.LOGIN_SUCCESS:
        return 'User logged in successfully';
      case EVENT_TYPES.LOGIN_FAILURE:
        return 'Failed login attempt';
      case EVENT_TYPES.PASSWORD_CHANGE:
        return 'User changed their password';
      case EVENT_TYPES.USER_DISABLED:
        return 'User account disabled';
      case EVENT_TYPES.USER_ENABLED:
        return 'User account enabled';
      case EVENT_TYPES.ROLE_CHANGE:
        return 'User permissions modified';
      case EVENT_TYPES.SUSPICIOUS_ACTIVITY:
        return 'Suspicious activity detected';
      default:
        return 'Security event detected';
    }
  }

  private getDefaultSeverity(eventType: EventType): SecurityEvent['severity'] {
    switch (eventType) {
      case EVENT_TYPES.LOGIN_FAILURE:
        return 'high';
      case EVENT_TYPES.SUSPICIOUS_ACTIVITY:
      case EVENT_TYPES.ROLE_CHANGE:
        return 'medium';
      case EVENT_TYPES.USER_DISABLED:
      case EVENT_TYPES.USER_ENABLED:
        return 'medium';
      case EVENT_TYPES.LOGIN_ATTEMPT:
      case EVENT_TYPES.LOGIN_SUCCESS:
      case EVENT_TYPES.PASSWORD_CHANGE:
        return 'low';
      default:
        return 'low';
    }
  }

  async logEvent(event: Omit<SecurityEvent, 'id'> & { eventType: EventType }) {
    try {
      console.log('Attempting to log security event:', JSON.stringify(event, null, 2));

      // For login attempts, check rate limiting
      if (event.eventType === EVENT_TYPES.LOGIN_ATTEMPT && event.userId) {
        const rateLimit = await this.checkRateLimit(event.userId);
        if (rateLimit.blocked) {
          console.warn(`Login blocked for user ${event.userId} due to rate limiting`);
          // Log the blocked attempt
          const blockedEvent = {
            ...event,
            eventType: EVENT_TYPES.LOGIN_FAILURE as EventType,
            details: 'Login blocked due to too many attempts',
            severity: 'critical' as const,
            metadata: {
              ...(event.metadata || {}),
              rateLimitExceeded: true,
              remainingAttempts: 0
            }
          };
          await this.logEvent(blockedEvent);
          throw new Error('Too many login attempts. Please try again later.');
        }

        // Add remaining attempts to metadata
        event.metadata = {
          ...(event.metadata || {}),
          remainingAttempts: rateLimit.remainingAttempts
        };
      }

      // Convert string timestamp to Firestore Timestamp
      let timestamp = Timestamp.now();
      if (typeof event.timestamp === 'string') {
        timestamp = Timestamp.fromDate(new Date(event.timestamp));
      }

      // Validate event type
      if (!Object.values(EVENT_TYPES).includes(event.eventType)) {
        console.error('Invalid event type:', event.eventType);
        console.error('Valid event types are:', Object.values(EVENT_TYPES));
        throw new Error(`Invalid event type: ${event.eventType}`);
      }

      // Get IP address
      const ipAddress = await this.fetchIpAddress();

      // Prepare event data with required fields
      const eventData = {
        timestamp,
        eventType: event.eventType,
        details: event.details || this.getDefaultDetails(event.eventType),
        severity: event.severity || this.getDefaultSeverity(event.eventType),
        status: 'new' as const,
        userId: event.userId || auth.currentUser?.uid || 'anonymous',
        metadata: {
          ...(event.metadata || {}),
          ipAddress,
          userAgent: window.navigator.userAgent,
          recordedAt: Timestamp.now(),
          recordedBy: auth.currentUser?.uid || 'system'
        }
      };

      // Validate the event data matches Firestore rules
      if (!eventData.details || typeof eventData.details !== 'string') {
        throw new Error('Event details must be a non-empty string');
      }

      if (!['low', 'medium', 'high', 'critical'].includes(eventData.severity)) {
        throw new Error(`Invalid severity: ${eventData.severity}`);
      }

      console.log('Validated event data:', eventData);
      const docRef = await addDoc(this.collectionRef, eventData);
      console.log('Successfully logged security event with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error logging security event:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  async updateEventStatus(eventId: string, status: SecurityEvent['status'], resolution?: string) {
    try {
      // Check if user is admin before allowing to update events
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Cannot update event status: User not authenticated');
        return;
      }

      const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", currentUser.email)));
      const userData = userDoc.docs[0]?.data();
      
      if (!userData || userData.role !== 'system_admin') {
        console.error('Cannot update event status: User is not a system admin');
        return;
      }

      const docRef = doc(this.collectionRef, eventId);
      const updateData = {
        status,
        ...(resolution && { resolution }),
        updatedAt: Timestamp.now()
      };
      console.log('Updating event status:', { eventId, updateData });
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating event status:', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string) {
    try {
      // Check if user is admin before allowing to delete events
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Cannot delete event: User not authenticated');
        return;
      }

      const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", currentUser.email)));
      const userData = userDoc.docs[0]?.data();
      
      if (!userData || userData.role !== 'system_admin') {
        console.error('Cannot delete event: User is not a system admin');
        return;
      }

      console.log('Deleting event:', eventId);
      const docRef = doc(this.collectionRef, eventId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  async deleteEvents(eventIds: string[]) {
    try {
      // Check if user is admin before allowing to delete events
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Cannot delete events: User not authenticated');
        return;
      }

      const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", currentUser.email)));
      const userData = userDoc.docs[0]?.data();
      
      if (!userData || userData.role !== 'system_admin') {
        console.error('Cannot delete events: User is not a system admin');
        return;
      }

      console.log('Deleting multiple events:', eventIds);
      await Promise.all(eventIds.map(id => this.deleteEvent(id)));
    } catch (error) {
      console.error('Error deleting events:', error);
      throw error;
    }
  }

  async cleanupOldEvents(retentionDays: number = 90) {
    try {
      // Check if user is admin before allowing to cleanup events
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Cannot cleanup events: User not authenticated');
        return;
      }

      const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", currentUser.email)));
      const userData = userDoc.docs[0]?.data();
      
      if (!userData || userData.role !== 'system_admin') {
        console.error('Cannot cleanup events: User is not a system admin');
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      console.log('Cleaning up events older than:', cutoffDate.toISOString());

      const q = query(
        this.collectionRef,
        where('timestamp', '<=', cutoffTimestamp),
        where('severity', 'not-in', ['high', 'critical']),
        where('status', 'in', ['resolved', 'dismissed'])
      );

      const snapshot = await getDocs(q);
      console.log('Found events to clean up:', snapshot.docs.length);
      await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
    } catch (error) {
      console.error('Error cleaning up old events:', error);
      throw error;
    }
  }

  public static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }
}

export const securityMonitoringService = SecurityMonitoringService.getInstance(); 