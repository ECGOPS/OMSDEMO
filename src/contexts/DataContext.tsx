import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/components/ui/sonner";
import {
  Region,
  District,
  OP5Fault,
  ControlSystemOutage,
  VITAsset,
  VITInspectionChecklist,
  VoltageLevel,
  VITStatus,
  YesNoOption,
  GoodBadOption,
  FaultType,
  InspectionItem,
  AffectedPopulation,
  ReliabilityIndices,
  NetworkInspection,
  ConditionStatus
} from "@/lib/types";
import { LoadMonitoringData, SubstationInspection } from "@/lib/asset-types";
import { calculateUnservedEnergy, calculateOutageDuration, calculateMTTR } from "@/utils/calculations";
import { PermissionService } from '@/services/PermissionService';
import { db } from "@/config/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  getDoc,
  setDoc,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  limit,
  startAfter,
  getCountFromServer
} from "firebase/firestore";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { 
  StoreName,
  safeAddItem, 
  safeUpdateItem, 
  safeDeleteItem, 
  safeGetAllItems, 
  safeGetItem, 
  safeClearStore, 
  addToPendingSync, 
  getPendingSyncItems, 
  clearPendingSyncItem, 
  addItem, 
  updateItem, 
  deleteItem, 
  initDB 
} from '../utils/db';
import { openDB } from "idb";
import { deleteDB } from "idb";
import { FaultService } from '@/services/FaultService';
import { LoadMonitoringService } from '@/services/LoadMonitoringService';
import { SubstationInspectionService } from '@/services/SubstationInspectionService';
import { syncPendingChanges } from '@/utils/sync';
import { getAllItems } from "@/lib/indexedDB";
import { SMSService } from "@/services/SMSService";
import { VITSyncService } from "@/services/VITSyncService";
import LoggingService from "@/services/LoggingService";
import { COLLECTIONS } from '@/lib/constants';
import { FeederService } from '@/services/FeederService';

const DB_NAME = 'ecg-nms-db';
const DB_VERSION = 4;  // Update from 3 to 4

// Define store name constants
const STORE_NAMES = {
  OP5_FAULTS: 'op5Faults' as StoreName,
  OP5_FAULTS_CACHE: 'op5Faults-cache' as StoreName,
  CONTROL_OUTAGES: 'controlOutages' as StoreName,
  CONTROL_OUTAGES_CACHE: 'controlOutages-cache' as StoreName,
  VIT_ASSETS: 'vitAssets' as StoreName,
  VIT_ASSETS_CACHE: 'vitAssets-cache' as StoreName,
  VIT_INSPECTIONS: 'vitInspections' as StoreName,
  VIT_INSPECTIONS_CACHE: 'vitInspections-cache' as StoreName,
  LOAD_MONITORING: 'loadMonitoring' as StoreName,
  LOAD_MONITORING_CACHE: 'loadMonitoring-cache' as StoreName,
  SUBSTATION_INSPECTIONS: 'substationInspections' as StoreName,
  SUBSTATION_INSPECTIONS_CACHE: 'substationInspections-cache' as StoreName,
  OVERHEAD_LINE_INSPECTIONS: 'overheadLineInspections' as StoreName,
  OVERHEAD_LINE_INSPECTIONS_CACHE: 'overheadLineInspections-cache' as StoreName,
  PENDING_SYNC: 'pending-sync' as StoreName,
  DISTRICTS: 'districts' as StoreName,
  DISTRICTS_CACHE: 'districts-cache' as StoreName,
  REGIONS: 'regions' as StoreName,
  REGIONS_CACHE: 'regions-cache' as StoreName,
  DEVICES: 'devices' as StoreName,
  DEVICES_CACHE: 'devices-cache' as StoreName,
  PERMISSIONS: 'permissions' as StoreName,
  PERMISSIONS_CACHE: 'permissions-cache' as StoreName,
  STAFF_IDS: 'staffIds' as StoreName,
  STAFF_IDS_CACHE: 'staffIds-cache' as StoreName,
  SYSTEM: 'system' as StoreName,
  SYSTEM_CACHE: 'system-cache' as StoreName,
  USERS: 'users' as StoreName,
  USERS_CACHE: 'users-cache' as StoreName
} as const;

// Add clearStore function
async function clearStore(storeName: StoreName) {
  const db = await openDB(DB_NAME, DB_VERSION);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.clear();
  await tx.done;
}

// Add these utility functions at the top of the file
const withRetry = async (operation: () => Promise<any>, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        // Reinitialize DB connection
        await initDB();
      } else {
        throw error;
      }
    }
  }
  throw lastError;
};

const safeDBOperation = async (operation: () => Promise<any>) => {
  try {
    return await withRetry(operation);
  } catch (error) {
    console.error('Database operation failed:', error);
    // If we're offline, don't show error to user
    if (navigator.onLine) {
      toast.error('Database operation failed. Please try again.');
    }
    throw error;
  }
};

// Add these utility functions after the existing utility functions
async function mergeFirestoreAndOffline<T extends BaseRecord & { id: string; clientId?: string }>(
  storeName: StoreName,
  collectionName: string
): Promise<(T & { isOnline: boolean; synced: boolean })[]> {
  try {
    // Get Firestore data
    const snapshot = await getDocs(collection(db, collectionName));
    const firestoreData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];

    // Get offline data
    const offlineData = await safeGetAllItems<T>(storeName);
    
    // Get pending sync items
    const pendingItems = await getPendingSyncItems();
    const pendingDeletes = new Set(
      pendingItems
        .filter(item => item.type === storeName && item.action === 'delete')
        .map(item => item.data.id)
    );
    
    const pendingUpdates = new Map(
      pendingItems
        .filter(item => item.type === storeName && item.action === 'update')
        .map(item => [item.data.id, item.data])
    );

    const recordMap = new Map<string, T & { isOnline: boolean; synced: boolean }>();

    // First add Firestore records
    firestoreData.forEach(item => {
      // Skip if this record is pending deletion
      if (pendingDeletes.has(item.id)) {
        return;
      }

      // Check if there's a pending update for this record
      const pendingUpdate = pendingUpdates.get(item.id);
      if (pendingUpdate) {
        // Use the pending update instead of the Firestore record
        recordMap.set(`offline_${item.id}`, {
          ...pendingUpdate as T,
          isOnline: false,
          synced: false
        });
      } else {
        recordMap.set(`online_${item.id}`, {
          ...item,
          isOnline: true,
          synced: true
        });
      }
    });

    // Then add offline records that aren't in Firestore
    offlineData.forEach(item => {
      // Skip if this record is pending deletion
      if (pendingDeletes.has(item.id)) {
        return;
      }

      // If the record isn't in the map yet, add it
      if (!recordMap.has(`online_${item.id}`)) {
        recordMap.set(`offline_${item.id}`, {
          ...item,
          isOnline: false,
          synced: false
        });
      }
    });

    return Array.from(recordMap.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error(`Error merging data for ${storeName}:`, error);
    throw error;
  }
}

async function clearCacheAndUpdateState<T extends BaseRecord & { id: string; clientId?: string }>(
  storeName: StoreName,
  collectionName: string,
  setState: React.Dispatch<React.SetStateAction<(T & { isOnline: boolean; synced: boolean })[]>>
) {
  try {
    // Clear the cache
    await clearStore(storeName);
    
    // Get merged data
    const mergedData = await mergeFirestoreAndOffline<T>(storeName, collectionName);
    
    // Update state
    setState(mergedData);
    
    // Update cache with merged data
    for (const item of mergedData) {
      await safeAddItem(storeName, item);
    }
  } catch (error) {
    console.error(`Error clearing cache and updating state for ${storeName}:`, error);
    throw error;
  }
}

