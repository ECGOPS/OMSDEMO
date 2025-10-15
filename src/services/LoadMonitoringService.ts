import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { LoadMonitoringData } from '@/lib/asset-types';
import { getAuth } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from '@/components/ui/sonner';
import { getFirestore } from 'firebase/firestore';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface LoadMonitoringDB extends DBSchema {
  loadMonitoring: {
    key: string;
    value: PendingLoadMonitoring;
  };
}

export interface PendingLoadMonitoring {
  id: string;
  record: LoadMonitoringData;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
  retryCount: number;
}

export class LoadMonitoringService {
  private static instance: LoadMonitoringService;
  private db: IDBPDatabase<LoadMonitoringDB> | null = null;
  private isOnline: boolean = true;

  private constructor() {
    this.init();
    this.setupOnlineStatusListener();
  }

  public static getInstance(): LoadMonitoringService {
    if (!LoadMonitoringService.instance) {
      LoadMonitoringService.instance = new LoadMonitoringService();
    }
    return LoadMonitoringService.instance;
  }

  private async init() {
    try {
      this.db = await openDB<LoadMonitoringDB>('load-monitoring-offline', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('loadMonitoring')) {
            db.createObjectStore('loadMonitoring', { keyPath: 'id' });
          }
        },
      });
    } catch (error) {
      console.error('Error initializing LoadMonitoringService:', error);
    }
  }

  private setupOnlineStatusListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncLoadMonitoringRecords();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  public isInternetAvailable(): boolean {
    return this.isOnline;
  }

  public async saveLoadMonitoringOffline(record: Omit<LoadMonitoringData, 'id'>, action: 'create' | 'update' | 'delete'): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const offlineId = `offline_${Date.now()}`;
    const pendingRecord: PendingLoadMonitoring = {
      id: offlineId,
      record: {
        ...record,
        id: offlineId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      action,
      timestamp: Date.now(),
      retryCount: 0
    };

    await this.db.put('loadMonitoring', pendingRecord);

    // Dispatch event for UI update
    window.dispatchEvent(new CustomEvent('loadMonitoringRecordAdded', {
      detail: {
        record: pendingRecord.record,
        action,
        status: 'success'
      }
    }));
  }

  public async getPendingLoadMonitoringRecords(): Promise<PendingLoadMonitoring[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db.getAll('loadMonitoring');
  }

  public async removePendingLoadMonitoring(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.delete('loadMonitoring', id);
  }

  public async syncLoadMonitoringRecords(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    const pendingRecords = await this.getPendingLoadMonitoringRecords();
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    const db = getFirestore();

    for (const pending of pendingRecords) {
      try {
        switch (pending.action) {
          case 'create':
            await addDoc(collection(db, 'loadMonitoring'), {
              ...pending.record,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            break;

          case 'update':
            if (!pending.record.id) {
              throw new Error('Record ID is required for update');
            }
            await updateDoc(doc(db, 'loadMonitoring', pending.record.id), {
              ...pending.record,
              updatedAt: serverTimestamp()
            });
            break;

          case 'delete':
            if (!pending.record.id) {
              throw new Error('Record ID is required for delete');
            }
            await deleteDoc(doc(db, 'loadMonitoring', pending.record.id));
            break;
        }

        await this.removePendingLoadMonitoring(pending.id);
      } catch (error) {
        console.error('Error syncing load monitoring record:', error);
        
        // Increment retry count and update in IndexedDB
        pending.retryCount++;
        if (pending.retryCount < 3) {
          await this.db?.put('loadMonitoring', pending);
        } else {
          // Remove after 3 failed attempts
          await this.removePendingLoadMonitoring(pending.id);
        }
      }
    }
  }
} 