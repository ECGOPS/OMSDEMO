import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Layout } from "@/components/layout/Layout";
import { VITInspectionForm } from "@/components/vit/VITInspectionForm";
import { VITAssetsTable } from "@/components/vit/VITAssetsTable";
import { VITAssetForm } from "@/components/vit/VITAssetForm";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import "jspdf-autotable"; // Import the autotable plugin
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PlusCircle, Eye, Pencil, Download, FileText, Trash2, MoreHorizontal, Edit
} from "lucide-react";
import { VITAsset, VITInspectionChecklist } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessControlWrapper } from '@/components/access-control/AccessControlWrapper';
import { useAuth } from "@/contexts/AuthContext";
import { getFirestore, collection, query, where, orderBy, limit, startAfter, getCountFromServer, getDocs } from 'firebase/firestore';
import { debounce } from 'lodash';

// Add type declaration for jsPDF with autotable extensions
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY?: number;
    };
    autoTable: (options: any) => jsPDF;
  }
}

export default function VITInspectionManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vitAssets, vitInspections, regions, districts, setVITInspections } = useData();
  const [activeTab, setActiveTab] = useState("assets");
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<VITInspectionChecklist | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for frequently accessed data
  const [dataCache, setDataCache] = useState<{ [key: string]: any[] }>({});
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${selectedRegion}-${selectedDistrict}-${selectedStatus}-${searchTerm}-${user?.role}-${user?.region}-${user?.district}`;
  }, [selectedRegion, selectedDistrict, selectedStatus, searchTerm, user]);

  // Optimize data loading with pagination and caching
  const loadData = useCallback(async (resetPagination = false) => {
    setIsLoading(true);
    try {
      const db = getFirestore();
      const inspectionsRef = collection(db, "vitInspections");
      
      // Build query based on filters
      let q = query(inspectionsRef);
      
      // Apply role-based filtering
      if (user?.role === 'global_engineer' || user?.role === 'system_admin') {
        // No filtering for global engineers or system admins
      } else if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
        if (user.region) {
          q = query(q, where("region", "==", user.region));
        } else {
          console.warn("Regional/project engineer missing region assignment", user);
        }
      } else if (user?.role === 'district_engineer' || user?.role === 'technician' || user?.role === 'district_manager') {
        if (user.district && user.region) {
          q = query(q, where("district", "==", user.district), where("region", "==", user.region));
        } else {
          console.warn("District role missing district or region assignment", user);
        }
      }

      // Apply additional filters
      if (selectedRegion) {
        q = query(q, where("region", "==", selectedRegion));
      }
      if (selectedDistrict) {
        q = query(q, where("district", "==", selectedDistrict));
      }
      if (searchTerm) {
        // Use compound queries for better performance
        q = query(
          q,
          where("inspectedBy", ">=", searchTerm),
          where("inspectedBy", "<=", searchTerm + '\uf8ff')
        );
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
      
      // Apply pagination with optimized query
      q = query(
        q,
        orderBy("inspectionDate", "desc"),
        limit(pageSize)
      );
      
      if (lastVisible && !resetPagination) {
        q = query(q, startAfter(lastVisible));
      }

      const querySnapshot = await getDocs(q);
      const newInspections = querySnapshot.docs.map(doc => ({
        id: doc.id,
        vitAssetId: doc.data().vitAssetId || "",
        region: doc.data().region || "",
        district: doc.data().district || "",
        inspectionDate: doc.data().inspectionDate || new Date().toISOString(),
        inspectedBy: doc.data().inspectedBy || "unknown",
        rodentTermiteEncroachment: doc.data().rodentTermiteEncroachment || "No",
        cleanDustFree: doc.data().cleanDustFree || "No",
        protectionButtonEnabled: doc.data().protectionButtonEnabled || "No",
        recloserButtonEnabled: doc.data().recloserButtonEnabled || "No",
        groundEarthButtonEnabled: doc.data().groundEarthButtonEnabled || "No",
        acPowerOn: doc.data().acPowerOn || "No",
        batteryPowerLow: doc.data().batteryPowerLow || "No",
        handleLockOn: doc.data().handleLockOn || "No",
        remoteButtonEnabled: doc.data().remoteButtonEnabled || "No",
        gasLevelLow: doc.data().gasLevelLow || "No",
        earthingArrangementAdequate: doc.data().earthingArrangementAdequate || "No",
        noFusesBlown: doc.data().noFusesBlown || "No",
        noDamageToBushings: doc.data().noDamageToBushings || "No",
        noDamageToHVConnections: doc.data().noDamageToHVConnections || "No",
        insulatorsClean: doc.data().insulatorsClean || "No",
        paintworkAdequate: doc.data().paintworkAdequate || "No",
        ptFuseLinkIntact: doc.data().ptFuseLinkIntact || "No",
        noCorrosion: doc.data().noCorrosion || "No",
        silicaGelCondition: doc.data().silicaGelCondition || "Good",
        correctLabelling: doc.data().correctLabelling || "No",
        remarks: doc.data().remarks || "",
        createdBy: doc.data().createdBy || "unknown",
        createdAt: doc.data().createdAt || new Date().toISOString(),
        updatedAt: doc.data().updatedAt || new Date().toISOString()
      })) as VITInspectionChecklist[];

      // Update cache with paginated data
      const updatedCache = { ...dataCache };
      const pageKey = `${cacheKey}-${currentPage}`;
      updatedCache[pageKey] = newInspections;
      setDataCache(updatedCache);
      
      // Update last visible document for pagination
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
      setHasMore(querySnapshot.docs.length === pageSize);
      
      // Update inspections with paginated data
      if (resetPagination) {
        setVITInspections(newInspections);
      } else {
        setVITInspections(prev => [...prev, ...newInspections]);
      }
    } catch (err) {
      setError("Failed to load inspections");
      console.error("Error loading inspections:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, currentPage, pageSize, lastVisible, selectedRegion, selectedDistrict, searchTerm, dataCache, totalCountCache, getCacheKey, setVITInspections]);

  // Load data on mount and when filters change
  useEffect(() => {
    loadData(true);
  }, [selectedRegion, selectedDistrict, selectedStatus, searchTerm]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  }, [isLoading, hasMore, loadData]);

  // Optimize filtered inspections with useMemo and virtual scrolling
  const filteredInspections = useMemo(() => {
    if (!vitInspections) return [];
    
    let filtered = vitInspections;
    
    // Apply role-based filtering
    if (user?.role === 'global_engineer' || user?.role === 'system_admin') {
      // See all
    } else if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
      if (user.region) {
        filtered = filtered.filter(inspection => inspection.region === user.region);
      } else {
        console.warn("Regional/project engineer missing region assignment", user);
        filtered = [];
      }
    } else if (user?.role === 'district_engineer' || user?.role === 'technician' || user?.role === 'district_manager') {
      if (user.district && user.region) {
        filtered = filtered.filter(inspection => inspection.district === user.district && inspection.region === user.region);
      } else {
        console.warn("District role missing district or region assignment", user);
        filtered = [];
      }
    }
    
    // Apply region filter
    if (selectedRegion) {
      filtered = filtered.filter(inspection => inspection.region === selectedRegion);
    }
    
    // Apply district filter
    if (selectedDistrict) {
      filtered = filtered.filter(inspection => inspection.district === selectedDistrict);
    }
    
    // Apply search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(inspection => 
        inspection.inspectedBy?.toLowerCase().includes(lowerCaseSearchTerm) ||
        inspection.remarks?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    
    return filtered;
  }, [vitInspections, user, selectedRegion, selectedDistrict, searchTerm]);

  // Add debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  // Add infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (
      target.scrollHeight - target.scrollTop === target.clientHeight &&
      !isLoading &&
      hasMore
    ) {
      handleLoadMore();
    }
  }, [isLoading, hasMore, handleLoadMore]);

  // Add cleanup for debounced search
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsAssetFormOpen(true);
  };

  const handleEditAsset = (asset: VITAsset) => {
    setSelectedAsset(asset);
    setIsAssetFormOpen(true);
  };

  const handleAddInspection = (assetId: string) => {
    setSelectedAssetId(assetId);
    setSelectedInspection(null);
    setIsInspectionFormOpen(true);
  };

  const handleCloseAssetForm = () => {
    setIsAssetFormOpen(false);
    setSelectedAsset(null);
  };

  const handleCloseInspectionForm = () => {
    setIsInspectionFormOpen(false);
    setSelectedInspection(null);
    setSelectedAssetId("");
  };

  const handleInspectionSubmit = (data: Partial<VITInspectionChecklist>) => {
    // Close the form first
    handleCloseInspectionForm();
    // Then refresh the data
    loadData(true);
  };

  const handleViewDetails = (inspection: VITInspectionChecklist) => {
    setSelectedInspection(inspection);
    setIsDetailsDialogOpen(true);
  };

  const handleEditInspection = (inspection: VITInspectionChecklist) => {
    setSelectedInspection(inspection);
    setSelectedAssetId(inspection.vitAssetId);
    setIsInspectionFormOpen(true);
  };
  
  const handleViewAsset = (assetId: string) => {
    navigate(`/asset-management/vit-inspection-details/${assetId}`);
  };

  return (
    <AccessControlWrapper type="inspection">
      <Layout>
        <div className="container py-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">VIT Inspection Management</h1>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="assets">Assets Management</TabsTrigger>
                <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
              </TabsList>
              
              <TabsContent value="assets" className="space-y-4">
                <VITAssetsTable 
                  onAddAsset={handleAddAsset}
                  onEditAsset={handleEditAsset}
                  onInspect={handleAddInspection}
                />
                
                <Button
                  onClick={handleAddAsset}
                  className="mt-4"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New VIT Asset
                </Button>
              </TabsContent>
              
              <TabsContent value="inspections" className="space-y-4 bg-card p-6 rounded-md">
                <InspectionRecordsTable 
                  onViewDetails={handleViewDetails} 
                  onEditInspection={handleEditInspection}
                  onViewAsset={handleViewAsset}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Asset Form Sheet */}
        <Sheet open={isAssetFormOpen} onOpenChange={setIsAssetFormOpen}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedAsset ? "Edit VIT Asset" : "Add New VIT Asset"}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <VITAssetForm
                asset={selectedAsset ?? undefined}
                onSubmit={handleCloseAssetForm}
                onCancel={handleCloseAssetForm}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Inspection Form Sheet - Used for both Add and Edit */}
        <Sheet 
          open={isInspectionFormOpen} 
          onOpenChange={(open) => {
            if (!open) {
              handleCloseInspectionForm();
            }
          }}
        >
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedInspection ? "Edit VIT Inspection" : "Add VIT Inspection"}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <VITInspectionForm
                assetId={selectedAssetId}
                inspectionData={selectedInspection}
                onSubmit={handleInspectionSubmit}
                onCancel={handleCloseInspectionForm}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Inspection Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>VIT Inspection Details</DialogTitle>
              <DialogDescription>
                Inspection performed on {selectedInspection ? new Date(selectedInspection.inspectionDate).toLocaleDateString() : ""}
              </DialogDescription>
            </DialogHeader>
            {selectedInspection && <InspectionDetailsView inspection={selectedInspection} />}
          </DialogContent>
        </Dialog>
      </Layout>
    </AccessControlWrapper>
  );
}

// Internal component for inspection details view
function InspectionDetailsView({ inspection }: { inspection: VITInspectionChecklist }) {
  const { vitAssets, regions, districts } = useData();
  const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
  const region = asset?.region || "Unknown";
  const district = asset?.district || "Unknown";

  const getStatusDisplay = (value: string) => {
    if (value === "Yes") return <span className="text-green-600 font-medium">Yes</span>;
    if (value === "No") return <span className="text-red-600 font-medium">No</span>;
    if (value === "Good") return <span className="text-green-600 font-medium">Good</span>;
    if (value === "Bad") return <span className="text-red-600 font-medium">Bad</span>;
    return value;
  };

  const checklistItems = [
    { label: "Rodent/Termite Encroachment", value: inspection.rodentTermiteEncroachment, isIssue: inspection.rodentTermiteEncroachment === "Yes" },
    { label: "Clean and Dust Free", value: inspection.cleanDustFree, isIssue: inspection.cleanDustFree === "No" },
    { label: "Protection Button Enabled", value: inspection.protectionButtonEnabled, isIssue: inspection.protectionButtonEnabled === "No" },
    { label: "Recloser Button Enabled", value: inspection.recloserButtonEnabled, isIssue: inspection.recloserButtonEnabled === "No" },
    { label: "Ground Earth Button Enabled", value: inspection.groundEarthButtonEnabled, isIssue: inspection.groundEarthButtonEnabled === "No" },
    { label: "AC Power On", value: inspection.acPowerOn, isIssue: inspection.acPowerOn === "No" },
    { label: "Battery Power Low", value: inspection.batteryPowerLow, isIssue: inspection.batteryPowerLow === "Yes" },
    { label: "Handle Lock On", value: inspection.handleLockOn, isIssue: inspection.handleLockOn === "No" },
    { label: "Remote Button Enabled", value: inspection.remoteButtonEnabled, isIssue: inspection.remoteButtonEnabled === "No" },
    { label: "Gas Level Low", value: inspection.gasLevelLow, isIssue: inspection.gasLevelLow === "Yes" },
    { label: "Earthing Arrangement Adequate", value: inspection.earthingArrangementAdequate, isIssue: inspection.earthingArrangementAdequate === "No" },
    { label: "No Fuses Blown", value: inspection.noFusesBlown, isIssue: inspection.noFusesBlown === "No" },
    { label: "No Damage to Bushings", value: inspection.noDamageToBushings, isIssue: inspection.noDamageToBushings === "No" },
    { label: "No Damage to HV Connections", value: inspection.noDamageToHVConnections, isIssue: inspection.noDamageToHVConnections === "No" },
    { label: "Insulators Clean", value: inspection.insulatorsClean, isIssue: inspection.insulatorsClean === "No" },
    { label: "Paintwork Adequate", value: inspection.paintworkAdequate, isIssue: inspection.paintworkAdequate === "No" },
    { label: "PT Fuse Link Intact", value: inspection.ptFuseLinkIntact, isIssue: inspection.ptFuseLinkIntact === "No" },
    { label: "No Corrosion", value: inspection.noCorrosion, isIssue: inspection.noCorrosion === "No" },
    { label: "Silica Gel Condition", value: inspection.silicaGelCondition, isIssue: inspection.silicaGelCondition === "Bad" },
    { label: "Correct Labelling", value: inspection.correctLabelling, isIssue: inspection.correctLabelling === "No" },
  ];

  const issuesCount = checklistItems.filter(item => item.isIssue).length;

  return (
    <div className="space-y-6 py-4">
      {/* Asset Information */}
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-medium mb-2">Asset Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
            <p className="text-base">{asset?.serialNumber || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Type</p>
            <p className="text-base">{asset?.typeOfUnit || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Region</p>
            <p className="text-base">{region}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">District</p>
            <p className="text-base">{district}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Location</p>
            <p className="text-base">{asset?.location || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <p className="text-base">{asset?.status || "Unknown"}</p>
          </div>
        </div>
      </div>

      {/* Inspection Information */}
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-3">Inspection Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Date</p>
            <p className="text-base">{new Date(inspection.inspectionDate).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Inspector</p>
            <p className="text-base">{inspection.inspectedBy}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Issues Found</p>
            <p className={`text-base ${issuesCount > 0 ? "text-red-600" : "text-green-600"}`}>
              {issuesCount} {issuesCount === 1 ? "issue" : "issues"}
            </p>
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspection Item</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {checklistItems.map((item, index) => (
                <tr key={index} className={item.isIssue ? "bg-red-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.label}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusDisplay(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remarks */}
      {inspection.remarks && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Remarks</h3>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm">{inspection.remarks}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal component for inspection records table with standardized actions matching the asset table
function InspectionRecordsTable({ onViewDetails, onEditInspection, onViewAsset }: { 
  onViewDetails: (inspection: VITInspectionChecklist) => void;
  onEditInspection: (inspection: VITInspectionChecklist) => void;
  onViewAsset: (assetId: string) => void;
}) {
  const { vitInspections, vitAssets, regions, districts, deleteVITInspection } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // Filter inspections based on user role and search term
  const filteredInspections = vitInspections.filter(inspection => {
    const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
    if (!asset) return false;

    // First apply role-based filtering
    let roleBasedAccess = true;
    if (user?.role === "global_engineer") {
      roleBasedAccess = true;
    } else if (user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager") {
      const userRegion = regions.find(r => r.name === user.region);
      roleBasedAccess = userRegion ? asset.region === userRegion.id : false;
    } else if ((user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.region && user.district) {
      const userRegion = regions.find(r => r.name === user.region);
      const userDistrict = districts.find(d => d.name === user.district);
      roleBasedAccess = userRegion && userDistrict ? 
        asset.region === userRegion.id && asset.district === userDistrict.id : false;
    }

    if (!roleBasedAccess) return false;

    // Then apply search filtering if there's a search term
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      const region = regions.find(r => r.id === asset.region)?.name || "";
      const district = districts.find(d => d.id === asset.district)?.name || "";
      
      return (
        asset.serialNumber.toLowerCase().includes(lowercaseSearch) ||
        asset.location.toLowerCase().includes(lowercaseSearch) ||
        region.toLowerCase().includes(lowercaseSearch) ||
        district.toLowerCase().includes(lowercaseSearch) ||
        inspection.inspectedBy.toLowerCase().includes(lowercaseSearch)
      );
    }

    return true;
  });

  const handleDeleteInspection = (id: string) => {
    if (window.confirm("Are you sure you want to delete this inspection record?")) {
      deleteVITInspection(id);
      toast.success("Inspection record deleted successfully");
    }
  };

  const exportToPDF = (inspection: VITInspectionChecklist) => {
    const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
    if (!asset) {
      toast.error("Asset information not found");
      return;
    }
    
    const region = regions.find(r => r.id === asset.region)?.name || "Unknown";
    const district = districts.find(d => d.id === asset.district)?.name || "Unknown";
    
    // Create PDF document
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(0, 51, 102);
    doc.text("VIT Inspection Report", 14, 20);
    
    // Add date and inspector info
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${format(new Date(inspection.inspectionDate), "dd/MM/yyyy")}`, 14, 30);
    doc.text(`Inspector: ${inspection.inspectedBy}`, 14, 36);
    
    // Add asset information
    doc.setFontSize(14);
    doc.setTextColor(0, 51, 102);
    doc.text("Asset Information", 14, 46);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Serial Number: ${asset.serialNumber}`, 14, 54);
    doc.text(`Type of Unit: ${asset.typeOfUnit}`, 14, 60);
    doc.text(`Voltage Level: ${asset.voltageLevel}`, 14, 66);
    doc.text(`Region: ${region}`, 114, 54);
    doc.text(`District: ${district}`, 114, 60);
    doc.text(`Location: ${asset.location}`, 114, 66);
    
    // Add inspection checklist
    doc.setFontSize(14);
    doc.setTextColor(0, 51, 102);
    doc.text("Inspection Checklist", 14, 78);
    
    // Create inspection items table data
    const checklistItems = [
      ["Item", "Status"],
      ["Rodent/Termite Encroachment", inspection.rodentTermiteEncroachment],
      ["Clean and Dust Free", inspection.cleanDustFree],
      ["Protection Button Enabled", inspection.protectionButtonEnabled],
      ["Recloser Button Enabled", inspection.recloserButtonEnabled],
      ["Ground Earth Button Enabled", inspection.groundEarthButtonEnabled],
      ["AC Power On", inspection.acPowerOn],
      ["Battery Power Low", inspection.batteryPowerLow],
      ["Handle Lock On", inspection.handleLockOn],
      ["Remote Button Enabled", inspection.remoteButtonEnabled],
      ["Gas Level Low", inspection.gasLevelLow],
      ["Earthing Arrangement Adequate", inspection.earthingArrangementAdequate],
      ["No Fuses Blown", inspection.noFusesBlown],
      ["No Damage to Bushings", inspection.noDamageToBushings],
      ["No Damage to HV Connections", inspection.noDamageToHVConnections],
      ["Insulators Clean", inspection.insulatorsClean],
      ["Paintwork Adequate", inspection.paintworkAdequate],
      ["PT Fuse Link Intact", inspection.ptFuseLinkIntact],
      ["No Corrosion", inspection.noCorrosion],
      ["Silica Gel Condition", inspection.silicaGelCondition],
      ["Correct Labelling", inspection.correctLabelling]
    ];
    
    doc.autoTable({
      startY: 84,
      head: [checklistItems[0]],
      body: checklistItems.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
      styles: { cellPadding: 3, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 }
      }
    });
    
    // Get the final y position after the table
    let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : 200;
    
    if (inspection.remarks) {
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text("Remarks", 14, finalY + 15);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(inspection.remarks, 14, finalY + 25, {
        maxWidth: 180
      });
    }
    
    // Save PDF
    doc.save(`vit-inspection-${asset.serialNumber}-${format(new Date(inspection.inspectionDate), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF report generated successfully");
  };

  const exportToCSV = (inspection: VITInspectionChecklist) => {
    const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
    if (!asset) {
      toast.error("Asset information not found");
      return;
    }
    
    const region = regions.find(r => r.id === asset.region)?.name || "Unknown";
    const district = districts.find(d => d.id === asset.district)?.name || "Unknown";
    
    // Create CSV content
    const csvContent = [
      ["VIT Inspection Report"],
      ["Date", format(new Date(inspection.inspectionDate), "dd/MM/yyyy")],
      ["Inspector", inspection.inspectedBy],
      [],
      ["Asset Information"],
      ["Serial Number", asset.serialNumber],
      ["Type of Unit", asset.typeOfUnit],
      ["Voltage Level", asset.voltageLevel],
      ["Region", region],
      ["District", district],
      ["Location", asset.location],
      [],
      ["Inspection Checklist"],
      ["Item", "Status"],
      ["Rodent/Termite Encroachment", inspection.rodentTermiteEncroachment],
      ["Clean and Dust Free", inspection.cleanDustFree],
      ["Protection Button Enabled", inspection.protectionButtonEnabled],
      ["Recloser Button Enabled", inspection.recloserButtonEnabled],
      ["Ground Earth Button Enabled", inspection.groundEarthButtonEnabled],
      ["AC Power On", inspection.acPowerOn],
      ["Battery Power Low", inspection.batteryPowerLow],
      ["Handle Lock On", inspection.handleLockOn],
      ["Remote Button Enabled", inspection.remoteButtonEnabled],
      ["Gas Level Low", inspection.gasLevelLow],
      ["Earthing Arrangement Adequate", inspection.earthingArrangementAdequate],
      ["No Fuses Blown", inspection.noFusesBlown],
      ["No Damage to Bushings", inspection.noDamageToBushings],
      ["No Damage to HV Connections", inspection.noDamageToHVConnections],
      ["Insulators Clean", inspection.insulatorsClean],
      ["Paintwork Adequate", inspection.paintworkAdequate],
      ["PT Fuse Link Intact", inspection.ptFuseLinkIntact],
      ["No Corrosion", inspection.noCorrosion],
      ["Silica Gel Condition", inspection.silicaGelCondition],
      ["Correct Labelling", inspection.correctLabelling]
    ];
    
    if (inspection.remarks) {
      csvContent.push([], ["Remarks"], [inspection.remarks]);
    }
    
    // Convert to CSV string
    const csvString = csvContent.map(row => row.join(",")).join("\n");
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `vit-inspection-${asset.serialNumber}-${format(new Date(inspection.inspectionDate), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV report generated successfully");
  };
  
  const handleViewInspectionDetails = (inspection: VITInspectionChecklist) => {
    onViewAsset(inspection.vitAssetId);
  };

  const handleEditInspectionDetails = (inspection: VITInspectionChecklist) => {
    navigate(`/asset-management/edit-vit-inspection/${inspection.id}`);
  };
  
  return (
    <div>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search inspections by serial number, location, region or district..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border rounded-md w-full"
        />
      </div>

      <div className="rounded-md border">
        <div className="relative">
          <div className="overflow-x-auto">
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Asset</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Region</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">District</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Inspector</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Issues</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider sticky right-0 bg-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredInspections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-sm text-muted-foreground">
                        {searchTerm ? "No inspections found matching your search" : "No inspection records found"}
                      </td>
                    </tr>
                  ) : (
                    filteredInspections.map(inspection => {
                      const asset = vitAssets.find(a => a.id === inspection.vitAssetId);
                      if (!asset) return null;
                      
                      const region = asset.region || "Unknown";
                      const district = asset.district || "Unknown";
                      
                      // Count issues
                      const issuesCount = Object.entries(inspection).reduce((count, [key, value]) => {
                        // Check only Yes/No fields for issues (Yes for negative fields, No for positive fields)
                        if (key === 'rodentTermiteEncroachment' && value === 'Yes') return count + 1;
                        if (key === 'batteryPowerLow' && value === 'Yes') return count + 1;
                        if (key === 'gasLevelLow' && value === 'Yes') return count + 1;
                        if (key === 'silicaGelCondition' && value === 'Bad') return count + 1;
                        
                        // All other boolean fields where "No" is an issue
                        if (
                          ['cleanDustFree', 'protectionButtonEnabled', 'recloserButtonEnabled', 
                           'groundEarthButtonEnabled', 'acPowerOn', 'handleLockOn', 'remoteButtonEnabled', 
                           'earthingArrangementAdequate', 'noFusesBlown', 'noDamageToBushings', 
                           'noDamageToHVConnections', 'insulatorsClean', 'paintworkAdequate', 
                           'ptFuseLinkIntact', 'noCorrosion', 'correctLabelling'].includes(key) && 
                           value === 'No'
                        ) {
                          return count + 1;
                        }
                        
                        return count;
                      }, 0);
                      
                      return (
                        <tr
                          key={inspection.id}
                          onClick={e => {
                            // Prevent row click if clicking inside the Actions cell
                            if ((e.target as HTMLElement).closest('td')?.classList.contains('actions-cell')) return;
                            onViewDetails(inspection);
                          }}
                          className="cursor-pointer hover:bg-muted transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground sticky left-0 bg-card">
                            {new Date(inspection.inspectionDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground bg-card">
                            {asset.serialNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {region}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {district}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            {inspection.inspectedBy}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground bg-card">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              issuesCount > 0 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                            }`}>
                              {issuesCount} {issuesCount === 1 ? "issue" : "issues"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-card actions-cell">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onViewDetails(inspection)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onViewAsset(asset.id)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Asset
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEditInspection(inspection)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteInspection(inspection.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

