import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { LoadMonitoringData } from '@/lib/asset-types';
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { Button, Table, Modal, Form, Input, DatePicker, Select, message, Badge } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import moment from 'moment';
import { getFirestore, collection, query, where, orderBy, limit, startAt, getCountFromServer, getDocs, startAfter } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { LoadMonitoringService } from '@/services/LoadMonitoringService';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { DataTable } from "@/components/ui/data-table";
import { Plus } from "lucide-react";
import { columns } from "./columns";
import { LoadMonitoringDialog } from "./LoadMonitoringDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionService } from '@/services/PermissionService';

const { Option } = Select;

const LoadMonitoringPage: React.FC = () => {
  const { 
    loadMonitoringRecords, 
    saveLoadMonitoringRecord, 
    updateLoadMonitoringRecord, 
    deleteLoadMonitoringRecord,
    regions,
    districts,
    setLoadMonitoringRecords,
    canEditLoadMonitoring,
    canDeleteLoadMonitoring,
    initializeLoadMonitoring
  } = useData();
  const { isAuthenticated, user } = useAuth();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filter states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LoadMonitoringData | null>(null);
  const [form] = Form.useForm();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: LoadMonitoringData[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Online/offline status
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(false);

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${selectedDate?.toISOString()}-${selectedMonth?.toISOString()}-${selectedRegion}-${selectedDistrict}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm, user]);

  // Optimize data loading with pagination and caching
  const loadData = useCallback(async (resetPagination = false) => {
    setIsLoading(true);
    try {
      const db = getFirestore();
      const loadMonitoringRef = collection(db, "loadMonitoring");
      
      // Build query based on filters
      let q = query(loadMonitoringRef);
      
      // Use PermissionService for role-based filtering
      const permissionService = PermissionService.getInstance();
      if (user?.role && !permissionService.canAccessFeature(user.role, 'load_monitoring')) {
        setLoadMonitoringRecords([]);
        setIsLoading(false);
        return;
      }
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        q = query(q, where("region", "==", user.region));
      } else if (user?.role === 'district_engineer' || user?.role === 'technician' || user?.role === 'district_manager') {
        q = query(q, where("district", "==", user.district), where("region", "==", user.region));
      }
      
      // Apply date filter
      if (selectedDate) {
        const startOfDay = moment(selectedDate).startOf('day').toDate();
        const endOfDay = moment(selectedDate).endOf('day').toDate();
        q = query(q, where("date", ">=", startOfDay), where("date", "<=", endOfDay));
      }
      
      // Apply month filter
      if (selectedMonth) {
        const startOfMonth = moment(selectedMonth).startOf('month').toDate();
        const endOfMonth = moment(selectedMonth).endOf('month').toDate();
        q = query(q, where("date", ">=", startOfMonth), where("date", "<=", endOfMonth));
      }
      
      // Apply region filter
      if (selectedRegion) {
        q = query(q, where("region", "==", selectedRegion));
      }
      
      // Apply district filter
      if (selectedDistrict) {
        q = query(q, where("district", "==", selectedDistrict));
      }
      
      // Apply search term
      if (searchTerm) {
        q = query(q, where("substationName", ">=", searchTerm), where("substationName", "<=", searchTerm + '\uf8ff'));
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
        orderBy("date", "desc"),
        limit(pageSize)
      );
      
      if (lastVisible && !resetPagination) {
        q = query(q, startAfter(lastVisible));
      }
      
      // Fetch data
      const snapshot = await getDocs(q);
      const newRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoadMonitoringData[];
      
      // Update cache
      const updatedCache = { ...dataCache };
      const pageKey = `${cacheKey}-${currentPage}`;
      updatedCache[pageKey] = newRecords;
      setDataCache(updatedCache);
      
      // Update last visible document for pagination
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      setHasMore(snapshot.docs.length === pageSize);
      
      // Update records
      if (resetPagination) {
        setLoadMonitoringRecords(newRecords);
      } else {
        setLoadMonitoringRecords(prev => [...prev, ...newRecords]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      message.error("Failed to load monitoring records");
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm, currentPage, pageSize, lastVisible, dataCache, totalCountCache, getCacheKey]);

  // Load data on mount and when filters change
  useEffect(() => {
    if (isAuthenticated) {
      loadData(true);
    }
  }, [isAuthenticated, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  }, [isLoading, hasMore, loadData]);

  // Optimize filtered records with useMemo
  const filteredRecords = useMemo(() => {
    if (!loadMonitoringRecords) return [];
    
    // Use PermissionService for role-based filtering
    const permissionService = PermissionService.getInstance();
    if (user?.role && !permissionService.canAccessFeature(user.role, 'load_monitoring')) {
      return [];
    }
    
    let filtered = loadMonitoringRecords;
    
    // Apply role-based filtering
    if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
      filtered = filtered.filter(record => record.region === user.region);
    } else if (user?.role === 'district_engineer' || user?.role === 'technician' || user?.role === 'district_manager') {
      filtered = filtered.filter(record => record.district === user.district && record.region === user.region);
    }
    
    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.toDateString() === selectedDate.toDateString();
      });
    }
    
    // Apply month filter
    if (selectedMonth) {
      filtered = filtered.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === selectedMonth.getMonth() && 
               recordDate.getFullYear() === selectedMonth.getFullYear();
      });
    }
    
    // Apply region filter
    if (selectedRegion) {
      filtered = filtered.filter(record => record.region === selectedRegion);
    }
    
    // Apply district filter
    if (selectedDistrict) {
      filtered = filtered.filter(record => record.district === selectedDistrict);
    }
    
    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(record => 
        record.substationName?.toLowerCase().includes(lowerCaseSearchTerm) ||
        record.substationNumber?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    
    return filtered;
  }, [loadMonitoringRecords, user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  // Get filtered districts based on selected region
  const filteredDistricts = useMemo(() => {
    if (!selectedRegion) return districts;
    return districts.filter(district => district.regionId === selectedRegion);
  }, [districts, selectedRegion]);

  // Handle add/edit/delete operations
  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: LoadMonitoringData) => {
    if (!canEditLoadMonitoring) {
      toast.error('You do not have permission to edit this record');
      return;
    }
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      date: moment(record.date)
    });
    setIsModalVisible(true);
  };

  const handleDelete = (record: LoadMonitoringData) => {
    if (!canDeleteLoadMonitoring) {
      toast.error('You do not have permission to delete this record');
      return;
    }
    if (window.confirm('Are you sure you want to delete this record?')) {
      deleteLoadMonitoringRecord(record.id)
        .then(() => {
          toast.success('Record deleted successfully');
        })
        .catch((error) => {
          console.error('Error deleting record:', error);
          toast.error('Failed to delete record');
        });
    }
  };

  // Add effect to handle online/offline status
  useEffect(() => {
    const loadMonitoringService = LoadMonitoringService.getInstance();
    setIsOnline(loadMonitoringService.isInternetAvailable());

    const handleOnlineStatusChange = () => {
      const isOnlineNow = loadMonitoringService.isInternetAvailable();
      setIsOnline(isOnlineNow);
      
      if (isOnlineNow) {
        loadMonitoringService.syncLoadMonitoringRecords();
      }
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  // Add effect to handle pending sync status
  useEffect(() => {
    const loadMonitoringService = LoadMonitoringService.getInstance();
    
    const checkPendingSync = async () => {
      const pendingRecords = await loadMonitoringService.getPendingLoadMonitoringRecords();
      setPendingSync(pendingRecords.length > 0);
    };

    checkPendingSync();
    const interval = setInterval(checkPendingSync, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    try {
      const loadMonitoringService = LoadMonitoringService.getInstance();
      await loadMonitoringService.syncLoadMonitoringRecords();
      toast.success('Load monitoring records synced successfully');
    } catch (error) {
      console.error('Error syncing load monitoring records:', error);
      toast.error('Failed to sync load monitoring records');
    }
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LoadMonitoringData | null>(null);

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await initializeLoadMonitoring();
      } catch (error) {
        console.error("Error loading load monitoring data:", error);
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [initializeLoadMonitoring]);

  return (
    <AccessControlWrapper type="asset">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Load Monitoring</h1>
          <div className="flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 text-yellow-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>You are offline</span>
              </div>
            )}
            {pendingSync && (
              <button
                onClick={handleSync}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </button>
            )}
            <Button
              onClick={() => {
                setSelectedRecord(null);
                setIsDialogOpen(true);
              }}
              className="inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Record
            </Button>
          </div>
        </div>

        <div className="grid gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={selectedRegion}
                    onValueChange={setSelectedRegion}
                  >
                    <SelectTrigger id="region">
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Regions</SelectItem>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={setSelectedDistrict}
                  >
                    <SelectTrigger id="district">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Districts</SelectItem>
                      {filteredDistricts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DataTable
          columns={columns}
          data={filteredRecords}
          isLoading={isLoading}
          onEdit={canEditLoadMonitoring ? handleEdit : undefined}
          onDelete={canDeleteLoadMonitoring ? handleDelete : undefined}
        />

        <LoadMonitoringDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          record={selectedRecord}
          onSuccess={() => {
            setIsDialogOpen(false);
            setSelectedRecord(null);
          }}
        />
      </div>
    </AccessControlWrapper>
  );
};

export default LoadMonitoringPage; 