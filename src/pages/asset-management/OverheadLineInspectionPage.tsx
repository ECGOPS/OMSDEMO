import { useState, useEffect, useMemo } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OverheadLineInspectionForm } from "@/components/overhead-line/OverheadLineInspectionForm";
import { OverheadLineInspectionsTable } from "@/components/overhead-line/OverheadLineInspectionsTable";
import { PlusCircle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { NetworkInspection } from "@/lib/types";
import { OverheadLineInspectionDetails } from "@/components/overhead-line/OverheadLineInspectionDetails";
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { InspectionDetailsView } from "@/components/inspection/InspectionDetailsView";
import { useNavigate } from "react-router-dom";
import { OfflineInspectionService } from "@/services/OfflineInspectionService";
import { OverheadLineInspectionDetailsView } from "@/components/overhead-line/OverheadLineInspectionDetailsView";

export default function OverheadLineInspectionPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("inspections");
  const [isInspectionFormOpen, setIsInspectionFormOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<NetworkInspection | null>(null);
  const [editingInspection, setEditingInspection] = useState<NetworkInspection | null>(null);
  const { networkInspections, updateNetworkInspection, deleteNetworkInspection, addNetworkInspection, districts, regions } = useData();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedFeeder, setSelectedFeeder] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();
  const offlineStorage = OfflineInspectionService.getInstance();
  const [offlineInspections, setOfflineInspections] = useState<NetworkInspection[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncCompleted, setSyncCompleted] = useState(0);
  const [syncFailed, setSyncFailed] = useState(0);
  const [showSyncProgress, setShowSyncProgress] = useState(false);

  // Load offline inspections
  useEffect(() => {
    const handleOfflineInspectionsUpdate = (event: CustomEvent) => {
      setOfflineInspections(event.detail.inspections);
    };

    // Load initial offline inspections
    setOfflineInspections(offlineStorage.getOfflineInspections());

    window.addEventListener('offlineInspectionsUpdated', handleOfflineInspectionsUpdate as EventListener);

    return () => {
      window.removeEventListener('offlineInspectionsUpdated', handleOfflineInspectionsUpdate as EventListener);
    };
  }, [offlineStorage]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      offlineStorage.syncPendingInspections();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineStorage]);

  // Filter districts based on selected region
  const filteredDistricts = useMemo(() => {
    if (!selectedRegion) return districts;
    return districts.filter(d => d.regionId === selectedRegion);
  }, [districts, selectedRegion]);

  // Filter inspections based on user's role and assigned district/region
  const filteredInspections = useMemo(() => {
    // Combine online and offline inspections
    const allInspections = [
      ...(networkInspections || []),
      ...offlineInspections
    ];
    
    let filtered = allInspections;
    
    // Apply role-based filtering
    if (user?.role === 'district_engineer' || user?.role === 'technician') {
      filtered = filtered.filter(inspection => inspection.district === user.district);
    } else if (user?.role === 'regional_engineer' || user?.role === 'project_engineer') {
      filtered = filtered.filter(inspection => inspection.region === user.region);
    }
    
    // Apply date filter
    if (selectedDate) {
      filtered = filtered.filter(inspection => {
        const inspectionDate = new Date(inspection.date || inspection.createdAt);
        return inspectionDate.toDateString() === selectedDate.toDateString();
      });
    }
    
    // Apply month filter
    if (selectedMonth) {
      filtered = filtered.filter(inspection => {
        const inspectionDate = new Date(inspection.date || inspection.createdAt);
        return inspectionDate.getMonth() === selectedMonth.getMonth() && 
               inspectionDate.getFullYear() === selectedMonth.getFullYear();
      });
    }
    
    // Apply region filter (for global engineer and admin)
    if (selectedRegion && (user?.role === 'global_engineer' || user?.role === 'system_admin')) {
      const selectedRegionName = regions.find(r => r.id === selectedRegion)?.name;
      if (selectedRegionName) {
        filtered = filtered.filter(inspection => inspection.region === selectedRegionName);
      }
    }
    
    // Apply district filter (for regional engineer and above)
    if (selectedDistrict && 
        (user?.role === 'global_engineer' || 
         user?.role === 'system_admin' || 
         user?.role === 'regional_engineer')) {
      const selectedDistrictName = districts.find(d => d.id === selectedDistrict)?.name;
      if (selectedDistrictName) {
        filtered = filtered.filter(inspection => inspection.district === selectedDistrictName);
      }
    }

    // Apply feeder filter
    if (selectedFeeder) {
      filtered = filtered.filter(inspection => inspection.feederName === selectedFeeder);
    }

    // Apply status filter
    if (selectedStatus) {
      filtered = filtered.filter(inspection => inspection.status === selectedStatus);
    }
    
    return filtered;
  }, [networkInspections, offlineInspections, user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, selectedFeeder, selectedStatus, regions, districts]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredInspections.length / pageSize);
  const paginatedInspections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInspections.slice(start, start + pageSize);
  }, [filteredInspections, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedMonth, selectedRegion, selectedDistrict, selectedFeeder, selectedStatus, networkInspections]);

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedDate(null);
    setSelectedMonth(null);
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setSelectedFeeder(null);
    setSelectedStatus(null);
  };

  const handleAddInspection = () => {
    setEditingInspection(null);
    setIsInspectionFormOpen(true);
  };

  const handleInspectionFormClose = () => {
    setIsInspectionFormOpen(false);
    setEditingInspection(null);
  };

  const handleViewInspection = (inspection: NetworkInspection) => {
    setSelectedInspection(inspection);
    setIsDetailsDialogOpen(true);
  };

  const handleEditInspection = (inspection: NetworkInspection) => {
    setEditingInspection(inspection);
    setIsInspectionFormOpen(true);
  };

  const handleDeleteInspection = async (inspection: NetworkInspection) => {
    try {
      await deleteNetworkInspection(inspection.id);
      toast.success("Inspection deleted successfully");
    } catch (error) {
      toast.error("Failed to delete inspection");
    }
  };

  const handleFormSubmit = async (inspection: NetworkInspection) => {
    try {
      if (editingInspection) {
        await updateNetworkInspection(editingInspection.id, inspection);
        toast.success("Inspection updated successfully");
      } else {
        await addNetworkInspection(inspection);
        toast.success("Inspection created successfully");
      }
      setIsInspectionFormOpen(false);
      setEditingInspection(null);
    } catch (error) {
      toast.error(editingInspection ? "Failed to update inspection" : "Failed to create inspection");
    }
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    try {
      const pending = await offlineStorage.getPendingInspections();
      if (!navigator.onLine) {
        toast.error("You're offline. Connect to the internet to sync.");
        return;
      }
      if (pending.length === 0) {
        toast.info("No offline inspections to sync");
        return;
      }
      setIsSyncing(true);
      setShowSyncProgress(true);
      setSyncTotal(pending.length);
      setSyncCompleted(0);
      setSyncFailed(0);

      const onSynced = (event: Event) => {
        const e = event as CustomEvent<any>;
        if (e.detail?.status === 'success') {
          setSyncCompleted(prev => prev + 1);
        } else if (e.detail?.status === 'error') {
          setSyncFailed(prev => prev + 1);
        }
      };
      window.addEventListener('inspectionSynced', onSynced as EventListener);
      try {
        await offlineStorage.syncPendingInspections();
        if (syncFailed === 0) {
          toast.success("Sync completed");
        } else {
          toast.success("Sync completed with some errors");
        }
      } finally {
        window.removeEventListener('inspectionSynced', onSynced as EventListener);
        setIsSyncing(false);
        setTimeout(() => setShowSyncProgress(false), 1500);
      }
    } catch (error) {
      setIsSyncing(false);
      toast.error("Failed to start sync");
    }
  };

  return (
    <AccessControlWrapper type="inspection">
      <Layout>
        <div className="container py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Network Inspection</h1>
              <p className="text-muted-foreground mt-1">
                Manage and monitor network inspections
              </p>
              {isOffline && (
                <p className="text-sm text-yellow-600 mt-1">
                  You are currently offline. Changes will be saved locally and synced when you're back online.
                  {offlineInspections.length > 0 && (
                    <span> You have {offlineInspections.length} inspection{offlineInspections.length === 1 ? '' : 's'} saved offline.</span>
                  )}
                </p>
              )}
              {showSyncProgress && (
                <div className="mt-3 space-y-1">
                  <div className="h-2 w-full max-w-md bg-secondary rounded">
                    <div
                      className="h-2 bg-primary rounded"
                      style={{ width: `${syncTotal ? Math.min(100, Math.round(((syncCompleted + syncFailed) / syncTotal) * 100)) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Syncing {syncCompleted + syncFailed}/{syncTotal}
                    {syncFailed > 0 ? ` • Errors: ${syncFailed}` : ''}
                  </p>
                </div>
              )}
            </div>
            {(user?.role === 'global_engineer' || user?.role === 'district_engineer' || user?.role === 'district_manager' || user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager' || user?.role === 'technician' || user?.role === 'system_admin') && (
              <div className="flex gap-2 mt-4 md:mt-0">
                <Button
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={isSyncing || offlineInspections.length === 0 || isOffline}
                >
                  {isSyncing ? 'Syncing…' : `Sync ${offlineInspections.length > 0 ? `(${offlineInspections.length})` : ''}`}
                </Button>
                <Button onClick={handleAddInspection}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Inspection
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Month</Label>
              <DatePicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                picker="month"
              />
            </div>
            
            {(user?.role === 'global_engineer' || user?.role === 'system_admin') && (
              <div className="space-y-2">
                <Label>Region</Label>
                <div className="w-full">
                  <Select
                    value={selectedRegion}
                    onValueChange={setSelectedRegion}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map(region => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {(user?.role === 'global_engineer' || 
              user?.role === 'system_admin' || 
              user?.role === 'regional_engineer') && (
              <div className="space-y-2">
                <Label>District</Label>
                <div className="w-full">
                  <Select
                    value={selectedDistrict}
                    onValueChange={setSelectedDistrict}
                    disabled={!selectedRegion && user?.role !== 'regional_engineer'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDistricts.map(district => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

                    {/* Reset Filters Button */}
          <div className="flex flex-col sm:flex-row justify-end gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 w-full sm:w-auto">
              <div className="space-y-2 w-full sm:w-[200px]">
                <Label>Filter by Feeder Name</Label>
                <Select
                  value={selectedFeeder || "all-feeders"}
                  onValueChange={(value) => {
                    if (value === "all-feeders") {
                      setSelectedFeeder(null);
                    } else {
                      setSelectedFeeder(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Feeders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-feeders">All Feeders</SelectItem>
                    {Array.from(new Set(filteredInspections
                      .map(inspection => inspection.feederName)
                      .filter(Boolean)))
                      .sort()
                      .map(feeder => (
                        <SelectItem key={feeder} value={feeder}>
                          {feeder}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-full sm:w-[200px]">
                <Label>Filter by Status</Label>
                <Select
                  value={selectedStatus || "all-statuses"}
                  onValueChange={(value) => {
                    if (value === "all-statuses") {
                      setSelectedStatus(null);
                    } else {
                      setSelectedStatus(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-statuses">All Statuses</SelectItem>
                    {Array.from(new Set(filteredInspections
                      .map(inspection => inspection.status)
                      .filter(Boolean)))
                      .sort()
                      .map(status => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              disabled={!selectedDate && !selectedMonth && !selectedRegion && !selectedDistrict && !selectedFeeder && !selectedStatus}
              className="w-full sm:w-auto"
            >
              Reset All Filters
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-1">
              <TabsTrigger value="inspections">Inspection Records</TabsTrigger>
            </TabsList>

            <TabsContent value="inspections" className="space-y-4">
              <OverheadLineInspectionsTable 
                inspections={paginatedInspections}
                allInspections={filteredInspections}
                onEdit={handleEditInspection}
                onDelete={handleDeleteInspection}
                onView={handleViewInspection}
                userRole={user?.role}
              />
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="flex-1 text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredInspections.length)} of {filteredInspections.length} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Inspection Form Sheet */}
          <Sheet open={isInspectionFormOpen} onOpenChange={setIsInspectionFormOpen}>
            <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingInspection ? "Edit Network Inspection" : "New Network Inspection"}
                </SheetTitle>
                <SheetDescription>
                  {editingInspection ? "Update the inspection details." : "Complete the inspection checklist for the network."}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <OverheadLineInspectionForm
                  inspection={editingInspection}
                  onSubmit={handleFormSubmit}
                  onCancel={handleInspectionFormClose}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Inspection Details Dialog */}
          <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Network Inspection Details</DialogTitle>
                <DialogDescription>
                  Inspection performed on {selectedInspection 
                    ? (selectedInspection.date 
                       ? selectedInspection.date
                       : selectedInspection.createdAt && !isNaN(new Date(selectedInspection.createdAt).getTime())
                         ? new Date(selectedInspection.createdAt).toLocaleDateString()
                         : "today")
                    : ""}
                </DialogDescription>
              </DialogHeader>
              {selectedInspection && (
                <OverheadLineInspectionDetailsView
                  inspection={selectedInspection}
                  showHeader={false}
                  showBackButton={false}
                  onEdit={() => navigate(`/asset-management/overhead-line/edit/${selectedInspection.id}`)}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    </AccessControlWrapper>
  );
} 