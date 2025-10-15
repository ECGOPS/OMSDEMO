import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { PermissionService } from "@/services/PermissionService";
import { getFirestore, collection, query, where, orderBy, limit, startAt, getCountFromServer, getDocs, startAfter } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FaultListPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { regions, districts } = useData();
  const [faults, setFaults] = useState<(OP5Fault | ControlSystemOutage)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissionService = PermissionService.getInstance();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: (OP5Fault | ControlSystemOutage)[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${selectedRegion}-${selectedDistrict}-${selectedStatus}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [selectedRegion, selectedDistrict, selectedStatus, searchTerm, user]);

  // Optimize data loading with pagination and caching
  const loadData = useCallback(async (resetPagination = false) => {
    setLoading(true);
    try {
      const db = getFirestore();
      const faultsRef = collection(db, "faults");
      
      // Build query based on filters
      let q = query(faultsRef);
      
      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'regional_general_manager') {
        q = query(q, where("regionId", "==", user.regionId));
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'technician') {
        q = query(q, where("districtId", "==", user.districtId));
      }

      // Apply additional filters
      if (selectedRegion) {
        q = query(q, where("regionId", "==", selectedRegion));
      }
      if (selectedDistrict) {
        q = query(q, where("districtId", "==", selectedDistrict));
      }
      if (selectedStatus) {
        q = query(q, where("status", "==", selectedStatus));
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
        orderBy("occurrenceDate", "desc"),
        limit(pageSize)
      );
      
      if (lastVisible && !resetPagination) {
        q = query(q, startAfter(lastVisible));
      }

      const querySnapshot = await getDocs(q);
      const newFaults = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (OP5Fault | ControlSystemOutage)[];

      // Update cache
      const updatedCache = { ...dataCache };
      const pageKey = `${cacheKey}-${currentPage}`;
      updatedCache[pageKey] = newFaults;
      setDataCache(updatedCache);
      
      // Update last visible document for pagination
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
      setHasMore(querySnapshot.docs.length === pageSize);
      
      // Update faults
      if (resetPagination) {
        setFaults(newFaults);
      } else {
        setFaults(prev => [...prev, ...newFaults]);
      }
    } catch (err) {
      setError("Failed to load faults");
      console.error("Error loading faults:", err);
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, pageSize, lastVisible, selectedRegion, selectedDistrict, selectedStatus, dataCache, totalCountCache, getCacheKey]);

  // Load data on mount and when filters change
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    // Check if user has permission to view faults
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }

    // Set initial region and district based on user role
    if (user) {
      if ((user.role === 'district_engineer' || user.role === 'district_manager' || user.role === 'technician') && user.region && user.district) {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
          const userDistrict = districts.find(d => d.name === user.district);
          if (userDistrict) {
            setSelectedDistrict(userDistrict.id);
          }
        }
      } else if ((user.role === 'regional_engineer' || user.role === 'regional_general_manager') && user.region) {
        const userRegion = regions.find(r => r.name === user.region);
        if (userRegion) {
          setSelectedRegion(userRegion.id);
        }
      }
    }

    loadData(true);
  }, [isAuthenticated, navigate, user, regions, districts, selectedRegion, selectedDistrict, selectedStatus, searchTerm]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  }, [loading, hasMore, loadData]);

  // Optimize filtering with useMemo
  const filteredFaults = useMemo(() => {
    if (!searchTerm) return faults;
    
    return faults.filter(fault => {
      const isOP5 = 'substationName' in fault;
      if (isOP5) {
        const op5Fault = fault as OP5Fault;
        return (
          op5Fault.faultType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          op5Fault.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          op5Fault.substationName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        const controlOutage = fault as ControlSystemOutage;
        return (
          controlOutage.faultType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (controlOutage.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (controlOutage.areaAffected || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    });
  }, [faults, searchTerm]);

  const handleCreateFault = () => {
    if (user && !permissionService.canAccessFeature(user.role, 'fault_reporting')) {
      navigate("/unauthorized");
      return;
    }
    
    navigate("/faults/report");
  };

  // Check if user has permission to manage faults
  const canManageFaults = user?.role ? permissionService.canAccessFeature(user.role, 'fault_reporting') : false;

  if (!isAuthenticated || loading) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-red-500">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Faults</h1>
              <p className="text-muted-foreground mt-1">
                View and manage all reported faults
              </p>
            </div>
            {canManageFaults && (
              <Button onClick={handleCreateFault}>Report New Fault</Button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={selectedRegion || ""}
                onValueChange={setSelectedRegion}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Regions</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>District</Label>
              <Select
                value={selectedDistrict || ""}
                onValueChange={setSelectedDistrict}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Districts</SelectItem>
                  {districts.map(district => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={selectedStatus || ""}
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search faults..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Faults List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredFaults.map((fault) => {
              const isOP5 = 'substationName' in fault;
              const op5Fault = isOP5 ? fault as OP5Fault : null;
              const controlOutage = !isOP5 ? fault as ControlSystemOutage : null;

              return (
                <Card key={fault.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/faults/${fault.id}`)}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={fault.status === "pending" ? "destructive" : "default"}>
                            {fault.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(fault.occurrenceDate), "PPp")}
                          </span>
                        </div>
                        <h3 className="font-semibold">
                          {isOP5 ? op5Fault?.description : controlOutage?.reason}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {regions.find(r => r.id === fault.regionId)?.name || "Unknown"} • {districts.find(d => d.id === fault.districtId)?.name || "Unknown"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {fault.createdBy?.split(" ").map(n => n[0]).join("") || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{fault.createdBy || "Unknown User"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Label>Page Size:</Label>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {Math.ceil(totalItems / pageSize)}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalItems / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalItems / pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 