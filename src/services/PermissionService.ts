import { UserRole } from "@/lib/types";
import { LoadMonitoringData } from "@/lib/asset-types";
import { getFirestore, doc, onSnapshot, updateDoc, setDoc, deleteDoc, getDoc, enableNetwork, disableNetwork, collection, addDoc } from "firebase/firestore";
import { db } from "@/config/firebase";

const STORAGE_KEY = "feature_permissions";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class PermissionService {
  private static instance: PermissionService;
  private roleHierarchy: { [key in Exclude<UserRole, null>]: number } = {
    'technician': 1,
    'district_engineer': 2,
    'district_manager': 2,
    'regional_engineer': 3,
    'project_engineer': 3,
    'regional_general_manager': 3,
    'global_engineer': 4,
    'system_admin': 5,
    'ict': 2,
    'load_monitoring_edit': 2,
    'load_monitoring_delete': 3,
    'admin': 5
  };

  private permissionChangeListeners: (() => void)[] = [];
  private retryCount = 0;
  private isInitialized = false;

  private defaultFeaturePermissions: { [key: string]: UserRole[] } = {
    // Asset Management Features
    'asset_management': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'asset_management_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'asset_management_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    // User Logs Features
    'user_logs': ['system_admin'],
    'user_logs_update': ['system_admin'],
    'user_logs_delete': ['system_admin'],
    'user_logs_delete_all': ['system_admin'],
    
    // SMS Notification Features
    'sms_notification': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'sms_notification_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'sms_notification_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    'inspection_management': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'inspection_management_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'inspection_management_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    'load_monitoring': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'load_monitoring_update': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'load_monitoring_delete': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    'substation_inspection': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'substation_inspection_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'substation_inspection_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    'vit_inspection': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'vit_inspection_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'vit_inspection_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    'overhead_line_inspection': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'overhead_line_inspection_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'overhead_line_inspection_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    // Fault Management Features
    'fault_reporting': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'fault_reporting_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'fault_reporting_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    'fault_analytics': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'fault_analytics_update': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'fault_analytics_delete': ['global_engineer', 'system_admin'],
    
    'control_system_analytics': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'control_outage_management': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'control_outage_management_update': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'control_outage_management_delete': ['global_engineer', 'system_admin'],
    
    'op5_fault_management': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'op5_fault_management_update': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'op5_fault_management_delete': ['global_engineer', 'system_admin'],
    
    // Analytics Features
    'analytics_dashboard': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'analytics_page': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'reliability_metrics': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'reliability_metrics_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'reliability_metrics_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'performance_reports': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'performance_reports_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'performance_reports_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    
    // Feeder Management Features
    'feeder_management': ['technician', 'district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'feeder_management_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'feeder_management_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'feeder_management_delete_all': ['global_engineer', 'system_admin'],
    
    // User Management Features
    'user_management': ['global_engineer', 'system_admin', 'ict'],
    'user_management_update': ['global_engineer', 'system_admin', 'ict'],
    'user_management_delete': ['system_admin', 'ict'],
    
    'district_population': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'district_population_update': ['district_engineer', 'district_manager', 'regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'district_population_delete': ['regional_engineer', 'project_engineer', 'regional_general_manager', 'global_engineer', 'system_admin'],
    'district_population_reset': ['global_engineer', 'system_admin'],
    
    // System Administration Features
    'system_configuration': ['system_admin'],
    'permission_management': ['system_admin'],
    'security_monitoring': ['system_admin'],
    'security_testing': ['system_admin'],
    'feeder_offline_testing': ['system_admin'],
    
    // Music Management Features
    'music_management': ['system_admin'],
    'music_management_update': ['system_admin'],
    'music_management_delete': ['system_admin'],
    'staff_ids_management': ['system_admin', 'ict'],
  };

  private featurePermissions: { [key: string]: UserRole[] } = {};
  private db = getFirestore();
  private permissionsRef = doc(this.db, 'permissions', 'feature_permissions');

  private permissionCache: Map<string, boolean> = new Map();

  private readonly rolePermissions: Record<string, string[]> = {
    system_admin: [
      'user_management',
      'fault_reporting',
      'fault_approval',
      'broadcast_messages',
      'view_analytics',
      'view_logs',
      'asset_management'
    ],
    global_engineer: [
      'fault_reporting',
      'fault_approval',
      'broadcast_messages',
      'view_analytics',
      'view_logs',
      'asset_management'
    ],
    regional_general_manager: [
      'fault_reporting',
      'fault_approval',
      'broadcast_messages',
      'view_analytics',
      'view_logs',
      'asset_management'
    ],
    regional_engineer: [
      'fault_reporting',
      'fault_approval',
      'broadcast_messages',
      'view_analytics',
      'view_logs',
      'asset_management'
    ],
    district_manager: [
      'fault_reporting',
      'fault_approval',
      'broadcast_messages',
      'view_analytics',
      'view_logs',
      'asset_management'
    ],
    district_engineer: [
      'fault_reporting',
      'view_analytics',
      'view_logs',
      'asset_management'
    ],
    technician: [
      'fault_reporting',
      'view_analytics',
      'view_logs',
      'asset_management'
    ]
  };

  private constructor() {
    this.loadPermissions();
  }

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  private async loadPermissions() {
    try {
      console.log('Loading permissions from Firestore...');
      
      // If we're offline, try to reset the connection
      if (!navigator.onLine) {
        console.log('Device is offline, attempting to reset Firestore connection...');
        await disableNetwork(this.db);
      }

      const docSnap = await getDoc(this.permissionsRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as { [key: string]: UserRole[] };
        console.log('Existing permissions from Firestore:', data);
        
        // Ensure all permissions are properly set
        Object.keys(data).forEach(key => {
          if (!Array.isArray(data[key])) {
            data[key] = [];
          }
        });
        
        // Only merge with defaults for missing features
        const mergedPermissions = { ...this.defaultFeaturePermissions };
        Object.keys(data).forEach(key => {
          if (data[key] && Array.isArray(data[key])) {
            mergedPermissions[key] = [...data[key]];
          }
        });
        
        this.featurePermissions = mergedPermissions;
        console.log('Loaded permissions from Firestore:', this.featurePermissions);
        this.isInitialized = true;
        this.retryCount = 0;
      } else {
        console.log('No existing permissions found, initializing with defaults');
        // Initialize with default permissions
        this.featurePermissions = { ...this.defaultFeaturePermissions };
        await setDoc(this.permissionsRef, this.defaultFeaturePermissions);
        this.isInitialized = true;
        this.retryCount = 0;
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
      
      // If we get an offline error and haven't exceeded retries, try again
      if (error.message?.includes('client is offline') && this.retryCount < MAX_RETRIES) {
        console.log(`Retrying permission load (attempt ${this.retryCount + 1}/${MAX_RETRIES})...`);
        this.retryCount++;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        
        // Try to reset the connection and load again
        await disableNetwork(this.db);
        return this.loadPermissions();
      }
      
      // If we've exhausted retries or it's a different error, use defaults
      console.log('Using default permissions due to error');
      this.featurePermissions = { ...this.defaultFeaturePermissions };
      this.isInitialized = true;
    }
  }

  public async initialize() {
    if (!this.isInitialized) {
      await this.loadPermissions();
    }
    return this.isInitialized;
  }

  private notifyPermissionChange() {
    this.permissionChangeListeners.forEach(listener => listener());
  }

  public addPermissionChangeListener(listener: () => void) {
    this.permissionChangeListeners.push(listener);
    return () => {
      this.permissionChangeListeners = this.permissionChangeListeners.filter(l => l !== listener);
    };
  }

  public listenToPermissions(callback: () => void) {
    console.log('Setting up permissions listener');
    const unsubscribe = onSnapshot(this.permissionsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as { [key: string]: UserRole[] };
        console.log('Permissions updated from listener:', data);
        
        // Ensure all permissions are properly set
        Object.keys(data).forEach(key => {
          if (!Array.isArray(data[key])) {
            data[key] = [];
          }
        });
        
        // Only merge with defaults for missing features
        const mergedPermissions = { ...this.defaultFeaturePermissions };
        Object.keys(data).forEach(key => {
          if (data[key] && Array.isArray(data[key])) {
            mergedPermissions[key] = [...data[key]];
          }
        });
        
        this.featurePermissions = mergedPermissions;
        callback();
        
        // Notify all listeners about the permission change
        this.notifyPermissionChange();
      }
    });
    
    return unsubscribe;
  }

  public getFeaturePermissions(): { [key: string]: UserRole[] } {
    return { ...this.featurePermissions };
  }

  public async updateFeaturePermissions(feature: string, roles: UserRole[]) {
    try {
      console.log(`Updating permissions for feature ${feature}:`, roles);
      
      // Get the current permissions from Firestore
      const docSnap = await getDoc(this.permissionsRef);
      const currentPermissions = docSnap.exists() ? docSnap.data() as { [key: string]: UserRole[] } : {};
      
      // Create updated permissions
      const updatedPermissions = { ...currentPermissions };
      
      // Handle inspection management permissions specifically
      if (feature === 'inspection_management') {
        console.log('Updating inspection management permissions');
        updatedPermissions['inspection_management'] = [...roles];
        updatedPermissions['inspection_management_update'] = [...roles];
        updatedPermissions['inspection_management_delete'] = [...roles];
      } else {
        updatedPermissions[feature] = [...roles];
      }

      console.log('Saving updated permissions to Firestore:', updatedPermissions);
      // Save the entire permissions object to Firestore
      await setDoc(this.permissionsRef, updatedPermissions);
      this.featurePermissions = updatedPermissions;
      console.log('Permissions updated and saved to Firestore successfully:', this.featurePermissions);
    } catch (error) {
      console.error("Error updating feature permissions:", error);
      throw error;
    }
  }

  public async addFeature(feature: string, roles: UserRole[]) {
    try {
      const updatedPermissions = { ...this.featurePermissions };
      updatedPermissions[feature] = roles;
      await updateDoc(this.permissionsRef, updatedPermissions);
      this.featurePermissions = updatedPermissions;
    } catch (error) {
      console.error("Error adding feature:", error);
      throw error;
    }
  }

  public async removeFeature(feature: string) {
    try {
      const updatedPermissions = { ...this.featurePermissions };
      delete updatedPermissions[feature];
      await updateDoc(this.permissionsRef, updatedPermissions);
      this.featurePermissions = updatedPermissions;
    } catch (error) {
      console.error("Error removing feature:", error);
      throw error;
    }
  }

  public async resetToDefaults() {
    try {
      // Only reset if there are no existing permissions
      const docSnap = await getDoc(this.permissionsRef);
      if (!docSnap.exists()) {
        console.log('No existing permissions found, initializing with defaults');
        await setDoc(this.permissionsRef, this.defaultFeaturePermissions);
        this.featurePermissions = { ...this.defaultFeaturePermissions };
      } else {
        console.log('Existing permissions found, not resetting to defaults');
      }
    } catch (error) {
      console.error("Error resetting permissions:", error);
      throw error;
    }
  }

  public canAccessFeature(userRole: string, feature: string): boolean {
    const cacheKey = `${userRole}-${feature}`;
    
    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    // Get allowed roles for the feature
    const allowedRoles = this.getFeatureRoles(feature);
    console.log(`Checking access for ${feature}:`, { userRole, allowedRoles });

    // Check if user's role is in allowed roles
    const hasAccess = allowedRoles.includes(userRole);
    
    // Cache the result
    this.permissionCache.set(cacheKey, hasAccess);
    
    return hasAccess;
  }

  public hasRequiredRole(userRole: UserRole | null, requiredRole: UserRole): boolean {
    if (!userRole) return false;
    return this.roleHierarchy[userRole] >= this.roleHierarchy[requiredRole];
  }

  public canViewAsset(
    userRole: UserRole | null,
    userRegion: string,
    userDistrict: string,
    assetRegion: string,
    assetDistrict: string
  ): boolean {
    if (!userRole) return false;
    if (userRole === 'system_admin' || userRole === 'global_engineer') return true;
    if (userRole === 'regional_engineer' || userRole === 'project_engineer' || userRole === 'regional_general_manager') return userRegion === assetRegion;
    if (userRole === 'district_engineer' || userRole === 'technician' || userRole === 'district_manager') {
      return userRegion === assetRegion && userDistrict === assetDistrict;
    }
    return false;
  }

  public canEditAsset(
    userRole: UserRole | null,
    userRegion: string,
    userDistrict: string,
    assetRegion: string,
    assetDistrict: string
  ): boolean {
    if (!userRole) return false;
    if (userRole === 'system_admin' || userRole === 'global_engineer') return true;
    if (userRole === 'regional_engineer' || userRole === 'project_engineer') return userRegion === assetRegion;
    if (userRole === 'district_engineer') {
      return userRegion === assetRegion && userDistrict === assetDistrict;
    }
    return false;
  }

  public canDeleteAsset(
    userRole: UserRole | null,
    userRegion: string,
    userDistrict: string,
    assetRegion: string,
    assetDistrict: string
  ): boolean {
    if (!userRole) return false;
    if (userRole === 'system_admin' || userRole === 'global_engineer') return true;
    if (userRole === 'regional_engineer' || userRole === 'project_engineer') return userRegion === assetRegion;
    if (userRole === 'district_engineer') {
      return userRegion === assetRegion && userDistrict === assetDistrict;
    }
    return false;
  }

  public canManageStaffIds(userRole: UserRole | null): boolean {
    return userRole === 'system_admin';
  }

  public canManageDistrictPopulation(userRole: UserRole | null): boolean {
    if (!userRole) return false;
    return userRole === 'district_engineer' || userRole === 'district_manager' || userRole === 'regional_engineer' || userRole === 'project_engineer' || userRole === 'regional_general_manager' || userRole === 'global_engineer' || userRole === 'system_admin';
  }

  public canResetDistrictPopulation(userRole: UserRole | null): boolean {
    if (!userRole) return false;
    return this.canAccessFeature(userRole, 'district_population_reset');
  }

  public canEditInspection(
    userRole: UserRole | null,
    userRegion: string,
    userDistrict: string,
    inspectionRegion: string,
    inspectionDistrict: string
  ): boolean {
    if (!userRole) return false;
    if (userRole === 'system_admin' || userRole === 'global_engineer') return true;
    if (userRole === 'regional_engineer' || userRole === 'project_engineer') return userRegion === inspectionRegion;
    if (userRole === 'district_engineer' || userRole === 'technician') {
      return userRegion === inspectionRegion && userDistrict === inspectionDistrict;
    }
    return false;
  }

  // Add new methods for CRUD operation permissions
  public canUpdateFeature(userRole: string, feature: string): boolean {
    const cacheKey = `${userRole}-${feature}-update`;
    
    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    // Get allowed roles for the feature
    const allowedRoles = this.getUpdateRoles(feature);
    console.log(`Checking update access for ${feature}:`, { userRole, allowedRoles });

    // Check if user's role is in allowed roles
    const hasAccess = allowedRoles.includes(userRole);
    
    // Cache the result
    this.permissionCache.set(cacheKey, hasAccess);
    
    return hasAccess;
  }

  public canDeleteFeature(userRole: string, feature: string): boolean {
    const cacheKey = `${userRole}-${feature}-delete`;
    
    // Check cache first
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    // Get allowed roles for the feature
    const allowedRoles = this.getDeleteRoles(feature);
    console.log(`Checking delete access for ${feature}:`, { userRole, allowedRoles });

    // Check if user's role is in allowed roles
    const hasAccess = allowedRoles.includes(userRole);
    
    // Cache the result
    this.permissionCache.set(cacheKey, hasAccess);
    
    return hasAccess;
  }

  public async updateAllPermissions(permissions: { [key: string]: UserRole[] }) {
    try {
      console.log('Updating all permissions:', permissions);
      
      // Get the current permissions from Firestore
      const docSnap = await getDoc(this.permissionsRef);
      const currentPermissions = docSnap.exists() ? docSnap.data() as { [key: string]: UserRole[] } : {};
      
      // Create updated permissions by merging current and new permissions
      const updatedPermissions = { ...currentPermissions, ...permissions };
      
      // Ensure all permissions are properly set
      Object.keys(updatedPermissions).forEach(key => {
        if (!Array.isArray(updatedPermissions[key])) {
          updatedPermissions[key] = [];
        }
      });
      
      console.log('Saving updated permissions to Firestore:', updatedPermissions);
      // Save the entire permissions object to Firestore
      await setDoc(this.permissionsRef, updatedPermissions);
      this.featurePermissions = updatedPermissions;
      console.log('All permissions updated and saved to Firestore successfully:', this.featurePermissions);
      
      // Notify all listeners about the permission change
      this.notifyPermissionChange();
    } catch (error) {
      console.error("Error updating all permissions:", error);
      throw error;
    }
  }

  public canViewInspection(
    userRole: UserRole | null,
    userRegion: string,
    userDistrict: string,
    inspectionRegion: string,
    inspectionDistrict: string
  ): boolean {
    if (!userRole) return false;
    if (userRole === 'system_admin' || userRole === 'global_engineer') return true;
    if (userRole === 'regional_engineer' || userRole === 'project_engineer') return userRegion === inspectionRegion;
    if (userRole === 'district_engineer' || userRole === 'technician') {
      return userRegion === inspectionRegion && userDistrict === inspectionDistrict;
    }
    return false;
  }

  public canDeleteInspection(
    userRole: UserRole | null,
    userRegion: string,
    userDistrict: string,
    inspectionRegion: string,
    inspectionDistrict: string
  ): boolean {
    if (!userRole) return false;
    if (userRole === 'system_admin' || userRole === 'global_engineer') return true;
    if (userRole === 'regional_engineer' || userRole === 'project_engineer') return userRegion === inspectionRegion;
    if (userRole === 'district_engineer') {
      return userRegion === inspectionRegion && userDistrict === inspectionDistrict;
    }
    return false;
  }

  // Add method to clear cache when needed (e.g., on role change)
  public clearPermissionCache(): void {
    this.permissionCache.clear();
  }

  private getFeatureRoles(feature: string): string[] {
    if (!this.isInitialized) {
      console.warn('PermissionService not initialized, using default permissions');
      return this.defaultFeaturePermissions[feature] || [];
    }
    return this.featurePermissions[feature] || [];
  }

  private getUpdateRoles(feature: string): string[] {
    if (!this.isInitialized) {
      console.warn('PermissionService not initialized, using default permissions');
      return this.defaultFeaturePermissions[`${feature}_update`] || [];
    }
    return this.featurePermissions[`${feature}_update`] || [];
  }

  private getDeleteRoles(feature: string): string[] {
    if (!this.isInitialized) {
      console.warn('PermissionService not initialized, using default permissions');
      return this.defaultFeaturePermissions[`${feature}_delete`] || [];
    }
    return this.featurePermissions[`${feature}_delete`] || [];
  }

  async addPermission(permission: Partial<Permissions>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, "permissions"), permission);
      return docRef.id;
    } catch (error) {
      console.error("Error adding permission:", error);
      throw error;
    }
  }

  async updatePermission(id: string, permission: Partial<Permissions>): Promise<void> {
    try {
      const docRef = doc(db, "permissions", id);
      await updateDoc(docRef, permission);
    } catch (error) {
      console.error("Error updating permission:", error);
      throw error;
    }
  }
} 