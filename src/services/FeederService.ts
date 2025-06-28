import { db } from "@/config/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import { OfflineStorageService } from "./OfflineStorageService";

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

export class FeederService {
  private static instance: FeederService;
  private offlineService: OfflineStorageService;

  private constructor() {
    this.offlineService = OfflineStorageService.getInstance();
  }

  public static getInstance(): FeederService {
    if (!FeederService.instance) {
      FeederService.instance = new FeederService();
    }
    return FeederService.instance;
  }

  /**
   * Get feeders for a specific region with offline support
   */
  public async getFeedersByRegion(regionId: string): Promise<FeederInfo[]> {
    try {
      // First try to get from offline storage
      const offlineFeeders = await this.offlineService.getOfflineFeeders();
      const regionFeeders = offlineFeeders.filter(feeder => feeder.regionId === regionId);

      // If we're online, try to fetch from Firestore and update offline cache
      if (navigator.onLine) {
        try {
          const feedersRef = collection(db, "feeders");
          const q = query(feedersRef, where("regionId", "==", regionId));
          const querySnapshot = await getDocs(q);
          const firestoreFeeders = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as FeederInfo[];

          // Update offline cache with fresh data
          for (const feeder of firestoreFeeders) {
            await this.offlineService.saveFeederOffline(feeder);
          }

          return firestoreFeeders;
        } catch (error) {
          console.error("Error fetching feeders from Firestore:", error);
          // If Firestore fails, return offline data
          return regionFeeders;
        }
      }

      // If offline, return cached data
      return regionFeeders;
    } catch (error) {
      console.error("Error getting feeders:", error);
      return [];
    }
  }

  /**
   * Get all feeders with offline support
   */
  public async getAllFeeders(): Promise<FeederInfo[]> {
    try {
      // First try to get from offline storage
      const offlineFeeders = await this.offlineService.getOfflineFeeders();

      // If we're online, try to fetch from Firestore and update offline cache
      if (navigator.onLine) {
        try {
          const feedersRef = collection(db, "feeders");
          const querySnapshot = await getDocs(feedersRef);
          const firestoreFeeders = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as FeederInfo[];

          // Update offline cache with fresh data
          for (const feeder of firestoreFeeders) {
            await this.offlineService.saveFeederOffline(feeder);
          }

          return firestoreFeeders;
        } catch (error) {
          console.error("Error fetching feeders from Firestore:", error);
          // If Firestore fails, return offline data
          return offlineFeeders;
        }
      }

      // If offline, return cached data
      return offlineFeeders;
    } catch (error) {
      console.error("Error getting all feeders:", error);
      return [];
    }
  }

  /**
   * Add a new feeder with offline support
   */
  public async addFeeder(feeder: Omit<FeederInfo, "id">): Promise<string> {
    try {
      if (navigator.onLine) {
        // If online, save to Firestore first
        const docRef = await addDoc(collection(db, "feeders"), feeder);
        const newFeeder = { id: docRef.id, ...feeder };
        
        // Also save to offline cache
        await this.offlineService.saveFeederOffline(newFeeder);
        
        return docRef.id;
      } else {
        // If offline, save to offline cache only
        const offlineId = `offline_${Date.now()}`;
        const offlineFeeder = { id: offlineId, ...feeder };
        await this.offlineService.saveFeederOffline(offlineFeeder);
        
        return offlineId;
      }
    } catch (error) {
      console.error("Error adding feeder:", error);
      throw error;
    }
  }

  /**
   * Update a feeder with offline support
   */
  public async updateFeeder(id: string, updates: Partial<FeederInfo>): Promise<void> {
    try {
      if (navigator.onLine) {
        // If online, update Firestore first
        const feederRef = doc(db, "feeders", id);
        await updateDoc(feederRef, updates);
        
        // Also update offline cache
        const updatedFeeder = { id, ...updates } as FeederInfo;
        await this.offlineService.saveFeederOffline(updatedFeeder);
      } else {
        // If offline, update offline cache only
        const offlineFeeders = await this.offlineService.getOfflineFeeders();
        const existingFeeder = offlineFeeders.find(f => f.id === id);
        if (existingFeeder) {
          const updatedFeeder = { ...existingFeeder, ...updates };
          await this.offlineService.saveFeederOffline(updatedFeeder);
        }
      }
    } catch (error) {
      console.error("Error updating feeder:", error);
      throw error;
    }
  }

  /**
   * Delete a feeder with offline support
   */
  public async deleteFeeder(id: string): Promise<void> {
    try {
      if (navigator.onLine) {
        // If online, delete from Firestore first
        const feederRef = doc(db, "feeders", id);
        await deleteDoc(feederRef);
        
        // Also remove from offline cache
        await this.offlineService.removeOfflineFeeder(id);
      } else {
        // If offline, remove from offline cache only
        await this.offlineService.removeOfflineFeeder(id);
      }
    } catch (error) {
      console.error("Error deleting feeder:", error);
      throw error;
    }
  }

  /**
   * Get a specific feeder by ID with offline support
   */
  public async getFeederById(id: string): Promise<FeederInfo | null> {
    try {
      // First check offline cache
      const offlineFeeders = await this.offlineService.getOfflineFeeders();
      const offlineFeeder = offlineFeeders.find(f => f.id === id);
      
      if (offlineFeeder) {
        return offlineFeeder;
      }

      // If not in offline cache and online, try Firestore
      if (navigator.onLine) {
        try {
          const feederRef = doc(db, "feeders", id);
          const feederDoc = await getDoc(feederRef);
          
          if (feederDoc.exists()) {
            const feeder = { id: feederDoc.id, ...feederDoc.data() } as FeederInfo;
            // Save to offline cache for future use
            await this.offlineService.saveFeederOffline(feeder);
            return feeder;
          }
        } catch (error) {
          console.error("Error fetching feeder from Firestore:", error);
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting feeder by ID:", error);
      return null;
    }
  }

  /**
   * Preload feeders for offline use
   */
  public async preloadFeeders(): Promise<void> {
    try {
      if (navigator.onLine) {
        const feedersRef = collection(db, "feeders");
        const querySnapshot = await getDocs(feedersRef);
        const feeders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as FeederInfo[];

        // Save all feeders to offline cache
        for (const feeder of feeders) {
          await this.offlineService.saveFeederOffline(feeder);
        }

        console.log(`Preloaded ${feeders.length} feeders for offline use`);
      }
    } catch (error) {
      console.error("Error preloading feeders:", error);
    }
  }
} 