import { getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import type { VITAsset, VITInspectionChecklist } from '@/lib/types';
import { OfflineStorageService } from './OfflineStorageService';
import { OfflineInspectionService } from './OfflineInspectionService';
import { toast } from 'sonner';

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

function isVITInspectionData(obj: any): obj is VITInspectionData {
  return obj && obj.type === 'VIT' && typeof obj.vitAssetId === 'string' && typeof obj.syncStatus === 'string';
}

export class VITSyncService {
  private static instance: VITSyncService;
  private db = getFirestore();
  private offlineStorage = OfflineStorageService.getInstance();
  private offlineInspection = OfflineInspectionService.getInstance();
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncTimeout: NodeJS.Timeout | null = null;
  private syncLock: Promise<void> | null = null;
  private lastSyncTime: number = 0;
  private readonly SYNC_COOLDOWN = 5000; // 5 seconds cooldown between syncs
  private syncInProgress: boolean = false;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private processedAssets: Set<string> = new Set();
  private syncAttempts: Map<string, number> = new Map();
  private readonly MAX_SYNC_ATTEMPTS = 3;
  private syncPromise: Promise<void> | null = null;
  private syncLockPromise: Promise<void> | null = null;
  private syncLockResolve: ((value: void | PromiseLike<void>) => void) | null = null;
  private syncQueue: Promise<void> = Promise.resolve();
  private syncInProgressAssets: Set<string> = new Set();
  private lastSyncTrigger: number = 0;
  private readonly SYNC_DEBOUNCE = 2000; // 2 seconds debounce for sync triggers
  private syncStats = {
    totalWrites: 0,
    totalReads: 0,
    syncStartTime: 0,
    syncEndTime: 0,
    syncTriggers: [] as { timestamp: number; source: string }[],
    writeOperations: [] as { operation: string; assetId: string; timestamp: number }[]
  };
  private offlineSyncState: Map<string, {
    lastSyncAttempt: number;
    syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
    retryCount: number;
  }> = new Map();

  private logSyncTrigger(source: string) {
    this.syncStats.syncTriggers.push({
      timestamp: Date.now(),
      source
    });
    console.log('[VITSync] Sync triggered:', {
      source,
      timestamp: new Date().toISOString(),
      totalTriggers: this.syncStats.syncTriggers.length,
      timeSinceLastSync: this.lastSyncTime ? Date.now() - this.lastSyncTime : 0
    });
  }

  private logWriteOperation(operation: string, assetId: string) {
    this.syncStats.writeOperations.push({
      operation,
      assetId,
      timestamp: Date.now()
    });
    this.syncStats.totalWrites++;
    console.log('[VITSync] Write operation:', {
      operation,
      assetId,
      timestamp: new Date().toISOString(),
      totalWrites: this.syncStats.totalWrites
    });
  }

  private logReadOperation() {
    this.syncStats.totalReads++;
    console.log('[VITSync] Read operation:', {
      timestamp: new Date().toISOString(),
      totalReads: this.syncStats.totalReads
    });
  }

  private resetSyncStats() {
    this.syncStats = {
      totalWrites: 0,
      totalReads: 0,
      syncStartTime: Date.now(),
      syncEndTime: 0,
      syncTriggers: [],
      writeOperations: []
    };
  }

  private logSyncStats() {
    this.syncStats.syncEndTime = Date.now();
    const duration = this.syncStats.syncEndTime - this.syncStats.syncStartTime;
    
    console.log('[VITSync] Sync statistics:', {
      duration: `${duration}ms`,
      totalWrites: this.syncStats.totalWrites,
      totalReads: this.syncStats.totalReads,
      syncTriggers: this.syncStats.syncTriggers.map(t => ({
        source: t.source,
        time: new Date(t.timestamp).toISOString()
      })),
      writeOperations: this.syncStats.writeOperations.map(w => ({
        operation: w.operation,
        assetId: w.assetId,
        time: new Date(w.timestamp).toISOString()
      })),
      timestamp: new Date().toISOString()
    });
  }

  private constructor() {
    // Set up online/offline listeners
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Register service worker
    this.registerServiceWorker();
  }

  private async registerServiceWorker() {
    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[VITSync] Service Worker registered');
      
      // Listen for sync events
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC') {
          this.handleSyncEvent(event.data);
        }
      });
    } catch (error) {
      console.error('[VITSync] Service Worker registration failed:', error);
    }
  }

  private async handleSyncEvent(data: any) {
    console.log('[VITSync] Received sync event:', data);
    
    // Skip if we're already syncing
    if (this.syncInProgress) {
      console.log('[VITSync] Sync already in progress, skipping');
      return;
    }

    // Debounce sync triggers
    const now = Date.now();
    if (now - this.lastSyncTrigger < this.SYNC_DEBOUNCE) {
      console.log('[VITSync] Skipping sync - too soon since last trigger', {
        lastTrigger: new Date(this.lastSyncTrigger).toISOString(),
        now: new Date(now).toISOString(),
        debounce: this.SYNC_DEBOUNCE
      });
      return;
    }
    this.lastSyncTrigger = now;
    
    // Add a small delay to ensure network is stable
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.syncAllVITData().catch(error => {
        console.error('[VITSync] Error syncing data:', error);
        toast.error('Failed to sync offline data. Please try again.');
      });
    }, 1000);
  }

  private handleOnline = async () => {
    console.log('[VITSync] Network connection restored');
    this.isOnline = true;
    
    try {
      await this.syncAllVITData();
      window.dispatchEvent(new CustomEvent('vitDataSynced', { 
        detail: { status: 'success' } 
      }));
    } catch (error: any) {
      console.error('[VITSync] Error syncing data after coming online:', error);
      window.dispatchEvent(new CustomEvent('vitDataSynced', { 
        detail: { 
          error: error?.message || 'Unknown error',
          status: 'error'
        } 
      }));
    }
  };

  private handleOffline = () => {
    console.log('[VITSync] Network connection lost');
    this.isOnline = false;
    toast.error("You are offline. Changes will be saved locally and synced when you're back online.");
  };

  public static getInstance(): VITSyncService {
    if (!VITSyncService.instance) {
      VITSyncService.instance = new VITSyncService();
    }
    return VITSyncService.instance;
  }

  private async acquireSyncLock(): Promise<void> {
    if (this.syncInProgress) {
      console.log('[VITSync] Sync already in progress, waiting for lock...');
      if (this.syncLockPromise) {
        await this.syncLockPromise;
      }
      return;
    }

    console.log('[VITSync] Acquiring sync lock');
    this.syncInProgress = true;
    
    // Create a new lock promise
    this.syncLockPromise = new Promise((resolve) => {
      this.syncLockResolve = resolve;
    });
  }

  private releaseSyncLock(): void {
    console.log('[VITSync] Releasing sync lock');
    this.syncInProgress = false;
    if (this.syncLockResolve) {
      this.syncLockResolve();
      this.syncLockResolve = null;
    }
    this.syncLockPromise = null;
    this.syncPromise = null;
    this.syncInProgressAssets.clear();
  }

  // Generate a unique UUID for an asset
  private generateAssetUUID(asset: VITAsset): string {
    const uniqueKey = `${asset.region}_${asset.district}_${asset.voltageLevel}_${asset.typeOfUnit}_${asset.serialNumber}`;
    return crypto.randomUUID();
  }

  private generateAssetUniqueId(asset: VITAsset): string {
    return `${asset.region}_${asset.district}_${asset.voltageLevel}_${asset.typeOfUnit}_${asset.serialNumber}`;
  }

  private async findExistingAsset(uniqueId: string): Promise<{ id: string; version: number; exists: boolean } | null> {
    this.logReadOperation();
    const vitAssetsRef = collection(this.db, 'vitAssets');
    const q = query(
      vitAssetsRef,
      where('region', '==', uniqueId.split('_')[0]),
      where('district', '==', uniqueId.split('_')[1]),
      where('voltageLevel', '==', uniqueId.split('_')[2]),
      where('typeOfUnit', '==', uniqueId.split('_')[3]),
      where('serialNumber', '==', uniqueId.split('_')[4])
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        version: doc.data().version || 0,
        exists: true
      };
    }
    return null;
  }

  private async updateOfflineSyncState(key: string, status: 'pending' | 'syncing' | 'completed' | 'failed') {
    const now = Date.now();
    const currentState = this.offlineSyncState.get(key) || { lastSyncAttempt: 0, syncStatus: 'pending', retryCount: 0 };
    
    this.offlineSyncState.set(key, {
      ...currentState,
      lastSyncAttempt: now,
      syncStatus: status,
      retryCount: status === 'failed' ? currentState.retryCount + 1 : currentState.retryCount
    });

    console.log('[VITSync] Updated offline sync state:', {
      key,
      status,
      retryCount: this.offlineSyncState.get(key)?.retryCount,
      timestamp: new Date(now).toISOString()
    });
  }

  public async syncVITAssets(): Promise<void> {
    try {
      console.log('[VITSync] Starting VIT assets sync...');
      const pendingAssets = await this.offlineStorage.getPendingAssets();
      console.log('[VITSync] Found', pendingAssets.length, 'pending assets to sync');
      
      const syncResults = {
        success: 0,
        failed: 0,
        errors: [] as { key: string; error: any; asset: any }[]
      };
      
      for (const { key, asset } of pendingAssets) {
        try {
          // Check offline sync state
          const syncState = this.offlineSyncState.get(key);
          if (syncState?.syncStatus === 'syncing') {
            console.log('[VITSync] Skipping asset - already syncing:', {
              key,
              id: asset.id,
              syncStatus: asset.syncStatus,
              lastAttempt: new Date(syncState.lastSyncAttempt).toISOString()
            });
            continue;
          }

          // Skip if already processed in this sync session
          if (this.processedAssets.has(key)) {
            console.log('[VITSync] Skipping already processed asset:', {
              key,
              id: asset.id,
              syncStatus: asset.syncStatus
            });
            continue;
          }

          // Update sync state to syncing
          await this.updateOfflineSyncState(key, 'syncing');

          const uniqueId = this.generateAssetUniqueId(asset);
          console.log('[VITSync] Processing asset:', {
            key,
            uniqueId,
            syncStatus: asset.syncStatus,
            retryCount: syncState?.retryCount || 0,
            timestamp: new Date().toISOString()
          });

          // Find existing asset by unique identifier
          const existingAsset = await this.findExistingAsset(uniqueId);
          const assetId = existingAsset?.id || asset.id || this.generateAssetUUID(asset);
          
          const vitAssetsRef = collection(this.db, 'vitAssets');
          const assetRef = doc(vitAssetsRef, assetId);
          
          try {
            if (asset.syncStatus === 'created' || asset.syncStatus === 'updated') {
              // Check if document exists
              const docSnapshot = await getDoc(assetRef);
              const exists = docSnapshot.exists();
              
              // Prepare the asset data
              const assetData = {
                ...asset,
                id: assetId,
                version: (existingAsset?.version || 0) + 1,
                updatedAt: new Date().toISOString(),
                ...(asset.syncStatus === 'created' && !exists && { createdAt: new Date().toISOString() })
              };
              
              console.log('[VITSync] Upserting asset:', {
                id: assetId,
                uniqueId,
                status: asset.syncStatus,
                exists,
                version: assetData.version,
                timestamp: new Date().toISOString()
              });
              
              if (exists) {
                // Update existing document
                await updateDoc(assetRef, assetData);
              } else {
                // Create new document
                await setDoc(assetRef, assetData);
              }
              
              // Remove from pending storage only after successful write
              await this.offlineStorage.removePendingAsset(key);
              this.processedAssets.add(key);
              await this.updateOfflineSyncState(key, 'completed');
              
              syncResults.success++;
              console.log('[VITSync] Successfully synced asset:', {
                key,
                id: assetId,
                uniqueId,
                syncStatus: asset.syncStatus,
                version: assetData.version,
                timestamp: new Date().toISOString()
              });
            } else if (asset.syncStatus === 'deleted') {
              if (existingAsset?.exists) {
                console.log('[VITSync] Deleting existing asset:', {
                  id: assetId,
                  uniqueId,
                  version: existingAsset.version,
                  timestamp: new Date().toISOString()
                });
                await deleteDoc(assetRef);
              }
              await this.offlineStorage.removePendingAsset(key);
              this.processedAssets.add(key);
              await this.updateOfflineSyncState(key, 'completed');
              
              syncResults.success++;
              console.log('[VITSync] Successfully deleted asset:', {
                key,
                id: assetId,
                uniqueId,
                version: existingAsset?.version,
                timestamp: new Date().toISOString()
              });
            }
          } catch (error) {
            console.error('[VITSync] Error processing asset:', { 
              key, 
              uniqueId,
              error: error.message,
              stack: error.stack,
              asset: {
                id: asset.id,
                syncStatus: asset.syncStatus,
                region: asset.region,
                district: asset.district,
                version: existingAsset?.version
              },
              timestamp: new Date().toISOString()
            });
            
            // Update sync state to failed
            await this.updateOfflineSyncState(key, 'failed');
            
            // If max retries reached, remove from pending
            const retryCount = (this.offlineSyncState.get(key)?.retryCount || 0);
            if (retryCount >= this.MAX_SYNC_ATTEMPTS) {
              console.log('[VITSync] Max retries reached, removing asset:', {
                key,
                uniqueId,
                retryCount,
                syncStatus: asset.syncStatus
              });
              await this.offlineStorage.removePendingAsset(key);
            }
            
            syncResults.failed++;
            syncResults.errors.push({ key, error, asset });
          }
        } catch (error) {
          console.error('[VITSync] Error in sync loop:', error);
          syncResults.failed++;
          syncResults.errors.push({ key, error, asset });
          await this.updateOfflineSyncState(key, 'failed');
        }
      }
      
      console.log('[VITSync] VIT assets sync completed:', {
        total: pendingAssets.length,
        success: syncResults.success,
        failed: syncResults.failed,
        errors: syncResults.errors.map(e => ({
          key: e.key,
          error: e.error.message,
          asset: {
            id: e.asset?.id,
            type: e.asset?.type,
            syncStatus: e.asset?.syncStatus,
            region: e.asset?.region,
            district: e.asset?.district
          }
        })),
        timestamp: new Date().toISOString()
      });
      
      if (syncResults.failed > 0) {
        const errorMessage = `${syncResults.failed} assets failed to sync:\n` + 
          syncResults.errors.map(e => 
            `- Asset ${e.key}: ${e.error.message} (${e.asset?.syncStatus || 'unknown status'})`
          ).join('\n');
        console.warn('[VITSync] Sync failures:', errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('[VITSync] Error syncing VIT assets:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      // Clear processed assets set after sync
      this.processedAssets.clear();
      console.log('[VITSync] Cleared processed assets set');
    }
  }

  // Sync VIT inspections
  public async syncVITInspections(): Promise<void> {
    try {
      console.log('[VITSync] Starting VIT inspections sync...');
      const pendingInspections = await this.offlineInspection.getPendingInspections();
      console.log('[VITSync] Found', pendingInspections.length, 'pending inspections to sync');
      
      for (const { key, inspection } of pendingInspections) {
        if (isVITInspectionData(inspection)) {
          const vitInspection = inspection;
          console.log('[VITSync] Processing inspection:', { key, syncStatus: vitInspection.syncStatus });
          
          try {
            if (vitInspection.syncStatus === 'created') {
              await this.syncNewVITInspection(vitInspection, key);
            } else if (vitInspection.syncStatus === 'updated') {
              await this.syncUpdatedVITInspection(vitInspection, key);
            } else if (vitInspection.syncStatus === 'deleted') {
              await this.syncDeletedVITInspection(key);
            }
          } catch (error) {
            console.error('[VITSync] Error processing inspection:', { key, error });
            // Don't throw here, continue with other inspections
          }
        }
      }
      console.log('[VITSync] VIT inspections sync completed');
    } catch (error) {
      console.error('[VITSync] Error syncing VIT inspections:', error);
      throw error;
    }
  }

  // Sync all VIT data
  public async syncAllVITData(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      console.log('[VITSync] Sync skipped - online:', this.isOnline, 'sync in progress:', this.syncInProgress);
      return;
    }

    this.syncInProgress = true;
    this.syncQueue = this.syncQueue.then(async () => {
      let successCount = 0;
      let errorCount = 0;
      
      try {
        const pendingAssets = await this.offlineStorage.getPendingAssets();
        console.log('[VITSync] Found', pendingAssets.length, 'assets to sync');
        
        for (const { key, asset } of pendingAssets) {
          try {
            const uniqueId = this.generateAssetUniqueId(asset);
            const existingAsset = await this.findExistingAsset(uniqueId);
            const assetId = existingAsset?.id || asset.id;
            
            const vitAssetsRef = collection(this.db, 'vitAssets');
            const assetRef = doc(vitAssetsRef, assetId);
            
            if (asset.syncStatus === 'created' || asset.syncStatus === 'updated') {
              await setDoc(assetRef, {
                ...asset,
                id: assetId,
                updatedAt: new Date().toISOString()
              });
            } else if (asset.syncStatus === 'deleted') {
              await deleteDoc(assetRef);
            }
            
            await this.offlineStorage.removePendingAsset(key);
            
            window.dispatchEvent(new CustomEvent('vitAssetSynced', { 
              detail: { key, status: 'success' } 
            }));
            
            successCount++;
            console.log(`[VITSync] Successfully synced asset ${key}`);
          } catch (error: any) {
            console.error(`[VITSync] Failed to sync asset ${key}:`, error);
            errorCount++;
            
            window.dispatchEvent(new CustomEvent('vitAssetSynced', { 
              detail: { 
                key,
                error: error?.message || 'Unknown error',
                status: 'error'
              } 
            }));
          }
        }
        
        // Dispatch final sync completion event
        const finalStatus = errorCount === 0 ? 'success' : 'partial';
        window.dispatchEvent(new CustomEvent('vitDataSynced', { 
          detail: { 
            status: finalStatus,
            successCount,
            errorCount,
            totalCount: pendingAssets.length
          } 
        }));
        
        console.log(`[VITSync] Sync completed: ${successCount} success, ${errorCount} errors`);
      } finally {
        this.syncInProgress = false;
        console.log('[VITSync] Sync process finished');
      }
    });

    return this.syncQueue;
  }

  private async syncNewVITInspection(inspection: VITInspectionData, offlineKey: string): Promise<void> {
    try {
      const vitInspectionsRef = collection(this.db, 'vitInspections');
      const newDocRef = doc(vitInspectionsRef);
      
      // Create new inspection with the generated ID
      const newInspection = {
        ...inspection,
        id: newDocRef.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await setDoc(newDocRef, newInspection);
      await this.offlineInspection.removePendingInspection(offlineKey);
    } catch (error) {
      console.error('Error syncing new VIT inspection:', error);
      throw error;
    }
  }

  private async syncUpdatedVITInspection(inspection: VITInspectionData, offlineKey: string): Promise<void> {
    try {
      const vitInspectionsRef = collection(this.db, 'vitInspections');
      const inspectionRef = doc(vitInspectionsRef, inspection.id);
      
      // Check if inspection exists
      const inspectionDoc = await getDoc(inspectionRef);
      if (!inspectionDoc.exists()) {
        throw new Error('Inspection not found');
      }
      
      // Update inspection
      await updateDoc(inspectionRef, {
        ...inspection,
        updatedAt: new Date()
      });
      
      await this.offlineInspection.removePendingInspection(offlineKey);
    } catch (error) {
      console.error('Error syncing updated VIT inspection:', error);
      throw error;
    }
  }

  private async syncDeletedVITInspection(offlineKey: string): Promise<void> {
    try {
      // const { inspection } = await this.offlineInspection.getPendingInspection(offlineKey);
      // TODO: If you need to get the inspection, implement getPendingInspection in OfflineInspectionService
      // For now, skip this step or handle as needed
      // const vitInspectionsRef = collection(this.db, 'vitInspections');
      // const inspectionRef = doc(vitInspectionsRef, inspection.id);
      // await deleteDoc(inspectionRef);
      // await this.offlineInspection.removePendingInspection(offlineKey);
    } catch (error) {
      console.error('Error syncing deleted VIT inspection:', error);
      throw error;
    }
  }

  private async updateRelatedInspections(oldAssetId: string, newAssetId: string): Promise<void> {
    try {
      const pendingInspections = await this.offlineInspection.getPendingInspections();
      for (const { key, inspection } of pendingInspections) {
        if (isVITInspectionData(inspection) && inspection.vitAssetId === oldAssetId) {
          const updatedInspection = {
            ...inspection,
            vitAssetId: newAssetId
          };
          // If you have updatePendingInspection, use it here. Otherwise, skip.
          // await this.offlineInspection.updatePendingInspection(key, updatedInspection);
        }
      }
    } catch (error) {
      console.error('Error updating related inspections:', error);
      throw error;
    }
  }

  public async addVITAsset(asset: Omit<VITAsset, "id">): Promise<string> {
    try {
      // Generate UUID for the asset
      const assetUUID = this.generateAssetUUID(asset as VITAsset);
      
      if (!this.isOnline) {
        console.log('[VITSync] Device is offline, saving asset locally');
        // Ensure the asset has the correct type and sync status
        const offlineAsset: VITAsset = {
          ...asset,
          id: assetUUID,
          type: 'VIT' as const,
          syncStatus: 'created' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        console.log('[VITSync] Saving offline asset:', offlineAsset);
        const key = await this.offlineStorage.addPendingAsset(offlineAsset);
        toast.success('Asset saved offline. Will sync when online.');
        return key;
      }

      console.log('[VITSync] Device is online, saving asset to Firestore');
      const vitAssetsRef = collection(this.db, 'vitAssets');
      const assetRef = doc(vitAssetsRef, assetUUID);
      
      const newAsset: VITAsset = {
        ...asset,
        id: assetUUID,
        type: 'VIT' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(assetRef, newAsset);
      toast.success('Asset saved successfully');
      return assetUUID;
    } catch (error: any) {
      console.error('[VITSync] Error adding VIT asset:', error);
      if (!this.isOnline) {
        // If we're offline and the error is due to that, save locally
        const assetUUID = this.generateAssetUUID(asset as VITAsset);
        const offlineAsset: VITAsset = {
          ...asset,
          id: assetUUID,
          type: 'VIT' as const,
          syncStatus: 'created' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const key = await this.offlineStorage.addPendingAsset(offlineAsset);
        toast.success('Asset saved offline. Will sync when online.');
        return key;
      }
      toast.error('Failed to save asset');
      throw error;
    }
  }

  public async updateVITAsset(asset: Partial<VITAsset> & { id: string }): Promise<void> {
    try {
      if (!this.isOnline) {
        console.log('[VITSync] Device is offline, updating asset locally');
        await this.offlineStorage.updatePendingAsset(asset.id, asset as VITAsset);
        toast.success('Asset updated offline. Will sync when online.');
        return;
      }

      console.log('[VITSync] Device is online, updating asset in Firestore');
      const vitAssetsRef = collection(this.db, 'vitAssets');
      const assetRef = doc(vitAssetsRef, asset.id);
      
      await updateDoc(assetRef, {
        ...asset,
        updatedAt: new Date().toISOString()
      });
      toast.success('Asset updated successfully');
    } catch (error: any) {
      console.error('[VITSync] Error updating VIT asset:', error);
      if (!this.isOnline) {
        await this.offlineStorage.updatePendingAsset(asset.id, asset as VITAsset);
        toast.success('Asset updated offline. Will sync when online.');
        return;
      }
      toast.error('Failed to update asset');
      throw error;
    }
  }

  public async deleteVITAsset(assetId: string): Promise<void> {
    try {
      if (!this.isOnline) {
        console.log('[VITSync] Device is offline, marking asset for deletion locally');
        const asset = await this.offlineStorage.getPendingAsset(assetId);
        if (asset) {
          await this.offlineStorage.updatePendingAsset(assetId, {
            ...asset.asset,
            syncStatus: 'deleted'
          });
          toast.success('Asset marked for deletion. Will sync when online.');
          return;
        }
      }

      console.log('[VITSync] Device is online, deleting asset from Firestore');
      const vitAssetsRef = collection(this.db, 'vitAssets');
      const assetRef = doc(vitAssetsRef, assetId);
      
      await deleteDoc(assetRef);
      toast.success('Asset deleted successfully');
    } catch (error: any) {
      console.error('[VITSync] Error deleting VIT asset:', error);
      if (!this.isOnline) {
        const asset = await this.offlineStorage.getPendingAsset(assetId);
        if (asset) {
          await this.offlineStorage.updatePendingAsset(assetId, {
            ...asset.asset,
            syncStatus: 'deleted'
          });
          toast.success('Asset marked for deletion. Will sync when online.');
          return;
        }
      }
      toast.error('Failed to delete asset');
      throw error;
    }
  }

  public async getPendingVITAssets(): Promise<VITAsset[]> {
    try {
      const pendingAssets = await this.offlineStorage.getPendingAssets();
      return pendingAssets
        .filter(({ asset }) => asset.type === 'VIT')
        .map(({ key, asset }) => ({
          ...asset,
          id: key
        }));
    } catch (error: any) {
      console.error('[VITSync] Error getting pending VIT assets:', error);
      return [];
    }
  }
} 