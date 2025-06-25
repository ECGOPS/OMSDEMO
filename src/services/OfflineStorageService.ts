import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { OP5Fault, ControlSystemOutage, VITAsset, VITInspectionChecklist } from '@/lib/types';
import { FaultService } from './FaultService';
import { getAuth } from 'firebase/auth';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';

interface PendingFault {
  key: string;
  fault: Omit<OP5Fault, 'id'> | Omit<ControlSystemOutage, 'id'>;
  timestamp: number;
  type: 'op5' | 'control';
  data: {
    fault: Omit<OP5Fault, 'id'> | Omit<ControlSystemOutage, 'id'>;
    timestamp: number;
    type: 'op5' | 'control';
  };
}

interface FaultDB extends DBSchema {
  pendingFaults: {
    key: string;
    value: PendingFault;
  };
}

type VITAssetData = VITAsset & {
  type: 'VIT';
  syncStatus: 'created' | 'updated' | 'deleted';
  createdAt: string;
  updatedAt: string;
};

type VITInspectionData = VITInspectionChecklist & {
  type: 'VIT';
  syncStatus: 'created' | 'updated' | 'deleted';
  createdAt: string;
  updatedAt: string;
};

interface VITDB extends DBSchema {
  pendingAssets: {
    key: string;
    value: {
      id: string;
      data: VITAssetData;
    };
  };
  pendingInspections: {
    key: string;
    value: {
      id: string;
      data: VITInspectionData;
    };
  };
}

interface FeederInfo {
  id: string;
  name: string;
  bspPss: string;
  region: string;
  district: string;
  regionId: string;
  districtId: string;
  voltageLevel: string;
  feederType: string;
}

interface FeederDB extends DBSchema {
  feeders: {
    key: string;
    value: FeederInfo;
  };
}

export class OfflineStorageService {
  private static instance: OfflineStorageService;
  private faultDB: IDBPDatabase<FaultDB> | null = null;
  private vitDB: IDBPDatabase<VITDB> | null = null;
  private feederDB: IDBPDatabase<FeederDB> | null = null;
  private faultDBName = 'faultStorage';
  private vitDBName = 'vitStorage';
  private feederDBName = 'feederStorage';
  private version = 1;
  private isSyncing: boolean = false;
  private syncQueue: Promise<void> = Promise.resolve();
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private faultService: FaultService;
  private dbInitialized: boolean = false;