export interface DataContextType {
  regions: Region[];
  districts: District[];
  regionsLoading: boolean;
  districtsLoading: boolean;
  regionsError: string | null;
  districtsError: string | null;
  retryRegionsAndDistricts: () => Promise<void>;
  op5Faults: OP5Fault[];
  controlSystemOutages: ControlSystemOutage[];
  addOP5Fault: (fault: Omit<OP5Fault, "id">) => Promise<string>;
  updateOP5Fault: (id: string, data: Partial<OP5Fault>) => Promise<void>;
  deleteOP5Fault: (id: string) => Promise<void>;
  addControlSystemOutage: (outage: Omit<ControlSystemOutage, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => Promise<string>;
  updateControlSystemOutage: (id: string, data: Partial<ControlSystemOutage>) => Promise<void>;
  deleteControlSystemOutage: (id: string) => Promise<void>;
  canResolveFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  getFilteredFaults: (regionId?: string, districtId?: string) => { op5Faults: OP5Fault[]; controlOutages: ControlSystemOutage[] };
  resolveFault: (id: string, isOP5: boolean, restorationDate: string) => Promise<void>;
  deleteFault: (id: string, isOP5: boolean) => Promise<void>;
  canEditFault: (fault: OP5Fault | ControlSystemOutage) => boolean;
  loadMonitoringRecords?: LoadMonitoringData[];
  setLoadMonitoringRecords: React.Dispatch<React.SetStateAction<LoadMonitoringData[] | undefined>>;
  saveLoadMonitoringRecord: (record: Omit<LoadMonitoringData, "id">) => Promise<string>;
  getLoadMonitoringRecord: (id: string) => Promise<LoadMonitoringData | undefined>;
  updateLoadMonitoringRecord: (id: string, data: Partial<LoadMonitoringData>) => Promise<void>;
  deleteLoadMonitoringRecord: (id: string) => Promise<void>;
  initializeLoadMonitoring: () => Promise<void>;
  vitAssets: VITAsset[];
  vitInspections: VITInspectionChecklist[];
  addVITAsset: (asset: Omit<VITAsset, "id">) => Promise<string>;
  updateVITAsset: (id: string, updates: Partial<VITAsset>) => Promise<void>;
  deleteVITAsset: (id: string) => Promise<void>;
  addVITInspection: (inspection: Omit<VITInspectionChecklist, "id">) => Promise<string>;
  updateVITInspection: (id: string, updates: Partial<VITInspectionChecklist>) => Promise<void>;
  deleteVITInspection: (id: string) => Promise<void>;
  savedInspections: SubstationInspection[];
  setSavedInspections: React.Dispatch<React.SetStateAction<SubstationInspection[]>>;
  saveInspection: (inspection: SubstationInspection) => Promise<string>;
  updateSubstationInspection: (id: string, updates: Partial<SubstationInspection>) => Promise<void>;
  deleteInspection: (id: string) => Promise<void>;
  updateDistrict: (id: string, updates: Partial<District>) => Promise<void>;
  canEditAsset: (asset: VITAsset) => boolean;
  canEditInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  canDeleteAsset: (asset: VITAsset) => boolean;
  canDeleteInspection: (inspection: VITInspectionChecklist | SubstationInspection) => boolean;
  setVITAssets: React.Dispatch<React.SetStateAction<VITAsset[]>>;
  setVITInspections: React.Dispatch<React.SetStateAction<VITInspectionChecklist[]>>;
  getSavedInspection: (id: string) => SubstationInspection | undefined;
  canAddAsset: (regionName: string, districtName: string) => boolean;
  canAddInspection: (regionId: string, districtId: string) => boolean;
  getOP5FaultById: (id: string) => OP5Fault | undefined;
  networkInspections: NetworkInspection[];
  addNetworkInspection: (inspection: Omit<NetworkInspection, "id">) => Promise<string>;
  updateNetworkInspection: (id: string, updates: Partial<NetworkInspection>) => Promise<void>;
  deleteNetworkInspection: (id: string) => Promise<void>;
  canEditLoadMonitoring: boolean;
  canDeleteLoadMonitoring: boolean;
  refreshInspections: () => Promise<void>;
}

export const DataContext = createContext<DataContextType>({
  regions: [],
  districts: [],
  regionsLoading: true,
  districtsLoading: true,
  regionsError: null,
  districtsError: null,
  retryRegionsAndDistricts: () => Promise.resolve(),
  op5Faults: [],
  controlSystemOutages: [],
  addOP5Fault: async () => '',
  updateOP5Fault: async () => {},
  deleteOP5Fault: async () => {},
  addControlSystemOutage: async () => '',
  updateControlSystemOutage: async () => {},
  deleteControlSystemOutage: async () => {},
  canResolveFault: () => false,
  getFilteredFaults: () => ({ op5Faults: [], controlOutages: [] }),
  resolveFault: async () => {},
  deleteFault: async () => {},
  canEditFault: () => false,
  loadMonitoringRecords: undefined,
  setLoadMonitoringRecords: () => {},
  saveLoadMonitoringRecord: async () => '',
  getLoadMonitoringRecord: async () => undefined,
  updateLoadMonitoringRecord: async () => {},
  deleteLoadMonitoringRecord: async () => {},
  initializeLoadMonitoring: async () => {},
  vitAssets: [],
  vitInspections: [],
  addVITAsset: async (asset: Omit<VITAsset, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "vitAssets"), {
        ...asset,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding VIT asset:", error);
      toast.error("Failed to add asset");
      throw error;
    }
  },
  updateVITAsset: async (id: string, updates: Partial<VITAsset>) => {
    try {
      const docRef = doc(db, "vitAssets", id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating VIT asset:", error);
      toast.error("Failed to update asset");
      throw error;
    }
  },
  deleteVITAsset: async (id: string) => {
    try {
      // Get the asset data before deleting
      const asset = vitAssets.find(a => a.id === id);
      if (!asset) {
        throw new Error("VIT asset not found");
      }

      // Delete the asset
      await vitSyncService.deleteVITAsset(id);

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[Delete] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id,
          serialNumber: asset.serialNumber,
          region: asset.region,
          district: asset.district
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Delete",
          "VITAsset",
          id,
          `Deleted VIT asset ${asset.serialNumber} in ${asset.region}${asset.district ? `, ${asset.district}` : ''}`,
          asset.region,
          asset.district
        );
      }
    } catch (error) {
      console.error("Error deleting VIT asset:", error);
      throw error;
    }
  },
  addVITInspection: async (inspection: Omit<VITInspectionChecklist, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "vitInspections"), {
        ...inspection,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding VIT inspection:", error);
      toast.error("Failed to add inspection");
      throw error;
    }
  },
  updateVITInspection: async (id: string, updates: Partial<VITInspectionChecklist>) => {
    try {
      const docRef = doc(db, "vitInspections", id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating VIT inspection:", error);
      toast.error("Failed to update inspection");
      throw error;
    }
  },
  deleteVITInspection: async (id: string) => {
    try {
      const docRef = doc(db, "vitInspections", id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting VIT inspection:", error);
      toast.error("Failed to delete inspection");
      throw error;
    }
  },
  savedInspections: [],
  setSavedInspections: () => {},
  saveInspection: async () => '',
  updateSubstationInspection: async () => {},
  deleteInspection: async () => {},
  updateDistrict: async () => {},
  canEditAsset: () => false,
  canEditInspection: () => false,
  canDeleteAsset: () => false,
  canDeleteInspection: () => false,
  setVITAssets: () => {},
  setVITInspections: () => {},
  getSavedInspection: () => undefined,
  canAddAsset: () => false,
  canAddInspection: () => false,
  getOP5FaultById: () => undefined,
  networkInspections: [],
  addNetworkInspection: async () => '',
  updateNetworkInspection: async () => {},
  deleteNetworkInspection: async () => {},
  canEditLoadMonitoring: false,
  canDeleteLoadMonitoring: false,
  refreshInspections: async () => {},
});

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Add after the imports and before the DataProvider component
const getCacheStoreName = (storeType: StoreName): StoreName => {
  switch (storeType) {
    case STORE_NAMES.OP5_FAULTS:
      return STORE_NAMES.OP5_FAULTS_CACHE;
    case STORE_NAMES.CONTROL_OUTAGES:
      return STORE_NAMES.CONTROL_OUTAGES_CACHE;
    case STORE_NAMES.LOAD_MONITORING:
      return STORE_NAMES.LOAD_MONITORING_CACHE;
    case STORE_NAMES.VIT_ASSETS:
      return STORE_NAMES.VIT_ASSETS_CACHE;
    case STORE_NAMES.VIT_INSPECTIONS:
      return STORE_NAMES.VIT_INSPECTIONS_CACHE;
    case STORE_NAMES.OVERHEAD_LINE_INSPECTIONS:
      return STORE_NAMES.OVERHEAD_LINE_INSPECTIONS_CACHE;
    default:
      throw new Error(`No cache store for store name: ${storeType}`);
  }
};

