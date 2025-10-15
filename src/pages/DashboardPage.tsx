import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { FaultCard } from "@/components/dashboard/FaultCard";
import { PendingFaultsList } from "@/components/faults/PendingFaultsList";
import { ChatBox } from "@/components/chat/ChatBox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertTriangle, ZapOff, RefreshCw, Filter } from "lucide-react";
import { OP5Fault, ControlSystemOutage, FaultType } from "@/lib/types";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { PermissionService } from "@/services/PermissionService";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, isSameDay, isSameMonth, isSameYear } from "date-fns";
import { BroadcastMessage } from "@/components/dashboard/BroadcastMessage";
import { BroadcastMessageForm } from "@/components/dashboard/BroadcastMessageForm";
import { AudioPlayer } from "@/components/dashboard/AudioPlayer";

interface FilterBarProps {
  setFilterRegion: (region: string | undefined) => void;
  setFilterDistrict: (district: string | undefined) => void;
  setFilterStatus: (status: "all" | "pending" | "resolved") => void;
  filterStatus: "all" | "pending" | "resolved";
  onRefresh: () => void;
  isRefreshing: boolean;
  setFilterFaultType: (type: string) => void;
  setDateRange: (range: DateRange) => void;
  setSelectedDay: (day: Date | undefined) => void;
  setSelectedMonth: (month: number | undefined) => void;
  setSelectedMonthYear: (year: number | undefined) => void;
  setSelectedYear: (year: number | undefined) => void;
  setDateFilterType: (type: "range" | "day" | "month" | "year") => void;
  filterFaultType: string;
  dateRange: DateRange;
  selectedDay: Date | undefined;
  selectedMonth: number | undefined;
  selectedMonthYear: number | undefined;
  selectedYear: number | undefined;
  dateFilterType: "range" | "day" | "month" | "year";
}

