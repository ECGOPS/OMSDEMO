import { useState, useMemo, useEffect } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VITAssetsTable } from "@/components/vit/VITAssetsTable";
import { VITAssetForm } from "@/components/vit/VITAssetForm";
import { VITInspectionForm } from "@/components/vit/VITInspectionForm";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VITAsset } from "@/lib/types";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getPendingSyncItems } from "@/utils/db";
import { syncPendingChanges } from "@/utils/sync";
import { initDB } from "@/utils/db";
import { OfflineInspectionService } from "@/services/OfflineInspectionService";
import { VITSyncService } from "@/services/VITSyncService";
import { Card } from "@/components/ui/card";
import { Info, Database, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VITMapView } from '@/components/vit/VITMapView';

export default function VITInspectionPage() {
  const { vitAssets, vitInspections, regions, districts } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("assets");
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [offlineAssets, setOfflineAssets] = useState<VITAsset[]>([]);
  const [inspectionSearchTerm, setInspectionSearchTerm] = useState("");
  const [inspectionSelectedRegion, setInspectionSelectedRegion] = useState<string>("all");
  const [inspectionSelectedDistrict, setInspectionSelectedDistrict] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const offlineStorage = OfflineInspectionService.getInstance();
  const vitSyncService = VITSyncService.getInstance();
  
  // Initialize database on mount
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await initDB();
      } catch (error) {
        console.error('Error initializing database:', error);
        toast.error('Failed to initialize offline storage');
      }
    };
    initializeDatabase();
  }, []);

  // Initialize database and load offline data
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const pendingAssets = await vitSyncService.getPendingVITAssets();
        setOfflineAssets(pendingAssets);
      } catch (error) {
        console.error('Error loading offline assets:', error);
      }
    };

    loadOfflineData();
  }, []);

  // Add effect to handle online/offline status
  useEffect(() => {
    const handleOnlineStatusChange = async () => {
      const isOnlineNow = navigator.onLine;
      setIsOnline(isOnlineNow);
      
      if (isOnlineNow) {
        try {
          // Trigger sync when coming back online
          await vitSyncService.syncAllVITData();
          setForceUpdate(prev => !prev);
          setPendingSync(false);
        } catch (error) {
          console.error('Error syncing data:', error);
          setPendingSync(true);
        }
      }
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  // Handle manual sync
  const handleSync = async () => {
    try {
      await vitSyncService.syncAllVITData();
      setForceUpdate(prev => !prev);
      setPendingSync(false);
    } catch (error) {
      console.error('Error syncing data:', error);
      toast.error('Failed to synchronize data');
    }
  };

  // Combine online and offline assets with duplicate prevention
  const allAssets = useMemo(() => {
    const onlineAssets = vitAssets || [];
    
    // Create a map of online assets for quick lookup
    const onlineAssetsMap = new Map(
      onlineAssets.map(asset => [
        `${asset.serialNumber}_${asset.region}_${asset.district}`,
        asset
      ])
    );

    // Filter offline assets to only include those not already in Firebase
    const uniqueOfflineAssets = offlineAssets.filter(offlineAsset => {
      const assetIdentifier = `${offlineAsset.serialNumber}_${offlineAsset.region}_${offlineAsset.district}`;
      return !onlineAssetsMap.has(assetIdentifier);
    });

    return [...onlineAssets, ...uniqueOfflineAssets];
  }, [vitAssets, offlineAssets]);

  // Filter assets based on user role
  const filteredAssets = useMemo(() => {
    if (!user) return [];
    
    // Use a Map to ensure unique assets by ID
    const uniqueAssets = new Map<string, VITAsset>();
    
    if (user.role === "system_admin" || user.role === "global_engineer") {
      vitAssets.forEach(asset => {
        if (!uniqueAssets.has(asset.id)) {
          uniqueAssets.set(asset.id, asset);
        }
      });
    } else if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") {
      vitAssets
        .filter(asset => asset.region === user.region)
        .forEach(asset => {
          if (!uniqueAssets.has(asset.id)) {
            uniqueAssets.set(asset.id, asset);
          }
        });
    } else if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
      vitAssets
        .filter(asset => asset.district === user.district && asset.region === user.region)
        .forEach(asset => {
          if (!uniqueAssets.has(asset.id)) {
            uniqueAssets.set(asset.id, asset);
          }
        });
    }
    
    return Array.from(uniqueAssets.values());
  }, [vitAssets, user]);

  // Filter inspections based on user role
  const filteredInspections = useMemo(() => {
    if (!user) return [];
    
    let filtered = [];
    
    if (user.role === "system_admin" || user.role === "global_engineer") {
      filtered = vitInspections;
    } else if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") {
      filtered = vitInspections.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.region === user.region;
      });
    } else if (user.role === "ashsub_t" || user.role === "accsub_t") {
      // Filter by allowed regions for ashsub_t and accsub_t
      const allowedRegionNames = user.role === "ashsub_t" 
        ? ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION']
        : ['ACCRA EAST REGION', 'ACCRA WEST REGION', 'SUBTRANSMISSION ACCRA'];
      
      // Get region IDs for the allowed regions
      const allowedRegionIds = regions
        .filter(r => allowedRegionNames.includes(r.name))
        .map(r => r.id);
      
      filtered = vitInspections.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.region && allowedRegionIds.includes(asset.region);
      });
    } else if (user.role === "district_engineer" || user.role === "technician" || user.role === "district_manager") {
      filtered = vitInspections.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.district === user.district && asset?.region === user.region;
      });
    }
    
    // Apply additional filters
    if (inspectionSelectedRegion && inspectionSelectedRegion !== "all") {
      filtered = filtered.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.region === inspectionSelectedRegion;
      });
    }
    
    if (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all") {
      filtered = filtered.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        return asset?.district === inspectionSelectedDistrict;
      });
    }
    
    if (inspectionSearchTerm) {
      filtered = filtered.filter(inspection => {
        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
        if (!asset) return false;
        
        return (
          asset.serialNumber.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
          inspection.inspectedBy.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
          asset.region.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
          asset.district.toLowerCase().includes(inspectionSearchTerm.toLowerCase())
        );
      });
    }
    
    return filtered;
  }, [vitInspections, vitAssets, user, inspectionSearchTerm, inspectionSelectedRegion, inspectionSelectedDistrict]);

  // Add effect to handle asset added events
  useEffect(() => {
    const handleAssetAdded = (event: CustomEvent) => {
      if (event.detail.type === 'vit') {
        // Add the new asset to offline assets immediately
        setOfflineAssets(prev => [...prev, event.detail.asset]);
      }
    };

    window.addEventListener('assetAdded', handleAssetAdded as EventListener);
    return () => {
      window.removeEventListener('assetAdded', handleAssetAdded as EventListener);
    };
  }, []);

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsAssetFormOpen(true);
  };
  
  const handleEditAsset = (asset: VITAsset) => {
    navigate(`/asset-management/edit-vit-asset/${asset.id}`);
  };
  
  const handleAddInspection = (assetId: string) => {
    setSelectedAssetId(assetId);
    setIsInspectionFormOpen(true);
  };
  
  const handleAssetFormClose = () => {
    setIsAssetFormOpen(false);
    setSelectedAsset(null);
  };
  
  const handleInspectionFormClose = () => {
    setIsInspectionFormOpen(false);
    setSelectedAssetId(null);
    // Force a re-render by updating the state
    setForceUpdate(prev => !prev);
    // Reset any other form-related state if needed
    setSelectedAsset(null);
  };
  
  const handleViewInspections = (assetId: string) => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  const clearInspectionFilters = () => {
    setInspectionSearchTerm("");
    setInspectionSelectedRegion("all");
    setInspectionSelectedDistrict("all");
  };

  const clearAssetFilters = () => {
    setSelectedRegion("all");
    setSelectedDistrict("all");
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VITs Inspection</h1>
            <p className="text-muted-foreground mt-1">
              Manage and monitor VIT assets and conduct inspections
            </p>
          </div>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            {!isOnline && (
              <div className="flex items-center gap-2 text-yellow-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>You are offline</span>
              </div>
            )}
            {pendingSync && (
              <Button
                onClick={handleSync}
                variant="outline"
                className="inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="assets">VIT Assets</TabsTrigger>
            <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
            <TabsTrigger value="map">Map View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="assets" className="space-y-6">
            <VITAssetsTable 
              assets={allAssets}
              onAddAsset={handleAddAsset} 
              onEditAsset={handleEditAsset}
              onInspect={handleAddInspection}
              selectedRegion={selectedRegion}
              selectedDistrict={selectedDistrict}
              onRegionChange={setSelectedRegion}
              onDistrictChange={setSelectedDistrict}
            />
          </TabsContent>
          
          <TabsContent value="inspections">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Inspection Records</h2>
                <Button onClick={() => navigate("/asset-management/vit-inspection-management")}>
                  View All Inspections
                </Button>
              </div>
              
              {/* Inspection Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search inspections..."
                    value={inspectionSearchTerm}
                    onChange={(e) => setInspectionSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Select value={inspectionSelectedRegion} onValueChange={setInspectionSelectedRegion}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {regions?.map((region) => (
                        <SelectItem key={region.id} value={region.name}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={inspectionSelectedDistrict} onValueChange={setInspectionSelectedDistrict}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts?.map((district) => (
                        <SelectItem key={district.id} value={district.name}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {(inspectionSearchTerm || (inspectionSelectedRegion && inspectionSelectedRegion !== "all") || (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all")) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearInspectionFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Filter Summary */}
              {(inspectionSearchTerm || (inspectionSelectedRegion && inspectionSelectedRegion !== "all") || (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all")) && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                  {inspectionSearchTerm && (
                    <Badge variant="secondary" className="text-xs">
                      Search: "{inspectionSearchTerm}"
                    </Badge>
                  )}
                  {inspectionSelectedRegion && inspectionSelectedRegion !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      Region: {inspectionSelectedRegion}
                    </Badge>
                  )}
                  {inspectionSelectedDistrict && inspectionSelectedDistrict !== "all" && (
                    <Badge variant="secondary" className="text-xs">
                      District: {inspectionSelectedDistrict}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearInspectionFilters}
                    className="h-6 px-2 text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              )}
              
              <div className="rounded-md border overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Asset</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">District</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Inspector</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredInspections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">
                          {(inspectionSearchTerm || (inspectionSelectedRegion && inspectionSelectedRegion !== "all") || (inspectionSelectedDistrict && inspectionSelectedDistrict !== "all"))
                            ? "No inspection records found matching your filter criteria. Try adjusting your filters."
                            : "No inspection records found"}
                        </td>
                      </tr>
                    ) : (
                      filteredInspections.map(inspection => {
                        const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
                        if (!asset) return null;
                        
                        const region = regions.find(r => r.name === asset.region)?.name || "Unknown";
                        const district = districts.find(d => d.name === asset.district)?.name || "Unknown";
                        
                        return (
                          <tr key={`inspection-${inspection.id}`} className="hover:bg-muted/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {new Date(inspection.inspectionDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                              {asset.serialNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {region}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {district}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              {inspection.inspectedBy}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewInspections(asset.id)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="map" className="space-y-6">
            <VITMapView 
              assets={allAssets}
              selectedRegion={selectedRegion}
              selectedDistrict={selectedDistrict}
            />
          </TabsContent>
        </Tabs>

        {/* Asset Form Sheet */}
        <Sheet open={isAssetFormOpen} onOpenChange={(open) => {
          if (!open) {
            handleAssetFormClose();
          }
        }}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedAsset ? "Edit VIT Asset" : "Add New VIT Asset"}</SheetTitle>
              <SheetDescription>
                {selectedAsset 
                  ? "Update the information for this VIT asset" 
                  : "Fill in the details to add a new VIT asset"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <VITAssetForm 
                asset={selectedAsset || undefined} 
                onSubmit={() => {
                  handleAssetFormClose();
                  setIsAssetFormOpen(false);
                }}
                onCancel={() => {
                  handleAssetFormClose();
                  setIsAssetFormOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Inspection Form Sheet */}
        <Sheet open={isInspectionFormOpen} onOpenChange={setIsInspectionFormOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>New Inspection</SheetTitle>
              <SheetDescription>
                Complete the inspection checklist for this VIT asset
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <VITInspectionForm 
                assetId={selectedAssetId || undefined}
                onSubmit={handleInspectionFormClose}
                onCancel={handleInspectionFormClose}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
