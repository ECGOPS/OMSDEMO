import { db } from "@/config/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { toast } from "@/components/ui/sonner";
import { getAuth, User } from "firebase/auth";
import { PermissionService } from "./PermissionService";
import { UserRole } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

export interface SMSNotification {
  phoneNumber: string;
  message: string;
  faultId?: string;
  faultType?: string;
  location?: string;
}

interface SMSResponse {
  data: {
    success: boolean;
    messageId?: string;
    error?: string;
    details?: any;
  }
}

interface CustomUser extends User {
  role?: UserRole;
}

export class SMSService {
  private static instance: SMSService;
  private smsLogsCollection = collection(db, "sms_logs");
  private functions = getFunctions();
  private maxRetries = 1;
  private retryDelay = 1000;
  private auth = getAuth();
  private permissionService = PermissionService.getInstance();
  private smsEndpoint = 'https://us-central1-omss-30595.cloudfunctions.net/sendSMS';

  private constructor() {}

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send a custom SMS notification with retry logic
   */
  public async sendNotification(notification: SMSNotification): Promise<void> {
    let lastError: any;
    
    // Get the current user's token
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to send SMS');
    }

    // Get user's role from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    const userRole = userData?.role as UserRole;

    // Debug logging
    console.log('Current user:', {
      uid: user.uid,
      role: userRole,
      email: user.email
    });

    // Check if user has permission to send SMS
    const hasPermission = this.permissionService.canAccessFeature(userRole || '', 'sms_notification');
    console.log('SMS permission check:', {
      userRole,
      hasPermission,
    });

    if (!hasPermission) {
      throw new Error('User does not have permission to send SMS notifications');
    }
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Get the current user's token
        const token = await user.getIdToken();

        // Call the Cloud Function to send SMS
        const response = await fetch(this.smsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            phoneNumber: notification.phoneNumber,
            message: notification.message,
            faultId: notification.faultId,
            faultType: notification.faultType
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'SMS service returned unsuccessful response');
        }

        const result = await response.json();

        // Log the successful SMS attempt
        await addDoc(this.smsLogsCollection, {
          ...notification,
          status: 'sent',
          messageId: result.messageId,
          timestamp: serverTimestamp(),
          attempt
        });

        return; // Success, exit the retry loop
      } catch (error) {
        lastError = error;
        console.error(`SMS attempt ${attempt} failed:`, error);
        
        // Log the failed attempt
        await addDoc(this.smsLogsCollection, {
          ...notification,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: serverTimestamp(),
          attempt
        });

        if (attempt < this.maxRetries) {
          // Wait before retrying
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    // If we get here, all retries failed
    throw new Error(`Failed to send SMS after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Send a fault resolution notification
   */
  public async sendFaultResolutionNotification(
    phoneNumber: string,
    faultId: string,
    faultType: string,
    location: string
  ): Promise<void> {
    const message = `Your reported fault (ID: ${faultId}) at ${location} has been resolved. Thank you for your patience. If you have any further concerns, please contact us on 0302 611 611.`;
    
    try {
      await this.sendNotification({
        phoneNumber,
        message,
        faultId,
        faultType,
        location
      });
    } catch (error) {
      console.error('Error sending fault resolution notification:', error);
      toast.error('Failed to send SMS notification. Please try again later.');
      throw error;
    }
  }

  /**
   * Send a fault report notification
   */
  public async sendFaultReportNotification(
    phoneNumber: string,
    faultId: string,
    faultType: string,
    location: string
  ): Promise<void> {
    const message = `Your fault report (ID: ${faultId}) at ${location} has been received. Our team will investigate the ${faultType} issue.`;
    
    await this.sendNotification({
      phoneNumber,
      message,
      faultId,
      faultType,
      location
    });
  }

  /**
   * Send a maintenance notification
   */
  public async sendMaintenanceNotification(
    phoneNumber: string,
    location: string,
    scheduledTime: string,
    duration: string
  ): Promise<void> {
    const message = `Scheduled maintenance at ${location} on ${scheduledTime}. Expected duration: ${duration}. We apologize for any inconvenience.`;
    
    await this.sendNotification({
      phoneNumber,
      message,
      location
    });
  }

  /**
   * Send an emergency notification
   */
  public async sendEmergencyNotification(
    phoneNumber: string,
    location: string,
    emergencyType: string,
    instructions: string
  ): Promise<void> {
    const message = `EMERGENCY ALERT: ${emergencyType} at ${location}. ${instructions}`;
    
    await this.sendNotification({
      phoneNumber,
      message,
      location
    });
  }
} 