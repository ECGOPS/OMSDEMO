import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { User } from '@/lib/types';
import { 
  hasRoleAccess, 
  hasRegionAccess, 
  hasDistrictAccess, 
  canReadData, 
  canCreateData, 
  canUpdateData, 
  canDeleteData, 
  filterDataByAccess 
} from '../utils/accessControl';

export const useAccessControl = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAccessControl must be used within an AuthProvider');
  }
  const { user } = context;

  return {
    // Role-based access
    hasRoleAccess: (requiredRole: string) => 
      user ? hasRoleAccess(user.role || '', requiredRole) : false,
    
    // Region and district access
    hasRegionAccess: (regionId: string) => 
      user ? hasRegionAccess(user, regionId) : false,
    hasDistrictAccess: (districtId: string) => 
      user ? hasDistrictAccess(user, districtId) : false,
    
    // Data operation permissions
    canReadData: (data: any) => 
      user ? canReadData(user, data) : false,
    canCreateData: (data: any) => 
      user ? canCreateData(user, data) : false,
    canUpdateData: (data: any) => 
      user ? canUpdateData(user, data) : false,
    canDeleteData: (data: any) => 
      user ? canDeleteData(user, data) : false,
    
    // Data filtering
    filterDataByAccess: (data: any[]) => 
      user ? filterDataByAccess(user, data) : [],
  };
}; 