  private constructor() {
    this.initializeDB();
    this.setupOnlineStatusListener();
    this.faultService = FaultService.getInstance();
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  public static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  private async initializeDB() {
    try {
      console.log('[OfflineStorage] Initializing IndexedDB...');
      this.faultDB = await openDB<FaultDB>(this.faultDBName, this.version, {
        upgrade(db) {
          console.log('[OfflineStorage] Upgrading database...');
          if (!db.objectStoreNames.contains('pendingFaults')) {
            console.log('[OfflineStorage] Creating pendingFaults store...');
            db.createObjectStore('pendingFaults', { keyPath: 'key' });
          }
        },
      });
      this.vitDB = await openDB<VITDB>(this.vitDBName, this.version, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('pendingAssets')) {
            db.createObjectStore('pendingAssets', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('pendingInspections')) {
            db.createObjectStore('pendingInspections', { keyPath: 'id' });
          }
        },
      });
      this.feederDB = await openDB<FeederDB>(this.feederDBName, this.version, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('feeders')) {
            db.createObjectStore('feeders', { keyPath: 'id' });
          }
        },
      });
      this.dbInitialized = true;
      console.log('[OfflineStorage] Database initialized successfully');
    } catch (error) {
      console.error('[OfflineStorage] Error initializing database:', error);
      throw error;
    }
  }

  private setupOnlineStatusListener() {
    window.addEventListener('online', () => {
      console.log('[OfflineStorage] Network connection restored');
      this.isOnline = true;
      this.syncPendingFaults();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineStorage] Network connection lost');
      this.isOnline = false;
    });
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.syncPendingFaults();
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  private async getCurrentUser() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Only try to refresh token if we're online
    if (this.isOnline) {
      try {
        await user.getIdToken(true);
      } catch (error) {
        console.error('Error refreshing token:', error);
        // Don't throw error if we're offline - just use the existing token
        if (this.isOnline) {
          throw new Error('Authentication token expired');
        }
      }
    }

    return user;
  }

  private async ensureAuthenticated() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      // Only try to re-authenticate if we're online
      if (this.isOnline) {
        // Instead of storing credentials, use Firebase's persistence
        try {
          // Firebase will handle re-authentication automatically
          await setPersistence(auth, browserLocalPersistence);
        } catch (error) {
          console.error('Error re-authenticating:', error);
          throw new Error('Authentication failed');
        }
      } else {
        // If we're offline and have no user, we can't proceed
        throw new Error('User not authenticated and offline');
      }
    }
  }

  public async saveFaultOffline(fault: Omit<OP5Fault, 'id'> | Omit<ControlSystemOutage, 'id'>, type: 'op5' | 'control'): Promise<void> {
    console.log('[OfflineStorage] Attempting to save fault offline...', { fault, type });
    
    if (!this.dbInitialized) {
      console.log('[OfflineStorage] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.faultDB) {
      console.error('[OfflineStorage] Database not available after initialization');
      throw new Error('Database not initialized');
    }

    const key = `fault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingFault: PendingFault = {
      key,
      fault,
      timestamp: Date.now(),
      type,
      data: {
        fault,
        timestamp: Date.now(),
        type
      }
    };

    try {
      console.log('[OfflineStorage] Saving fault with key:', key);
      await this.faultDB.add('pendingFaults', pendingFault);
      console.log('[OfflineStorage] Fault saved successfully');

      // Add to local state for immediate UI update
      if (type === 'op5') {
        const op5Fault = fault as Omit<OP5Fault, 'id'>;
        const newFault: OP5Fault & { isOnline: boolean; synced: boolean } = {
          ...op5Fault,
          id: key,
          isOnline: false,
          synced: false
        };
        // Update local state through event
        window.dispatchEvent(new CustomEvent('faultAdded', { 
          detail: { 
            fault: newFault, 
            type: 'op5',
            status: 'success'
          } 
        }));
      } else {
        const controlOutage = fault as Omit<ControlSystemOutage, 'id'>;
        const newOutage: ControlSystemOutage & { isOnline: boolean; synced: boolean } = {
          ...controlOutage,
          id: key,
          isOnline: false,
          synced: false
        };
        // Update local state through event
        window.dispatchEvent(new CustomEvent('faultAdded', { 
          detail: { 
            fault: newOutage, 
            type: 'control',
            status: 'success'
          } 
        }));
      }
    } catch (error) {
      console.error('[OfflineStorage] Error saving fault:', error);
      // Dispatch error event
      window.dispatchEvent(new CustomEvent('faultAdded', { 
        detail: { 
          error: error.message,
          type,
          status: 'error'
        } 
      }));
      throw error;
    }
  }

  public async getPendingFaults(): Promise<PendingFault[]> {
    console.log('[OfflineStorage] Getting pending faults...');
    
    if (!this.dbInitialized) {
      console.log('[OfflineStorage] Database not initialized, retrying initialization...');
      await this.initializeDB();
    }

    if (!this.faultDB) {
      console.error('[OfflineStorage] Database not available after initialization');
      throw new Error('Database not initialized');
    }

    try {
      const keys = await this.faultDB.getAllKeys('pendingFaults');
      const values = await this.faultDB.getAll('pendingFaults');
      
      console.log('[OfflineStorage] Found', keys.length, 'pending faults');
      
      return values.map((value, index) => ({
        key: keys[index],
        fault: value.data.fault,
        timestamp: value.data.timestamp,
        type: value.data.type,
        data: value.data
      }));
    } catch (error) {
      console.error('[OfflineStorage] Error getting pending faults:', error);
      throw error;
    }
  }

  public async removePendingFault(key: string): Promise<void> {
    console.log('[OfflineStorage] Removing pending fault:', key);
    
    if (!this.faultDB) {
      throw new Error('Database not initialized');
    }

    try {
      await this.faultDB.delete('pendingFaults', key);
      console.log('[OfflineStorage] Fault removed successfully');
    } catch (error) {
      console.error('[OfflineStorage] Error removing fault:', error);
      throw error;
    }
  }

  public async syncPendingFaults(): Promise<void> {
    console.log('[OfflineStorage] Starting sync of pending faults...');
    
    if (!this.isOnline || this.syncInProgress) {
      console.log('[OfflineStorage] Sync skipped - online:', this.isOnline, 'sync in progress:', this.syncInProgress);
      return;
    }

    this.syncInProgress = true;
    this.syncQueue = this.syncQueue.then(async () => {
      try {
        const pendingFaults = await this.getPendingFaults();
        console.log('[OfflineStorage] Found', pendingFaults.length, 'faults to sync');
        
        for (const { key, fault, type } of pendingFaults) {
          await this.syncFaultWithRetry(key, fault, type);
        }
      } finally {
        this.syncInProgress = false;
        console.log('[OfflineStorage] Sync completed');
      }
    });

    return this.syncQueue;
  }

  public isInternetAvailable(): boolean {
    return this.isOnline;
  }

  public async saveOP5FaultOffline(fault: Omit<OP5Fault, 'id'>): Promise<void> {
    try {
      // Get user info if available, but don't fail if we can't
      let userId = 'offline_user';
      try {
        await this.ensureAuthenticated();
        const user = await this.getCurrentUser();
        userId = user.uid;
      } catch (error) {
        console.warn('Could not get authenticated user, using offline_user:', error);
      }
      
      const offlineFault = {
        ...fault,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        updatedBy: userId,
        isOffline: true
      };

      await this.saveFaultOffline(offlineFault, 'op5');

      if (this.isOnline) {
        await this.syncPendingFaults();
      }
    } catch (error) {
      console.error('Error saving fault offline:', error);
      throw error;
    }
  }

  public async saveControlSystemOutageOffline(outage: Omit<ControlSystemOutage, 'id'>): Promise<void> {
    try {
      // Get user info if available, but don't fail if we can't
      let userId = 'offline_user';
      try {
        await this.ensureAuthenticated();
        const user = await this.getCurrentUser();
        userId = user.uid;
      } catch (error) {
        console.warn('Could not get authenticated user, using offline_user:', error);
      }
      
      const offlineOutage = {
        ...outage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        updatedBy: userId,
        isOffline: true
      };

      await this.saveFaultOffline(offlineOutage, 'control');

      if (this.isOnline) {
        await this.syncPendingFaults();
      }
    } catch (error) {
      console.error('Error saving outage offline:', error);
      throw error;
    }
  }

  private async syncFaultWithRetry(key: string, fault: any, type: 'op5' | 'control', retryCount = 0): Promise<boolean> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
      console.log(`[OfflineStorage] Attempting to sync fault ${key} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      // Get current user and ensure authentication
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.error('[OfflineStorage] No authenticated user found during sync');
        // Use Firebase's built-in persistence instead of stored credentials
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch (error) {
          console.error('[OfflineStorage] Failed to re-authenticate:', error);
          throw new Error('Authentication failed');
        }
      }

      // Force token refresh before sync
      try {
        const newToken = await currentUser.getIdToken(true);
        console.log('[OfflineStorage] Successfully refreshed token');
      } catch (error) {
        console.error('[OfflineStorage] Failed to refresh token:', error);
        // If token refresh fails, try to re-authenticate using Firebase persistence
        try {
          await setPersistence(auth, browserLocalPersistence);
          console.log('[OfflineStorage] Successfully re-authenticated');
        } catch (error) {
          console.error('[OfflineStorage] Failed to re-authenticate:', error);
          throw new Error('Authentication token expired');
        }
      }
      
      // Ensure we have a valid user after all authentication attempts
      const finalUser = auth.currentUser;
      if (!finalUser) {
        throw new Error('No authenticated user available after authentication attempts');
      }

      // Update the fault with the current user's ID
      const updatedFault = {
        ...fault,
        createdBy: finalUser.uid,
        updatedBy: finalUser.uid,
        updatedAt: new Date().toISOString()
      };
      
      if (type === 'op5') {
        await this.faultService.createOP5Fault(updatedFault as Omit<OP5Fault, 'id'>);
      } else {
        await this.faultService.createControlSystemOutage(updatedFault as Omit<ControlSystemOutage, 'id'>);
      }
      
      await this.removePendingFault(key);
      console.log(`[OfflineStorage] Successfully synced fault ${key}`);
      return true;
    } catch (error) {
      console.error(`[OfflineStorage] Failed to sync fault ${key}:`, error);
      
      // If it's an authentication error, don't retry
      if (error instanceof Error && 
          (error.message.includes('Authentication') || 
           error.message.includes('permission'))) {
        console.error('[OfflineStorage] Authentication error, not retrying');
        return false;
      }
      
      if (retryCount < maxRetries) {
        console.log(`[OfflineStorage] Retrying sync for fault ${key} in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.syncFaultWithRetry(key, fault, type, retryCount + 1);
      }
      
      return false;
    }
  }

  // Add VIT asset methods
  public async getPendingAssets(): Promise<Array<{ key: string; asset: VITAssetData }>> {
    try {
      const db = await this.getVITDB();
      const pendingAssets = await db.getAll('pendingAssets');
      return pendingAssets.map(item => ({
        key: item.id,
        asset: item.data
      }));
    } catch (error) {
      console.error('Error getting pending assets:', error);
      throw error;
    }
  }

  public async getPendingAsset(key: string): Promise<{ key: string; asset: VITAssetData }> {
    try {
      const db = await this.getVITDB();
      const asset = await db.get('pendingAssets', key);
      if (!asset) {
        throw new Error('Asset not found');
      }
      return {
        key,
        asset: asset.data
      };
    } catch (error) {
      console.error('Error getting pending asset:', error);
      throw error;
    }
  }

  public async removePendingAsset(key: string): Promise<void> {
    try {
      const db = await this.getVITDB();
      await db.delete('pendingAssets', key);
    } catch (error) {
      console.error('Error removing pending asset:', error);
      throw error;
    }
  }

  public async addPendingAsset(asset: VITAsset): Promise<string> {
    try {
      const db = await this.getVITDB();
      const key = crypto.randomUUID();
      const vitAssetData: VITAssetData = {
        ...asset,
        type: 'VIT',
        syncStatus: 'created',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.add('pendingAssets', {
        id: key,
        data: vitAssetData
      });
      return key;
    } catch (error) {
      console.error('Error adding pending asset:', error);
      throw error;
    }
  }

  public async updatePendingAsset(key: string, asset: VITAsset): Promise<void> {
    try {
      const db = await this.getVITDB();
      const existingAsset = await db.get('pendingAssets', key);
      if (!existingAsset) {
        throw new Error('Asset not found');
      }
      const vitAssetData: VITAssetData = {
        ...asset,
        type: 'VIT',
        syncStatus: 'updated',
        updatedAt: new Date().toISOString()
      };
      await db.put('pendingAssets', {
        id: key,
        data: vitAssetData
      });
    } catch (error) {
      console.error('Error updating pending asset:', error);
      throw error;
    }
  }

  private async getVITDB(): Promise<IDBPDatabase<VITDB>> {
    if (!this.vitDB) {
      await this.initializeDB();
    }
    if (!this.vitDB) {
      throw new Error('Database not initialized');
    }
    return this.vitDB;
  }

  // --- Feeder offline methods ---
  public async saveFeederOffline(feeder: FeederInfo): Promise<void> {
    if (!this.feederDB) await this.initializeDB();
    if (!this.feederDB) throw new Error('Feeder DB not initialized');
    await this.feederDB.put('feeders', feeder);
  }

  public async getOfflineFeeders(): Promise<FeederInfo[]> {
    if (!this.feederDB) await this.initializeDB();
    if (!this.feederDB) throw new Error('Feeder DB not initialized');
    return await this.feederDB.getAll('feeders');
  }

  public async removeOfflineFeeder(id: string): Promise<void> {
    if (!this.feederDB) await this.initializeDB();
    if (!this.feederDB) throw new Error('Feeder DB not initialized');
    await this.feederDB.delete('feeders', id);
  }
}

export default OfflineStorageService; 