// Add a utility function to check if the environment is production
const isProduction = process.env.NODE_ENV === 'production';

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const { getFilteredFaults, regions, districts, op5Faults, controlSystemOutages } = useData();
  const navigate = useNavigate();
  const permissionService = PermissionService.getInstance();
  
  // Replace console.log statements with conditional logging
  if (!isProduction) {
  console.log('[Dashboard] Initial render - Auth state:', { isAuthenticated, userRole: user?.role });
  }
  
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "resolved">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faults, setFaults] = useState<{op5Faults: OP5Fault[], controlOutages: ControlSystemOutage[]}>({
    op5Faults: [],
    controlOutages: []
  });
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  
  // Advanced filter states
  const [filterFaultType, setFilterFaultType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<"range" | "day" | "month" | "year">("day");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12); // Show 12 items per page (3x4 grid)
  const [activeTab, setActiveTab] = useState<"all" | "op5" | "control">("all");
  
  // Set initial filter values based on user role
  useEffect(() => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] Auth effect - Checking authentication');
    }
    if (!isAuthenticated) {
      if (!isProduction) {
      console.log('[Dashboard] Not authenticated, redirecting to login');
      }
      navigate("/login");
      return;
    }
    
    if (user) {
      if (!isProduction) {
      console.log('[Dashboard] User data:', { 
        role: user.role, 
        region: user.region, 
        district: user.district 
      });
      }
      
      // Check if user has access to dashboard
      const hasAccess = permissionService.canAccessFeature(user.role, 'analytics_dashboard');
      if (!isProduction) {
      console.log('[Dashboard] User has access to dashboard:', hasAccess);
      }
      
      if (!hasAccess) {
        if (!isProduction) {
        console.log('[Dashboard] User does not have access to dashboard, redirecting');
        }
        navigate("/unauthorized");
        return;
      }
      
      // Only set region/district filters if user is not a system admin or global engineer
      if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
        if (!isProduction) {
        console.log('[Dashboard] Region/District IDs:', { regionId, districtId });
        }
        
        if (regionId) {
          setFilterRegion(regionId);
          setSelectedRegion(regionId);
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
          setSelectedDistrict(districtId);
        }
      }
    }
  }, [isAuthenticated, navigate, user, regions, districts]);
  
  useEffect(() => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] Loading faults with filters:', { 
      filterRegion, 
      filterDistrict, 
      filterStatus,
      filterFaultType,
      dateFilterType,
      dateRange,
      selectedDay,
      selectedMonth,
      selectedMonthYear,
      selectedYear
    });
    }
    loadFaults();
  }, [
    filterRegion, 
    filterDistrict, 
    filterStatus, 
    filterFaultType,
    dateFilterType,
    dateRange,
    selectedDay,
    selectedMonth,
    selectedMonthYear,
    selectedYear,
    getFilteredFaults
  ]);
  
  // Add effect to reload faults when context data changes
  useEffect(() => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] Context data changed:', {
      op5FaultsCount: op5Faults.length,
      controlOutagesCount: controlSystemOutages.length,
      op5Faults: op5Faults,
      controlSystemOutages: controlSystemOutages
    });
    }
    loadFaults();
  }, [op5Faults, controlSystemOutages, getFilteredFaults]);
  
  const loadFaults = () => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] loadFaults called');
    }
    console.log('[Dashboard] Current filter states:', { 
      filterRegion, 
      filterDistrict, 
      filterStatus,
      filterFaultType,
      dateFilterType,
      dateRange,
      selectedDay,
      selectedMonth,
      selectedMonthYear,
      selectedYear
    });
    
    // Get filtered faults from context
    const filteredFaults = getFilteredFaults(filterRegion, filterDistrict);
    console.log('[Dashboard] Filtered faults from context:', { 
      op5Count: filteredFaults.op5Faults.length,
      controlCount: filteredFaults.controlOutages.length,
      op5Faults: filteredFaults.op5Faults,
      controlOutages: filteredFaults.controlOutages
    });
    
    // Apply status filter
    let statusFilteredOP5 = filteredFaults.op5Faults;
    let statusFilteredControl = filteredFaults.controlOutages;
    
    if (filterStatus !== "all") {
      statusFilteredOP5 = filteredFaults.op5Faults.filter(f => f.status === filterStatus);
      statusFilteredControl = filteredFaults.controlOutages.filter(f => f.status === filterStatus);
    }
    
    // Apply fault type filter
    let typeFilteredOP5 = statusFilteredOP5;
    let typeFilteredControl = statusFilteredControl;
    
    if (filterFaultType !== "all") {
      typeFilteredOP5 = statusFilteredOP5.filter(f => f.faultType === filterFaultType);
      typeFilteredControl = statusFilteredControl.filter(f => f.faultType === filterFaultType);
    }
    
    // Apply date filters
    let dateFilteredOP5 = typeFilteredOP5;
    let dateFilteredControl = typeFilteredControl;
    
    if (dateFilterType === "range" && dateRange.from && dateRange.to) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isWithinInterval(faultDate, { start: dateRange.from, end: dateRange.to });
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isWithinInterval(faultDate, { start: dateRange.from, end: dateRange.to });
      });
    } else if (dateFilterType === "day" && selectedDay) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameDay(faultDate, selectedDay);
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameDay(faultDate, selectedDay);
      });
    } else if (dateFilterType === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameMonth(faultDate, new Date(selectedMonthYear, selectedMonth));
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameMonth(faultDate, new Date(selectedMonthYear, selectedMonth));
      });
    } else if (dateFilterType === "year" && selectedYear !== undefined) {
      dateFilteredOP5 = typeFilteredOP5.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameYear(faultDate, new Date(selectedYear, 0));
      });
      
      dateFilteredControl = typeFilteredControl.filter(f => {
        const faultDate = new Date(f.occurrenceDate);
        return isSameYear(faultDate, new Date(selectedYear, 0));
      });
    }

    // Remove any duplicates between OP5 and control faults
    const controlIds = new Set(dateFilteredControl.map(f => f.id));
    dateFilteredOP5 = dateFilteredOP5.filter(f => !controlIds.has(f.id));
    
    // Update state with filtered faults
    const updatedFaults = {
      op5Faults: dateFilteredOP5,
      controlOutages: dateFilteredControl
    };
    console.log('[Dashboard] Setting updated faults:', updatedFaults);
    setFaults(updatedFaults);
  };
  
  const handleRefresh = () => {
    // Replace console.log statements with conditional logging
    if (!isProduction) {
    console.log('[Dashboard] Refreshing data');
    }
    setIsRefreshing(true);
    setTimeout(() => {
      loadFaults();
      setIsRefreshing(false);
    }, 1000);
  };
  
  // Calculate paginated faults based on active tab
  const paginatedFaults = useMemo(() => {
    let filteredFaults: (OP5Fault | ControlSystemOutage)[] = [];
    
    if (activeTab === "all") {
      // For "all" tab, combine both types of faults but ensure uniqueness
      const seenIds = new Set<string>();
      filteredFaults = [...faults.op5Faults, ...faults.controlOutages].filter(fault => {
        if (seenIds.has(fault.id)) {
          return false;
        }
        seenIds.add(fault.id);
        return true;
      });
    } else if (activeTab === "op5") {
      // For "op5" tab, only show OP5 faults
      filteredFaults = faults.op5Faults;
    } else if (activeTab === "control") {
      // For "control" tab, only show control system outages
      filteredFaults = faults.controlOutages;
    }

    // Apply sorting
    filteredFaults.sort((a, b) => {
      const dateA = new Date(a.occurrenceDate).getTime();
      const dateB = new Date(b.occurrenceDate).getTime();
      return dateB - dateA;
    });

    // Calculate pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return filteredFaults.slice(startIndex, endIndex);
  }, [activeTab, faults.op5Faults, faults.controlOutages, currentPage, pageSize]);

  // Calculate total pages based on active tab
  const totalPages = useMemo(() => {
    const totalItems = activeTab === "all" 
      ? faults.op5Faults.length + faults.controlOutages.length
      : activeTab === "op5" 
        ? faults.op5Faults.length 
        : faults.controlOutages.length;
    return Math.ceil(totalItems / pageSize);
  }, [activeTab, faults.op5Faults.length, faults.controlOutages.length, pageSize]);

  // Reset pagination when tab changes or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterRegion, filterDistrict, filterStatus, filterFaultType, dateFilterType, dateRange, selectedDay, selectedMonth, selectedMonthYear, selectedYear]);

  // Add debug logging for pagination
  useEffect(() => {
    if (!isProduction) {
    console.log('[Dashboard] Pagination state:', {
      currentPage,
      pageSize,
      totalPages,
      activeTab,
      totalItems: activeTab === "all" 
        ? faults.op5Faults.length + faults.controlOutages.length 
        : activeTab === "op5" 
          ? faults.op5Faults.length 
          : faults.controlOutages.length
    });
    }
  }, [currentPage, pageSize, totalPages, activeTab, faults]);
  
  if (!isAuthenticated) {
    if (!isProduction) {
    console.log('[Dashboard] Not authenticated, returning null');
    }
    return null;
  }
  
  if (!isProduction) {
  console.log('[Dashboard] Rendering with faults:', { 
    op5Count: faults.op5Faults.length,
    controlCount: faults.controlOutages.length
  });
  }
  
  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 relative min-h-screen">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage power distribution faults
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </Button>
            <Button asChild>
              <Link to="/report-fault" className="flex items-center">
                <PlusCircle size={16} className="mr-2" />
                Report New Fault
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Add broadcast messages section */}
        <BroadcastMessage />
        
        {/* Add broadcast message form for admins */}
        {(user?.role === "system_admin" || user?.role === "global_engineer") && (
          <div className="mb-8">
            <BroadcastMessageForm />
          </div>
        )}
        
        <div className="space-y-6">
        <StatsOverview 
          op5Faults={faults.op5Faults} 
          controlOutages={faults.controlOutages} 
            filterRegion={filterRegion}
            filterDistrict={filterDistrict}
        />
        </div>
        
        <div className="mt-8">
          <PendingFaultsList />
        </div>
        
        <div className="mt-8">
          <FilterBar
            setFilterRegion={setFilterRegion}
            setFilterDistrict={setFilterDistrict}
            setFilterStatus={setFilterStatus}
            filterStatus={filterStatus}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            setFilterFaultType={setFilterFaultType}
            setDateRange={setDateRange}
            setSelectedDay={setSelectedDay}
            setSelectedMonth={setSelectedMonth}
            setSelectedMonthYear={setSelectedMonthYear}
            setSelectedYear={setSelectedYear}
            setDateFilterType={setDateFilterType}
            filterFaultType={filterFaultType}
            dateRange={dateRange}
            selectedDay={selectedDay}
            selectedMonth={selectedMonth}
            selectedMonthYear={selectedMonthYear}
            selectedYear={selectedYear}
            dateFilterType={dateFilterType}
          />
        </div>
        
        <Tabs defaultValue="all" className="mt-8" onValueChange={(value) => setActiveTab(value as "all" | "op5" | "control")}>
          <TabsList className="mb-6 grid w-full grid-cols-3 max-w-xs sm:max-w-sm md:max-w-md mx-auto bg-muted p-1 rounded-lg">
            <TabsTrigger 
              value="all"
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-colors duration-150"
            >
              All Faults
            </TabsTrigger>
            <TabsTrigger 
              value="op5" 
              className="flex items-center justify-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors duration-150"
            >
              <AlertTriangle size={16} className="mr-2" />
              OP5 Faults
            </TabsTrigger>
            <TabsTrigger 
              value="control" 
              className="flex items-center justify-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors duration-150"
            >
              <ZapOff size={16} className="mr-2" />
              Control System
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            {faults.op5Faults.length === 0 && faults.controlOutages.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20 shadow-sm">
                <p className="text-muted-foreground">No faults found with the current filters</p>
                <Button variant="link" onClick={() => {
                  if (!isProduction) {
                  console.log('[Dashboard] Clearing filters for user role:', user?.role);
                  }
                  if (user?.role === "global_engineer") {
                    setFilterRegion(undefined);
                    setFilterDistrict(undefined);
                  } else if (user?.role === "regional_engineer") {
                    setFilterDistrict(undefined);
                  }
                  setFilterStatus("all");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedFaults.map(fault => {
                    const isOP5Fault = faults.op5Faults.some(f => f.id === fault.id);
                    return (
                    <FaultCard 
                        key={`${activeTab}-${fault.id}`} 
                      fault={fault} 
                        type={isOP5Fault ? "op5" : "control"} 
                    />
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6 mb-20">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="op5">
            {faults.op5Faults.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20 shadow-sm">
                <p className="text-muted-foreground">No OP5 faults found with the current filters</p>
                <Button variant="link" onClick={() => {
                  setFilterRegion(undefined);
                  setFilterDistrict(undefined);
                  setFilterStatus("all");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedFaults.map(fault => (
                    <FaultCard 
                      key={`${activeTab}-${fault.id}`} 
                      fault={fault} 
                      type="op5" 
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6 mb-20">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="control">
            {faults.controlOutages.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/20 shadow-sm">
                <p className="text-muted-foreground">No control system outages found with the current filters</p>
                <Button variant="link" onClick={() => {
                  setFilterRegion(undefined);
                  setFilterDistrict(undefined);
                  setFilterStatus("all");
                  setFilterFaultType("all");
                  setDateRange({ from: undefined, to: undefined });
                  setSelectedDay(undefined);
                  setSelectedMonth(undefined);
                  setSelectedMonthYear(undefined);
                  setSelectedYear(undefined);
                  setDateFilterType("range");
                }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedFaults.map(fault => (
                    <FaultCard 
                      key={`${activeTab}-${fault.id}`} 
                      fault={fault} 
                      type="control" 
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6 mb-20">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="fixed bottom-4 right-4 z-50">
          <ChatBox />
        </div>
        <AudioPlayer />
      </div>
    </Layout>
  );
}
