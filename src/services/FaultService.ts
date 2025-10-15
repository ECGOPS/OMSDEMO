import { OP5Fault, ControlSystemOutage } from '@/lib/types';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { COLLECTIONS } from '@/lib/constants';
import LoggingService from './LoggingService';

export class FaultService {
  private static instance: FaultService;
  private auth = getAuth();
  private loggingService: LoggingService;

  private constructor() {
    this.loggingService = LoggingService.getInstance();
  }

  public static getInstance(): FaultService {
    if (!FaultService.instance) {
      FaultService.instance = new FaultService();
    }
    return FaultService.instance;
  }

  private removeUndefinedFields(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  }

  private async getCurrentUser() {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      throw new Error('User data not found');
    }

    const userData = userDoc.data();
    return {
      ...user,
      role: userData.role || 'Unknown Role'
    };
  }

  private async ensureAuthenticated() {
    const user = this.auth.currentUser;
    if (!user) {
      // Try to get stored credentials from localStorage
      const storedEmail = localStorage.getItem('userEmail');
      const storedPassword = localStorage.getItem('userPassword');
      
      if (storedEmail && storedPassword) {
        try {
          await signInWithEmailAndPassword(this.auth, storedEmail, storedPassword);
        } catch (error) {
          console.error('Error re-authenticating:', error);
          throw new Error('Authentication failed');
        }
      } else {
        throw new Error('User not authenticated');
      }
    }
  }

  public async createOP5Fault(fault: Omit<OP5Fault, 'id'>): Promise<string> {
    try {
      await this.ensureAuthenticated();
      const user = await this.getCurrentUser();
      
      const cleanFault = this.removeUndefinedFields({
        ...fault,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        updatedBy: user.uid
      });
      
      const docRef = await addDoc(collection(db, COLLECTIONS.OP5_FAULTS), cleanFault);
      
      // Log the action
      await this.loggingService.logAction(
        user.uid,
        user.displayName || 'Unknown User',
        user.role || 'Unknown Role',
        "Create",
        "OP5Fault",
        docRef.id,
        `Created new OP5 fault for feeder ${fault.feeder || 'Unknown'}`,
        fault.region,
        fault.district
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating OP5 fault:', error);
      if (error instanceof Error) {
        if (error.message === 'User not authenticated' || 
            error.message === 'Authentication failed' ||
            error.message === 'Authentication token expired') {
          throw new Error('You must be logged in to create a fault');
        }
      }
      throw error;
    }
  }

  public async createControlSystemOutage(outage: Omit<ControlSystemOutage, 'id'>): Promise<string> {
    try {
      await this.ensureAuthenticated();
      const user = await this.getCurrentUser();
      
      const cleanOutage = this.removeUndefinedFields({
        ...outage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        updatedBy: user.uid
      });
      
      const docRef = await addDoc(collection(db, COLLECTIONS.CONTROL_OUTAGES), cleanOutage);
      
      // Log the action
      await this.loggingService.logAction(
        user.uid,
        user.displayName || 'Unknown User',
        user.role || 'Unknown Role',
        "Create",
        "Outage",
        docRef.id,
        `Created new control system outage for feeder ${outage.feederName || 'Unknown'}`,
        outage.region,
        outage.district
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating control system outage:', error);
      if (error instanceof Error) {
        if (error.message === 'User not authenticated' || 
            error.message === 'Authentication failed' ||
            error.message === 'Authentication token expired') {
          throw new Error('You must be logged in to create an outage');
        }
      }
      throw error;
    }
  }
} 