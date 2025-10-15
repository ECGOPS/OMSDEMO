import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Download, FileText, Filter, AlertTriangle, Users, Zap, Clock, TrendingUp, Table, BarChart3, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { FeederManagement } from "@/components/analytics/FeederManagement";
import { useNavigate } from "react-router-dom";
import { getUserRegionAndDistrict } from "@/utils/user-utils";
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ControlSystemAnalyticsPage() {
  const { user, isAuthenticated } = useAuth();
  const { controlSystemOutages, regions, districts } = useData();
  const [filterRegion, setFilterRegion] = useState<string | undefined>(undefined);
  const [filterDistrict, setFilterDistrict] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedWeekYear, setSelectedWeekYear] = useState<number | undefined>(undefined);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | undefined>(undefined);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [outageType, setOutageType] = useState<'all' | 'sustained' | 'momentary'>('all');
  const [filterFaultType, setFilterFaultType] = useState<string>("all");
  const [filterSpecificFaultType, setFilterSpecificFaultType] = useState<string>("all");
  const [minTripCount, setMinTripCount] = useState<number>(1); // Changed default to 1
  const [view, setView] = useState<'charts' | 'table'>('charts');
  const [sortField, setSortField] = useState<string>('occurrenceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>("overview");
  const navigate = useNavigate();

  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [paginatedOutages, setPaginatedOutages] = useState<any[]>([]);

  // Cache for total count
  const [totalCountCache, setTotalCountCache] = useState<{ [key: string]: number }>({});

  // Add page size options
  const pageSizeOptions = [10, 25, 50, 100];

  // Add loading state for total count
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  // Add column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    occurrenceDate: true,
    region: true,
    district: true,
    faultType: true,
    specificFaultType: true,
    description: true,
    feederName: true,
    voltageLevel: true,
    ruralCustomers: true,
    urbanCustomers: true,
    metroCustomers: true,
    totalCustomers: true,
    ruralCID: true,
    urbanCID: true,
    metroCID: true,
    customerInterruptionDuration: true,
    ruralCIF: true,
    urbanCIF: true,
    metroCIF: true,
    customerInterruptionFrequency: true,
    totalFeederCustomers: true,
    unservedEnergy: true,
    repairDuration: true,
    outageDuration: true,
    load: true,
    status: true,
    controlPanelIndications: true,
    areaAffected: true,
    restorationDateTime: true
  });

  // Add a new state for filtered data
  const [filteredTableData, setFilteredTableData] = useState<OutageData[]>([]);

  // Add a new state for tracking the current data
  const [currentData, setCurrentData] = useState<OutageData[]>([]);

  // Add clear filters function with role-based logic (same as Dashboard)
  const clearFilters = () => {
    // Apply role-based clear filter logic (same as Dashboard)
    if (user?.role === "global_engineer" || user?.role === "system_admin") {
      setFilterRegion("all");
      setFilterDistrict("all");
    } else if (user?.role === "regional_engineer") {
      setFilterDistrict("all");
    }
    // District engineers and technicians don't clear region/district filters
    
    // Clear other filters for all roles
    setDateRange("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedWeek(undefined);
    setSelectedWeekYear(undefined);
    setOutageType("all");
    setFilterFaultType("all");
    setFilterSpecificFaultType("all");
    setMinTripCount(1);
    setCurrentPage(1);
    loadData(true);
  };

  // Column definitions
  const columns = [
    { id: 'occurrenceDate', label: 'Occurrence Date', sortField: 'occurrenceDate' },
    { id: 'region', label: 'Region', sortField: 'regionId' },
    { id: 'district', label: 'District', sortField: 'districtId' },
    { id: 'faultType', label: 'Fault Type', sortField: 'faultType' },
    { id: 'specificFaultType', label: 'Specific Fault Type', sortField: 'specificFaultType' },
    { id: 'description', label: 'Description', sortField: 'description' },
    { id: 'feederName', label: 'Feeder Name', sortField: 'feederName' },
    { id: 'voltageLevel', label: 'Voltage Level', sortField: 'voltageLevel' },
    { id: 'ruralCustomers', label: 'Rural Customers Affected', sortField: 'customersAffected.rural' },
    { id: 'urbanCustomers', label: 'Urban Customers Affected', sortField: 'customersAffected.urban' },
    { id: 'metroCustomers', label: 'Metro Customers Affected', sortField: 'customersAffected.metro' },
    { id: 'totalCustomers', label: 'Total Customers Affected', sortField: 'customersAffected' },
    { id: 'ruralCID', label: 'Rural CID (hrs)', sortField: 'customerInterruptionDuration.rural' },
    { id: 'urbanCID', label: 'Urban CID (hrs)', sortField: 'customerInterruptionDuration.urban' },
    { id: 'metroCID', label: 'Metro CID (hrs)', sortField: 'customerInterruptionDuration.metro' },
    { id: 'customerInterruptionDuration', label: 'Total CID (hrs)', sortField: 'customerInterruptionDuration' },
    { id: 'ruralCIF', label: 'Rural CIF', sortField: 'customerInterruptionFrequency.rural' },
    { id: 'urbanCIF', label: 'Urban CIF', sortField: 'customerInterruptionFrequency.urban' },
    { id: 'metroCIF', label: 'Metro CIF', sortField: 'customerInterruptionFrequency.metro' },
    { id: 'customerInterruptionFrequency', label: 'Total CIF', sortField: 'customerInterruptionFrequency' },
    { id: 'totalFeederCustomers', label: 'Total Feeder Customers', sortField: 'feederCustomers' },
    { id: 'repairDuration', label: 'Repair Duration (hrs)', sortField: 'repairStartDate' },
    { id: 'outageDuration', label: 'Outage Duration (hrs)', sortField: 'restorationDate' },
    { id: 'load', label: 'Load (MW)', sortField: 'loadMW' },
    { id: 'unservedEnergy', label: 'Unserved Energy (MWh)', sortField: 'unservedEnergyMWh' },
    { id: 'status', label: 'Status' },
    { id: 'controlPanelIndications', label: 'Indications on Control Panel', sortField: 'controlPanelIndications' },
    { id: 'areaAffected', label: 'Area Affected', sortField: 'areaAffected' },
    { id: 'restorationDateTime', label: 'Restoration Date & Time', sortField: 'restorationDate' }
  ];

  // Toggle column visibility
  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId as keyof typeof prev]
    }));
  };

  // Build cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${filterRegion}-${filterDistrict}-${dateRange}-${outageType}-${filterFaultType}-${user?.role}-${user?.region}-${user?.district}`;
  }, [filterRegion, filterDistrict, dateRange, outageType, filterFaultType, user]);

  // Add interface for outage data
  interface OutageData {
    id: string;
    occurrenceDate: string;
    restorationDate: string;
    regionId: string;
    districtId: string;
    faultType: string;
    specificFaultType?: string;
    description?: string;
    feederName?: string;
    voltageLevel?: string;
    customersAffected?: {
      rural: number;
      urban: number;
      metro: number;
    };
    status: string;
    [key: string]: any;
  }

  // Load data with server-side pagination
  const loadData = useCallback(async (resetPagination = false) => {
    console.log('=== loadData START ===');
    console.log('Current filters:', {
      filterDistrict,
      filterRegion,
      dateRange,
      selectedWeek,
      selectedWeekYear,
      selectedMonth,
      selectedMonthYear,
      outageType,
      filterFaultType,
      minTripCount,
      startDate,
      endDate
    });
    
    setIsLoading(true);
    try {
      const outagesRef = collection(db, "controlOutages");
      let q = query(outagesRef);

      // Apply role-based filtering
      if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
        q = query(q, where("regionId", "==", user.region));
      } else if (user?.role === 'district_engineer' || user?.role === 'district_manager') {
        q = query(q, where("districtId", "==", user.district));
      }

      // Apply district filter
      if (filterDistrict && filterDistrict !== "all") {
        q = query(q, where("districtId", "==", filterDistrict));
      }

      // Apply region filter
      if (filterRegion && filterRegion !== "all") {
        q = query(q, where("regionId", "==", filterRegion));
      }

      // Apply fault type filter - this should work independently
      if (filterFaultType && filterFaultType !== "all") {
        q = query(q, where("faultType", "==", filterFaultType));
      }

      // Apply date range filter
      if (dateRange !== "all") {
        let start, end;
        
        if (dateRange === "custom" && startDate && endDate) {
          start = startOfDay(startDate);
          end = endOfDay(endDate);
        } else if (dateRange === "today") {
          const now = new Date();
          start = startOfDay(now);
          end = endOfDay(now);
        } else if (dateRange === "yesterday") {
          const yesterday = subDays(new Date(), 1);
          start = startOfDay(yesterday);
          end = endOfDay(yesterday);
        } else if (dateRange === "7days") {
          const now = new Date();
          start = startOfDay(subDays(now, 7));
          end = endOfDay(now);
        } else if (dateRange === "30days") {
          const now = new Date();
          start = startOfDay(subDays(now, 30));
          end = endOfDay(now);
        } else if (dateRange === "90days") {
          const now = new Date();
          start = startOfDay(subDays(now, 90));
          end = endOfDay(now);
        } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
          const yearStart = new Date(selectedWeekYear, 0, 1);
          const firstWeekStart = startOfWeek(yearStart);
          const weekStart = new Date(firstWeekStart);
          weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
          start = startOfWeek(weekStart);
          end = endOfWeek(weekStart);
        } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
          const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
          start = startOfMonth(monthStart);
          end = endOfMonth(monthStart);
        } else if (dateRange === "year" && selectedYear !== undefined) {
          start = startOfYear(new Date(selectedYear, 0, 1));
          end = endOfYear(new Date(selectedYear, 0, 1));
        }

        if (start && end) {
          q = query(q, where("occurrenceDate", ">=", start));
          q = query(q, where("occurrenceDate", "<=", end));
        }
      }

      // Get total count
      const countSnapshot = await getCountFromServer(q);
      const totalCount = countSnapshot.data().count;
      console.log('Total count before pagination:', totalCount);
      setTotalItems(totalCount);
      
      // Reset pagination if filters changed
      if (resetPagination) {
        setCurrentPage(1);
        setLastVisible(null);
        setHasMore(true);
      }
      
      // Apply pagination and sorting
      q = query(
        q,
        orderBy(sortField, sortDirection),
        limit(pageSize)
      );
      
      if (lastVisible && !resetPagination) {
        q = query(q, startAfter(lastVisible));
      }

      console.log('Executing Firestore query with:', {
        sortField,
        sortDirection,
        pageSize,
        hasLastVisible: !!lastVisible,
        resetPagination
      });

      const querySnapshot = await getDocs(q);
      const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastVisibleDoc);
      setHasMore(querySnapshot.docs.length === pageSize);

      const outages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OutageData[];

      console.log('Retrieved outages from Firestore:', {
        count: outages.length,
        sample: outages.slice(0, 2).map(o => ({
          id: o.id,
          occurrenceDate: o.occurrenceDate,
          regionId: o.regionId,
          districtId: o.districtId
        }))
      });

      // Filter outages by outage type (sustained/momentary)
      const filteredOutages = outages.filter(outage => {
        if (outageType === 'all') return true;
        if (outage.occurrenceDate && outage.restorationDate) {
          const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60); // duration in minutes
          if (outageType === 'sustained' && duration > 5) return true;
          if (outageType === 'momentary' && duration <= 5) return true;
        }
        return false;
      });

      console.log('After outage type filtering:', {
        count: filteredOutages.length,
        sample: filteredOutages.slice(0, 2).map(o => ({
          id: o.id,
          occurrenceDate: o.occurrenceDate,
          regionId: o.regionId,
          districtId: o.districtId
        }))
      });

      // Update all data states
      setPaginatedOutages(filteredOutages);
      setFilteredTableData(filteredOutages);
      setCurrentData(filteredOutages);

      // Update total items count based on filtered data
      if (outageType !== 'all') {
        setTotalItems(filteredOutages.length);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      console.log('=== loadData END ===');
    }
  }, [
    filterRegion,
    filterDistrict,
    dateRange,
    startDate,
    endDate,
    selectedWeek,
    selectedMonth,
    selectedYear,
    selectedWeekYear,
    selectedMonthYear,
    filterFaultType,
    outageType,
    minTripCount,
    user,
    sortField,
    sortDirection,
    pageSize,
    lastVisible
  ]);

  // Update the effect to reload data when filters change
  useEffect(() => {
    loadData(true);
  }, [
    filterRegion,
    filterDistrict,
    dateRange,
    startDate,
    endDate,
    selectedWeek,
    selectedMonth,
    selectedYear,
    selectedWeekYear,
    selectedMonthYear,
    filterFaultType,
    outageType,
    minTripCount,
    sortField,
    sortDirection,
    pageSize
  ]);

  // Load next page
  const loadNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      loadData();
    }
  };

  // Load previous page
  const loadPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      loadData(true);
    }
  };

  // Define all possible fault types
  const faultTypes = [
    "Planned",
    "Unplanned",
    "Emergency",
    "ECG Load Shedding",
    "GridCo Outages"
  ];

  // Define specific fault types
  const specificFaultTypes = [
    "JUMPER CUT",
    "CONDUCTOR CUT",
    "MERGED CONDUCTOR",
    "HV/LV LINE CONTACT",
    "VEGETATION",
    "CABLE FAULT",
    "TERMINATION FAILURE",
    "BROKEN POLES",
    "BURNT POLE",
    "FAULTY ARRESTER/INSULATOR",
    "EQIPMENT FAILURE",
    "PUNCTURED CABLE",
    "ANIMAL INTERRUPTION",
    "BAD WEATHER",
    "TRANSIENT FAULTS",
    "OTHERS"
  ];

  // Filter outages based on selected criteria
  const filteredOutages = controlSystemOutages?.filter(outage => {
    // Apply region filter
    if (filterRegion && filterRegion !== "all" && outage.regionId !== filterRegion) {
      return false;
    }

    // Apply district filter
    if (filterDistrict && filterDistrict !== "all" && outage.districtId !== filterDistrict) {
      return false;
    }

    // Apply fault type filter
    if (filterFaultType && filterFaultType !== "all" && outage.faultType !== filterFaultType) {
      return false;
    }

    // Apply specific fault type filter
    if (filterSpecificFaultType && filterSpecificFaultType !== "all" && outage.specificFaultType !== filterSpecificFaultType) {
      return false;
    }
    
    if (dateRange !== "all") {
      const now = new Date();
      let start, end;
      
      if (dateRange === "today") {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (dateRange === "yesterday") {
        const yesterday = subDays(now, 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
      } else if (dateRange === "7days") {
        start = startOfDay(subDays(now, 7));
        end = endOfDay(now);
      } else if (dateRange === "30days") {
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
      } else if (dateRange === "90days") {
        start = startOfDay(subDays(now, 90));
        end = endOfDay(now);
      } else if (dateRange === "custom" && startDate && endDate) {
        start = startOfDay(startDate);
        end = endOfDay(endDate);
      } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
        const yearStart = new Date(selectedWeekYear, 0, 1);
        const firstWeekStart = startOfWeek(yearStart);
        const weekStart = new Date(firstWeekStart);
        weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
        start = startOfWeek(weekStart);
        end = endOfWeek(weekStart);
      } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
        const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
        start = startOfMonth(monthStart);
        end = endOfMonth(monthStart);
      } else if (dateRange === "year" && selectedYear !== undefined) {
        start = startOfYear(new Date(selectedYear, 0, 1));
        end = endOfYear(new Date(selectedYear, 0, 1));
      }

      const outageDate = new Date(outage.occurrenceDate);
      if (outageDate < start || outageDate > end) {
        return false;
      }
    }

    // Filter by outage type (sustained/momentary)
    if (outageType !== 'all' && outage.occurrenceDate && outage.restorationDate) {
      const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60); // duration in minutes
      if (outageType === 'sustained' && duration <= 5) return false;
      if (outageType === 'momentary' && duration > 5) return false;
    }
    
    return true;
  }) || [];

  // Calculate metrics
  const calculateMetrics = () => {
    // First, filter outages based on feeder trip count if needed
    let filteredData = [...filteredOutages];
    
    if (minTripCount > 1) {
      // Count trips per feeder
      const feederTripCounts = filteredData.reduce((acc, outage) => {
        if (outage.feederName) {
          acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter outages to only include those from feeders with enough trips
      filteredData = filteredData.filter(outage => 
        !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount
      );
    }

    const totalOutages = filteredData.length;
    const totalCustomersAffected = filteredData.reduce((sum, outage) => {
      const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
      return sum + rural + urban + metro;
    }, 0);
    
    const totalUnservedEnergy = filteredData.reduce((sum, outage) => 
      sum + (outage.unservedEnergyMWh || 0), 0
    );
    
    const avgOutageDuration = filteredData.reduce((sum, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime();
        return sum + duration;
      }
      return sum;
    }, 0) / (totalOutages || 1);

    // Calculate Customer Interruption Duration (CID)
    const customerInterruptionDuration = filteredData.reduce((sum, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60); // hours
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return sum + (duration * (rural + urban + metro));
      }
      return sum;
    }, 0);

    // Calculate Customer Interruption Frequency (CIF)
    const customerInterruptionFrequency = filteredData.reduce((sum, outage) => {
      const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
      return sum + (rural > 0 ? 1 : 0) + (urban > 0 ? 1 : 0) + (metro > 0 ? 1 : 0);
    }, 0);

    // Calculate Repair Durations
    const repairDurations = filteredData.reduce((sum, outage) => {
      if (outage.repairStartDate && outage.repairEndDate) {
        const duration = new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime();
        return sum + duration;
      }
      return sum;
    }, 0) / (totalOutages || 1);

    // Calculate fault type metrics
    const faultTypeMetrics = filteredData.reduce((acc, outage) => {
      const type = outage.faultType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOutages,
      totalCustomersAffected,
      totalUnservedEnergy,
      avgOutageDuration: avgOutageDuration / (1000 * 60 * 60), // Convert to hours
      customerInterruptionDuration,
      customerInterruptionFrequency,
      repairDurations: repairDurations / (1000 * 60 * 60), // Convert to hours
      faultTypeMetrics
    };
  };

  const metrics = calculateMetrics();

  // Add state for feeder pagination
  const [feederPage, setFeederPage] = useState(1);
  const feedersPerPage = 5;

  // Prepare chart data
  const prepareChartData = () => {
    // First, filter outages based on feeder trip count if needed
    let filteredData = [...filteredOutages];
    
    if (minTripCount > 1) {
      // Count trips per feeder
      const feederTripCounts = filteredData.reduce((acc, outage) => {
        if (outage.feederName) {
          acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter outages to only include those from feeders with enough trips
      filteredData = filteredData.filter(outage => 
        !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount
      );
    }

    // Outages by type
    const outagesByType = filteredData.reduce((acc, outage) => {
      acc[outage.faultType] = (acc[outage.faultType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Outages by voltage level
    const outagesByVoltage = filteredData.reduce((acc, outage) => {
      acc[outage.voltageLevel || 'Unknown'] = (acc[outage.voltageLevel || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Monthly trend
    const monthlyTrend = filteredData.reduce((acc, outage) => {
      const month = format(new Date(outage.occurrenceDate), 'MMM yyyy');
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Add repair duration by type
    const repairDurationByType = filteredData.reduce((acc, outage) => {
      if (outage.repairStartDate && outage.repairEndDate) {
        const duration = (new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60); // hours
        acc[outage.faultType] = (acc[outage.faultType] || 0) + duration;
      }
      return acc;
    }, {} as Record<string, number>);

    // Calculate average repair duration by type
    const averageRepairDurationByType = Object.entries(repairDurationByType).reduce((acc, [type, totalDuration]) => {
      const count = outagesByType[type] || 1;
      acc[type] = Number((totalDuration / count).toFixed(2));
      return acc;
    }, {} as Record<string, number>);

    // Add customer interruption duration by type
    const customerInterruptionDurationByType = filteredData.reduce((acc, outage) => {
      if (outage.occurrenceDate && outage.restorationDate) {
        const duration = (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60); // hours
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        const totalCustomers = rural + urban + metro;
        acc[outage.faultType] = (acc[outage.faultType] || 0) + (duration * totalCustomers);
      }
      return acc;
    }, {} as Record<string, number>);

    // Count feeder trips
    const feederTripCount = filteredData.reduce((acc, outage) => {
      if (outage.feederName) {
        if (!acc[outage.feederName]) {
          acc[outage.feederName] = {
            count: 0,
            details: []
          };
        }
        acc[outage.feederName].count += 1;
        acc[outage.feederName].details.push({
          date: format(new Date(outage.occurrenceDate), 'yyyy-MM-dd HH:mm'),
          type: outage.faultType,
          description: outage.description,
          status: outage.status,
          voltageLevel: outage.voltageLevel,
          region: regions.find(r => r.id === outage.regionId)?.name || 'Unknown',
          district: districts.find(d => d.id === outage.districtId)?.name || 'Unknown'
        });
      }
      return acc;
    }, {} as Record<string, { count: number; details: any[] }>);

    // Convert to array and sort by trip count
    const mostTrippedFeeders = Object.entries(feederTripCount)
      .filter(([_, data]) => data.count >= 2) // Always filter for 2 or more trips
      .map(([name, data]) => ({
        name,
        count: data.count,
        details: data.details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate pagination
    const totalFeeders = mostTrippedFeeders.length;
    const totalPages = Math.ceil(totalFeeders / feedersPerPage);
    const startIndex = (feederPage - 1) * feedersPerPage;
    const paginatedFeeders = mostTrippedFeeders.slice(startIndex, startIndex + feedersPerPage);

    return {
      byType: Object.entries(outagesByType).map(([name, value]) => ({ name, value })),
      byVoltage: Object.entries(outagesByVoltage).map(([name, value]) => ({ name, value })),
      monthlyTrend: Object.entries(monthlyTrend).map(([name, value]) => ({ name, value })),
      repairDurationByType: Object.entries(averageRepairDurationByType).map(([name, value]) => ({ name, value })),
      customerInterruptionDurationByType: Object.entries(customerInterruptionDurationByType).map(([name, value]) => ({ name, value })),
      frequentFeeders: paginatedFeeders,
      feederPagination: {
        totalFeeders,
        totalPages,
        currentPage: feederPage
      }
    };
  };

  const chartData = prepareChartData();

  // Export functions
  const exportToCSV = () => {
    const formatDate = (dateString: string | undefined | null) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd HH:mm');
    };

    // Define all possible headers with their corresponding data accessors
    const allColumns = [
      { id: 'occurrenceDate', label: 'Occurrence Date', accessor: (outage: any) => formatDate(outage.occurrenceDate) },
      { id: 'region', label: 'Region', accessor: (outage: any) => regions.find(r => r.id === outage.regionId)?.name || '' },
      { id: 'district', label: 'District', accessor: (outage: any) => districts.find(d => d.id === outage.districtId)?.name || '' },
      { id: 'faultType', label: 'Fault Type', accessor: (outage: any) => outage.faultType || '' },
      { id: 'specificFaultType', label: 'Specific Fault Type', accessor: (outage: any) => outage.specificFaultType || '' },
      { id: 'description', label: 'Description', accessor: (outage: any) => outage.description || '' },
      { id: 'feederName', label: 'Feeder Name', accessor: (outage: any) => outage.feederName || '' },
      { id: 'voltageLevel', label: 'Voltage Level', accessor: (outage: any) => outage.voltageLevel || '' },
      { id: 'ruralCustomers', label: 'Rural Customers Affected', accessor: (outage: any) => (outage.customersAffected?.rural || 0).toString() },
      { id: 'urbanCustomers', label: 'Urban Customers Affected', accessor: (outage: any) => (outage.customersAffected?.urban || 0).toString() },
      { id: 'metroCustomers', label: 'Metro Customers Affected', accessor: (outage: any) => (outage.customersAffected?.metro || 0).toString() },
      { id: 'totalCustomers', label: 'Total Customers Affected', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return (rural + urban + metro).toString();
      }},
      { id: 'ruralCID', label: 'Rural CID (hrs)', accessor: (outage: any) => {
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * (outage.customersAffected?.rural || 0)).toFixed(2);
      }},
      { id: 'urbanCID', label: 'Urban CID (hrs)', accessor: (outage: any) => {
      const outageDuration = outage.occurrenceDate && outage.restorationDate
        ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * (outage.customersAffected?.urban || 0)).toFixed(2);
      }},
      { id: 'metroCID', label: 'Metro CID (hrs)', accessor: (outage: any) => {
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
          : 0;
        return (outageDuration * (outage.customersAffected?.metro || 0)).toFixed(2);
      }},
      { id: 'customerInterruptionDuration', label: 'Total CID (hrs)', accessor: (outage: any) => {
      const totalCustomers = (outage.customersAffected?.rural || 0) + 
                           (outage.customersAffected?.urban || 0) + 
                           (outage.customersAffected?.metro || 0);
        const outageDuration = outage.occurrenceDate && outage.restorationDate
          ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
        : 0;
        return (outageDuration * totalCustomers).toFixed(2);
      }},
      { id: 'ruralCIF', label: 'Rural CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.rural > 0 ? '1' : '0');
      }},
      { id: 'urbanCIF', label: 'Urban CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.urban > 0 ? '1' : '0');
      }},
      { id: 'metroCIF', label: 'Metro CIF', accessor: (outage: any) => {
        return (outage.customersAffected?.metro > 0 ? '1' : '0');
      }},
      { id: 'customerInterruptionFrequency', label: 'Total CIF', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.customersAffected || {};
        return ((rural > 0 ? 1 : 0) + (urban > 0 ? 1 : 0) + (metro > 0 ? 1 : 0)).toString();
      }},
      { id: 'totalFeederCustomers', label: 'Total Feeder Customers', accessor: (outage: any) => {
        const { rural = 0, urban = 0, metro = 0 } = outage.feederCustomers || {};
        return (rural + urban + metro).toString();
      }},
      { id: 'repairDuration', label: 'Repair Duration (hrs)', accessor: (outage: any) => {
        if (outage.repairStartDate && outage.repairEndDate) {
          return ((new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)).toFixed(2);
        }
        return '0.00';
      }},
      { id: 'outageDuration', label: 'Outage Duration (hrs)', accessor: (outage: any) => {
        if (outage.occurrenceDate && outage.restorationDate) {
          return ((new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)).toFixed(2);
        }
        return '0.00';
      }},
      { id: 'load', label: 'Load (MW)', accessor: (outage: any) => outage.loadMW?.toFixed(2) || '' },
      { id: 'unservedEnergy', label: 'Unserved Energy (MWh)', accessor: (outage: any) => outage.unservedEnergyMWh?.toFixed(2) || '0.00' },
      { id: 'status', label: 'Status', accessor: (outage: any) => outage.status || '' },
      { id: 'controlPanelIndications', label: 'Indications on Control Panel', accessor: (outage: any) => outage.controlPanelIndications || '' },
      { id: 'areaAffected', label: 'Area Affected', accessor: (outage: any) => outage.areaAffected || '' },
      { id: 'restorationDateTime', label: 'Restoration Date & Time', accessor: (outage: any) => formatDate(outage.restorationDate) }
    ];

    // Filter columns based on visibility
    const visibleColumnDefinitions = allColumns.filter(col => visibleColumns[col.id as keyof typeof visibleColumns]);

    // Get headers from visible columns
    const headers = visibleColumnDefinitions.map(col => col.label);

    // Generate data rows
    const dataRows = filteredOutages.map(outage => {
      return visibleColumnDefinitions
        .map(col => `"${col.accessor(outage)}"`)
        .join(',');
    });

    const csvContent = [headers.join(','), ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `control-system-outages-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderChart = (data: any[], dataKey: string = 'value', nameKey: string = 'name') => {
    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={400} className="min-h-[400px] md:min-h-[300px]">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={nameKey} 
              tickFormatter={(value) => `${value} (${data.find(d => d[nameKey] === value)?.[dataKey] || 0})`}
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const value = payload[0].value as number;
                  const total = data.reduce((sum, item) => sum + item.value, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{label}</p>
                      <p>Total Outages: {value}</p>
                      <p>Percentage: {percentage}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar 
              dataKey={dataKey} 
              fill="#8884d8"
              label={{ 
                position: 'top',
                fill: 'hsl(var(--foreground))',
                fontSize: 12,
                fontWeight: 500,
                formatter: (value: any) => {
                  const total = data.reduce((sum, item) => sum + item.value, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${value} (${percentage}%)`;
                }
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400} className="min-h-[400px] md:min-h-[300px]">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={nameKey} 
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    } else if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={400} className="min-h-[400px] md:min-h-[300px]">
          <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey={dataKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  // Update the getSortedAndFilteredData function
  const getSortedAndFilteredData = () => {
    // Start with the filtered outages instead of paginated outages
    let data = [...filteredOutages];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(outage => 
        outage.faultType?.toLowerCase().includes(query) ||
        outage.description?.toLowerCase().includes(query) ||
        outage.feederName?.toLowerCase().includes(query) ||
        outage.voltageLevel?.toLowerCase().includes(query)
      );
    }

    // Apply feeder trip count filter only if minTripCount is greater than 1
    if (minTripCount > 1) {
      // Count trips per feeder
      const feederTripCounts = data.reduce((acc, outage) => {
        if (outage.feederName) {
          acc[outage.feederName] = (acc[outage.feederName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter outages to only include those from feeders with enough trips
      data = data.filter(outage => 
        !outage.feederName || feederTripCounts[outage.feederName] >= minTripCount
      );
    }

    // Apply date filters
    if (dateRange !== "all") {
      const now = new Date();
      let start, end;
      
      if (dateRange === "today") {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (dateRange === "yesterday") {
        const yesterday = subDays(now, 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
      } else if (dateRange === "7days") {
        start = startOfDay(subDays(now, 7));
        end = endOfDay(now);
      } else if (dateRange === "30days") {
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
      } else if (dateRange === "90days") {
        start = startOfDay(subDays(now, 90));
        end = endOfDay(now);
      } else if (dateRange === "custom" && startDate && endDate) {
        start = startOfDay(startDate);
        end = endOfDay(endDate);
      } else if (dateRange === "week" && selectedWeek !== undefined && selectedWeekYear !== undefined) {
        const yearStart = new Date(selectedWeekYear, 0, 1);
        const firstWeekStart = startOfWeek(yearStart);
        const weekStart = new Date(firstWeekStart);
        weekStart.setDate(weekStart.getDate() + (selectedWeek * 7));
        start = startOfWeek(weekStart);
        end = endOfWeek(weekStart);
      } else if (dateRange === "month" && selectedMonth !== undefined && selectedMonthYear !== undefined) {
        const monthStart = new Date(selectedMonthYear, selectedMonth, 1);
        start = startOfMonth(monthStart);
        end = endOfMonth(monthStart);
      } else if (dateRange === "year" && selectedYear !== undefined) {
        start = startOfYear(new Date(selectedYear, 0, 1));
        end = endOfYear(new Date(selectedYear, 0, 1));
      }

      data = data.filter(outage => {
        const outageDate = new Date(outage.occurrenceDate);
        return outageDate >= start && outageDate <= end;
      });
    }

    // Apply sorting
    data.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle date fields
      if (sortField === 'occurrenceDate' || sortField === 'restorationDate' || 
          sortField === 'repairStartDate' || sortField === 'repairEndDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle customer affected fields
      if (sortField === 'customersAffected') {
        const aTotal = (a.customersAffected?.rural || 0) + (a.customersAffected?.urban || 0) + (a.customersAffected?.metro || 0);
        const bTotal = (b.customersAffected?.rural || 0) + (b.customersAffected?.urban || 0) + (b.customersAffected?.metro || 0);
        aValue = aTotal;
        bValue = bTotal;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Update pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = data.slice(startIndex, endIndex);
    
    return paginatedData;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Update the renderTable function to use the total count from filteredOutages
  const renderTable = () => {
    // Get the filtered and sorted data
    const tableData = getSortedAndFilteredData();
    const totalCount = filteredOutages.length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search outages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
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
                      const filteredColumns = columns.filter(col => 
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
                  {columns.filter(col => 
                    ['occurrenceDate', 'region', 'district', 'faultType', 'specificFaultType', 'description'].includes(col.id)
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
                
                {/* Technical Details */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Technical Details
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['feederName', 'voltageLevel', 'load', 'unservedEnergy', 'controlPanelIndications', 'areaAffected'].includes(col.id)
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
                
                {/* Customer Impact */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Customer Impact
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['ruralCustomers', 'urbanCustomers', 'metroCustomers', 'totalCustomers', 
                     'ruralCID', 'urbanCID', 'metroCID', 'customerInterruptionDuration',
                     'ruralCIF', 'urbanCIF', 'metroCIF', 'customerInterruptionFrequency',
                     'totalFeederCustomers'].includes(col.id)
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
                
                {/* Duration & Status */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    Duration & Status
                  </DropdownMenuLabel>
                  {columns.filter(col => 
                    ['repairDuration', 'outageDuration', 'status', 'restorationDateTime'].includes(col.id)
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
          </div>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </div>
        <div className="rounded-md border">
          <TableComponent>
            <TableHeader>
              <TableRow>
                {columns.map((column) => 
                  visibleColumns[column.id as keyof typeof visibleColumns] && (
                    <TableHead 
                      key={column.id}
                      className={column.sortField ? "cursor-pointer" : ""}
                      onClick={() => column.sortField && handleSort(column.sortField)}
                    >
                      {column.label}
                      {column.sortField && sortField === column.sortField && (
                        sortDirection === 'asc' ? ' ↑' : ' ↓'
                      )}
                    </TableHead>
                  )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading data...
                    </div>
                  </TableCell>
                </TableRow>
              ) : tableData.length > 0 ? (
                tableData.map((outage) => {
                  const totalCustomers = (outage.customersAffected?.rural || 0) + 
                                      (outage.customersAffected?.urban || 0) + 
                                      (outage.customersAffected?.metro || 0);
                
                  const outageDuration = outage.occurrenceDate && outage.restorationDate
                    ? (new Date(outage.restorationDate).getTime() - new Date(outage.occurrenceDate).getTime()) / (1000 * 60 * 60)
                    : 0;

                  const customerInterruptionDuration = outage.occurrenceDate && outage.restorationDate
                    ? (outageDuration * totalCustomers)
                    : 0;

                  const customerInterruptionFrequency = 
                    (outage.customersAffected?.rural > 0 ? 1 : 0) +
                    (outage.customersAffected?.urban > 0 ? 1 : 0) +
                    (outage.customersAffected?.metro > 0 ? 1 : 0);

                  const totalFeederCustomers = (outage.feederCustomers?.rural || 0) + 
                                            (outage.feederCustomers?.urban || 0) + 
                                            (outage.feederCustomers?.metro || 0);

                  return (
                    <TableRow key={outage.id}>
                      {visibleColumns.occurrenceDate && (
                        <TableCell>{format(new Date(outage.occurrenceDate), 'yyyy-MM-dd HH:mm')}</TableCell>
                      )}
                      {visibleColumns.region && (
                        <TableCell>{regions.find(r => r.id === outage.regionId)?.name || '-'}</TableCell>
                      )}
                      {visibleColumns.district && (
                        <TableCell>{districts.find(d => d.id === outage.districtId)?.name || '-'}</TableCell>
                      )}
                      {visibleColumns.faultType && (
                        <TableCell>{outage.faultType || '-'}</TableCell>
                      )}
                      {visibleColumns.specificFaultType && (
                        <TableCell>{outage.specificFaultType || '-'}</TableCell>
                      )}
                      {visibleColumns.description && (
                        <TableCell className="max-w-[200px] truncate" title={outage.description || ''}>
                          {outage.description || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.feederName && (
                        <TableCell>{outage.feederName || '-'}</TableCell>
                      )}
                      {visibleColumns.voltageLevel && (
                        <TableCell>{outage.voltageLevel || '-'}</TableCell>
                      )}
                      {visibleColumns.ruralCustomers && (
                        <TableCell>{outage.customersAffected?.rural || 0}</TableCell>
                      )}
                      {visibleColumns.urbanCustomers && (
                        <TableCell>{outage.customersAffected?.urban || 0}</TableCell>
                      )}
                      {visibleColumns.metroCustomers && (
                        <TableCell>{outage.customersAffected?.metro || 0}</TableCell>
                      )}
                      {visibleColumns.totalCustomers && (
                        <TableCell>{totalCustomers}</TableCell>
                      )}
                      {visibleColumns.ruralCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.rural || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.urbanCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.urban || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.metroCID && (
                        <TableCell>
                          {outage.occurrenceDate && outage.restorationDate
                            ? (outageDuration * (outage.customersAffected?.metro || 0)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.customerInterruptionDuration && (
                        <TableCell>{customerInterruptionDuration.toFixed(2)}</TableCell>
                      )}
                      {visibleColumns.ruralCIF && (
                        <TableCell>
                          {outage.customersAffected?.rural > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.urbanCIF && (
                        <TableCell>
                          {outage.customersAffected?.urban > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.metroCIF && (
                        <TableCell>
                          {outage.customersAffected?.metro > 0 ? '1' : '0'}
                        </TableCell>
                      )}
                      {visibleColumns.customerInterruptionFrequency && (
                        <TableCell>{customerInterruptionFrequency}</TableCell>
                      )}
                      {visibleColumns.totalFeederCustomers && (
                        <TableCell>{totalFeederCustomers}</TableCell>
                      )}
                      {visibleColumns.repairDuration && (
                        <TableCell>
                          {outage.repairStartDate && outage.repairEndDate 
                            ? ((new Date(outage.repairEndDate).getTime() - new Date(outage.repairStartDate).getTime()) / (1000 * 60 * 60)).toFixed(2)
                            : '0.00'}
                        </TableCell>
                      )}
                      {visibleColumns.outageDuration && (
                        <TableCell>{outageDuration.toFixed(2)}</TableCell>
                      )}
                      {visibleColumns.load && (
                        <TableCell>{outage.loadMW?.toFixed(2) || '-'}</TableCell>
                      )}
                      {visibleColumns.unservedEnergy && (
                        <TableCell>{outage.unservedEnergyMWh?.toFixed(2) || '0.00'}</TableCell>
                      )}
                      {visibleColumns.status && (
                        <TableCell>
                          <Badge variant={outage.status === 'resolved' ? 'default' : 'destructive'}>
                            {outage.status}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.controlPanelIndications && (
                        <TableCell className="max-w-[200px] truncate" title={outage.controlPanelIndications || ''}>
                          {outage.controlPanelIndications || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.areaAffected && (
                        <TableCell className="max-w-[200px] truncate" title={outage.areaAffected || ''}>
                          {outage.areaAffected || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.restorationDateTime && (
                        <TableCell>
                          {outage.restorationDate ? format(new Date(outage.restorationDate), 'yyyy-MM-dd HH:mm') : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length} className="h-24 text-center text-muted-foreground">
                    No outages found matching the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </TableComponent>
        </div>
        
        {/* Update pagination controls */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex-1 text-sm text-muted-foreground">
              {isLoadingCount ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading total count...
                </div>
              ) : (
                `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} results`
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreviousPage}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadNextPage}
                disabled={currentPage * pageSize >= totalCount || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
        } else {
          // Set to "all" if no specific region
          setFilterRegion(undefined);
        }
        
        if (districtId) {
          setFilterDistrict(districtId);
        }
      } else {
        // For system admins and global engineers, set to "all" by default
        setFilterRegion(undefined);
        setFilterDistrict(undefined);
      }
    } else {
      // Set default to "all" when no user role restrictions
      setFilterRegion(undefined);
    }
  }, [isAuthenticated, user, navigate, regions, districts]);

  useEffect(() => {
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'regional_general_manager') {
      const regionObj = regions.find(r => r.name === user.region);
      if (regionObj) {
        setFilterRegion(regionObj.id);
      }
    }
  }, [user, regions]);

  // Update the district filter handler
  const handleDistrictChange = (value: string) => {
    console.log('District filter changed:', value);
    const newDistrict = value === 'all' ? undefined : value;
    setFilterDistrict(newDistrict);
    // Force a data reload
    loadData(true);
  };

  return (
    <Layout>
      <div className="px-4 md:container md:mx-auto py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Control System Analytics</h1>
            <p className="text-muted-foreground">Analyze control system outages and their impact</p>
          </div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={exportToCSV}
          >
            <Download className="h-4 w-4" />
            Export to CSV
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="overview" className="text-base">Overview</TabsTrigger>
            <TabsTrigger value="feeder" className="text-base">
              <span className="block md:hidden">Feeder</span>
              <span className="hidden md:inline">Feeder Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Filters Section */}
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Filters</h3>
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select
                    value={filterRegion || ""}
                    onValueChange={setFilterRegion}
                    disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "district_manager" || user?.role === "regional_general_manager"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      {(user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager")
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
                <div className="space-y-2">
                  <Label>District</Label>
                  <Select
                    value={filterDistrict || "all"}
                    onValueChange={handleDistrictChange}
                    disabled={user?.role === "district_engineer" || user?.role === "district_manager"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Districts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts
                        .filter(d => !filterRegion || d.regionId === filterRegion)
                        .map(district => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                      <SelectItem value="week">By Week</SelectItem>
                      <SelectItem value="month">By Month</SelectItem>
                      <SelectItem value="year">By Year</SelectItem>
                    </SelectContent>
                  </Select>
                  {dateRange === "custom" && (
                    <RangePicker
                      allowClear
                      value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
                      onChange={(dates) => {
                        if (dates && dates[0] && dates[1]) {
                          setStartDate(dates[0].toDate());
                          setEndDate(dates[1].toDate());
                        } else {
                          setStartDate(undefined);
                          setEndDate(undefined);
                        }
                      }}
                      format="YYYY-MM-DD"
                      className="w-full"
                    />
                  )}
                  {dateRange === "week" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Week</Label>
                        <Select
                          value={selectedWeek?.toString()}
                          onValueChange={(value) => setSelectedWeek(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select week" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 52 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                Week {i + 1}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Year</Label>
                        <Select
                          value={selectedWeekYear?.toString()}
                          onValueChange={(value) => setSelectedWeekYear(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => {
                              const year = new Date().getFullYear() - i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {dateRange === "month" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Month</Label>
                        <Select
                          value={selectedMonth?.toString()}
                          onValueChange={(value) => setSelectedMonth(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {format(new Date(2024, i, 1), "MMMM")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Year</Label>
                        <Select
                          value={selectedMonthYear?.toString()}
                          onValueChange={(value) => setSelectedMonthYear(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => {
                              const year = new Date().getFullYear() - i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {dateRange === "year" && (
                    <Select
                      value={selectedYear?.toString()}
                      onValueChange={(value) => setSelectedYear(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Outage Type</Label>
                  <Select 
                    value={outageType} 
                    onValueChange={(value: 'all' | 'sustained' | 'momentary') => setOutageType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outage type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outages</SelectItem>
                      <SelectItem value="sustained">Sustained ({'>'}5 min)</SelectItem>
                      <SelectItem value="momentary">Momentary (≤5 min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fault Type</Label>
                  <Select value={filterFaultType} onValueChange={setFilterFaultType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fault type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fault Types</SelectItem>
                      {faultTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Specific Fault Type</Label>
                  <Select 
                    value={filterSpecificFaultType} 
                    onValueChange={setFilterSpecificFaultType}
                    disabled={filterFaultType === "all" || filterFaultType === "Planned" || filterFaultType === "ECG Load Shedding" || filterFaultType === "GridCo Outages"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select specific fault type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Specific Types</SelectItem>
                      {specificFaultTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Most Trip Feeder Count</Label>
                  <Select 
                    value={minTripCount.toString()} 
                    onValueChange={(value) => setMinTripCount(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select feeder count" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">All Feeders</SelectItem>
                      <SelectItem value="2">2 or more trips</SelectItem>
                      <SelectItem value="3">3 or more trips</SelectItem>
                      <SelectItem value="4">4 or more trips</SelectItem>
                      <SelectItem value="5">5 or more trips</SelectItem>
                      <SelectItem value="10">10 or more trips</SelectItem>
                      <SelectItem value="20">20 or more trips</SelectItem>
                      <SelectItem value="50">50 or more trips</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <Card className="p-6 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Outages</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{metrics.totalOutages}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Customers Affected</CardTitle>
                  <Users className="h-4 w-4 text-green-500 dark:text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">{metrics.totalCustomersAffected}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Customer Interruption Duration</CardTitle>
                  <Clock className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{metrics.customerInterruptionDuration.toFixed(2)} hrs</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Customer Interruption Frequency</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{metrics.customerInterruptionFrequency}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-300">Avg. Repair Duration</CardTitle>
                  <Clock className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{metrics.repairDurations.toFixed(2)} hrs</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Unserved Energy</CardTitle>
                  <Zap className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{metrics.totalUnservedEnergy.toFixed(2)} MWh</div>
                </CardContent>
              </Card>
              
              {/* Planned vs Unplanned Outages */}
              <Card className="p-6 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Planned Outages</CardTitle>
                  <FileText className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{metrics.faultTypeMetrics['Planned'] || 0}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Unplanned Outages</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{metrics.faultTypeMetrics['Unplanned'] || 0}</div>
                </CardContent>
              </Card>
              
              {/* Emergency, Load Shedding, and Grid Outages */}
              <Card className="p-6 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Emergency Outages</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{metrics.faultTypeMetrics['Emergency'] || 0}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-300">ECG Load Shedding</CardTitle>
                  <Zap className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{metrics.faultTypeMetrics['ECG Load Shedding'] || 0}</div>
                </CardContent>
              </Card>
              <Card className="p-6 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-300">GridCo Outages</CardTitle>
                  <Zap className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{metrics.faultTypeMetrics['GridCo Outages'] || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Outages by Type</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Distribution of outage types</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.byType)}
                </CardContent>
              </Card>
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Outages by Voltage Level</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Distribution by voltage level</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.byVoltage)}
                </CardContent>
              </Card>
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Repair Duration by Type</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">Average repair duration for each outage type</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderChart(chartData.repairDurationByType)}
                </CardContent>
              </Card>
              <Card className="p-6 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                <CardHeader className="pb-4">
                  <CardTitle className="text-slate-700 dark:text-slate-300">Most Trip Feeders</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">
                    Showing feeders with {minTripCount} or more trips • {((feederPage - 1) * feedersPerPage) + 1} to {Math.min(feederPage * feedersPerPage, chartData.feederPagination.totalFeeders)} of {chartData.feederPagination.totalFeeders} feeders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {chartData.frequentFeeders.length > 0 ? (
                      <>
                        {chartData.frequentFeeders.map((feeder) => (
                          <div key={feeder.name} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">{feeder.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {feeder.details[0]?.voltageLevel} • {feeder.details[0]?.region} • {feeder.details[0]?.district}
                                </p>
                              </div>
                              <Badge variant="destructive">Tripped {feeder.count} times</Badge>
                            </div>
                            <div className="space-y-2">
                              {feeder.details.slice(0, 3).map((detail, index) => (
                                <div key={index} className="text-sm text-muted-foreground border-t pt-2">
                                  <div className="flex items-center gap-2">
                                    <span>{detail.date}</span>
                                    <Badge variant={detail.status === 'resolved' ? 'default' : 'destructive'}>
                                      {detail.status}
                                    </Badge>
                                  </div>
                                  <div className="mt-1">
                                    <span className="font-medium">{detail.type}</span>
                                    {detail.description && (
                                      <p className="text-xs mt-1">{detail.description}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {feeder.details.length > 3 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full text-muted-foreground"
                                  onClick={() => {
                                    // TODO: Implement modal or expandable view for all trips
                                    console.log('Show all trips for', feeder.name);
                                  }}
                                >
                                  Show {feeder.details.length - 3} more trips
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFeederPage(prev => Math.max(1, prev - 1))}
                            disabled={feederPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {feederPage} of {chartData.feederPagination.totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFeederPage(prev => Math.min(chartData.feederPagination.totalPages, prev + 1))}
                            disabled={feederPage === chartData.feederPagination.totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center">No feeders with multiple trips</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Table Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Outage Details Table</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pageSize">Rows per page:</Label>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setCurrentPage(1);
                        loadData(true);
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {pageSizeOptions.map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {renderTable()}
            </div>
          </TabsContent>

          <TabsContent value="feeder">
            <FeederManagement />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
} 