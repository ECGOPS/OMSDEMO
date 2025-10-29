import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, parse, startOfWeek, endOfWeek } from "date-fns";
import { Download, FileText, Filter, Eye, Calendar, MapPin, AlertTriangle, BarChart as ChartIcon, ActivityIcon, TrendingUp, Clock, Users, Wrench, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { exportAnalyticsToPDF } from "@/utils/pdfExport";
import { useToast } from "@/components/ui/use-toast";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { LineChart, Line } from 'recharts';
import { OP5Fault, ControlSystemOutage } from '@/lib/types';
import MaterialsAnalysis from '@/components/analytics/MaterialsAnalysis';
import { calculateOutageDuration, calculateMTTR } from "@/lib/calculations";
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { LoadMonitoringData } from '@/lib/asset-types';
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItemProps } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const formatSafeDate = (dateString: string | undefined | null | { seconds: number; nanoseconds: number }): string => {
  if (!dateString) return 'N/A';
  try {
    let date: Date;
    // Handle Firestore timestamp
    if (typeof dateString === 'object' && 'seconds' in dateString) {
      date = new Date(dateString.seconds * 1000);
    } else {
      date = new Date(dateString);
    }
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, 'MMM dd, yyyy HH:mm:ss');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-muted-foreground" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { isAuthenticated, user, users, usersLoading } = useAuth(); // Get the list of all users
  const navigate = useNavigate();
  const { regions, districts, getFilteredFaults, op5Faults, controlSystemOutages } = useData();
  const [filteredFaults, setFilteredFaults] = useState([]);
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [filterFaultType, setFilterFaultType] = useState<string | undefined>(undefined);
  const [filterSpecificFaultType, setFilterSpecificFaultType] = useState<string | undefined>(undefined);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedFaultType, setSelectedFaultType] = useState<string>("all");
  const [selectedFault, setSelectedFault] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<Date | undefined>(undefined);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [startMonth, setStartMonth] = useState<Date | undefined>(undefined);
  const [endMonth, setEndMonth] = useState<Date | undefined>(undefined);
  const [startYear, setStartYear] = useState<Date | undefined>(undefined);
  const [endYear, setEndYear] = useState<Date | undefined>(undefined);
  const [isStartMonthPickerOpen, setIsStartMonthPickerOpen] = useState(false);
  const [isEndMonthPickerOpen, setIsEndMonthPickerOpen] = useState(false);
  const [isStartYearPickerOpen, setIsStartYearPickerOpen] = useState(false);
  const [isEndYearPickerOpen, setIsEndYearPickerOpen] = useState(false);
  const [startWeek, setStartWeek] = useState<number | undefined>(undefined);

  // Local cache for resolving user names by UID when not present in AuthContext users array
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});

  const fetchAndCacheUserName = async (userId: string) => {
    if (!userId || userNameMap[userId]) return;
    try {
      // Lazy-load from Firestore if not in users array
      const { db } = await import("@/config/firebase");
      const { doc, getDoc } = await import("firebase/firestore");
      const userRef = doc(db, "users", userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as any;
        const display = data?.name || data?.email || userId;
        setUserNameMap(prev => ({ ...prev, [userId]: display }));
      } else {
        setUserNameMap(prev => ({ ...prev, [userId]: userId }));
      }
    } catch (e) {
      setUserNameMap(prev => ({ ...prev, [userId]: userId }));
    }
  };

  // When a fault is selected, resolve its createdBy/updatedBy names if missing
  useEffect(() => {
    if (!selectedFault) return;
    if (selectedFault.createdBy) fetchAndCacheUserName(selectedFault.createdBy);
    if (selectedFault.updatedBy) fetchAndCacheUserName(selectedFault.updatedBy);
  }, [selectedFault]);
  const [endWeek, setEndWeek] = useState<number | undefined>(undefined);
  const [isStartWeekPickerOpen, setIsStartWeekPickerOpen] = useState(false);
  const [isEndWeekPickerOpen, setIsEndWeekPickerOpen] = useState(false);
  const [reliabilityIndices, setReliabilityIndices] = useState<any>(null);
  const [materialsStats, setMaterialsStats] = useState({
    totalMaterials: 0,
    byType: [] as { name: string; value: number }[],
    byMonth: [] as { name: string; value: number }[],
    topMaterials: [] as { name: string; value: number }[]
  });
  const [overviewRecentFaultsTab, setOverviewRecentFaultsTab] = useState<'all' | 'op5' | 'control'>('all');
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeTab, setActiveTab] = useState<'all' | 'op5' | 'control'>('all');
  const [loadMonitoringRecords, setLoadMonitoringRecords] = useState<LoadMonitoringData[]>([]);
  const [loadStats, setLoadStats] = useState({
    total: 0,
    overloaded: 0,
    okay: 0,
    avgLoad: 0,
    urgent: 0,
  });
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  // Add new state for days filter
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [visibleColumns, setVisibleColumns] = useState({
    region: true,
    district: true,
    occurrenceDate: true,
    typeOfOutage: true, // moved before status
    specificFaultType: true, // moved before status
    status: true,
    outageDuration: true,
    repairDuration: true,
    estimatedResolution: true,
    resolutionStatus: true,
    customersAffected: true,
    description: true,
    remarks: true,
    actions: true,
    restorationDate: true
  });

  const columnOptions = [
    { id: 'region', label: 'Region' },
    { id: 'district', label: 'District' },
    { id: 'occurrenceDate', label: 'Occurrence Date' },
    { id: 'typeOfOutage', label: 'Type of Outage' }, // moved before status
    { id: 'specificFaultType', label: 'Specific Fault Type' }, // moved before status
    { id: 'status', label: 'Status' },
    { id: 'outageDuration', label: 'Outage Duration' },
    { id: 'repairDuration', label: 'Repair Duration' },
    { id: 'estimatedResolution', label: 'Estimated Resolution' },
    { id: 'resolutionStatus', label: 'Resolution Time' },
    { id: 'customersAffected', label: 'Customers Affected' },
    { id: 'restorationDate', label: 'Restoration Date' },
    { id: 'description', label: 'Description' },
    { id: 'remarks', label: 'Remarks' },
    { id: 'actions', label: 'Actions' }
  ];

  // Add handler for days change
  const handleDaysChange = (value: string) => {
    setSelectedDays(parseInt(value));
    loadData();
  };
  
  // Use the same logic as DashboardPage for paginatedFaults
  const paginatedFaults = useMemo(() => {
    // Get the latest filtered faults from context
    const { op5Faults: op5, controlOutages: control } = getFilteredFaults(
      selectedRegion === "all" ? undefined : filterRegion,
      selectedDistrict === "all" ? undefined : filterDistrict
    );
    let faultsToDisplay: (OP5Fault | ControlSystemOutage)[] = [];
    if (overviewRecentFaultsTab === 'op5') {
      faultsToDisplay = op5;
    } else if (overviewRecentFaultsTab === 'control') {
      faultsToDisplay = control;
    } else {
      // Show only OP5 faults in the "All Recent" tab
      faultsToDisplay = op5;
    }

    // Apply status filter if needed
    if (filterStatus) {
      faultsToDisplay = faultsToDisplay.filter(fault => fault.status === filterStatus);
    }

    // Apply fault type filter if needed
    if (filterFaultType && filterFaultType !== "all") {
      faultsToDisplay = faultsToDisplay.filter(fault => {
        if ('faultType' in fault) {
          return fault.faultType === filterFaultType;
        }
        return false;
      });
    }

    // Apply specific fault type filter if needed
    if (filterSpecificFaultType && filterSpecificFaultType !== "all") {
      faultsToDisplay = faultsToDisplay.filter(fault => {
        if ('specificFaultType' in fault) {
          return fault.specificFaultType === filterSpecificFaultType;
        }
        return false;
      });
    }

    // Apply date range filter
    if (dateRange !== "all") {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

      switch (dateRange) {
        case "days":
          // For "Last N Days", we want to show data from N days ago until today
          // For example, if today is March 15 and N=2:
          // - Start: March 13 00:00:00 (2 days ago)
          // - End: March 15 23:59:59 (today)
          start = startOfDay(subDays(now, selectedDays));
          end = endOfDay(now);
          console.log('[loadData] Last N Days range:', {
            selectedDays,
            start: start.toISOString(),
            end: end.toISOString(),
            daysIncluded: selectedDays + 1, // +1 because we include today
            example: `If today is ${format(now, 'MMMM d')}, this will show data from ${format(start, 'MMMM d')} to ${format(end, 'MMMM d')}`
          });
          break;
        case "today":
          start = startOfDay(now);
          break;
        case "week":
          start = startOfDay(subDays(now, 6));
          break;
        case "month":
          start = startOfDay(subDays(now, 29));
          break;
        case "year":
          // Set start date to the beginning of last year
          start = startOfYear(subYears(now, 1));
          // Set end date to the end of last year
          end = endOfYear(subYears(now, 1));
          break;
        case "custom":
          if (startDate && endDate) {
            start = startOfDay(startDate);
            end = endOfDay(endDate);
          } else {
            start = startOfYear(now);
          }
          break;
        case "custom-month":
          if (startMonth && endMonth) {
            start = startOfDay(startMonth);
            end = endOfDay(endMonth);
            console.log('[loadData] Custom month range:', {
              start: start.toISOString(),
              end: end.toISOString(),
              startMonth: startMonth.toISOString(),
              endMonth: endMonth.toISOString()
            });
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
          break;
        case "custom-year":
          if (startYear && endYear) {
            start = startOfYear(startYear);
            end = endOfYear(endYear);
          } else if (selectedYear) {
            start = startOfYear(selectedYear);
            end = endOfYear(selectedYear);
          } else {
            start = startOfYear(now);
            end = endOfYear(now);
          }
          break;
        case "custom-week":
          if (startWeek && endWeek && selectedYear) {
            start = startOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (startWeek - 1) * 7));
            end = endOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (endWeek - 1) * 7));
          } else {
            start = startOfWeek(now);
            end = endOfWeek(now);
          }
          break;
        case "yesterday":
          start = startOfDay(subDays(now, 1));
          end = endOfDay(subDays(now, 1));
          break;
        default:
          start = startOfYear(now);
      }

      faultsToDisplay = faultsToDisplay.filter(fault => {
        try {
          const faultDate = new Date(fault.occurrenceDate);
          return faultDate >= start && faultDate <= end;
        } catch (error) {
          console.error('[paginatedFaults] Error processing fault date:', {
            faultId: fault.id,
            occurrenceDate: fault.occurrenceDate,
            error
          });
          return false;
        }
      });
    }

    // Sort by occurrenceDate descending
    faultsToDisplay.sort((a, b) => new Date(b.occurrenceDate).getTime() - new Date(a.occurrenceDate).getTime());

    // Pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return faultsToDisplay.slice(startIndex, endIndex);
  }, [
    getFilteredFaults,
    selectedRegion,
    filterRegion,
    selectedDistrict,
    filterDistrict,
    overviewRecentFaultsTab,
    currentPage,
    pageSize,
    filterStatus,
    filterFaultType,
    filterSpecificFaultType,
    dateRange,
    startDate,
    endDate,
    startMonth,
    endMonth,
    startYear,
    endYear,
    startWeek,
    endWeek,
    selectedYear,
    selectedDays
  ]);

  // Calculate total pages based on filtered faults
  const totalPages = useMemo(() => {
    const { op5Faults: op5, controlOutages: control } = getFilteredFaults(
      selectedRegion === "all" ? undefined : filterRegion,
      selectedDistrict === "all" ? undefined : filterDistrict
    );
    let faultsToDisplay: (OP5Fault | ControlSystemOutage)[] = [];
    if (overviewRecentFaultsTab === 'op5') {
      faultsToDisplay = op5;
    } else if (overviewRecentFaultsTab === 'control') {
      faultsToDisplay = control;
    } else {
      const seenIds = new Set<string>();
      faultsToDisplay = [...op5, ...control].filter(fault => {
        if (seenIds.has(fault.id)) return false;
        seenIds.add(fault.id);
        return true;
      });
    }

    // Apply the same filters as paginatedFaults
    if (filterStatus) {
      faultsToDisplay = faultsToDisplay.filter(fault => fault.status === filterStatus);
    }

    if (filterFaultType && filterFaultType !== "all") {
      faultsToDisplay = faultsToDisplay.filter(fault => {
        if ('faultType' in fault) {
          return fault.faultType === filterFaultType;
        }
        return false;
      });
    }

    // Apply specific fault type filter if needed
    if (filterSpecificFaultType && filterSpecificFaultType !== "all") {
      faultsToDisplay = faultsToDisplay.filter(fault => {
        if ('specificFaultType' in fault) {
          return fault.specificFaultType === filterSpecificFaultType;
        }
        return false;
      });
    }

    // Apply date range filter
    if (dateRange !== "all") {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

      switch (dateRange) {
        case "days":
          start = startOfDay(subDays(now, selectedDays - 1));
          break;
        case "today":
          start = startOfDay(now);
          break;
        case "week":
          start = startOfDay(subDays(now, 6));
          break;
        case "month":
          start = startOfDay(subDays(now, 29));
          break;
        case "year":
          // Set start date to the beginning of last year
          start = startOfYear(subYears(now, 1));
          // Set end date to the end of last year
          end = endOfYear(subYears(now, 1));
          break;
        case "custom":
          if (startDate && endDate) {
            start = startOfDay(startDate);
            end = endOfDay(endDate);
          } else {
            start = startOfYear(now);
          }
          break;
        case "custom-month":
          if (startMonth && endMonth) {
            start = startOfDay(startMonth);
            end = endOfDay(endMonth);
            console.log('[loadData] Custom month range:', {
              start: start.toISOString(),
              end: end.toISOString(),
              startMonth: startMonth.toISOString(),
              endMonth: endMonth.toISOString()
            });
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
          break;
        case "custom-year":
          if (startYear && endYear) {
            start = startOfYear(startYear);
            end = endOfYear(endYear);
          } else if (selectedYear) {
            start = startOfYear(selectedYear);
            end = endOfYear(selectedYear);
          } else {
            start = startOfYear(now);
            end = endOfYear(now);
          }
          break;
        case "custom-week":
          if (startWeek && endWeek && selectedYear) {
            start = startOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (startWeek - 1) * 7));
            end = endOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (endWeek - 1) * 7));
          } else {
            start = startOfWeek(now);
            end = endOfWeek(now);
          }
          break;
        case "yesterday":
          start = startOfDay(subDays(now, 1));
          end = endOfDay(subDays(now, 1));
          break;
        default:
          start = startOfYear(now);
      }

      faultsToDisplay = faultsToDisplay.filter(fault => {
        try {
          const faultDate = new Date(fault.occurrenceDate);
          return faultDate >= start && faultDate <= end;
        } catch (error) {
          return false;
        }
      });
    }

    return Math.ceil(faultsToDisplay.length / pageSize);
  }, [
    getFilteredFaults,
    selectedRegion,
    filterRegion,
    selectedDistrict,
    filterDistrict,
    overviewRecentFaultsTab,
    pageSize,
    filterStatus,
    filterFaultType,
    filterSpecificFaultType,
    dateRange,
    startDate,
    endDate,
    startMonth,
    endMonth,
    startYear,
    endYear,
    startWeek,
    endWeek,
    selectedYear,
    selectedDays
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    
    // Initialize filters based on user role
    if (user) {
      // Only set region/district filters if user is not a system admin or global engineer
      if (user.role !== 'system_admin' && user.role !== 'global_engineer') {
        const { regionId, districtId } = getUserRegionAndDistrict(user, regions, districts);
        
        if (regionId) {
          setFilterRegion(regionId);
          setSelectedRegion(regionId);
        } else {
          // Set to "all" if no specific region
          setFilterRegion(undefined);
          setSelectedRegion("all");
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
          setSelectedDistrict(districtId);
        }
      } else {
        // For system admins and global engineers, set to "all" by default
        setFilterRegion(undefined);
        setSelectedRegion("all");
        setFilterDistrict(undefined);
        setSelectedDistrict("all");
      }
    } else {
      // Set default to "all" when no user role restrictions
      setFilterRegion(undefined);
      setSelectedRegion("all");
    }
  }, [isAuthenticated, user, navigate, regions, districts]);

  // Single effect for data loading
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[AnalyticsPage] filteredFaults:', filteredFaults);
      filteredFaults.forEach((fault, idx) => {
        console.log(`[AnalyticsPage] Fault #${idx + 1}:`, fault);
        console.log(`[AnalyticsPage] Fault #${idx + 1} keys:`, Object.keys(fault));
      });
      // Use either 'faultLocation' or 'substationName' to identify OP5 faults
      const op5WithDates = filteredFaults.filter(f => 
        ('faultLocation' in f || 'substationName' in f) && 
        f.repairDate && f.restorationDate
      );
      console.log('[AnalyticsPage] OP5 faults with repairDate and restorationDate:', op5WithDates);
      loadData();
    }
  }, [isAuthenticated, filterRegion, filterDistrict, filterFaultType, filterSpecificFaultType, dateRange, startDate, endDate]);

  const loadData = () => {
    console.log('[loadData] Starting with filters:', {
      filterRegion,
      filterDistrict,
      filterFaultType,
      filterSpecificFaultType,
      filterStatus,
      dateRange,
      startDate,
      endDate,
      selectedRegion,
      selectedMonth,
      selectedYear,
      startWeek,
      endWeek,
      selectedDays
    });

    // Get filtered faults for analytics - handle "all" case properly
    const { op5Faults, controlOutages } = getFilteredFaults(
      selectedRegion === "all" ? undefined : filterRegion,
      selectedDistrict === "all" ? undefined : filterDistrict
    );
    
    // Apply date range filter
    let filteredByDate = [...op5Faults, ...controlOutages];

    // Apply fault type filter if needed
    if (filterFaultType && filterFaultType !== "all") {
      filteredByDate = filteredByDate.filter(fault => {
        if ('faultType' in fault) {
          return fault.faultType === filterFaultType;
        }
        return false;
      });
    }

    // Apply specific fault type filter if needed
    if (filterSpecificFaultType && filterSpecificFaultType !== "all") {
      filteredByDate = filteredByDate.filter(fault => {
        if ('specificFaultType' in fault) {
          return fault.specificFaultType === filterSpecificFaultType;
        }
        return false;
      });
    }

    // Apply status filter if needed
    if (filterStatus) {
      filteredByDate = filteredByDate.filter(fault => fault.status === filterStatus);
    }

    // Apply date range filter if needed
    if (dateRange !== "all") {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

      switch (dateRange) {
        case "days":
          // For "Last N Days", we want to show data from N-1 days ago until today
          // For example, if today is March 15 and N=2:
          // - Start: March 14 00:00:00
          // - End: March 15 23:59:59
          start = startOfDay(subDays(now, selectedDays - 1));
          end = endOfDay(now);
          console.log('[loadData] Last N Days range:', {
            selectedDays,
            start: start.toISOString(),
            end: end.toISOString(),
            daysIncluded: selectedDays
          });
          break;
        case "today":
          start = startOfDay(now);
          break;
        case "week":
          start = startOfDay(subDays(now, 6));
          break;
        case "month":
          start = startOfDay(subDays(now, 29));
          break;
        case "year":
          // Set start date to the beginning of last year
          start = startOfYear(subYears(now, 1));
          // Set end date to the end of last year
          end = endOfYear(subYears(now, 1));
          break;
        case "custom":
          if (startDate && endDate) {
            start = startOfDay(startDate);
            end = endOfDay(endDate);
          } else {
            start = startOfYear(now);
          }
          break;
        case "custom-month":
          if (startMonth && endMonth) {
            start = startOfDay(startMonth);
            end = endOfDay(endMonth);
            console.log('[loadData] Custom month range:', {
              start: start.toISOString(),
              end: end.toISOString(),
              startMonth: startMonth.toISOString(),
              endMonth: endMonth.toISOString()
            });
          } else {
            start = startOfMonth(now);
            end = endOfMonth(now);
          }
          break;
        case "custom-year":
          if (startYear && endYear) {
            start = startOfYear(startYear);
            end = endOfYear(endYear);
          } else if (selectedYear) {
            start = startOfYear(selectedYear);
            end = endOfYear(selectedYear);
          } else {
            start = startOfYear(now);
            end = endOfYear(now);
          }
          break;
        case "custom-week":
          if (startWeek && endWeek && selectedYear) {
            // Convert week numbers to dates
            start = startOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (startWeek - 1) * 7));
            end = endOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (endWeek - 1) * 7));
            console.log('[loadData] Custom week range:', {
              start: start.toISOString(),
              end: end.toISOString(),
              startWeek,
              endWeek,
              year: selectedYear.getFullYear()
            });
          } else {
            start = startOfWeek(now);
            end = endOfWeek(now);
          }
          break;
        case "yesterday":
          start = startOfDay(subDays(now, 1));
          end = endOfDay(subDays(now, 1));
          break;
        default:
          start = startOfYear(now);
      }

      console.log('[loadData] Date filter:', {
        dateRange,
        start: start.toISOString(),
        end: end.toISOString()
      });

      filteredByDate = filteredByDate.filter(fault => {
        try {
          const faultDate = new Date(fault.occurrenceDate);
          const isInRange = faultDate >= start && faultDate <= end;
          
          if (!isInRange) {
            console.log('[loadData] Fault filtered out:', {
              faultId: fault.id,
              faultDate: faultDate.toISOString(),
              start: start.toISOString(),
              end: end.toISOString()
            });
          }
          
          return isInRange;
        } catch (error) {
          console.error('[loadData] Error processing fault date:', {
            faultId: fault.id,
            occurrenceDate: fault.occurrenceDate,
            error
          });
          return false;
        }
      });
    }

    console.log('[loadData] Filtered results:', {
      totalFaults: filteredByDate.length,
      op5Faults: filteredByDate.filter(f => 'faultLocation' in f).length,
      controlOutages: filteredByDate.filter(f => !('faultLocation' in f)).length,
      dateRange,
      region: filterRegion,
      district: filterDistrict,
      sampleDates: filteredByDate.slice(0, 3).map(f => ({
        id: f.id,
        date: f.occurrenceDate
      }))
    });

    setFilteredFaults(filteredByDate);

    // Calculate reliability indices based on selected level
    const reliabilityIndices = calculateReliabilityIndicesByLevel(
      filteredByDate,
      districts,
      filterRegion,
      filterDistrict
    );
    setReliabilityIndices(reliabilityIndices);
  };

  const calculateReliabilityIndicesByLevel = (
    faults: any[],
    districts: any[],
    regionId: string | undefined,
    districtId: string | undefined
  ) => {
    const indices = {
      rural: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      urban: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      metro: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 },
      total: { saidi: 0, saifi: 0, caidi: 0, caifi: 0, maifi: 0 }
    };

    // Filter only OP5 faults with valid dates
    const op5Faults = faults.filter(fault => 
      ('faultLocation' in fault || 'substationName' in fault) && 
      fault.occurrenceDate && 
      fault.restorationDate &&
      fault.repairDate &&
      fault.repairEndDate
    );

    // Get total population based on level
    let totalPopulation = { rural: 0, urban: 0, metro: 0 };
    if (districtId) {
      // District level
      const district = districts.find(d => d.id === districtId);
      if (district?.population) {
        totalPopulation = district.population;
      }
    } else if (regionId) {
      // Regional level
      const regionDistricts = districts.filter(d => d.regionId === regionId);
      totalPopulation = regionDistricts.reduce((acc, district) => ({
        rural: acc.rural + (district.population?.rural || 0),
        urban: acc.urban + (district.population?.urban || 0),
        metro: acc.metro + (district.population?.metro || 0)
      }), { rural: 0, urban: 0, metro: 0 });
    } else {
      // Global level
      totalPopulation = districts.reduce((acc, district) => ({
        rural: acc.rural + (district.population?.rural || 0),
        urban: acc.urban + (district.population?.urban || 0),
        metro: acc.metro + (district.population?.metro || 0)
      }), { rural: 0, urban: 0, metro: 0 });
    }

    // Initialize tracking objects
    let customerHoursLost = { rural: 0, urban: 0, metro: 0 };
    let affectedCustomers = { rural: 0, urban: 0, metro: 0 };
    let momentaryInterruptions = { rural: 0, urban: 0, metro: 0 };
    let sustainedInterruptions = { rural: 0, urban: 0, metro: 0 };
    let totalInterruptions = { rural: 0, urban: 0, metro: 0 };

    // Use Maps instead of Sets for tracking distinct customers
    const distinctCustomersByType = {
      rural: new Map<string, number>(),
      urban: new Map<string, number>(),
      metro: new Map<string, number>()
    };

    // Process each fault
    op5Faults.forEach(fault => {
      if (!fault.affectedPopulation) return;

      const { rural, urban, metro } = fault.affectedPopulation;
      const duration = calculateOutageDuration(fault.occurrenceDate, fault.restorationDate);
      const isMomentary = duration < 5; // 5 minutes threshold for momentary interruptions

      // Process each population type
      ['rural', 'urban', 'metro'].forEach(type => {
        const t = type as keyof typeof totalPopulation;
        const affected = fault.affectedPopulation[t] || 0;
        
        if (affected > 0) {
          // Update customer hours lost
          customerHoursLost[t] += duration * affected;
          
          // Update affected customers count
          affectedCustomers[t] += affected;
          
          // Update interruption counts
          if (isMomentary) {
            momentaryInterruptions[t] += affected;
          } else {
            sustainedInterruptions[t] += affected;
          }
          
          // Update total interruptions
          totalInterruptions[t] += affected;

          // Track distinct customers using Map
          const customerKey = `${fault.id}-${t}`;
          distinctCustomersByType[t].set(customerKey, affected);
        }
      });
    });

    // Calculate indices for each population type
    ['rural', 'urban', 'metro'].forEach(type => {
      const t = type as keyof typeof totalPopulation;
      if (totalPopulation[t] > 0) {
        // SAIDI = Total Customer Hours Lost / Total Number of Customers
        indices[t].saidi = Number((customerHoursLost[t] / totalPopulation[t]).toFixed(2));
        
        // SAIFI = Total Customers Affected / Total Number of Customers
        indices[t].saifi = Number((affectedCustomers[t] / totalPopulation[t]).toFixed(2));
        
        // CAIDI = SAIDI / SAIFI
        indices[t].caidi = indices[t].saifi > 0 ? 
          Number((indices[t].saidi / indices[t].saifi).toFixed(2)) : 0;

        // CAIFI = Total Number of Customer Interruptions / Number of Distinct Customers Interrupted
        const distinctCount = distinctCustomersByType[t].size;
        const totalInterruptionCount = totalInterruptions[t];
        
        indices[t].caifi = distinctCount > 0 ? 
          Number((totalInterruptionCount / distinctCount).toFixed(2)) : 0;

        // MAIFI = Number of customers with momentary interruptions / Total Number of Customers
        indices[t].maifi = Number((momentaryInterruptions[t] / totalPopulation[t]).toFixed(2));
      }
    });

    // Calculate total indices
    const totalPopulationAll = totalPopulation.rural + totalPopulation.urban + totalPopulation.metro;
    const totalCustomerHoursLost = customerHoursLost.rural + customerHoursLost.urban + customerHoursLost.metro;
    const totalAffectedCustomers = affectedCustomers.rural + affectedCustomers.urban + affectedCustomers.metro;
    const totalMomentaryInterruptions = momentaryInterruptions.rural + momentaryInterruptions.urban + momentaryInterruptions.metro;
    const totalCustomerInterruptions = totalInterruptions.rural + totalInterruptions.urban + totalInterruptions.metro;
    const totalDistinctCustomers = Object.values(distinctCustomersByType).reduce((sum, map) => sum + map.size, 0);

    if (totalPopulationAll > 0) {
      indices.total.saidi = Number((totalCustomerHoursLost / totalPopulationAll).toFixed(2));
      indices.total.saifi = Number((totalAffectedCustomers / totalPopulationAll).toFixed(2));
      indices.total.caidi = indices.total.saifi > 0 ? 
        Number((indices.total.saidi / indices.total.saifi).toFixed(2)) : 0;
      indices.total.caifi = totalDistinctCustomers > 0 ? 
        Number((totalCustomerInterruptions / totalDistinctCustomers).toFixed(2)) : 0;
      indices.total.maifi = Number((totalMomentaryInterruptions / totalPopulationAll).toFixed(2));
    }

    return indices;
  };

  const handleRegionChange = (value: string) => {
    console.log('[handleRegionChange] New region:', value, 'Previous:', selectedRegion);
    
    if (value === "all") {
      // Clear both region and district filters
      setFilterRegion(undefined);
      setFilterDistrict(undefined);
      setSelectedDistrict("");
    } else {
      // Set new region filter
      setFilterRegion(value);
      // Reset district when changing region
      setFilterDistrict(undefined);
      setSelectedDistrict("");
    }
    setSelectedRegion(value);
  };

  const handleDistrictChange = (value: string) => {
    console.log('[handleDistrictChange] New district:', value);
    
    if (value === "all") {
      setFilterDistrict(undefined);
    } else {
      setFilterDistrict(value);
    }
    setSelectedDistrict(value);
  };
  
  const handleDateRangeChange = (value: string) => {
    console.log('[handleDateRangeChange] New date range:', value);
    
    setDateRange(value);
    // Reset custom date selections when changing date range type
    if (value !== "custom") {
      setStartDate(null);
      setEndDate(null);
    }
    // Reset custom period selections
    setStartMonth(undefined);
    setEndMonth(undefined);
    setStartYear(undefined);
    setEndYear(undefined);
    setStartWeek(undefined);
    setEndWeek(undefined);
  };

  const handleStartMonthSelect = (date: Date | undefined) => {
    setStartMonth(date);
    setIsStartMonthPickerOpen(false);
    // Only load data if we have both start and end months
    if (date && endMonth) {
      if (date > endMonth) {
        // If start month is after end month, swap them
        setStartMonth(endMonth);
        setEndMonth(date);
      }
      loadData();
    }
  };

  const handleEndMonthSelect = (date: Date | undefined) => {
    setEndMonth(date);
    setIsEndMonthPickerOpen(false);
    // Only load data if we have both start and end months
    if (date && startMonth) {
      if (date < startMonth) {
        // If end month is before start month, swap them
        setStartMonth(date);
        setEndMonth(startMonth);
      }
      loadData();
    }
  };

  const handleStartYearSelect = (date: Date | undefined) => {
    setStartYear(date);
    setIsStartYearPickerOpen(false);
    if (date && endYear) {
      loadData();
    }
  };

  const handleEndYearSelect = (date: Date | undefined) => {
    setEndYear(date);
    setIsEndYearPickerOpen(false);
    if (date && startYear) {
      loadData();
    }
  };

  const handleStartWeekSelect = (week: number) => {
    setStartWeek(week);
    if (week && endWeek && selectedYear) {
      loadData();
    }
  };

  const handleEndWeekSelect = (week: number) => {
    setEndWeek(week);
    if (week && startWeek && selectedYear) {
      loadData();
    }
  };

  const handleYearSelect = (date: Date | undefined) => {
    setSelectedYear(date);
    if (date && startWeek && endWeek) {
      loadData();
    }
  };
  
  const handleFaultTypeChange = (value: string) => {
    console.log('[handleFaultTypeChange] New fault type:', value);
    
    if (value === "all") {
      setFilterFaultType(undefined);
    } else {
      setFilterFaultType(value);
    }
    setSelectedFaultType(value);
  };
  
  const handleStatusChange = (value: string) => {
    setFilterStatus(value === "all" ? undefined : value);
  };
  
  // Add useEffect to watch for date range changes
  useEffect(() => {
    if (dateRange === "custom-month" && startMonth && endMonth) {
      loadData();
    } else if (dateRange === "custom-year" && startYear && endYear) {
      loadData();
    } else if (dateRange === "custom-week" && startWeek && endWeek) {
      loadData();
    }
  }, [dateRange, startMonth, endMonth, startYear, endYear, startWeek, endWeek]);
  
  const exportDetailed = () => {
    const headers = [
      'ID', 'Type', 'Region', 'District', 'Occurrence Date', 'Restoration Date', 
      'Status', 'Fault Type', 'Specific Fault Type', 'Duration (hours)', 'Created By', 'Created At',
      // Common fields for both types
      'Rural Customers Affected', 'Urban Customers Affected', 'Metro Customers Affected',
      // OP5 specific fields
      'Fault Location', 'MTTR', 'SAIDI', 'SAIFI', 'CAIDI',
      // Control outage specific fields
      'Load (MW)', 'Unserved Energy (MWh)', 'Area Affected', 'Reason', 'Control Panel Indications'
    ];
    
    // Use filteredFaults instead of all faults
    const dataRows = filteredFaults.map((fault: any) => {
      // Properly identify the fault type
      const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
      const type = isOP5Fault ? 'OP5 Fault' : 'Control Outage';
      
      // Calculate duration properly
      const duration = fault.occurrenceDate && fault.restorationDate ? 
        calculateOutageDuration(fault.occurrenceDate, fault.restorationDate) : 0;
      const region = regions.find(r => r.id === fault.regionId)?.name || fault.regionId;
      const district = districts.find(d => d.id === fault.districtId)?.name || fault.districtId;
      
      // Common fields
      const row = [
        fault.id,
        type,
        region,
        district,
        formatSafeDate(fault.occurrenceDate),
        fault.restorationDate ? formatSafeDate(fault.restorationDate) : 'N/A',
        fault.status,
        fault.faultType,
        fault.specificFaultType || 'N/A',
        duration.toFixed(2), // Format duration to 2 decimal places
        getUserDisplayName(fault.createdBy),
        formatSafeDate(fault.createdAt),
        // Population affected
        fault.affectedPopulation?.rural || fault.customersAffected?.rural || 0,
        fault.affectedPopulation?.urban || fault.customersAffected?.urban || 0,
        fault.affectedPopulation?.metro || fault.customersAffected?.metro || 0,
      ];

      // Add OP5 specific fields
      if (isOP5Fault) {
        row.push(
          fault.faultLocation || fault.substationName || 'N/A',
          fault.mttr || 'N/A',
          fault.reliabilityIndices?.saidi || 'N/A',
          fault.reliabilityIndices?.saifi || 'N/A',
          fault.reliabilityIndices?.caidi || 'N/A',
          'N/A', // Load MW
          'N/A', // Unserved Energy
          'N/A', // Area Affected
          'N/A', // Reason
          'N/A'  // Control Panel Indications
        );
      } else {
        // Add Control outage specific fields
        row.push(
          'N/A', // Fault Location
          'N/A', // MTTR
          'N/A', // SAIDI
          'N/A', // SAIFI
          'N/A', // CAIDI
          fault.loadMW || 0,
          fault.unservedEnergyMWh || 0,
          fault.areaAffected || 'N/A',
          fault.reason || 'N/A',
          fault.controlPanelIndications || 'N/A'
        );
      }
      
      // Handle values that might contain commas by wrapping in quotes
      return row.map(value => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          // Escape any existing quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    // Combine headers and data
    const csvContent = [headers.join(','), ...dataRows].join('\n');
    
    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Add filter information to filename
    let filename = `fault-analysis-${format(new Date(), 'yyyy-MM-dd')}`;
    if (selectedRegion !== "all") {
      const regionName = regions.find(r => r.id === selectedRegion)?.name || selectedRegion;
      filename += `-${regionName}`;
    }
    if (selectedDistrict !== "all") {
      const districtName = districts.find(d => d.id === selectedDistrict)?.name || selectedDistrict;
      filename += `-${districtName}`;
    }
    if (selectedFaultType !== "all") {
      filename += `-${selectedFaultType}`;
    }
    if (dateRange !== "all") {
      filename += `-${dateRange}`;
    }
    
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success toast with breakdown of exported records
    const op5Count = dataRows.filter(row => row[1] === 'OP5 Fault').length;
    const controlCount = dataRows.filter(row => row[1] === 'Control Outage').length;
    toast({
      title: "Export Successful",
      description: `Exported ${dataRows.length} records (${op5Count} OP5, ${controlCount} Control) with current filters applied.`,
    });
  };

  const exportToPDF = async () => {
    try {
      // Log the initial filtered faults
      console.log('Initial filteredFaults:', {
        total: filteredFaults.length,
        op5Count: filteredFaults.filter(f => 'faultLocation' in f || 'substationName' in f || 'substationNo' in f).length,
        controlCount: filteredFaults.filter(f => !('faultLocation' in f || 'substationName' in f || 'substationNo' in f)).length,
        sampleFaults: filteredFaults.slice(0, 2)
      });

      // Ensure we're using the filtered data
      const dataToExport = filteredFaults.map(fault => {
        // Log each fault being processed
        console.log('Processing fault:', {
          id: fault.id,
          hasFaultLocation: 'faultLocation' in fault,
          hasSubstationName: 'substationName' in fault,
          hasSubstationNo: 'substationNo' in fault,
          type: fault.type,
          faultType: fault.faultType,
          rawFault: fault
        });

        // Properly identify the fault type - check for all possible OP5 indicators
        const isOP5Fault = 
          'faultLocation' in fault || 
          'substationName' in fault || 
          'substationNo' in fault || 
          fault.type === 'OP5' ||
          fault.faultType === 'OP5';

        const processedFault = {
          ...fault,
          type: isOP5Fault ? 'OP5 Fault' : 'Control Outage',
          region: regions.find(r => r.id === fault.regionId)?.name || fault.regionId,
          district: districts.find(d => d.id === fault.districtId)?.name || fault.districtId,
          createdBy: getUserDisplayName(fault.createdBy),
          updatedBy: getUserDisplayName(fault.updatedBy)
        };

        // Log the processed fault
        console.log('Processed fault:', {
          id: processedFault.id,
          type: processedFault.type,
          isOP5Fault
        });

        return processedFault;
      });

      // Log the final data being exported
      console.log('Final export data:', {
        totalRecords: dataToExport.length,
        op5Faults: dataToExport.filter(f => f.type === 'OP5 Fault').length,
        controlOutages: dataToExport.filter(f => f.type === 'Control Outage').length,
        sampleOP5: dataToExport.find(f => f.type === 'OP5 Fault'),
        sampleControl: dataToExport.find(f => f.type === 'Control Outage')
      });

      await exportAnalyticsToPDF(
        dataToExport,
        reliabilityIndices,
        dateRange,
        startDate,
        endDate,
        selectedRegion,
        selectedDistrict,
        regions,
        districts
      );

      // Show success toast with breakdown of exported records
      const op5Count = dataToExport.filter(fault => fault.type === 'OP5 Fault').length;
      const controlCount = dataToExport.filter(fault => fault.type === 'Control Outage').length;
      toast({
        title: "Export Successful",
        description: `Exported ${dataToExport.length} records (${op5Count} OP5, ${controlCount} Control) to PDF.`,
      });
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export PDF report. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const exportMaterialsToCSV = () => {
    try {
      console.log('Starting material export with faults:', filteredFaults);

      // Get all OP5 faults with materials used
      const faultsWithMaterials = filteredFaults.filter(fault => {
        const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
        const hasMaterials = Array.isArray(fault.materialsUsed) && fault.materialsUsed.length > 0;
        if (isOP5Fault && hasMaterials) {
          console.log('[MaterialsAnalysis] Fault with materials:', fault);
        }
        return isOP5Fault && hasMaterials;
      });

      if (faultsWithMaterials.length === 0) {
        toast({
          title: "Export Failed",
          description: "No material data found to export",
          variant: "destructive",
        });
        return;
      }

      // Prepare headers
      const headers = [
        'Fault ID',
        'Fault Type',
        'Region',
        'District',
        'Fault Location',
        'Material Type',
        'Material Details',
        'Quantity',
        'Date'
      ];

      // Prepare data rows
      const dataRows = faultsWithMaterials.flatMap(fault => {
        const region = regions.find(r => r.id === fault.regionId)?.name || 'Unknown';
        const district = districts.find(d => d.id === fault.districtId)?.name || 'Unknown';
        const faultType = fault.faultType || 'OP5 Fault'; // Default to 'OP5 Fault' if faultType is not available
        
        return fault.materialsUsed.map(material => {
          let materialDetails = 'N/A';
          let quantity = material.quantity || material.details?.quantity || 1;
          
          // Handle different material types
          switch (material.type) {
            case 'Fuse':
              const rating = material.details?.rating || material.details?.fuseRating || material.rating || 'N/A';
              materialDetails = `Rating: ${rating}A`;
              break;
            case 'Conductor':
              const type = material.details?.type || material.conductorType || 'N/A';
              const length = material.details?.length || material.length || 'N/A';
              materialDetails = `Type: ${type}, Length: ${length}m`;
              break;
            case 'Others':
              materialDetails = material.details?.description || material.description || 'N/A';
              break;
            default:
              materialDetails = 'Unknown material type';
          }

          console.log('Processing material:', {
            faultId: fault.id,
            materialType: material.type,
            quantity: quantity,
            rawMaterial: material
          });

          return [
            fault.id || 'N/A',
            faultType,
            region,
            district,
            fault.faultLocation || 'N/A',
            material.type || 'Unknown',
            materialDetails,
            quantity.toString(),
            formatSafeDate(fault.occurrenceDate)
          ];
        });
      });

      // Create CSV content with proper escaping
      const csvContent = [
        headers.join(','),
        ...dataRows.map(row => 
          row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `materials_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Materials report has been exported",
      });
    } catch (error) {
      console.error('Error exporting materials to CSV:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export materials report",
        variant: "destructive",
      });
    }
  };
  
  const renderMaterialsContent = () => {
    // Get all OP5 faults with materials used
    const op5Faults = filteredFaults.filter(fault => {
      // Check if it's an OP5 fault and has materials
      const isOP5Fault = 'faultLocation' in fault || 'substationName' in fault || fault.type === 'OP5';
      const hasMaterials = Array.isArray(fault.materialsUsed) && fault.materialsUsed.length > 0;
      
      if (isOP5Fault && hasMaterials) {
        console.log('OP5 Fault with materials:', {
          id: fault.id,
          type: fault.type,
          materialsCount: fault.materialsUsed.length,
          materials: fault.materialsUsed
        });
      }
      
      return isOP5Fault && hasMaterials;
    });

    // Calculate materials statistics
    const materialsStats = {
      totalMaterials: op5Faults.reduce((sum, fault) => sum + fault.materialsUsed.length, 0),
      byType: [] as { name: string; value: number }[],
      byMonth: [] as { name: string; value: number }[],
      topMaterials: [] as { name: string; value: number }[]
    };

    // Group materials by type
    const materialsByType = new Map<string, number>();
    const materialsByMonth = new Map<string, number>();
    const materialCounts = new Map<string, number>();

    op5Faults.forEach(fault => {
      try {
        // Use occurrenceDate instead of date
        const faultDate = fault.occurrenceDate ? new Date(fault.occurrenceDate) : null;
        if (!faultDate || isNaN(faultDate.getTime())) {
          console.warn(`Invalid date for fault ${fault.id}:`, {
            occurrenceDate: fault.occurrenceDate,
            type: fault.type
          });
          return;
        }
        
        const month = format(faultDate, 'MMM yyyy');
        
        fault.materialsUsed.forEach(material => {
          // Log the complete material object for debugging
          console.log('Processing material:', {
            type: material.type,
            details: material.details,
            raw: material
          });

          // Count by type
          materialsByType.set(
            material.type,
            (materialsByType.get(material.type) || 0) + 1
          );

          // Count by month
          materialsByMonth.set(
            month,
            (materialsByMonth.get(month) || 0) + 1
          );

          // Count individual materials with safe property access
          let materialKey = material.type;
          
          if (material.type === 'Fuse') {
            // Check both the details object and direct properties
            const rating = material.details?.rating || 
                         material.details?.fuseRating || 
                         material.rating || 
                         material.fuseRating || 
                         'Unknown Rating';
            materialKey = `${material.type} - ${rating}`;
          } else if (material.type === 'Conductor') {
            const type = material.details?.type || 
                        material.type || 
                        'Unknown Type';
            materialKey = `${material.type} - ${type}`;
          } else if (material.type === 'Others') {
            const description = material.details?.description || 
                              material.description || 
                              'Unknown Description';
            materialKey = `${material.type} - ${description}`;
          }

          materialCounts.set(
            materialKey,
            (materialCounts.get(materialKey) || 0) + 1
          );
        });
      } catch (error) {
        console.error(`Error processing fault ${fault.id}:`, error, {
          occurrenceDate: fault.occurrenceDate,
          type: fault.type,
          materials: fault.materialsUsed
        });
      }
    });

    // Convert to arrays for charts
    materialsStats.byType = Array.from(materialsByType.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    materialsStats.byMonth = Array.from(materialsByMonth.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        try {
          const dateA = new Date(a.name);
          const dateB = new Date(b.name);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            console.warn('Invalid date in month sorting:', { a: a.name, b: b.name });
            return 0;
          }
          return dateA.getTime() - dateB.getTime();
        } catch (error) {
          console.error('Error sorting dates:', error);
          return 0;
        }
      });

    materialsStats.topMaterials = Array.from(materialCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    console.log('Materials Analysis Stats:', {
      totalFaults: op5Faults.length,
      totalMaterials: materialsStats.totalMaterials,
      byType: materialsStats.byType,
      byMonth: materialsStats.byMonth,
      topMaterials: materialsStats.topMaterials,
      sampleFault: op5Faults[0] ? {
        id: op5Faults[0].id,
        materials: op5Faults[0].materialsUsed
      } : null
    });

    return (
      <TabsContent value="materials" className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Materials Analysis</h2>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportMaterialsToCSV}
          >
            <Package className="h-4 w-4" />
            <span>Export Materials Report</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                Rural Reliability
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-200">Indices for rural areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-green-900 dark:text-green-100">
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">SAIDI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saidi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">SAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">CAIDI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caidi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-green-700 dark:text-green-200">Avg. Customer Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">CAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-green-700 dark:text-green-200">Customer Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-green-700 dark:text-green-200">MAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.rural?.maifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-green-700 dark:text-green-200">Momentary Avg. Interruption Frequency</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-[#20232a] border border-blue-200 dark:border-blue-900 hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                Urban Reliability
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-200">Indices for urban areas</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 text-blue-900 dark:text-blue-100">
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">SAIDI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saidi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">SAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">CAIDI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caidi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Customer Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">CAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-200">Customer Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-blue-700 dark:text-blue-200">MAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.urban?.maifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-200">Momentary Avg. Interruption Frequency</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-[#241f2e] border border-purple-200 dark:border-purple-900 hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-purple-800 dark:text-purple-200">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                Metro Reliability
              </CardTitle>
              <CardDescription className="text-purple-700 dark:text-purple-200">Indices for metro areas</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4 text-purple-900 dark:text-purple-100">
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">SAIDI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saidi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">SAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">CAIDI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caidi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Customer Interruption Duration</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">CAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-purple-700 dark:text-purple-200">Customer Avg. Interruption Frequency</p>
                </div>
                <div>
                  <Label className="text-sm text-purple-700 dark:text-purple-200">MAIFI</Label>
                  <p className="text-xl font-semibold">{reliabilityIndices?.metro?.maifi?.toFixed(2) || 'N/A'}</p>
                  <p className="text-xs text-purple-700 dark:text-purple-200">Momentary Avg. Interruption Frequency</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    );
  };
  
  // For district engineers, we restrict them to only see their district data
  const canChangeFilters = user?.role !== "district_engineer";
  
  // Filter the districts based on selected region
  const availableDistricts = filterRegion 
    ? districts.filter(d => d.regionId === filterRegion) 
    : districts;
  
  // Function to get region and district names
  const getRegionName = (regionId: string) => {
    return regions.find(r => r.id === regionId)?.name || regionId;
  };
  
  const getDistrictName = (districtId: string) => {
    return districts.find(d => d.id === districtId)?.name || districtId;
  };
  
  const showFaultDetails = (fault: any) => {
    setSelectedFault(fault);
    setDetailsOpen(true);
    console.log('Selected fault:', fault);
  };
  
  // Function to export only the recent faults shown in the overview table
  const exportRecentFaultsToCSV = () => {
    // Get the latest filtered faults
    const dataToExport = filteredFaults || [];
    
    if (dataToExport.length === 0) {
      toast({
        title: "No Data Available",
        description: "No data matches the current filters.",
        variant: "destructive",
      });
      return;
    }

    // Create headers based on visible columns
    const headers = [];
    if (visibleColumns.region) headers.push('Region');
    if (visibleColumns.district) headers.push('District');
    if (visibleColumns.occurrenceDate) headers.push('Occurrence Date');
    if (visibleColumns.typeOfOutage) headers.push('Type of Outage'); // moved before status
    if (visibleColumns.specificFaultType) headers.push('Specific Fault Type'); // moved before status
    if (visibleColumns.status) headers.push('Status');
    if (visibleColumns.restorationDate) headers.push('Restoration Date');
    if (visibleColumns.outageDuration) headers.push('Outage Duration');
    if (visibleColumns.repairDuration) headers.push('Repair Duration');
    if (visibleColumns.estimatedResolution) headers.push('Estimated Resolution Time');
    if (visibleColumns.resolutionStatus) headers.push('Resolution Time');
    if (visibleColumns.customersAffected) headers.push('Customers Affected');
    if (visibleColumns.description) headers.push('Description');
    if (visibleColumns.remarks) headers.push('Remarks');

    // Create data rows based on visible columns
    const dataRows = dataToExport.map((fault: any) => {
      const row = [];
      if (visibleColumns.region) row.push(getRegionName(fault.regionId));
      if (visibleColumns.district) row.push(getDistrictName(fault.districtId));
      if (visibleColumns.occurrenceDate) row.push(formatSafeDate(fault.occurrenceDate));
      if (visibleColumns.typeOfOutage) row.push(fault.faultType || 'N/A'); // moved before status
      if (visibleColumns.specificFaultType) row.push(fault.specificFaultType || 'N/A'); // moved before status
      if (visibleColumns.status) row.push(fault.status === 'resolved' ? 'Resolved' : 'Pending');
      if (visibleColumns.restorationDate) row.push(fault.restorationDate ? formatSafeDate(fault.restorationDate) : 'N/A');
      if (visibleColumns.outageDuration) {
        row.push(fault.occurrenceDate && fault.restorationDate
          ? `${((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
          : 'N/A');
      }
      if (visibleColumns.repairDuration) {
        row.push(fault.repairDate && fault.repairEndDate
          ? `${((new Date(fault.repairEndDate).getTime() - new Date(fault.repairDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
          : 'N/A');
      }
      if (visibleColumns.estimatedResolution) {
        row.push(fault.occurrenceDate && fault.estimatedResolutionTime
          ? `${((new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
          : 'N/A');
      }
      if (visibleColumns.resolutionStatus) {
        if (!fault.occurrenceDate || !fault.restorationDate || !fault.estimatedResolutionTime) {
          row.push('N/A');
        } else {
          const outageDuration = (new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
          const estimatedDuration = (new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
          row.push(outageDuration <= estimatedDuration ? 'Within Estimate' : 'Exceeded Estimate');
        }
      }
      if (visibleColumns.customersAffected) {
        let totalCustomersAffected = 0;
        if (fault.affectedPopulation) {
          totalCustomersAffected = (fault.affectedPopulation.rural || 0) + 
                                 (fault.affectedPopulation.urban || 0) + 
                                 (fault.affectedPopulation.metro || 0);
        } else if (fault.customersAffected) {
          totalCustomersAffected = (fault.customersAffected.rural || 0) + 
                                 (fault.customersAffected.urban || 0) + 
                                 (fault.customersAffected.metro || 0);
        }
        row.push(totalCustomersAffected || 'N/A');
      }
      if (visibleColumns.description) row.push(fault.outageDescription || fault.description || 'N/A');
      if (visibleColumns.remarks) row.push(fault.remarks || 'N/A');
      return row;
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...dataRows.map(row => row.map(cell => {
        // Handle special characters and ensure proper CSV formatting
        if (cell === null || cell === undefined) return '';
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename based on current filters
    let filename = 'fault-report';
    if (selectedRegion && selectedRegion !== 'all') {
      filename += `-${getRegionName(selectedRegion).toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (selectedDistrict && selectedDistrict !== 'all') {
      filename += `-${getDistrictName(selectedDistrict).toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (filterFaultType) {
      filename += `-${filterFaultType.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (dateRange) {
      filename += `-${dateRange}`;
    }
    filename += `-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${dataToExport.length} records to CSV.`,
    });
  };
  
  // Add a helper function to find user name by ID
  const getUserNameById = (userId: string | undefined): string => {
    if (!userId || userId === 'offline_user' || userId === 'unknown') return userId || 'N/A';
    
    // If users data is not loaded yet, return a loading indicator
    if (usersLoading || !users || users.length === 0) {
      return 'Loading...';
    }
    
    // Debug logging
    console.log('getUserNameById - Looking for userId:', userId);
    console.log('getUserNameById - Available users:', users);
    console.log('getUserNameById - Users count:', users?.length);
    
    const foundUser = users.find(u => u.id === userId);
    console.log('getUserNameById - Found user:', foundUser);
    
    if (foundUser) {
      const result = foundUser.name || foundUser.email || userId;
      console.log('getUserNameById - Returning:', result);
      return result;
    }
    
    console.log('getUserNameById - User not found, returning userId:', userId);
    return userId;
  };

  // Enhanced helper function to get user name with better fallback
  const getUserDisplayName = (userId: string | undefined): string => {
    if (!userId) return 'Unknown';
    
    // Handle special cases
    if (userId === 'offline_user' || userId === 'unknown') return 'Offline User';
    
    // Return from local cache if available (populated via Firestore on-demand)
    if (userNameMap[userId]) return userNameMap[userId];

    // If users data is not loaded yet, return a loading indicator
    if (usersLoading) return 'Loading...';
    
    // If no users data available, return the userId as fallback
    if (!users || users.length === 0) {
      console.log('getUserDisplayName - No users available, userId:', userId);
      return userId.length > 20 ? `${userId.substring(0, 20)}...` : userId;
    }
    
    console.log('getUserDisplayName - Looking for userId:', userId);
    console.log('getUserDisplayName - Total users:', users.length);
    console.log('getUserDisplayName - All users:', users);
    console.log('getUserDisplayName - Sample user:', users[0]);
    console.log('getUserDisplayName - Checking user with id:', users[0]?.id);
    console.log('getUserDisplayName - Checking if userId matches id');
    
    // The user id is the same as uid, so check both
    const foundUser = users.find(u => {
      const matchId = u.id === userId;
      const matchUid = u.uid === userId;
      const match = matchId || matchUid;
      
      console.log('getUserDisplayName - Checking user:', u.id, 'vs', userId, 'matchId:', matchId, 'matchUid:', matchUid);
      
      if (match) {
        console.log('getUserDisplayName - Found user object:', u);
      }
      return match;
    });
    
    if (foundUser) {
      const result = foundUser.name || foundUser.email || 'Unknown User';
      console.log('getUserDisplayName - Returning:', result);
      return result;
    }
    
    console.log('getUserDisplayName - User not found for userId:', userId);
    // If not found, return a truncated version of the ID for better display
    return userId.length > 20 ? `${userId.substring(0, 20)}...` : userId;
  };
  
  // Fetch load monitoring data with role-based filtering
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    async function fetchLoadMonitoring() {
      let qRef = collection(db, 'loadMonitoring');
      let q = query(qRef);

      // Apply region filter (use regionId)
      if (selectedRegion && selectedRegion !== "all") {
        q = query(q, where('regionId', '==', selectedRegion));
      } else if (user.role === 'regional_engineer') {
        q = query(q, where('regionId', '==', user.region));
      }

      // Apply district filter (use districtId)
      if (selectedDistrict && selectedDistrict !== "all") {
        q = query(q, where('districtId', '==', selectedDistrict));
      } else if (user.role === 'district_engineer' || user.role === 'technician') {
        q = query(q, where('districtId', '==', user.district));
      }

      const snapshot = await getDocs(q);
      let records: LoadMonitoringData[] = snapshot.docs.map(doc => ({ id: doc.id, ...Object.assign({}, doc.data()) } as LoadMonitoringData));

      // Date range filtering (client-side)
      if (dateRange !== "all") {
        let start: Date, end: Date;
        const now = new Date();
        switch (dateRange) {
          case "week":
            start = startOfDay(subDays(now, 6));
            end = endOfDay(now);
            break;
          case "month":
            start = startOfDay(subDays(now, 29));
            end = endOfDay(now);
            break;
          case "year":
            // Set start date to the beginning of last year
            start = startOfYear(subYears(now, 1));
            // Set end date to the end of last year
            end = endOfYear(subYears(now, 1));
            break;
          case "custom":
            if (startDate && endDate) {
              start = startOfDay(startDate);
              end = endOfDay(endDate);
            }
            break;
          case "custom-month":
            if (startMonth && endMonth) {
              start = startOfMonth(startMonth);
              end = endOfMonth(endMonth);
            }
            break;
          case "custom-year":
            if (startYear && endYear) {
              start = startOfYear(startYear);
              end = endOfYear(endYear);
            }
            break;
          case "custom-week":
            if (startWeek && endWeek && selectedYear) {
              start = startOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (startWeek - 1) * 7));
              end = endOfWeek(new Date(selectedYear.getFullYear(), 0, 1 + (endWeek - 1) * 7));
            }
            break;
          case "yesterday":
            start = startOfDay(subDays(now, 1));
            end = endOfDay(subDays(now, 1));
            break;
          default:
            start = startOfYear(now);
            end = endOfDay(now);
        }
        if (start && end) {
          records = records.filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= start && recordDate <= end;
          });
        }
      }

      setLoadMonitoringRecords(records);
    }
    fetchLoadMonitoring();
  }, [
    isAuthenticated,
    user,
    selectedRegion,
    selectedDistrict,
    dateRange,
    startDate,
    endDate,
    startMonth,
    endMonth,
    startYear,
    endYear,
    startWeek,
    endWeek,
    selectedYear
  ]);

  // Compute statistics
  useEffect(() => {
    if (!loadMonitoringRecords.length) {
      setLoadStats({ total: 0, overloaded: 0, okay: 0, avgLoad: 0, urgent: 0 });
      return;
    }
    const total = loadMonitoringRecords.length;
    const overloaded = loadMonitoringRecords.filter(r => r.percentageLoad > 100).length;
    const okay = loadMonitoringRecords.filter(r => r.percentageLoad <= 100).length;
    const avgLoad = total ? Number((loadMonitoringRecords.reduce((sum, r) => sum + (r.percentageLoad || 0), 0) / total).toFixed(2)) : 0;
    const urgent = loadMonitoringRecords.filter(r => r.neutralWarningLevel === 'critical').length;
    setLoadStats({ total, overloaded, okay, avgLoad, urgent });
  }, [loadMonitoringRecords]);
  
  const handleClearFilters = () => {
    // Apply role-based clear filter logic (same as Dashboard)
    if (user?.role === "global_engineer" || user?.role === "system_admin") {
    setSelectedRegion("all");
    setFilterRegion(undefined);
    setSelectedDistrict("all");
    setFilterDistrict(undefined);
    } else if (user?.role === "regional_engineer") {
      setSelectedDistrict("all");
      setFilterDistrict(undefined);
    }
    // District engineers and technicians don't clear region/district filters
    
    // Clear other filters for all roles
    setSelectedFaultType("all");
    setFilterFaultType(undefined);
    setFilterSpecificFaultType(undefined);
    setFilterStatus(undefined);
    setDateRange("all");
    setStartDate(null);
    setEndDate(null);
    setStartMonth(undefined);
    setEndMonth(undefined);
    setStartYear(undefined);
    setEndYear(undefined);
    setStartWeek(undefined);
    setEndWeek(undefined);
    setSelectedYear(undefined);
  };
  
  // Set initial filters based on user role
  useEffect(() => {
    if (user?.role === "regional_engineer" && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setFilterRegion(userRegion.id);
        setSelectedRegion(userRegion.id);
      }
    }
  }, [user, regions]);
  
  // Add toggleColumn function
  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId as keyof typeof prev]
    }));
  };
  
  // Set region automatically for project_engineer on load
  useEffect(() => {
    if ((user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') && user.region) {
      const regionObj = regions.find(r => r.name === user.region);
      if (regionObj) {
        setFilterRegion(regionObj.id);
        setSelectedRegion(regionObj.id);
      }
    }
  }, [user, regions]);
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-6 sm:space-y-8">
        {/* Enhanced Page Header */}
        <div className="pb-4 border-b border-border/40">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Analytics & Reporting
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {user?.role === "district_engineer" 
              ? `Analysis for ${user.district}` 
              : user?.role === "regional_engineer"
              ? `Analysis for ${user.region}`
              : "Analyze fault patterns and generate insights for better decision making"}
          </p>
        </div>

        {/* Filters Section */}
        <Card className="p-4 sm:p-6 bg-muted/30 border shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5" /> Filters
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="ml-auto"
            >
              Clear Filters
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Region Select */}
            <div>
              <Label htmlFor="region-select" className="text-xs text-muted-foreground">Region</Label>
              <Select
                value={selectedRegion}
                onValueChange={handleRegionChange}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "regional_general_manager" || user?.role === "district_manager" || user?.role === "project_engineer"}
              >
                <SelectTrigger id="region-select" className="mt-1">
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  {(user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager')
                    ? regions.filter(r => r.name === user.region).map(region => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))
                    : [<SelectItem value="all" key="all">All Regions</SelectItem>,
                       ...regions.map(region => (
                         <SelectItem key={region.id} value={region.id}>
                           {region.name}
                         </SelectItem>
                       ))]}
                </SelectContent>
              </Select>
            </div>
            {/* District Select */}
            <div>
              <Label htmlFor="district-select" className="text-xs text-muted-foreground">District</Label>
              <Select
                value={selectedDistrict}
                onValueChange={handleDistrictChange}
                disabled={!selectedRegion || user?.role === "district_engineer" || user?.role === "district_manager"}
              >
                <SelectTrigger id="district-select" className="mt-1">
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts
                    .filter((d) => !selectedRegion || d.regionId === selectedRegion)
                    .map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {/* Fault Type Select */}
            <div>
               <Label htmlFor="fault-type-select" className="text-xs text-muted-foreground">Outage Type</Label>
              <Select
                value={selectedFaultType}
                onValueChange={handleFaultTypeChange}
              >
                <SelectTrigger id="fault-type-select" className="mt-1">
                  <SelectValue placeholder="Select Outage Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Planned">Planned</SelectItem>
                  <SelectItem value="Unplanned">Unplanned</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="ECG Load Shedding">ECG Load Shedding</SelectItem>
                  <SelectItem value="GridCo Outages">GridCo Outages</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specific Fault Type Select */}
            <div>
              <Label htmlFor="specific-fault-type-select" className="text-xs text-muted-foreground">Specific Fault Type</Label>
              <Select
                value={filterSpecificFaultType || "all"}
                onValueChange={setFilterSpecificFaultType}
                disabled={selectedFaultType === "all" || selectedFaultType === "Planned" || selectedFaultType === "ECG Load Shedding" || selectedFaultType === "GridCo Outages"}
              >
                <SelectTrigger id="specific-fault-type-select" className="mt-1">
                  <SelectValue placeholder="Select Specific Fault Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specific Types</SelectItem>
                  {/* Unplanned Fault Types */}
                  <SelectItem value="JUMPER CUT">Jumper Cut</SelectItem>
                  <SelectItem value="CONDUCTOR CUT">Conductor Cut</SelectItem>
                  <SelectItem value="MERGED CONDUCTOR">Merged Conductor</SelectItem>
                  <SelectItem value="HV/LV LINE CONTACT">HV/LV Line Contact</SelectItem>
                  <SelectItem value="VEGETATION">Vegetation</SelectItem>
                  <SelectItem value="CABLE FAULT">Cable Fault</SelectItem>
                  <SelectItem value="TERMINATION FAILURE">Termination Failure</SelectItem>
                  <SelectItem value="BROKEN POLES">Broken Poles</SelectItem>
                  <SelectItem value="BURNT POLE">Burnt Pole</SelectItem>
                  <SelectItem value="FAULTY ARRESTER/INSULATOR">Faulty Arrester/Insulator</SelectItem>
                  <SelectItem value="EQIPMENT FAILURE">Equipment Failure</SelectItem>
                  <SelectItem value="PUNCTURED CABLE">Punctured Cable</SelectItem>
                  <SelectItem value="ANIMAL INTERRUPTION">Animal Interruption</SelectItem>
                  <SelectItem value="BAD WEATHER">Bad Weather</SelectItem>
                  <SelectItem value="TRANSIENT FAULTS">Transient Faults</SelectItem>
                  <SelectItem value="PHASE OFF">Phase Off</SelectItem>
                  <SelectItem value="BURNT PHASE">Burnt Phase</SelectItem>
                  {/* Emergency Fault Types */}
                  <SelectItem value="MEND CABLE">Mend Cable</SelectItem>
                  <SelectItem value="WORK ON EQUIPMENT">Work on Equipment</SelectItem>
                  <SelectItem value="FIRE">Fire</SelectItem>
                  <SelectItem value="IMPROVE HV">Improve HV</SelectItem>
                  <SelectItem value="JUMPER REPLACEMENT">Jumper Replacement</SelectItem>
                  <SelectItem value="MEND BROKEN">Mend Broken</SelectItem>
                  <SelectItem value="MEND JUMPER">Mend Jumper</SelectItem>
                  <SelectItem value="MEND TERMINATION">Mend Termination</SelectItem>
                  <SelectItem value="BROKEN POLE">Broken Pole</SelectItem>
                  <SelectItem value="ANIMAL CONTACT">Animal Contact</SelectItem>
                  <SelectItem value="VEGETATION SAFETY">Vegetation Safety</SelectItem>
                  <SelectItem value="TRANSFER/RESTORE">Transfer/Restore</SelectItem>
                  <SelectItem value="TROUBLE SHOOTING">Trouble Shooting</SelectItem>
                  <SelectItem value="MEND LOOSE">Mend Loose</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="OTHERS">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Status Select */}
            <div>
              <Label htmlFor="status-select" className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={filterStatus || "all"}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger id="status-select" className="mt-1">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Date Range Filters */}
          <div className="mt-4">
             <Label className="text-xs text-muted-foreground">Date Range</Label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Select value={dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by Date Range">
                    {dateRange === "custom-month" && startMonth && endMonth
                      ? `${format(startMonth, "MMM yyyy")} - ${format(endMonth, "MMM yyyy")}`
                      : dateRange === "custom-year" && startYear && endYear
                      ? `${format(startYear, "yyyy")} - ${format(endYear, "yyyy")}`
                      : dateRange === "custom-week" && startWeek && endWeek && selectedYear
                      ? `Week ${startWeek} - Week ${endWeek}, ${format(selectedYear, "yyyy")}`
                      : dateRange === "days"
                      ? `Last ${selectedDays} Days`
                      : dateRange === "all"
                      ? "All Time"
                      : dateRange === "today"
                      ? "Today"
                      : dateRange === "yesterday"
                      ? "Yesterday"
                      : dateRange === "week"
                      ? "Last 7 Days"
                      : dateRange === "month"
                      ? "Last 30 Days"
                      : dateRange === "year"
                      ? "Last Year"
                      : "Select Date Range"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="days">Last N Days</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                  <SelectItem value="custom-week">Select Week Range</SelectItem>
                  <SelectItem value="custom-month">Select Month Range</SelectItem>
                  <SelectItem value="custom-year">Select Year Range</SelectItem>
                </SelectContent>
              </Select>

              {dateRange === "days" && (
                <Select value={selectedDays.toString()} onValueChange={handleDaysChange}>
                  <SelectTrigger className="w-[100px] sm:w-[120px]">
                    <SelectValue placeholder="Days" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 14, 21, 30, 60, 90].map(days => (
                      <SelectItem key={days} value={days.toString()}>
                        {days} {days === 1 ? 'Day' : 'Days'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {dateRange === "custom-week" && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Select value={selectedYear?.getFullYear()?.toString()} onValueChange={(value) => handleYearSelect(new Date(parseInt(value), 0))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={startWeek?.toString()} onValueChange={(value) => handleStartWeekSelect(parseInt(value))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="Start Week" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 52 }, (_, i) => i + 1).map(week => (
                        <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="hidden sm:inline">to</span>

                  <Select value={endWeek?.toString()} onValueChange={(value) => handleEndWeekSelect(parseInt(value))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="End Week" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 52 }, (_, i) => i + 1).map(week => (
                        <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {dateRange === "custom-month" && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Popover open={isStartMonthPickerOpen} onOpenChange={setIsStartMonthPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] sm:w-[200px] justify-start text-left font-normal">
                        {startMonth ? format(startMonth, "MMMM yyyy") : "Start Month"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startMonth}
                        onSelect={handleStartMonthSelect}
                        initialFocus
                        disabled={(date) => endMonth ? date > endMonth : false}
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="hidden sm:inline">to</span>

                  <Popover open={isEndMonthPickerOpen} onOpenChange={setIsEndMonthPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] sm:w-[200px] justify-start text-left font-normal">
                        {endMonth ? format(endMonth, "MMMM yyyy") : "End Month"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endMonth}
                        onSelect={handleEndMonthSelect}
                        initialFocus
                        disabled={(date) => startMonth ? date < startMonth : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {dateRange === "custom-year" && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Select value={startYear?.getFullYear()?.toString()} onValueChange={(value) => handleStartYearSelect(new Date(parseInt(value), 0))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="Start Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="hidden sm:inline">to</span>

                  <Select value={endYear?.getFullYear()?.toString()} onValueChange={(value) => handleEndYearSelect(new Date(parseInt(value), 0))}>
                    <SelectTrigger className="w-[100px] sm:w-[120px]">
                      <SelectValue placeholder="End Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Export Buttons moved here for better grouping */}
          <div className="flex flex-wrap items-center gap-2 mt-6 border-t pt-4">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportDetailed}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Export Detailed CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportToPDF}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export PDF Report</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none flex items-center gap-2"
              onClick={exportMaterialsToCSV}
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Export Materials CSV</span>
              <span className="sm:hidden">Materials</span>
            </Button>
          </div>
        </Card>

        {/* Showing data range info - kept subtle */}
        {dateRange !== "all" && (
          <div className="mb-4 sm:mb-6 text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {dateRange === "today" 
                ? `Showing data for today (${format(new Date(), 'MMM dd, yyyy')})`
                : dateRange === "yesterday"
                ? `Showing data for yesterday (${format(subDays(new Date(), 1), 'MMM dd, yyyy')})`
                : startDate && endDate
                ? `Showing data from ${format(startDate, 'MMM dd, yyyy')} to ${format(endDate, 'MMM dd, yyyy')}`
                : dateRange === "days"
                ? `Showing data for the last ${selectedDays} days (${format(subDays(new Date(), selectedDays), 'MMM dd')} to ${format(new Date(), 'MMM dd, yyyy')})`
                : dateRange === "week"
                ? `Showing data for the last 7 days`
                : dateRange === "month"
                ? `Showing data for the last 30 days`
                : dateRange === "year"
                ? `Showing data for the last year`
                : ""}
            </span>
          </div>
        )}
        
        {/* Summary Cards Section - unchanged */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="bg-red-50 dark:bg-[#2a2325] border border-red-200 dark:border-red-900 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-red-700 dark:text-red-200">Total Faults</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-red-900 dark:text-red-100">{filteredFaults.length}</div>
              <p className="text-xs text-red-700 dark:text-red-200">
                {filteredFaults.filter((f: any) => f.status === "pending").length} pending
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 dark:bg-[#20232a] border border-blue-200 dark:border-blue-900 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-blue-700 dark:text-blue-200">OP5 Faults</CardTitle>
              <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">
                {filteredFaults.filter((f: any) => 'substationNo' in f).length}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-200">
                {filterRegion || filterDistrict ? `In selected area` : 'Across all regions'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 dark:bg-[#241f2e] border border-purple-200 dark:border-purple-900 hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-purple-700 dark:text-purple-200">Control Outages</CardTitle>
              <Users className="h-4 w-4 text-purple-600 dark:text-purple-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-purple-900 dark:text-purple-100">
                {filteredFaults.filter((f: any) => 'loadMW' in f).length}
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-200">
                {filterRegion || filterDistrict ? `In selected area` : 'Across all regions'}
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* MTTR Report Card */}
        <Card className="mb-4 sm:mb-8 border shadow-sm hover:shadow-md transition-shadow duration-200 dark:bg-[#181a1b] dark:border-gray-800">
          <CardHeader className="bg-muted/30 border-b p-4 dark:bg-[#23272e] dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 dark:text-gray-100">
                  <Clock className="h-5 w-5 text-primary dark:text-primary-200" />
                  Mean Time To Repair (MTTR) Report
                  {user?.role === "district_engineer" && user.district && (
                    <span className="text-sm font-normal text-muted-foreground">
                      - {districts.find(d => d.id === user.district)?.name || user.district}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1 dark:text-gray-300">Analysis of repair times for OP5 faults</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs sm:text-sm dark:text-gray-200 dark:border-gray-600">
                {filteredFaults.filter(f => 
                  ('faultLocation' in f || 'substationName' in f) && 
                  f.repairDate && 
                  f.repairEndDate
                ).length} Faults Analyzed
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <Card className="bg-yellow-50 dark:bg-[#2a281f] border border-yellow-200 dark:border-yellow-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-200">Average MTTR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {(() => {
                      const op5FaultsWithMTTR = filteredFaults.filter(f => 
                        ('faultLocation' in f || 'substationName' in f) && 
                        f.repairDate && 
                        f.repairEndDate
                      );
                      const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => {
                        const repairDate = new Date(fault.repairDate);
                        const repairEndDate = new Date(fault.repairEndDate);
                        const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                        return sum + mttr;
                      }, 0);
                      const averageMTTR = op5FaultsWithMTTR.length > 0 ? totalMTTR / op5FaultsWithMTTR.length : 0;
                      return `${averageMTTR.toFixed(2)} hours`;
                    })()}
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-200 mt-1">
                    Across all regions
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 dark:bg-[#2a2820] border border-orange-200 dark:border-orange-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-200">Total Repair Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {(() => {
                      const op5FaultsWithMTTR = filteredFaults.filter(f => 
                        ('faultLocation' in f || 'substationName' in f) && 
                        f.repairDate && 
                        f.repairEndDate
                      );
                      const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => {
                        const repairDate = new Date(fault.repairDate);
                        const repairEndDate = new Date(fault.repairEndDate);
                        const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                        return sum + mttr;
                      }, 0);
                      return `${totalMTTR.toFixed(2)} hours`;
                    })()}
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-200 mt-1">
                    Combined repair time
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-50 dark:bg-[#23272e] border border-gray-200 dark:border-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-200">Faults with MTTR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {filteredFaults.filter(f => 
                      ('faultLocation' in f || 'substationName' in f) && 
                      f.repairDate && 
                      f.repairEndDate
                    ).length}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-200 mt-1">
                    Out of {filteredFaults.filter(f => 'faultLocation' in f || 'substationName' in f).length} total OP5 faults
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <h3 className="text-base font-semibold">
                  {selectedDistrict && selectedDistrict !== "all"
                    ? `MTTR for ${districts.find(d => d.id === selectedDistrict)?.name || selectedDistrict}`
                    : selectedRegion && selectedRegion !== "all"
                      ? `MTTR by District in ${regions.find(r => r.id === selectedRegion)?.name || selectedRegion}`
                      : "MTTR by Region"}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  Average Repair Time (Lower is Better)
                </Badge>
              </div>
              <div className="space-y-4">
                {(() => {
                  let itemsToDisplay: any[] = [];
                  let isDisplayingDistricts = false;

                  if (selectedDistrict && selectedDistrict !== "all") {
                    // Case 1: Specific district selected (by DE or RE)
                    itemsToDisplay = districts.filter(d => d.id === selectedDistrict);
                    isDisplayingDistricts = true;
                  } else if (selectedRegion && selectedRegion !== "all") {
                    // Case 2: Specific region selected, show districts within
                    itemsToDisplay = districts.filter(d => d.regionId === selectedRegion);
                    isDisplayingDistricts = true;
                  } else {
                    // Case 3: No specific region/district, show regions
                    itemsToDisplay = showAllRegions ? regions : regions.slice(0, 1);
                    isDisplayingDistricts = false;
                  }

                  // Filter faults based on the current item (region or district)
                  return itemsToDisplay.map(item => {
                    const itemFaults = filteredFaults.filter(f => 
                      ('faultLocation' in f || 'substationName' in f) && 
                      f.repairDate && 
                      f.repairEndDate && 
                      (isDisplayingDistricts ? f.districtId === item.id : f.regionId === item.id)
                    );
                    const itemMTTR = itemFaults.reduce((sum, fault) => {
                      const repairDate = new Date(fault.repairDate);
                      const repairEndDate = new Date(fault.repairEndDate);
                      const mttr = (repairEndDate.getTime() - repairDate.getTime()) / (1000 * 60 * 60);
                      return sum + mttr;
                    }, 0);
                    const avgMTTR = itemFaults.length > 0 ? itemMTTR / itemFaults.length : 0;
                    const totalFaultsInArea = filteredFaults.filter(f => 
                       ('faultLocation' in f) && (isDisplayingDistricts ? f.districtId === item.id : f.regionId === item.id)
                    ).length;
                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            {/* Display item name (region or district) */}
                            <span className="font-medium text-sm sm:text-base">{item.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {itemFaults.length} faults
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="font-medium text-sm sm:text-base">{avgMTTR.toFixed(2)} hours</span>
                            <div className="flex-1 sm:w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ 
                                  width: `${(avgMTTR / 5) * 100}%`,  // Scale for 5 hours max
                                  maxWidth: '100%'
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {itemFaults.length} of {totalFaultsInArea} OP5 faults have MTTR data
                        </div>
                      </div>
                    );
                  });
                })()}
                {/* Only show Expand/Collapse button for the default 'MTTR by Region' view */}
                {regions.length > 1 && !(selectedDistrict && selectedDistrict !== "all") && !(selectedRegion && selectedRegion !== "all") && (
                  <div className="flex justify-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAllRegions(v => !v)}
                    >
                      {showAllRegions ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section with enhanced styling and responsiveness */}
        <div className="mt-8 sm:mt-12">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-1 h-auto bg-muted/50 rounded-lg border border-border/50 shadow-sm mb-6">
              <TabsTrigger value="overview" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <ActivityIcon className="h-4 w-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="faults" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Faults</span>
              </TabsTrigger>
              <TabsTrigger value="reliability" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <TrendingUp className="h-4 w-4" />
                <span>Reliability</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Clock className="h-4 w-4" />
                <span>Performance</span>
              </TabsTrigger>
              <TabsTrigger value="materials" className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
                <Package className="h-4 w-4" />
                <span>Materials</span>
              </TabsTrigger>
            </TabsList>

            {/* Add padding and subtle background to Tab Content areas */}
            <TabsContent value="overview" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-4">
              {/* Nested Tabs for Recent Faults Table - with active color */}
              <Tabs 
                defaultValue="all" 
                value={overviewRecentFaultsTab} 
                onValueChange={(value) => setOverviewRecentFaultsTab(value as 'all' | 'op5' | 'control')} 
                className="w-full"
              >
                {/* Add framing bg/padding to TabsList */}
                <TabsList className="grid w-full grid-cols-3 max-w-sm mx-auto bg-muted p-1 h-auto rounded-md mb-4"> 
                  <TabsTrigger 
                    value="all" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-colors duration-150"
                  >
                    All Recent
                  </TabsTrigger>
                  <TabsTrigger 
                    value="op5" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-orange-600 transition-colors duration-150"
                  >
                    OP5 Recent
                  </TabsTrigger>
                  <TabsTrigger 
                    value="control" 
                    className="text-xs sm:text-sm h-8 px-2 rounded-sm data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-purple-600 transition-colors duration-150"
                  >
                    Control Recent
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Recent Faults Card - Now uses filtered data */}
              <Card>
                <CardHeader className="pt-2 pb-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                    <div className="w-full sm:w-auto">
                      <CardTitle className="text-base sm:text-lg font-medium">Recent Faults</CardTitle>
                      <CardDescription className="text-xs sm:text-sm mt-1">
                        Latest fault reports based on selected tab
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Columns
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[300px] max-h-[400px] overflow-y-auto">
                          <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          {/* Search input */}
                          <div className="px-2 py-2">
                            <Input
                              placeholder="Search columns..."
                              className="h-8"
                              onChange={(e) => {
                                const searchTerm = e.target.value.toLowerCase();
                                const filteredColumns = columnOptions.filter(col => 
                                  col.label.toLowerCase().includes(searchTerm)
                                );
                                // Update visible columns based on search
                                const newVisibleColumns = { ...visibleColumns };
                                Object.keys(newVisibleColumns).forEach(key => {
                                  newVisibleColumns[key as keyof typeof newVisibleColumns] = 
                                    filteredColumns.some(col => col.id === key);
                                });
                                setVisibleColumns(newVisibleColumns);
                              }}
                            />
                          </div>
                          
                          {/* Basic Information */}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                              Basic Information
                            </DropdownMenuLabel>
                            {columnOptions.filter(col => 
                              ['region', 'district', 'occurrenceDate', 'status'].includes(col.id)
                            ).map(col => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                onCheckedChange={() => toggleColumn(col.id)}
                                onSelect={(e) => e.preventDefault()}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                    className="h-4 w-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  />
                                  <span 
                                    className="flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleColumn(col.id);
                                    }}
                                  >
                                    {col.label}
                                  </span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuGroup>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Duration & Impact */}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                              Duration & Impact
                            </DropdownMenuLabel>
                            {columnOptions.filter(col => 
                              ['outageDuration', 'repairDuration', 'estimatedResolution', 'resolutionStatus', 'customersAffected', 'restorationDate'].includes(col.id)
                            ).map(col => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                onCheckedChange={() => toggleColumn(col.id)}
                                onSelect={(e) => e.preventDefault()}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                    className="h-4 w-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  />
                                  <span 
                                    className="flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleColumn(col.id);
                                    }}
                                  >
                                    {col.label}
                                  </span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuGroup>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Additional Details */}
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                              Additional Details
                            </DropdownMenuLabel>
                            {columnOptions.filter(col => 
                              ['description', 'typeOfOutage', 'remarks'].includes(col.id)
                            ).map(col => (
                              <DropdownMenuCheckboxItem
                                key={col.id}
                                checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                onCheckedChange={() => toggleColumn(col.id)}
                                onSelect={(e) => e.preventDefault()}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <Checkbox
                                    checked={visibleColumns[col.id as keyof typeof visibleColumns]}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                    className="h-4 w-4"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  />
                                  <span 
                                    className="flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleColumn(col.id);
                                    }}
                                  >
                                    {col.label}
                                  </span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuGroup>
                          
                          <DropdownMenuSeparator />
                          
                          {/* Quick Actions */}
                          <div className="px-2 py-2 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const newVisibleColumns = { ...visibleColumns };
                                Object.keys(newVisibleColumns).forEach(key => {
                                  newVisibleColumns[key as keyof typeof newVisibleColumns] = true;
                                });
                                setVisibleColumns(newVisibleColumns);
                              }}
                            >
                              Show All
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const newVisibleColumns = { ...visibleColumns };
                                Object.keys(newVisibleColumns).forEach(key => {
                                  newVisibleColumns[key as keyof typeof newVisibleColumns] = false;
                                });
                                setVisibleColumns(newVisibleColumns);
                              }}
                            >
                              Hide All
                            </Button>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2"
                        onClick={exportRecentFaultsToCSV}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Export Recent
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visibleColumns.region && <TableHead className="text-xs sm:text-sm">Region</TableHead>}
                          {visibleColumns.district && <TableHead className="text-xs sm:text-sm">District</TableHead>}
                          {visibleColumns.occurrenceDate && <TableHead className="text-xs sm:text-sm">Occurrence Date</TableHead>}
                          {visibleColumns.typeOfOutage && <TableHead className="text-xs sm:text-sm">Type of Outage</TableHead>} {/* moved before status */}
                          {visibleColumns.specificFaultType && <TableHead className="text-xs sm:text-sm">Specific Fault Type</TableHead>} {/* moved before status */}
                          {visibleColumns.status && <TableHead className="text-xs sm:text-sm">Status</TableHead>}
                          {visibleColumns.restorationDate && <TableHead className="text-xs sm:text-sm">Restoration Date</TableHead>}
                          {visibleColumns.outageDuration && <TableHead className="text-xs sm:text-sm">Outage Duration</TableHead>}
                          {visibleColumns.repairDuration && <TableHead className="text-xs sm:text-sm">Repair Duration</TableHead>}
                          {visibleColumns.estimatedResolution && <TableHead className="text-xs sm:text-sm">Estimated Resolution</TableHead>}
                          {visibleColumns.resolutionStatus && <TableHead className="text-xs sm:text-sm">Resolution Time</TableHead>}
                          {visibleColumns.customersAffected && <TableHead className="text-xs sm:text-sm">Customers Affected</TableHead>}
                          {visibleColumns.description && <TableHead className="text-xs sm:text-sm">Description</TableHead>}
                          {visibleColumns.remarks && <TableHead className="text-xs sm:text-sm">Remarks</TableHead>}
                          {visibleColumns.actions && <TableHead className="text-xs sm:text-sm">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedFaults.length > 0 ? (
                          paginatedFaults.map((fault: any) => (
                            <TableRow key={fault.id}>
                              {visibleColumns.region && <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{getRegionName(fault.regionId)}</TableCell>}
                              {visibleColumns.district && <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{getDistrictName(fault.districtId)}</TableCell>}
                              {visibleColumns.occurrenceDate && <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">{formatSafeDate(fault.occurrenceDate)}</TableCell>}
                              {visibleColumns.typeOfOutage && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.faultType || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.specificFaultType && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.specificFaultType || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.status && (
                                <TableCell className="py-2 px-2 sm:px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${fault.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {fault.status === 'resolved' ? 'Resolved' : 'Pending'}
                                  </span>
                                </TableCell>
                              )}
                              {visibleColumns.restorationDate && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.restorationDate ? formatSafeDate(fault.restorationDate) : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.outageDuration && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.occurrenceDate && fault.restorationDate
                                    ? `${((new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                    : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.repairDuration && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.repairDate && fault.repairEndDate
                                    ? `${((new Date(fault.repairEndDate).getTime() - new Date(fault.repairDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                    : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.estimatedResolution && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.occurrenceDate && fault.estimatedResolutionTime
                                    ? `${((new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2)} hr`
                                    : 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.resolutionStatus && (
                                <TableCell className="py-2 px-2 sm:px-4">
                                  {(() => {
                                    if (!fault.occurrenceDate || !fault.restorationDate || !fault.estimatedResolutionTime) {
                                      return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">N/A</span>;
                                    }
                                    const outageDuration = (new Date(fault.restorationDate).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
                                    const estimatedDuration = (new Date(fault.estimatedResolutionTime).getTime() - new Date(fault.occurrenceDate).getTime()) / (1000 * 60 * 60);
                                    
                                    if (outageDuration <= estimatedDuration) {
                                      return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Within Estimate</span>;
                                    } else {
                                      return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Exceeded Estimate</span>;
                                    }
                                  })()}
                                </TableCell>
                              )}
                              {visibleColumns.customersAffected && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {(() => {
                                    let totalCustomersAffected = 0;
                                    if (fault.affectedPopulation) {
                                      totalCustomersAffected = (fault.affectedPopulation.rural || 0) + 
                                                             (fault.affectedPopulation.urban || 0) + 
                                                             (fault.affectedPopulation.metro || 0);
                                    } else if (fault.customersAffected) {
                                      totalCustomersAffected = (fault.customersAffected.rural || 0) + 
                                                             (fault.customersAffected.urban || 0) + 
                                                             (fault.customersAffected.metro || 0);
                                    }
                                    return totalCustomersAffected || 'N/A';
                                  })()}
                                </TableCell>
                              )}
                              {visibleColumns.description && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.outageDescription || fault.description || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.remarks && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  {fault.remarks || 'N/A'}
                                </TableCell>
                              )}
                              {visibleColumns.actions && (
                                <TableCell className="text-xs sm:text-sm py-2 px-2 sm:px-4">
                                  <Button variant="ghost" size="sm" onClick={() => showFaultDetails(fault)}>
                                    View Details
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center text-muted-foreground">
                              No recent faults found for the selected type.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                
                {/* Add pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex-1 text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredFaults.length)} of {filteredFaults.length} results
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
              </Card>
            </TabsContent>

            <TabsContent value="faults" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              <AnalyticsCharts filteredFaults={filteredFaults} />
            </TabsContent>

            <TabsContent value="reliability" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Updated Rural Reliability Card with color */}
                <Card className="bg-green-50 dark:bg-[#202a23] border border-green-200 dark:border-green-900 hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                      Rural Reliability
                    </CardTitle>
                    <CardDescription className="text-green-700 dark:text-green-200">Indices for rural areas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-green-900 dark:text-green-100">
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">SAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">SAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.saifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">CAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Avg. Customer Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">CAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.caifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Customer Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700 dark:text-green-200">MAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.rural?.maifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-green-700 dark:text-green-200">Momentary Avg. Interruption Frequency</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Updated Urban Reliability Card with color */}
                <Card className="bg-blue-50 dark:bg-[#20232a] border border-blue-200 dark:border-blue-900 hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                      Urban Reliability
                    </CardTitle>
                    <CardDescription className="text-blue-700 dark:text-blue-200">Indices for urban areas</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-4 text-blue-900 dark:text-blue-100">
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">SAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">SAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.saifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">CAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Avg. Customer Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">CAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.caifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Customer Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-blue-700 dark:text-blue-200">MAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.urban?.maifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-blue-700 dark:text-blue-200">Momentary Avg. Interruption Frequency</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Updated Metro Reliability Card with color */}
                <Card className="bg-purple-50 dark:bg-[#241f2e] border border-purple-200 dark:border-purple-900 hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-800 dark:text-purple-200">
                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                      Metro Reliability
                    </CardTitle>
                    <CardDescription className="text-purple-700 dark:text-purple-200">Indices for metro areas</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-4 text-purple-900 dark:text-purple-100">
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">SAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">SAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.saifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">CAIDI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caidi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Avg. Customer Interruption Duration</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">CAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.caifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Customer Avg. Interruption Frequency</p>
                      </div>
                      <div>
                        <Label className="text-sm text-purple-700 dark:text-purple-200">MAIFI</Label>
                        <p className="text-xl font-semibold">{reliabilityIndices?.metro?.maifi?.toFixed(2) || 'N/A'}</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">Momentary Avg. Interruption Frequency</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="p-4 sm:p-6 bg-background rounded-lg border shadow-sm space-y-6">
              {/* Add Performance Content Here */}
              <p>Performance metrics will be displayed here.</p>
            </TabsContent>

            <TabsContent value="materials" className="space-y-6">
              <MaterialsAnalysis faults={filteredFaults} />
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Fault Details Dialog - improved responsiveness */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-md sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedFault && (
              <>
                {/* {console.log('Selected Fault Data:', selectedFault)} */}
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedFault.faultType === 'Unplanned' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                    {selectedFault.faultType === 'Planned' && <Calendar className="h-5 w-5 text-blue-500" />}
                    {selectedFault.faultType === 'Emergency' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                    {selectedFault.faultType === 'Load Shedding' && <ChartIcon className="h-5 w-5 text-purple-500" />}
                    {'loadMW' in selectedFault ? 'Control System Outage Details' : 'OP5 Fault Details'}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{getRegionName(selectedFault.regionId)}, {getDistrictName(selectedFault.districtId)}</span>
                    </div>
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Fault Information</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground">ID</span>
                        <p className="text-sm">{selectedFault.id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Type</span>
                        <p className="text-sm">
                          <Badge variant="outline" className="mt-1">
                            {selectedFault.faultType}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Status</span>
                        <p className="text-sm">
                          <Badge className={`mt-1 ${
                            selectedFault.status === 'pending' 
                              ? 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-900' 
                              : 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-900'
                          }`}>
                            {selectedFault.status.toUpperCase()}
                          </Badge>
                        </p>
                      </div>
                      {'faultLocation' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Location</span>
                          <p className="text-sm">{selectedFault.faultLocation}</p>
                        </div>
                      )}
                      {'reason' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Reason</span>
                          <p className="text-sm">{selectedFault.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Time & Impact</h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Occurrence Date</span>
                        <p className="text-sm">{formatSafeDate(selectedFault.occurrenceDate)}</p>
                      </div>
                      {selectedFault.restorationDate && (
                        <div>
                          <span className="text-xs text-muted-foreground">Restoration Date</span>
                          <p className="text-sm">{formatSafeDate(selectedFault.restorationDate)}</p>
                        </div>
                      )}
                      {'outrageDuration' in selectedFault && selectedFault.outrageDuration && (
                        <div>
                          <span className="text-xs text-muted-foreground">Duration</span>
                          <p className="text-sm">{selectedFault.outrageDuration} minutes</p>
                        </div>
                      )}
                      {'affectedPopulation' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Affected Population</span>
                          <p className="text-sm">
                            Rural: {selectedFault.affectedPopulation.rural}, 
                            Urban: {selectedFault.affectedPopulation.urban}, 
                            Metro: {selectedFault.affectedPopulation.metro}
                          </p>
                        </div>
                      )}
                      {'customersAffected' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Customers Affected</span>
                          <p className="text-sm">
                            Rural: {selectedFault.customersAffected.rural}, 
                            Urban: {selectedFault.customersAffected.urban}, 
                            Metro: {selectedFault.customersAffected.metro}
                          </p>
                        </div>
                      )}
                      {'loadMW' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Load</span>
                          <p className="text-sm">{selectedFault.loadMW} MW</p>
                        </div>
                      )}
                      {'unservedEnergyMWh' in selectedFault && (
                        <div>
                          <span className="text-xs text-muted-foreground">Unserved Energy</span>
                          <p className="text-sm">{selectedFault.unservedEnergyMWh.toFixed(2)} MWh</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Materials Used</h3>
                  {selectedFault.materialsUsed && selectedFault.materialsUsed.length > 0 ? (
                    <div className="space-y-4">
                      {selectedFault.materialsUsed.map((material: any, index: number) => (
                        <Card key={index} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-muted-foreground">Type</span>
                              <p className="text-sm font-medium">{material.type}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Quantity</span>
                              <p className="text-sm font-medium">{material.quantity || material.details?.quantity || 1}</p>
                            </div>
                            {material.type === 'Fuse' && (
                              <>
                                <div>
                                  <span className="text-xs text-muted-foreground">Rating</span>
                                  <p className="text-sm font-medium">{material.rating || material.details?.rating || material.details?.fuseRating || 'N/A'}A</p>
                                </div>
                              </>
                            )}
                            {material.type === 'Conductor' && (
                              <>
                                <div>
                                  <span className="text-xs text-muted-foreground">Type</span>
                                  <p className="text-sm font-medium">{material.details?.type || material.conductorType || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-muted-foreground">Length</span>
                                  <p className="text-sm font-medium">{material.details?.length || material.length || 'N/A'}m</p>
                                </div>
                              </>
                            )}
                            {material.type === 'Others' && (
                              <div className="col-span-2">
                                <span className="text-xs text-muted-foreground">Description</span>
                                <p className="text-sm font-medium">{material.details?.description || material.description || 'N/A'}</p>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No materials used</p>
                  )}
                </div>

                {/* Move Audit Information after Materials Used */}
                <div className="mt-6">
                  <h3 className="text-sm font-medium mb-2">Audit Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Created By</span>
                      <p className="text-sm">{getUserDisplayName(selectedFault.createdBy)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Created At</span>
                      <p className="text-sm">{formatSafeDate(selectedFault.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Updated By</span>
                      <p className="text-sm">{getUserDisplayName(selectedFault.updatedBy)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Updated At</span>
                      <p className="text-sm">{formatSafeDate(selectedFault.updatedAt)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Link to={`/dashboard?id=${selectedFault.id}`} className="text-primary hover:underline text-sm">
                    View on Dashboard
                  </Link>
                </div>
                {/* Show all fault data for debugging/inspection */}
                <div className="mt-6">
                  <h3 className="text-base sm:text-lg font-bold text-primary mb-4">All Fault Data</h3>
                  {(() => {
                    // Helper functions
                    function formatValue(value): React.ReactNode {
                      if (value === null || value === undefined || value === '') return '—';
                      // Firestore timestamp
                      if (typeof value === 'object' && value.seconds && value.nanoseconds) {
                        const date = new Date(value.seconds * 1000);
                        return date.toLocaleString();
                      }
                      // ISO date string
                      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
                        return new Date(value).toLocaleString();
                      }
                      // Object (like affectedPopulation)
                      if (typeof value === 'object' && !Array.isArray(value)) {
                        return (
                          <ul className="ml-2 list-none">
                            {Object.entries(value).map(([k, v]) => (
                              <li key={k}><span className="font-semibold text-gray-500">{formatKey(k)}:</span> {formatValue(v)}</li>
                            ))}
                          </ul>
                        );
                      }
                      // Array (like materialsUsed)
                      if (Array.isArray(value)) {
                        return value.length === 0 ? '—' : (
                          <ul className="ml-2 list-disc">
                            {value.map((v, i) => {
                              // For materials, exclude the id field
                              if (v && typeof v === 'object' && 'type' in v) {
                                const { id, ...materialWithoutId } = v;
                                return <li key={i}>{formatValue(materialWithoutId)}</li>;
                              }
                              return <li key={i}>{formatValue(v)}</li>;
                            })}
                          </ul>
                        );
                      }
                      return String(value);
                    }
                    function formatKey(key) {
                      return key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())
                        .replace(/_/g, ' ');
                    }
                    // Group fields
                    const { regionId, districtId, ...rest } = selectedFault;
                    const groups = [
                      {
                        title: 'General Info',
                        fields: ['id', 'faultType', 'status', 'description', 'createdAt', 'updatedAt', 'mttr'],
                      },
                      {
                        title: 'Location',
                        fields: ['region', 'district', 'substationName', 'substationNo', 'faultLocation'],
                      },
                      {
                        title: 'Timing',
                        fields: ['occurrenceDate', 'repairDate', 'restorationDate'],
                      },
                      {
                        title: 'Impact',
                        fields: ['affectedPopulation', 'materialsUsed', 'loadMW', 'reason'],
                      },
                      // Add Audit Info group for createdBy and updatedBy
                      {
                        title: 'Audit Info',
                        fields: ['createdBy', 'updatedBy'],
                      },
                    ];
                    // Find any extra fields not in groups
                    const groupedFields = groups.flatMap(g => g.fields);
                    const exclude = [];
                    const extraFields = Object.keys(rest)
                      .filter(k => !groupedFields.includes(k) && !exclude.includes(k));
                    if (extraFields.length > 0) {
                      groups.push({ title: 'Other', fields: extraFields });
                    }
                    return (
                      <div className="space-y-4">
                        {groups.map(group => {
                          const groupEntries = group.fields.filter(f => f in rest).map(f => [f, rest[f]]);
                          if (groupEntries.length === 0) return null;
                          return (
                            <section
                              key={group.title}
                              className="bg-gray-50 rounded-lg shadow-sm p-4 sm:p-6 dark:bg-gray-700 dark:shadow-md"
                            >
                              <div className="flex items-center mb-3">
                                <h4 className="text-base sm:text-lg font-bold text-blue-700 tracking-wide uppercase dark:text-blue-300">
                                  {group.title}
                                </h4>
                              </div>
                              <dl className="divide-y divide-gray-200 dark:divide-gray-600">
                                {groupEntries.map(([key, value]) => (
                                  <div key={key} className="py-2 flex flex-col sm:flex-row sm:items-center">
                                    <dt className="text-xs sm:text-sm font-semibold text-gray-500 uppercase w-40 sm:w-56 flex-shrink-0 dark:text-gray-400">
                                      {formatKey(key)}
                                    </dt>
                                    <dd className="ml-0 sm:ml-4 text-sm sm:text-base text-gray-900 break-words dark:text-gray-200">
                                      { /* Use helper function for createdBy and updatedBy */ }
                                      { (key === 'createdBy' || key === 'updatedBy') 
                                          ? getUserDisplayName(value as string) 
                                          : formatValue(value)
                                      }
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </section>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
