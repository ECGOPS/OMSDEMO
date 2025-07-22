import { db } from "@/config/firebase";
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp, setDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";

export interface UserLog {
  id?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: Date;
  region?: string;
  district?: string;
}

class LoggingService {
  private static instance: LoggingService;
  private loggingEnabled: boolean = true;
  private initialized: boolean = false;

  private constructor() {
    this.initializeCollection();
  }

  private async initializeCollection() {
    if (this.initialized) return;

    try {
      // Simply mark as initialized without creating test document
      this.initialized = true;
      console.log('Successfully initialized userLogs collection');
    } catch (error) {
      console.error('Error initializing userLogs collection:', error);
      // Don't throw the error, just log it
      // The collection might already exist or be created on first use
    }
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  public disableLogging(): void {
    this.loggingEnabled = false;
    console.log('Logging disabled');
  }

  public enableLogging(): void {
    this.loggingEnabled = true;
    console.log('Logging enabled');
  }

  async logAction(
    userId: string,
    userName: string,
    userRole: string,
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    region?: string,
    district?: string
  ): Promise<void> {
    console.log('[LoggingService] Starting logAction with params:', {
      loggingEnabled: this.loggingEnabled,
      userId,
      userName,
      userRole,
      action,
      entityType,
      entityId,
      details,
      region,
      district
    });

    if (!this.loggingEnabled) {
      console.log('[LoggingService] Logging is disabled, skipping log action');
      return;
    }

    if (!userId || !userName || !userRole) {
      console.error('[LoggingService] Missing required user information for logging:', { userId, userName, userRole });
      return;
    }
    
    try {
      const logData: Omit<UserLog, "id"> = {
        userId,
        userName,
        userRole,
        action,
        entityType,
        entityId,
        details,
        timestamp: new Date(),
        region,
        district
      };

      // Remove undefined fields from logData
      const cleanedLogData = Object.fromEntries(
        Object.entries(logData).filter(([_, v]) => v !== undefined)
      );

      console.log('[LoggingService] Attempting to add document to Firestore with data:', cleanedLogData);
      const docRef = await addDoc(collection(db, "userLogs"), cleanedLogData);
      console.log('[LoggingService] Successfully logged action with ID:', docRef.id);
    } catch (error) {
      console.error("[LoggingService] Error logging user action:", error);
      if (error instanceof Error) {
        console.error('[LoggingService] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      // Re-throw the error to be handled by the caller
      throw error;
    }
  }

  async getLogs(
    startDate?: Date,
    endDate?: Date,
    userId?: string,
    action?: string,
    entityType?: string
  ): Promise<UserLog[]> {
    try {
      let q = collection(db, "userLogs");
      const constraints = [];

      if (startDate) {
        constraints.push(where("timestamp", ">=", startDate));
      }
      if (endDate) {
        constraints.push(where("timestamp", "<=", endDate));
      }
      if (userId) {
        constraints.push(where("userId", "==", userId));
      }
      if (action) {
        constraints.push(where("action", "==", action));
      }
      if (entityType) {
        constraints.push(where("entityType", "==", entityType));
      }

      constraints.push(orderBy("timestamp", "desc"));

      const querySnapshot = await getDocs(query(q, ...constraints));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      })) as UserLog[];
    } catch (error) {
      console.error("Error fetching logs:", error);
      return [];
    }
  }

  async deleteAllLogs(): Promise<void> {
    try {
      const logsRef = collection(db, "userLogs");
      const querySnapshot = await getDocs(logsRef);
      
      // Delete each document in a batch
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log("Successfully deleted all logs");
    } catch (error) {
      console.error("Error deleting all logs:", error);
      throw error;
    }
  }
}

export default LoggingService; 