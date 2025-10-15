import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { VITAssetList } from '@/components/asset-management/VITAssetList';
import { Skeleton } from '@/components/ui/skeleton';
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getCountFromServer, getDocs } from 'firebase/firestore';
import { VITAsset } from '@/lib/types';

export function VITAssetManagementPage() {
  const { user } = useAuth();
  const { vitAssets, regions, districts, setVITAssets } = useData();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: any[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${selectedRegion}-${selectedDistrict}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [selectedRegion, selectedDistrict, searchTerm, user]);

  // Optimize data loading with pagination and caching
  const loadData = useCallback(async (resetPagination = false) => {
    setIsLoading(true);
    try {
      const db = getFirestore();
      const assetsRef = collection(db, "vitAssets");
      
      // Build query based on filters
      let q = query(assetsRef);
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'project_engineer') {
        q = query(q, where("region", "==", user.region));
      } else if (user?.role === 'district_engineer' || user?.role === 'technician') {
        q = query(q, where("district", "==", user.district));
      }

      // Apply additional filters
      if (selectedRegion) {
        q = query(q, where("region", "==", selectedRegion));
      }
      if (selectedDistrict) {
        q = query(q, where("district", "==", selectedDistrict));
      }
      if (searchTerm) {
        q = query(q, where("serialNumber", ">=", searchTerm), where("serialNumber", "<=", searchTerm + '\uf8ff'));
      }

      // Get total count from cache or server
      const cacheKey = getCacheKey();
      let totalCount = totalCountCache[cacheKey];
      
      if (!totalCount) {
        const countSnapshot = await getCountFromServer(q);
        totalCount = countSnapshot.data().count;
        setTotalCountCache(prev => ({ ...prev, [cacheKey]: totalCount }));
      }
      
      setTotalItems(totalCount);
      
      // Reset pagination if filters changed
      if (resetPagination) {
        setCurrentPage(1);
        setLastVisible(null);
        setHasMore(true);
      }
      
      // Apply pagination
      q = query(
        q,
        orderBy("updatedAt", "desc"),
        limit(pageSize)
      );
      
      if (lastVisible && !resetPagination) {
        q = query(q, startAfter(lastVisible));
      }

      const querySnapshot = await getDocs(q);
      const newAssets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        region: doc.data().region || "",
        district: doc.data().district || "",
        voltageLevel: doc.data().voltageLevel || "",
        typeOfUnit: doc.data().typeOfUnit || "",
        serialNumber: doc.data().serialNumber || "",
        location: doc.data().location || "",
        gpsCoordinates: doc.data().gpsCoordinates || "",
        status: doc.data().status || "Operational",
        protection: doc.data().protection || "",
        photoUrl: doc.data().photoUrl || "",
        createdBy: doc.data().createdBy || "unknown",
        createdAt: doc.data().createdAt || new Date(),
        updatedAt: doc.data().updatedAt || new Date()
      })) as VITAsset[];

      // Update cache
      const updatedCache = { ...dataCache };
      const pageKey = `${cacheKey}-${currentPage}`;
      updatedCache[pageKey] = newAssets;
      setDataCache(updatedCache);
      
      // Update last visible document for pagination
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
      setHasMore(querySnapshot.docs.length === pageSize);
      
      // Update assets
      if (resetPagination) {
        setVITAssets(newAssets);
      } else {
        setVITAssets(prev => [...prev, ...newAssets]);
      }
    } catch (err) {
      setError("Failed to load assets");
      console.error("Error loading assets:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentPage, pageSize, lastVisible, selectedRegion, selectedDistrict, searchTerm, dataCache, totalCountCache, getCacheKey, setVITAssets]);

  // Load data on mount and when filters change
  useEffect(() => {
    loadData(true);
  }, [selectedRegion, selectedDistrict, searchTerm]);

  // For project engineers, always use their assigned region for filtering
  useEffect(() => {
    if (user?.role === 'project_engineer' && user.region) {
      setSelectedRegion(user.region);
    }
  }, [user]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  }, [isLoading, hasMore, loadData]);

  // Optimize filtered assets with useMemo
  const filteredAssets = useMemo(() => {
    if (!vitAssets) return [];
    
    let filtered = vitAssets;
    
    // Apply role-based filtering
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer') {
      filtered = filtered.filter(asset => asset.region === user.region);
    } else if (user?.role === 'district_engineer' || user?.role === 'technician') {
      filtered = filtered.filter(asset => asset.district === user.district);
    }
    
    // For project engineers, ignore selectedRegion
    if (user?.role !== 'project_engineer' && selectedRegion) {
      filtered = filtered.filter(asset => asset.region === selectedRegion);
    }
    
    // Apply district filter
    if (selectedDistrict) {
      filtered = filtered.filter(asset => asset.district === selectedDistrict);
    }
    
    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.serialNumber?.toLowerCase().includes(lowerCaseSearchTerm) ||
        asset.location?.toLowerCase().includes(lowerCaseSearchTerm) ||
        asset.typeOfUnit?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    
    return filtered;
  }, [vitAssets, user, selectedRegion, selectedDistrict, searchTerm]);

  if (isLoading) {
    return (
      <AccessControlWrapper type="asset">
        <div className="container mx-auto p-4">
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </AccessControlWrapper>
    );
  }

  if (error) {
    return (
      <AccessControlWrapper type="asset">
        <div className="container mx-auto p-4">
          <div className="text-red-500">{error}</div>
        </div>
      </AccessControlWrapper>
    );
  }

  return (
    <AccessControlWrapper type="asset">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">VIT Asset Management</h1>
          <Button asChild>
            <Link to="/asset-management/add">Add New Asset</Link>
          </Button>
        </div>
        <div className="flex gap-2 mb-4">
          {/* Only show region filter if not project engineer */}
          {user?.role !== 'project_engineer' && (
            <select
              value={selectedRegion || ''}
              onChange={e => setSelectedRegion(e.target.value || null)}
              className="border rounded px-2 py-1"
            >
              <option value="">All Regions</option>
              {regions.map(region => (
                <option key={region.id} value={region.name}>{region.name}</option>
              ))}
            </select>
          )}
          <select
            value={selectedDistrict || ''}
            onChange={e => setSelectedDistrict(e.target.value || null)}
            className="border rounded px-2 py-1"
          >
            <option value="">All Districts</option>
            {districts.map(district => (
              <option key={district.id} value={district.name}>{district.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by serial, location, type..."
            className="border rounded px-2 py-1"
          />
        </div>
        
        <VITAssetList 
          assets={filteredAssets} 
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      </div>
    </AccessControlWrapper>
  );
} 