const collectionMap: Partial<Record<StoreName, string>> = {
  [STORE_NAMES.OP5_FAULTS]: 'op5Faults',
  [STORE_NAMES.CONTROL_OUTAGES]: 'controlOutages',
  [STORE_NAMES.LOAD_MONITORING]: 'loadMonitoring',
  [STORE_NAMES.VIT_ASSETS]: 'vitAssets',
  [STORE_NAMES.VIT_INSPECTIONS]: 'vitInspections',
  [STORE_NAMES.SUBSTATION_INSPECTIONS]: 'substationInspections',
  [STORE_NAMES.OVERHEAD_LINE_INSPECTIONS]: 'overheadLineInspections'
};

// Add this function after the existing utility functions
async function clearAndReinitializeDB() {
  try {
    console.log('=== CLEARING AND REINITIALIZING DATABASE ===');
    // Close the current database connection
    const db = await openDB(DB_NAME, DB_VERSION);
    await db.close();
    
    // Delete the database
    await deleteDB(DB_NAME);
    console.log('Database deleted');
    
    // Reinitialize the database
    await initDB();
    console.log('Database reinitialized');
    
    return true;
  } catch (error) {
    console.error('Error clearing and reinitializing database:', error);
    return false;
  }
}

// Add these types at the top of the file after imports
interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Add these utility functions
async function saveToFirebase<T extends DocumentData>(
  collectionName: string,
  data: T,
  isUpdate: boolean = false
): Promise<T> {
  try {
    if (isUpdate) {
      // Update existing document
      const docRef = doc(db, collectionName, data.id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return data;
    } else {
      // Create new document
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return {
        ...data,
        id: docRef.id
      };
    }
  } catch (error) {
    console.error('Error saving to Firebase:', error);
    throw error;
  }
}

async function saveToLocal<T extends BaseRecord>(
  storeName: StoreName,
  data: T
): Promise<T> {
  try {
    const localData = {
      ...data,
      syncStatus: 'local' as const,
      lastModified: Date.now()
    };
    await safeAddItem(storeName, localData);
    return localData;
  } catch (error) {
    console.error('Error saving to local storage:', error);
    throw error;
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [op5Faults, setOP5Faults] = useState<OP5Fault[]>([]);
  const [controlSystemOutages, setControlSystemOutages] = useState<ControlSystemOutage[]>([]);
  const [loadMonitoringRecords, setLoadMonitoringRecords] = useState<LoadMonitoringData[]>([]);
  const [vitAssets, setVITAssets] = useState<VITAsset[]>([]);
  const [vitInspections, setVITInspections] = useState<VITInspectionChecklist[]>([]);
  const [savedInspections, setSavedInspections] = useState<SubstationInspection[]>([]);
  const [networkInspections, setNetworkInspections] = useState<NetworkInspection[]>([]);
  const [canEditLoadMonitoring, setCanEditLoadMonitoring] = useState(false);
  const [canDeleteLoadMonitoring, setCanDeleteLoadMonitoring] = useState(false);
  const [isDBInitialized, setIsDBInitialized] = useState(false);
  const inspectionService = SubstationInspectionService.getInstance();
  const vitSyncService = VITSyncService.getInstance();

  // OPTIMIZATION: Initialize IndexedDB in background (non-blocking)
  // This allows regions/districts to load immediately without waiting
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await initDB();
        setIsDBInitialized(true);
        console.log('IndexedDB initialized successfully in background');
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        // Don't show error to user - this is background initialization
        console.warn('IndexedDB initialization failed, but app will continue to work');
      }
    };

    // Don't await this - let it run in background
    initializeDatabase();
  }, []);

  // Only proceed with data operations after DB is initialized
  useEffect(() => {
    if (!isDBInitialized) return;

    // Add event listener for offline inspection updates
    const handleInspectionUpdate = (event: CustomEvent) => {
      const { action, inspection } = event.detail;
      console.log('Received inspection update:', action, inspection);

      setSavedInspections(prev => {
        let newInspections = [...prev];
        
        switch (action) {
          case 'create':
            newInspections = [...newInspections, inspection];
            break;
          case 'update':
            newInspections = newInspections.map(insp => 
              insp.id === inspection.id ? inspection : insp
            );
            break;
          case 'delete':
            newInspections = newInspections.filter(insp => insp.id !== inspection.id);
            break;
        }

        // Sort by updatedAt
        return newInspections.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    };

    window.addEventListener('substationInspectionUpdated', handleInspectionUpdate as EventListener);

    return () => {
      window.removeEventListener('substationInspectionUpdated', handleInspectionUpdate as EventListener);
    };
  }, [isDBInitialized]);

  // Load initial data only after DB is initialized
  useEffect(() => {
    if (!isDBInitialized) return;

    const loadInitialData = async () => {
      try {
        const inspectionService = SubstationInspectionService.getInstance();
        const feederService = FeederService.getInstance();
        const offlineRecords = await inspectionService.getOfflineSubstationInspections();
        console.log('Initial offline records loaded:', offlineRecords.length);
        
        // Preload feeders for offline use
        try {
          await feederService.preloadFeeders();
          console.log('Feeders preloaded for offline use');
        } catch (error) {
          console.error('Error preloading feeders:', error);
        }
        
        if (navigator.onLine && user) {  // Check for user authentication
          // If online, get Firestore data and merge
          let q = query(collection(db, "substationInspections"), orderBy("createdAt", "desc"));
          
          // Apply role-based filtering
          if (user.role !== "system_admin" && user.role !== "global_engineer") {
            if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
              const userDistrict = districts.find(d => d.name === user.district);
              const userRegion = regions.find(r => r.name === user.region);
              if (userDistrict && userRegion) {
                q = query(
                  collection(db, "substationInspections"),
                  where("districtId", "==", userDistrict.id),
                  where("regionId", "==", userRegion.id),
                  orderBy("createdAt", "desc")
                );
              }
            } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
              const userRegion = regions.find(r => r.name === user.region);
              if (userRegion) {
                q = query(
                  collection(db, "substationInspections"),
                  where("regionId", "==", userRegion.id),
                  orderBy("createdAt", "desc")
                );
              }
            }
          }

          const snapshot = await getDocs(q);
          const firestoreRecords = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
              syncStatus: 'synced'
            } as SubstationInspection;
          });

          // Create a map of all records by ID
          const recordMap = new Map<string, SubstationInspection>();
          
          // Add Firestore records to map
          firestoreRecords.forEach(record => {
            recordMap.set(record.id, record);
          });

          // Add offline records that aren't in Firestore
          offlineRecords.forEach(record => {
            if (!recordMap.has(record.id)) {
              recordMap.set(record.id, record);
            }
          });

          // Convert map to array and sort by updatedAt
          const allRecords = Array.from(recordMap.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          
          setSavedInspections(allRecords);
        } else {
          // If offline or not authenticated, just use offline records
          setSavedInspections(offlineRecords);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (error.code === 'permission-denied') {
          toast.error('You do not have permission to access this data');
        } else {
          toast.error('Failed to load initial data');
        }
      }
    };

    loadInitialData();
  }, [isDBInitialized, user]); // OPTIMIZATION: Remove districts, regions to prevent circular dependencies

  // OPTIMIZED: Fetch regions and districts with parallel loading and no connection reset
  const fetchRegionsAndDistricts = async (retryAttempt = 0) => {
    try {
      setRegionsLoading(true);
      setDistrictsLoading(true);
      setRegionsError(null);
      setDistrictsError(null);

      // OPTIMIZATION: Load both collections in parallel instead of sequentially
      const [regionsSnapshot, districtsSnapshot] = await Promise.all([
        getDocs(collection(db, "regions")),
        getDocs(collection(db, "districts"))
      ]);

      const regionsList = regionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Region[];

      const districtsList = districtsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as District[];

      setRegions(regionsList);
      setDistricts(districtsList);
      setRegionsLoading(false);
      setDistrictsLoading(false);
      
      console.log("Regions and districts loaded in parallel:", {
        regions: regionsList.length,
        districts: districtsList.length
      });
      
      // Reset retry count on success
      setRetryCount(0);
    } catch (error: any) {
      console.error("Error fetching regions and districts:", error);
      
      // OPTIMIZATION: Simplified retry logic without expensive connection reset
      if (retryAttempt < MAX_RETRIES) {
        console.log(`Retrying fetch (attempt ${retryAttempt + 1}/${MAX_RETRIES})...`);
        setRetryCount(retryAttempt + 1);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return fetchRegionsAndDistricts(retryAttempt + 1);
      }
      
      // If we've exhausted retries
      setRegionsError("Failed to load regions. Please try again.");
      setDistrictsError("Failed to load districts. Please try again.");
      setRegionsLoading(false);
      setDistrictsLoading(false);
      
      toast.error("Failed to load regions and districts. Please refresh the page.");
    }
  };

  // OPTIMIZATION: Load regions and districts immediately after user authentication
  // Don't wait for IndexedDB initialization - this is the biggest performance improvement
  useEffect(() => {
    if (user) {
      console.log("User authenticated, loading regions and districts immediately...");
      fetchRegionsAndDistricts();
    }
  }, [user]);

  // Subscribe to regions in real-time
  useEffect(() => {
    if (!user || regions.length === 0) return;

    let q = query(collection(db, "regions"));
    
    // Apply role-based filtering
    if (user.role === "regional_engineer" || user.role === "district_engineer") {
      q = query(collection(db, "regions"), where("name", "==", user.region));
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const regionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Region[];
        setRegions(regionsData);
      },
      (error) => {
        console.error("Error in regions snapshot:", error);
        setRegionsError("Failed to update regions in real-time.");
      }
    );

    return () => unsubscribe();
  }, [user, regions.length]);

  // Subscribe to districts in real-time
  useEffect(() => {
    if (!user || districts.length === 0) return;

    let q = query(collection(db, "districts"));
    
    // Apply role-based filtering
    if (user.role === "district_engineer" || user.role === "regional_engineer") {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        q = query(collection(db, "districts"), where("regionId", "==", userRegion.id));
      }
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const districtsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as District[];
        setDistricts(districtsData);
      },
      (error) => {
        console.error("Error in districts snapshot:", error);
        setDistrictsError("Failed to update districts in real-time.");
      }
    );

    return () => unsubscribe();
  }, [user, regions, districts.length]);

  // Subscribe to VIT assets
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "vitAssets"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        q = query(collection(db, "vitAssets"), where("district", "==", user.district));
      } else if (
        user.role === "regional_engineer" ||
        user.role === "regional_general_manager" ||
        user.role === "project_engineer" // <-- Added project_engineer here
      ) {
        q = query(collection(db, "vitAssets"), where("region", "==", user.region));
      }
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        // Get Firestore data
        const firestoreAssets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as VITAsset[];

        // Only get offline data if we're offline or if there are no Firestore assets
        let pendingAssets: VITAsset[] = [];
        if (!navigator.onLine || firestoreAssets.length === 0) {
          pendingAssets = await vitSyncService.getPendingVITAssets();
        }
        
        // Merge Firestore and offline data with duplicate prevention
        const assetMap = new Map<string, VITAsset>();
        
        // Add Firestore assets first (these take precedence)
        firestoreAssets.forEach(asset => {
          assetMap.set(asset.id, asset);
        });
        
        // Add pending assets only if they're not already in Firestore
        // Use a more robust duplicate detection based on unique identifiers
        const firestoreAssetIds = new Set(firestoreAssets.map(asset => asset.id));
        const firestoreAssetKeys = new Set(
          firestoreAssets.map(asset => 
            `${asset.serialNumber}_${asset.region}_${asset.district}`
          )
        );
        
        pendingAssets.forEach(asset => {
          const assetKey = `${asset.serialNumber}_${asset.region}_${asset.district}`;
          
          // Only add if not already in Firestore by ID or unique key
          if (!firestoreAssetIds.has(asset.id) && !firestoreAssetKeys.has(assetKey)) {
            assetMap.set(asset.id, asset);
          }
        });
        
        // Convert map to array and update state
        const mergedAssets = Array.from(assetMap.values());
        console.log('[DataContext] VIT assets updated:', {
          firestoreCount: firestoreAssets.length,
          pendingCount: pendingAssets.length,
          mergedCount: mergedAssets.length,
          isOnline: navigator.onLine
        });
        setVITAssets(mergedAssets);
      } catch (error) {
        console.error("Error updating VIT assets:", error);
        toast.error("Error updating assets list");
      }
    });

    return () => unsubscribe();
  }, [user, vitSyncService]);

  // Subscribe to OP5 faults
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "op5Faults"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          q = query(collection(db, "op5Faults"), where("districtId", "==", userDistrict.id));
        }
      } else if (user.role === "regional_engineer") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(collection(db, "op5Faults"), where("regionId", "==", userRegion.id));
        }
      }
    }

    console.log('[DataContext] Setting up OP5 faults subscription');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        console.log('[DataContext] OP5 faults snapshot update received.', { docChanges: snapshot.docChanges().map(change => ({ type: change.type, docId: change.doc.id })) });
        const faults = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as OP5Fault[];
        
        // Update state with Firestore data
        console.log('[DataContext] OP5 faults after mapping:', faults.length, 'faults');
        setOP5Faults(faults);
      } catch (error) {
        console.error('[DataContext] Error updating OP5 faults:', error);
        toast.error("Error updating faults list");
      }
    });

    return () => {
      console.log('[DataContext] Cleaning up OP5 faults subscription');
      unsubscribe();
    };
  }, [user, regions, districts]);

  // Subscribe to control outages
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "controlOutages"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        const userDistrict = districts.find(d => d.name === user.district);
        if (userDistrict) {
          q = query(collection(db, "controlOutages"), where("districtId", "==", userDistrict.id));
        }
      } else if (user.role === "regional_engineer") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(collection(db, "controlOutages"), where("regionId", "==", userRegion.id));
        }
      }
    }

    console.log('[DataContext] Setting up control outages subscription');
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        console.log('[DataContext] Control outages snapshot update received.', { docChanges: snapshot.docChanges().map(change => ({ type: change.type, docId: change.doc.id })) });
        // Get Firestore data (online)
        const firestoreData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ControlSystemOutage[];

        console.log('[DataContext] Control outages firestore data:', firestoreData.length, 'outages');

        // Update state directly with Firestore data
        setControlSystemOutages(firestoreData);
        console.log('[DataContext] Control outages state updated directly from Firestore:', firestoreData.length, 'outages');
      } catch (error) {
        console.error('[DataContext] Error updating control outages:', error);
        if (navigator.onLine) {
          toast.error("Error updating outages list");
        }
      }
    });

    return () => {
      console.log('[DataContext] Cleaning up control outages subscription');
      unsubscribe();
    };
  }, [user, regions, districts]);

  // Subscribe to VIT inspections
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "vitInspections"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician") {
        q = query(collection(db, "vitInspections"), where("district", "==", user.district));
      } else if (user.role === "regional_engineer" || user.role === "project_engineer") {
        q = query(collection(db, "vitInspections"), where("region", "==", user.region));
      }
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const inspections = snapshot.docs.map(doc => {
        const data = doc.data();
        // Preserve timestamps from Firestore
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        } as VITInspectionChecklist;
      });
      setVITInspections(inspections);
      // Cache to IndexedDB
      for (const inspection of inspections) {
        try {
          await safeAddItem(STORE_NAMES.VIT_INSPECTIONS_CACHE, inspection);
        } catch (e) {
          // Ignore duplicate errors
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Merged offline view effect for VIT inspections
  useEffect(() => {
    async function loadMergedOfflineInspections() {
      if (!navigator.onLine) {
        const cache = await safeGetAllItems<VITInspectionChecklist>(STORE_NAMES.VIT_INSPECTIONS_CACHE);
        const unsynced = await safeGetAllItems<VITInspectionChecklist>(STORE_NAMES.VIT_INSPECTIONS);
        const pendingDeletes = (await getPendingSyncItems())
          .filter(item => item.type === STORE_NAMES.VIT_INSPECTIONS && item.action === "delete")
          .map(item => item.data.id);

        // Create a map of cached items
        const cacheMap = new Map(cache.map(item => [item.id, item]));
        
        // Merge unsynced items that are not in cache and not pending delete
        const mergedInspections = [
          ...cache,
          ...unsynced.filter(item => 
            !cacheMap.has(item.id) && !pendingDeletes.includes(item.id)
          )
        ];

        setVITInspections(mergedInspections);
      }
    }
    loadMergedOfflineInspections();
    window.addEventListener("offline", loadMergedOfflineInspections);
    return () => {
      window.removeEventListener("offline", loadMergedOfflineInspections);
    };
  }, []);

  // Subscribe to substation inspections
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "substationInspections"), orderBy("createdAt", "desc"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        const userDistrict = districts.find(d => d.name === user.district);
        const userRegion = regions.find(r => r.name === user.region);
        if (userDistrict && userRegion) {
          q = query(
            collection(db, "substationInspections"),
            where("districtId", "==", userDistrict.id),
            where("regionId", "==", userRegion.id),
            orderBy("createdAt", "desc")
          );
        }
      } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(
            collection(db, "substationInspections"),
            where("regionId", "==", userRegion.id),
            orderBy("createdAt", "desc")
          );
        }
      }
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const inspections = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
          } as SubstationInspection;
        });
        setSavedInspections(inspections);
      } catch (error) {
        console.error("Error updating substation inspections:", error);
        toast.error("Error updating inspections list");
      }
    });

    return () => unsubscribe();
  }, [user, regions, districts]);

  // Add this after other useEffect hooks
  useEffect(() => {
    if (!user) return;

    // Create query with proper sorting by createdAt (which includes date and time)
    let q = query(
      collection(db, "overheadLineInspections"),
      orderBy("createdAt", "desc")
    );

    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        q = query(
          collection(db, "overheadLineInspections"),
          where("district", "==", user.district),
          orderBy("createdAt", "desc")
        );
      } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        q = query(
          collection(db, "overheadLineInspections"),
          where("region", "==", user.region),
          orderBy("createdAt", "desc")
        );
      }
    }

    console.log('[DataContext] Overhead line inspections query:', {
      role: user.role,
      district: user.district,
      region: user.region
    });

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const inspections = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as NetworkInspection[];
        setNetworkInspections(inspections);
      },
      (error) => {
        console.error("Error fetching overhead line inspections:", error);
        toast.error("Failed to load network inspections");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Add OP5 fault functions
  const addOP5Fault = async (fault: Omit<OP5Fault, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "op5Faults"), {
        ...fault,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding OP5 fault:", error);
      toast.error("Failed to add fault");
      throw error;
    }
  };

  const updateOP5Fault = async (id: string, data: Partial<OP5Fault>) => {
    try {
      const faultRef = doc(db, "op5Faults", id);
      await updateDoc(faultRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success("Fault updated successfully");
    } catch (error) {
      console.error("Error updating OP5 fault:", error);
      toast.error("Failed to update fault");
    }
  };

  const deleteOP5Fault = async (id: string) => {
    try {
      if (!user?.uid || !user?.name || !user?.role) {
        console.error("[Delete] User authentication required:", { user });
        toast.error("Authentication required. Please log in again.");
        return;
      }

      // Get the fault data before deleting
      const faultRef = doc(db, "op5Faults", id);
      const faultDoc = await getDoc(faultRef);
      if (!faultDoc.exists()) {
        throw new Error("Fault not found");
      }
      const faultData = faultDoc.data();

      // Delete the fault
      await deleteDoc(faultRef);

      // Log the action
      console.log("[Delete] LoggingService.logAction will be called with:", {
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        id,
        feeder: faultData.feeder,
        region: faultData.region,
        district: faultData.district
      });
      const loggingService = LoggingService.getInstance();
      await loggingService.logAction(
        user.uid,
        user.name,
        user.role,
        "Delete",
        "Outage",
        id,
        `Deleted OP5 fault for feeder ${faultData.feeder || 'Unknown'}`,
        faultData.region,
        faultData.district
      );

      toast.success("OP5 Fault deleted successfully");
    } catch (error) {
      console.error("[Delete] Error during delete or logging:", error);
      toast.error("Failed to delete fault. Please try again.");
      throw error;
    }
  };

  // Add control system outage functions
  const addControlSystemOutage = async (outage: Omit<ControlSystemOutage, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
    try {
      const docRef = await addDoc(collection(db, "controlOutages"), {
        ...outage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.id || 'unknown',
        updatedBy: user?.id || 'unknown'
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding control system outage:", error);
      toast.error("Failed to add outage");
      throw error;
    }
  };

  const updateControlSystemOutage = async (id: string, data: Partial<ControlSystemOutage>) => {
    try {
      // Get the outage data before updating
      const outageRef = doc(db, "controlOutages", id);
      const outageDoc = await getDoc(outageRef);
      if (!outageDoc.exists()) {
        throw new Error("Outage not found");
      }
      const outageData = outageDoc.data();

      // Update the outage
      await updateDoc(outageRef, {
        ...data,
        updatedAt: serverTimestamp()
      });

      // Log the action
      if (user?.id && user?.name && user?.role) {
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.id,
          user.name,
          user.role,
          "Update",
          "Outage",
          id,
          `Updated control system outage for feeder ${outageData.feederName || 'Unknown'}`,
          outageData.region,
          outageData.district
        );
      }

      toast.success("Outage updated successfully");
    } catch (error) {
      console.error("Error updating control system outage:", error);
      toast.error("Failed to update outage");
    }
  };

  const deleteControlSystemOutage = async (id: string) => {
    try {
      if (!user?.uid || !user?.name || !user?.role) {
        console.error("[Delete] User authentication required:", { user });
        toast.error("Authentication required. Please log in again.");
        return;
      }

      // Get the outage data before deleting
      const outageRef = doc(db, "controlOutages", id);
      const outageDoc = await getDoc(outageRef);
      if (!outageDoc.exists()) {
        throw new Error("Outage not found");
      }
      const outageData = outageDoc.data();

      // Delete the outage
      await deleteDoc(outageRef);

      // Log the action
      console.log("[Delete] LoggingService.logAction will be called with:", {
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        id,
        feeder: outageData.feeder,
        region: outageData.region,
        district: outageData.district
      });
      const loggingService = LoggingService.getInstance();
      await loggingService.logAction(
        user.uid,
        user.name,
        user.role,
        "Delete",
        "Outage",
        id,
        `Deleted control system outage for feeder ${outageData.feeder || 'Unknown'}`,
        outageData.region,
        outageData.district
      );

      toast.success("Outage deleted successfully");
    } catch (error) {
      console.error("[Delete] Error during delete or logging:", error);
      toast.error("Failed to delete outage. Please try again.");
      throw error;
    }
  };

  // Add fault utility functions
  const canResolveFault = useCallback((fault: OP5Fault | ControlSystemOutage) => {
    if (!user) return false;
    return PermissionService.getInstance().canAccessFeature(user.role, 'fault_resolution');
  }, [user]);

  const getFilteredFaults = useCallback((regionId?: string, districtId?: string) => {
    let filteredOP5Faults = [...op5Faults];
    let filteredControlOutages = [...controlSystemOutages];

    if (regionId) {
      filteredOP5Faults = filteredOP5Faults.filter(fault => fault.regionId === regionId);
      filteredControlOutages = filteredControlOutages.filter(outage => outage.regionId === regionId);
    }

    if (districtId) {
      filteredOP5Faults = filteredOP5Faults.filter(fault => fault.districtId === districtId);
      filteredControlOutages = filteredControlOutages.filter(outage => outage.districtId === districtId);
    }

    return {
      op5Faults: filteredOP5Faults,
      controlOutages: filteredControlOutages
    };
  }, [op5Faults, controlSystemOutages]);

  const resolveFault = useCallback(async (id: string, isOP5: boolean, restorationDate: string) => {
    try {
      const updateData = {
        status: "resolved" as const,
        restorationDate,
        updatedAt: serverTimestamp()
      };
      
      const collectionName = isOP5 ? "op5Faults" : "controlOutages";
      const docRef = doc(db, collectionName, id);
      
      // Get the fault data before updating
      const faultDoc = await getDoc(docRef);
      if (!faultDoc.exists()) {
        throw new Error("Fault not found");
      }
      
      const faultData = faultDoc.data();
      
      // Update the fault status
      await updateDoc(docRef, updateData);
      
      // Send SMS notification if phone number exists
      if (faultData.customerPhoneNumber || faultData.alternativePhoneNumber) {
        const smsService = SMSService.getInstance();
        const phoneNumber = faultData.customerPhoneNumber || faultData.alternativePhoneNumber;
        const location = faultData.substationName || faultData.areasAffected || "your location";
        
        try {
          await smsService.sendFaultResolutionNotification(
            phoneNumber,
            id,
            faultData.faultType || "power outage",
            location
          );
        } catch (smsError) {
          console.error("Error sending SMS notification:", smsError);
          // Don't throw the error as the fault is already resolved
          toast.error("Fault resolved but failed to send SMS notification");
        }
      }
      
      toast.success(`${isOP5 ? "OP5 Fault" : "Control System Outage"} resolved successfully`);
    } catch (error) {
      console.error("Error resolving fault:", error);
      toast.error("Failed to resolve fault");
    }
  }, []);

  const deleteFault = useCallback(async (id: string, isOP5: boolean) => {
    if (!user) {
      toast.error("User authentication required to delete faults.");
      console.error("[Delete] User authentication required:", { user });
      return;
    }
    try {
      if (isOP5) {
        await deleteOP5Fault(id);
      } else {
        await deleteControlSystemOutage(id);
      }
    } catch (error) {
      console.error("Error deleting fault:", error);
      toast.error("Failed to delete fault");
    }
  }, [user]);

  // Add load monitoring functions
  const saveLoadMonitoringRecord = async (record: Omit<LoadMonitoringData, "id">) => {
    try {
      const docRef = await addDoc(collection(db, "loadMonitoring"), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error saving load monitoring record:", error);
      toast.error("Failed to save record");
      throw error;
    }
  };

  const getLoadMonitoringRecord = async (id: string) => {
    try {
      const docRef = doc(db, "loadMonitoring", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as LoadMonitoringData;
      }
      return undefined;
    } catch (error) {
      console.error("Error getting load monitoring record:", error);
      toast.error("Failed to get record");
      throw error;
    }
  };

  const updateLoadMonitoringRecord = async (id: string, data: Partial<LoadMonitoringData>) => {
    try {
      const docRef = doc(db, "loadMonitoring", id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      toast.success("Record updated successfully");
    } catch (error) {
      console.error("Error updating load monitoring record:", error);
      toast.error("Failed to update record");
      throw error;
    }
  };

  const deleteLoadMonitoringRecord = async (id: string) => {
    try {
      // Get the record data before deleting
      const docRef = doc(db, "loadMonitoring", id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Load monitoring record not found");
      }
      const recordData = docSnap.data();

      await deleteDoc(docRef);

      // Log the action
      if (user?.uid && user?.name && user?.role) {
        console.log("[Delete] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id,
          substationName: recordData.substationName,
          substationNumber: recordData.substationNumber,
          region: recordData.region,
          district: recordData.district
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Delete",
          "LoadMonitoring",
          id,
          `Deleted load monitoring record for substation ${recordData.substationName} (${recordData.substationNumber}) in ${recordData.region}${recordData.district ? `, ${recordData.district}` : ''}`,
          recordData.region,
          recordData.district
        );
      }

      toast.success("Record deleted successfully");
    } catch (error) {
      console.error("Error deleting load monitoring record:", error);
      toast.error("Failed to delete record");
      throw error;
    }
  };

  // Subscribe to load monitoring records
  useEffect(() => {
    if (!user) return;

    let q = query(collection(db, "loadMonitoring"));
    
    // Only apply filters if not system_admin or global_engineer
    if (user.role !== "system_admin" && user.role !== "global_engineer") {
      if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
        const userDistrict = districts.find(d => d.name === user.district);
        const userRegion = regions.find(r => r.name === user.region);
        if (userDistrict && userRegion) {
          q = query(
            collection(db, "loadMonitoring"),
            where("districtId", "==", userDistrict.id),
            where("regionId", "==", userRegion.id)
          );
        }
      } else if (user.role === "regional_engineer" || user.role === "regional_general_manager") {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          q = query(
            collection(db, "loadMonitoring"),
            where("regionId", "==", userRegion.id)
          );
        }
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoadMonitoringData[];
      setLoadMonitoringRecords(records);
    });

    return () => unsubscribe();
  }, [user, regions, districts]);

  // Set permissions for load monitoring
  useEffect(() => {
    if (!user) return;
    const permissionService = PermissionService.getInstance();
    const updatePermissions = () => {
      const canEdit = permissionService.canUpdateFeature(user.role, "load_monitoring");
      const canDelete = permissionService.canDeleteFeature(user.role, "load_monitoring");
    setCanEditLoadMonitoring(canEdit);
    setCanDeleteLoadMonitoring(canDelete);
    };
    updatePermissions();
    // Listen for permission changes
    const unsubscribe = permissionService.listenToPermissions(updatePermissions);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const initializeLoadMonitoring = async () => {
    try {
      let q = query(collection(db, "loadMonitoring"));
      
      // Only apply filters if not system_admin or global_engineer
      if (user?.role !== "system_admin" && user?.role !== "global_engineer") {
        if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") {
          const userDistrict = districts.find(d => d.name === user.district);
          const userRegion = regions.find(r => r.name === user.region);
          if (userDistrict && userRegion) {
            q = query(
              collection(db, "loadMonitoring"),
              where("districtId", "==", userDistrict.id),
              where("regionId", "==", userRegion.id)
            );
          }
        } else if (user?.role === "regional_engineer" || user?.role === "regional_general_manager") {
          const userRegion = regions.find(r => r.name === user.region);
          if (userRegion) {
            q = query(
              collection(db, "loadMonitoring"),
              where("regionId", "==", userRegion.id)
            );
          }
        }
      }

      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoadMonitoringData[];
      setLoadMonitoringRecords(records);
    } catch (error) {
      console.error("Error initializing load monitoring:", error);
      toast.error("Failed to initialize load monitoring");
      throw error;
    }
  };

  // Add this function to actually update a district in Firestore
  const updateDistrict = async (id: string, updates: Partial<District>) => {
    try {
      // Get the district data before updating
      const districtRef = doc(db, "districts", id);
      const districtDoc = await getDoc(districtRef);
      if (!districtDoc.exists()) {
        throw new Error("District not found");
      }
      const districtData = districtDoc.data();

      // Update the district
      await updateDoc(districtRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      // Log the action if it's a population update
      if (updates.population && user?.uid && user?.name && user?.role) {
        console.log("[Update] LoggingService.logAction will be called with:", {
          userId: user.uid,
          userName: user.name,
          userRole: user.role,
          id,
          districtName: districtData.name,
          region: districtData.regionId,
          oldPopulation: districtData.population,
          newPopulation: updates.population
        });
        const loggingService = LoggingService.getInstance();
        await loggingService.logAction(
          user.uid,
          user.name,
          user.role,
          "Update",
          "DistrictPopulation",
          id,
          `Updated population for district ${districtData.name}`,
          districtData.regionId,
          districtData.name
        );
      }

      toast.success("District updated successfully");
      // Optionally update local state immediately for responsiveness
      setDistricts((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
        )
      );
    } catch (error) {
      console.error("Error updating district:", error);
      toast.error("Failed to update district");
      throw error;
    }
  };

  const saveInspection = async (inspection: SubstationInspection): Promise<string> => {
    try {
      // Get the inspection service instance
      const inspectionService = SubstationInspectionService.getInstance();
      
      // Save the inspection using the service
      await inspectionService.saveSubstationInspectionOffline(inspection, 'create');
      
      // Get all records after saving to ensure we have the latest state
      const allRecords = await inspectionService.getAllSubstationInspections();
      setSavedInspections(allRecords);
      
      // If online, trigger immediate sync
      if (navigator.onLine) {
        await inspectionService.triggerSyncAndRefresh();
      }
      
      return inspection.id;
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection");
      throw error;
    }
  };

  const getSavedInspection = (id: string): SubstationInspection | undefined => {
    if (!id) {
      console.error('getSavedInspection: No ID provided');
      return undefined;
    }
    const inspection = savedInspections.find(inspection => inspection.id === id);
    if (!inspection) {
      console.warn(`getSavedInspection: No inspection found with ID ${id}`);
    }
    return inspection;
  };

  const updateSubstationInspection = async (id: string, updates: Partial<SubstationInspection>) => {
    if (!id) {
      throw new Error('updateSubstationInspection: No ID provided');
    }
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('updateSubstationInspection: No updates provided');
    }

    try {
      // Get the inspection service instance
      const inspectionService = SubstationInspectionService.getInstance();
      
      // Get the existing inspection
      const existingInspection = savedInspections.find(inspection => inspection.id === id);
      if (!existingInspection) {
        throw new Error(`updateSubstationInspection: Inspection not found with ID ${id}`);
      }
      
      // Create updated inspection data by merging existing data with updates
      const updatedInspection: SubstationInspection = {
        ...existingInspection,
        ...updates,
        updatedAt: new Date().toISOString(),
        // Preserve category-specific items if they exist in updates
        siteCondition: updates.siteCondition || existingInspection.siteCondition,
        generalBuilding: updates.generalBuilding || existingInspection.generalBuilding,
        controlEquipment: updates.controlEquipment || existingInspection.controlEquipment,
        basement: updates.basement || existingInspection.basement,
        powerTransformer: updates.powerTransformer || existingInspection.powerTransformer,
        outdoorEquipment: updates.outdoorEquipment || existingInspection.outdoorEquipment,
        // Preserve other fields if they exist in updates
        region: updates.region || existingInspection.region,
        district: updates.district || existingInspection.district,
        substationName: updates.substationName || existingInspection.substationName,
        type: updates.type || existingInspection.type,
        location: updates.location || existingInspection.location,
        voltageLevel: updates.voltageLevel || existingInspection.voltageLevel,
        status: updates.status || existingInspection.status,
        remarks: updates.remarks || existingInspection.remarks,
        images: updates.images || existingInspection.images, // Preserve images field
        // Preserve checklist items if they exist in updates
        cleanDustFree: updates.cleanDustFree,
        protectionButtonEnabled: updates.protectionButtonEnabled,
        recloserButtonEnabled: updates.recloserButtonEnabled,
        groundEarthButtonEnabled: updates.groundEarthButtonEnabled,
        acPowerOn: updates.acPowerOn,
        batteryPowerLow: updates.batteryPowerLow,
        handleLockOn: updates.handleLockOn,
        remoteButtonEnabled: updates.remoteButtonEnabled,
        gasLevelLow: updates.gasLevelLow,
        earthingArrangementAdequate: updates.earthingArrangementAdequate,
        noFusesBlown: updates.noFusesBlown,
        noDamageToBushings: updates.noDamageToBushings,
        noDamageToHVConnections: updates.noDamageToHVConnections,
        insulatorsClean: updates.insulatorsClean,
        paintworkAdequate: updates.paintworkAdequate,
        ptFuseLinkIntact: updates.ptFuseLinkIntact,
        noCorrosion: updates.noCorrosion,
        silicaGelCondition: updates.silicaGelCondition,
        correctLabelling: updates.correctLabelling
      };
      
      // Save the updated inspection
      await inspectionService.saveSubstationInspectionOffline(updatedInspection, 'update');
      
      // If online, trigger immediate sync
      if (navigator.onLine) {
        await inspectionService.triggerSyncAndRefresh();
      }
      
      toast.success('Inspection updated successfully');
    } catch (error) {
      console.error('Error updating inspection:', error);
      toast.error('Failed to update inspection');
      throw error;
    }
  };

  const deleteInspection = async (id: string) => {
    if (!id) {
      throw new Error('deleteInspection: No ID provided');
    }

    try {
      // Get the inspection service instance
      const inspectionService = SubstationInspectionService.getInstance();

      // Get the existing inspection
      const existingInspection = savedInspections.find(inspection => inspection.id === id);
      if (!existingInspection) {
        throw new Error(`deleteInspection: Inspection not found with ID ${id}`);
      }

      // First try to delete from Firestore if online
      if (navigator.onLine) {
        try {
          // Try to find the document in Firestore first
          const q = query(
            collection(db, "substationInspections"),
            where("id", "==", id)
          );
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            // Get the Firestore document ID
            const docId = querySnapshot.docs[0].id;
            const docRef = doc(db, "substationInspections", docId);
            await deleteDoc(docRef);
            console.log('Deleted inspection from Firebase:', docId);

            // Log the action
            if (user?.uid && user?.name && user?.role) {
              console.log("[Delete] LoggingService.logAction will be called with:", {
                userId: user.uid,
                userName: user.name,
                userRole: user.role,
                id,
                substationName: existingInspection.substationName,
                substationNumber: existingInspection.substationNumber,
                region: existingInspection.region,
                district: existingInspection.district
              });
              const loggingService = LoggingService.getInstance();
              await loggingService.logAction(
                user.uid,
                user.name,
                user.role,
                "Delete",
                "SubstationInspection",
                id,
                `Deleted substation inspection for ${existingInspection.substationName}${existingInspection.substationNumber ? ` (${existingInspection.substationNumber})` : ''} in ${existingInspection.region}${existingInspection.district ? `, ${existingInspection.district}` : ''}`,
                existingInspection.region,
                existingInspection.district
              );
            }
          } else {
            console.log('Document not found in Firestore with local ID:', id);
          }
        } catch (error) {
          console.error('Error deleting from Firebase:', error);
          // Continue with offline deletion even if Firebase deletion fails
        }
      }

      // Update local state
      setSavedInspections(prev => prev.filter(inspection => inspection.id !== id));

      try {
        // Save deletion for sync (both online and offline)
        await inspectionService.saveSubstationInspectionOffline(existingInspection, 'delete');

        // If online, trigger sync immediately
        if (navigator.onLine) {
          // Get all inspections to refresh the state
          const allRecords = await inspectionService.getAllSubstationInspections();
          setSavedInspections(allRecords);
        }
        
        toast.success('Inspection deleted successfully');
      } catch (error) {
        console.error('Error saving deletion for sync:', error);
        // If we fail to save for sync, restore the inspection in the UI
        setSavedInspections(prev => [...prev, existingInspection]);
        toast.error('Failed to save deletion for sync');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting inspection:', error);
      toast.error('Failed to delete inspection');
      throw error;
    }
  };

  // Update the online handler in the useEffect
  useEffect(() => {
    if (!isDBInitialized) return;

    const handleOnline = async () => {
      console.log('[DataContext] Network connection restored');
      try {
        // Get the VIT sync service instance
        const vitSyncService = VITSyncService.getInstance();
        
        // Get pending assets before sync
        const pendingAssetsBefore = await vitSyncService.getPendingVITAssets();
        console.log('[DataContext] Pending assets before sync:', pendingAssetsBefore.length);
        
        // Trigger sync
        await vitSyncService.syncAllVITData();
        
        // Get pending assets after sync
        const pendingAssetsAfter = await vitSyncService.getPendingVITAssets();
        console.log('[DataContext] Pending assets after sync:', pendingAssetsAfter.length);
        
        if (pendingAssetsAfter.length > 0) {
          console.warn('[DataContext] Some assets failed to sync:', pendingAssetsAfter);
          toast.error(`${pendingAssetsAfter.length} assets failed to sync. Please try again.`);
        } else {
          toast.success('All assets synced successfully');
        }
        
        // Update UI with latest data
        setVITAssets(prevAssets => {
          const updatedAssets = [...prevAssets];
          
          // Remove any assets that were successfully synced
          const syncedAssets = pendingAssetsBefore.filter(
            before => !pendingAssetsAfter.some(after => after.id === before.id)
          );
          
          // Update or add synced assets
          syncedAssets.forEach(asset => {
            const index = updatedAssets.findIndex(a => a.id === asset.id);
            if (index >= 0) {
              updatedAssets[index] = asset;
            } else {
              updatedAssets.push(asset);
            }
          });
          
          return updatedAssets;
        });
      } catch (error) {
        console.error('[DataContext] Error handling online state:', error);
        toast.error('Failed to sync offline data. Please try again.');
      }
    };

    // Handle VIT asset sync events
    const handleVITAssetSynced = (event: CustomEvent) => {
      const { key, status, error } = event.detail;
      console.log('[DataContext] VIT asset sync event:', { key, status, error });
      
      if (status === 'success') {
        // Force refresh the VIT assets list to remove duplicates
        setVITAssets(prevAssets => {
          // Remove any duplicate assets that might still be in the list
          const uniqueAssets = new Map<string, VITAsset>();
          
          prevAssets.forEach(asset => {
            const assetKey = `${asset.serialNumber}_${asset.region}_${asset.district}`;
            if (!uniqueAssets.has(assetKey)) {
              uniqueAssets.set(assetKey, asset);
            }
          });
          
          return Array.from(uniqueAssets.values());
        });
      }
    };

    // Handle VIT data synced events
    const handleVITDataSynced = (event: CustomEvent) => {
      const { status } = event.detail;
      console.log('[DataContext] VIT data synced event:', status);
      
      if (status === 'success') {
        // Force refresh the VIT assets list
        setVITAssets(prevAssets => {
          // Remove any duplicate assets
          const uniqueAssets = new Map<string, VITAsset>();
          
          prevAssets.forEach(asset => {
            const assetKey = `${asset.serialNumber}_${asset.region}_${asset.district}`;
            if (!uniqueAssets.has(assetKey)) {
              uniqueAssets.set(assetKey, asset);
            }
          });
          
          return Array.from(uniqueAssets.values());
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('vitAssetSynced', handleVITAssetSynced as EventListener);
    window.addEventListener('vitDataSynced', handleVITDataSynced as EventListener);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('vitAssetSynced', handleVITAssetSynced as EventListener);
      window.removeEventListener('vitDataSynced', handleVITDataSynced as EventListener);
    };
  }, [isDBInitialized]);

  // Update context value
  const contextValue: DataContextType = {
    regions,
    districts,
    regionsLoading,
    districtsLoading,
    regionsError,
    districtsError,
    retryRegionsAndDistricts: () => fetchRegionsAndDistricts(),
    op5Faults,
    controlSystemOutages,
    addOP5Fault,
    updateOP5Fault,
    deleteOP5Fault,
    addControlSystemOutage,
    updateControlSystemOutage,
    deleteControlSystemOutage,
    canResolveFault,
    getFilteredFaults,
    resolveFault,
    deleteFault,
    canEditFault: () => true,
    loadMonitoringRecords,
    setLoadMonitoringRecords,
    saveLoadMonitoringRecord,
    getLoadMonitoringRecord,
    updateLoadMonitoringRecord,
    deleteLoadMonitoringRecord,
    initializeLoadMonitoring,
    vitAssets,
    vitInspections,
    addVITAsset: async (asset: Omit<VITAsset, "id">) => {
      try {
        return await vitSyncService.addVITAsset(asset);
      } catch (error) {
        console.error("Error adding VIT asset:", error);
        throw error;
      }
    },
    updateVITAsset: async (id: string, updates: Partial<VITAsset>) => {
      try {
        await vitSyncService.updateVITAsset({ id, ...updates });
      } catch (error) {
        console.error("Error updating VIT asset:", error);
        throw error;
      }
    },
    deleteVITAsset: async (id: string) => {
      try {
        // Get the asset data before deleting
        const asset = vitAssets.find(a => a.id === id);
        if (!asset) {
          throw new Error("VIT asset not found");
        }

        // Delete the asset
        await vitSyncService.deleteVITAsset(id);

        // Log the action
        if (user?.uid && user?.name && user?.role) {
          console.log("[Delete] LoggingService.logAction will be called with:", {
            userId: user.uid,
            userName: user.name,
            userRole: user.role,
            id,
            serialNumber: asset.serialNumber,
            region: asset.region,
            district: asset.district
          });
          const loggingService = LoggingService.getInstance();
          await loggingService.logAction(
            user.uid,
            user.name,
            user.role,
            "Delete",
            "VITAsset",
            id,
            `Deleted VIT asset ${asset.serialNumber} in ${asset.region}${asset.district ? `, ${asset.district}` : ''}`,
            asset.region,
            asset.district
          );
        }
      } catch (error) {
        console.error("Error deleting VIT asset:", error);
        throw error;
      }
    },
    addVITInspection: async (inspection: Omit<VITInspectionChecklist, "id">) => {
      try {
        const docRef = await addDoc(collection(db, "vitInspections"), {
          ...inspection,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        return docRef.id;
      } catch (error) {
        console.error("Error adding VIT inspection:", error);
        toast.error("Failed to add inspection");
        throw error;
      }
    },
    updateVITInspection: async (id: string, updates: Partial<VITInspectionChecklist>) => {
      try {
        const docRef = doc(db, "vitInspections", id);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Error updating VIT inspection:", error);
        toast.error("Failed to update inspection");
        throw error;
      }
    },
    deleteVITInspection: async (id: string) => {
      try {
        const docRef = doc(db, "vitInspections", id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Error deleting VIT inspection:", error);
        toast.error("Failed to delete inspection");
        throw error;
      }
    },
    savedInspections,
    setSavedInspections: () => {},
    saveInspection,
    updateSubstationInspection,
    deleteInspection,
    updateDistrict,
    canEditAsset: () => true,
    canEditInspection: () => true,
    canDeleteAsset: () => true,
    canDeleteInspection: () => true,
    setVITAssets: () => {},
    setVITInspections: () => {},
    getSavedInspection,
    canAddAsset: () => true,
    canAddInspection: () => true,
    getOP5FaultById: (id: string) => op5Faults.find(f => f.id === id),
    networkInspections,
    addNetworkInspection: async (inspection) => {
      try {
        const docRef = await addDoc(collection(db, "overheadLineInspections"), {
          ...inspection,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        return docRef.id;
      } catch (error) {
        console.error("Error adding network inspection:", error);
        toast.error("Failed to add inspection");
        throw error;
      }
    },
    updateNetworkInspection: async (id, updates) => {
      try {
        const docRef = doc(db, "overheadLineInspections", id);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Error updating network inspection:", error);
        toast.error("Failed to update inspection");
        throw error;
      }
    },
    deleteNetworkInspection: async (id) => {
      try {
        // Get the inspection data before deleting
        const docRef = doc(db, "overheadLineInspections", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          throw new Error("Network inspection not found");
        }
        const inspectionData = docSnap.data();

        // Delete the inspection
        await deleteDoc(docRef);

        // Log the action
        if (user?.uid && user?.name && user?.role) {
          console.log("[Delete] LoggingService.logAction will be called with:", {
            userId: user.uid,
            userName: user.name,
            userRole: user.role,
            id,
            lineName: inspectionData.lineName,
            region: inspectionData.region,
            district: inspectionData.district
          });
          const loggingService = LoggingService.getInstance();
          await loggingService.logAction(
            user.uid,
            user.name,
            user.role,
            "Delete",
            "NetworkInspection",
            id,
            `Deleted network inspection for ${inspectionData.lineName} in ${inspectionData.region}${inspectionData.district ? `, ${inspectionData.district}` : ''}`,
            inspectionData.region,
            inspectionData.district
          );
        }

        toast.success("Inspection deleted successfully");
      } catch (error) {
        console.error("Error deleting network inspection:", error);
        toast.error("Failed to delete inspection");
        throw error;
      }
    },
    canEditLoadMonitoring,
    canDeleteLoadMonitoring,
    refreshInspections: async () => {
      try {
        // Get the inspection service instance
        const inspectionService = SubstationInspectionService.getInstance();
        
        // Get all inspections using the service's getAllSubstationInspections method
        const allRecords = await inspectionService.getAllSubstationInspections();
        console.log('Retrieved all records:', allRecords.length);
        
        // Update the state with the merged data
        setSavedInspections(allRecords);
      } catch (error) {
        console.error("Error refreshing inspections:", error);
        toast.error("Failed to refresh inspections");
      }
    },
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
