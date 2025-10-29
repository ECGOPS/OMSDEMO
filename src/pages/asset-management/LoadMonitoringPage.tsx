import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { LoadMonitoringData } from "@/lib/asset-types";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/utils/calculations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccessControlWrapper } from "@/components/access-control/AccessControlWrapper";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";

export default function LoadMonitoringPage() {
  const { user } = useAuth();
  const { regions, districts, loadMonitoringRecords, deleteLoadMonitoringRecord } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get pagination from URL params
  const currentPageFromUrl = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeFromUrl = parseInt(searchParams.get('pageSize') || '10', 10);
  
  const formatTimeWithAMPM = (time: string) => {
    if (!time) return '-';
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return time;
    }
  };

  const [formattedPercentageLoads, setFormattedPercentageLoads] = useState<Record<string, string>>({});
  // Filter states with persistence
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const saved = localStorage.getItem('loadMonitoring_selectedDate');
    return saved ? new Date(saved) : null;
  });
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const saved = localStorage.getItem('loadMonitoring_selectedMonth');
    return saved ? new Date(saved) : null;
  });
  const [selectedRegion, setSelectedRegion] = useState<string | null>(() => {
    return localStorage.getItem('loadMonitoring_selectedRegion') || null;
  });
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(() => {
    return localStorage.getItem('loadMonitoring_selectedDistrict') || null;
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem('loadMonitoring_searchTerm') || "";
  });
  const [selectedLoadStatus, setSelectedLoadStatus] = useState<string | null>(() => {
    return localStorage.getItem('loadMonitoring_selectedLoadStatus') || null;
  });
  
  // Use URL params for pagination state
  const currentPage = currentPageFromUrl;
  const pageSize = pageSizeFromUrl;
  
  // Function to update pagination in URL
  const updatePagination = (newPage: number, newPageSize?: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    if (newPageSize) {
      params.set('pageSize', newPageSize.toString());
    }
    setSearchParams(params);
  };

  // Save filter state to localStorage whenever it changes
  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem('loadMonitoring_selectedDate', selectedDate.toISOString());
    } else {
      localStorage.removeItem('loadMonitoring_selectedDate');
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedMonth) {
      localStorage.setItem('loadMonitoring_selectedMonth', selectedMonth.toISOString());
    } else {
      localStorage.removeItem('loadMonitoring_selectedMonth');
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedRegion) {
      localStorage.setItem('loadMonitoring_selectedRegion', selectedRegion);
    } else {
      localStorage.removeItem('loadMonitoring_selectedRegion');
    }
  }, [selectedRegion]);

  useEffect(() => {
    if (selectedDistrict) {
      localStorage.setItem('loadMonitoring_selectedDistrict', selectedDistrict);
    } else {
      localStorage.removeItem('loadMonitoring_selectedDistrict');
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (searchTerm) {
      localStorage.setItem('loadMonitoring_searchTerm', searchTerm);
    } else {
      localStorage.removeItem('loadMonitoring_searchTerm');
    }
  }, [searchTerm]);

  useEffect(() => {
    if (selectedLoadStatus) {
      localStorage.setItem('loadMonitoring_selectedLoadStatus', selectedLoadStatus);
    } else {
      localStorage.removeItem('loadMonitoring_selectedLoadStatus');
    }
  }, [selectedLoadStatus]);

  // Function to determine load status based on percentage load
  const getLoadStatus = (percentageLoad: number) => {
    if (percentageLoad >= 70) {
      return { status: "OVERLOAD", color: "bg-red-500" };
    } else if (percentageLoad >= 45) {
      return { status: "AVERAGE", color: "bg-yellow-500" };
    } else {
      return { status: "OKAY", color: "bg-green-500" };
    }
  };

  // Filter regions for new roles
  const filteredRegions = useMemo(() => {
    if (!user) return regions;
    
    if (user.role === 'global_engineer' || user.role === 'system_admin') {
      return regions;
    } else if (user.role === 'ashsub_t') {
      return regions.filter(r => 
        ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'].includes(r.name)
      );
    } else if (user.role === 'accsub_t') {
      return regions.filter(r => 
        ['ACCRA EAST REGION', 'ACCRA WEST REGION', 'SUBTRANSMISSION ACCRA'].includes(r.name)
      );
    }
    
    return regions;
  }, [regions, user]);
  
  // Filter districts based on selected region
  const filteredDistricts = useMemo(() => {
    if (!selectedRegion) return districts;
    return districts.filter(d => d.regionId === selectedRegion);
  }, [districts, selectedRegion]);

  const filteredRecords = useMemo(() => {
    if (!loadMonitoringRecords) return [];
    
    let filtered = loadMonitoringRecords;
    
    // Apply role-based filtering
    if (user?.role === 'regional_engineer' || user?.role === 'project_engineer') {
      filtered = filtered.filter(record => record.region === user.region);
    } else if (user?.role === 'ashsub_t' || user?.role === 'accsub_t') {
      // Filter by allowed regions for ashsub_t and accsub_t
      const allowedRegionNames = user.role === 'ashsub_t' 
        ? ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION']
        : ['ACCRA EAST REGION', 'ACCRA WEST REGION', 'SUBTRANSMISSION ACCRA'];
      
      filtered = filtered.filter(record => 
        allowedRegionNames.includes(record.region)
      );
    } else if (user?.role === 'district_engineer' || user?.role === 'technician') {
      filtered = filtered.filter(record => record.district === user.district);
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
    
    // Apply region filter (for global engineer, admin, and new roles)
    if (selectedRegion && (user?.role === 'global_engineer' || user?.role === 'system_admin' || user?.role === 'ashsub_t' || user?.role === 'accsub_t')) {
      filtered = filtered.filter(record => record.regionId === selectedRegion);
    }
    
    // Apply district filter (for regional engineer and above, including new roles)
    if (selectedDistrict && 
        (user?.role === 'global_engineer' || 
         user?.role === 'system_admin' || 
         user?.role === 'regional_engineer' ||
         user?.role === 'ashsub_t' ||
         user?.role === 'accsub_t')) {
      filtered = filtered.filter(record => record.districtId === selectedDistrict);
    }
    
    // Apply load status filter
    if (selectedLoadStatus && selectedLoadStatus !== "all") {
      filtered = filtered.filter(record => {
        const percentageLoad = typeof record.percentageLoad === 'number' ? record.percentageLoad : 0;
        if (selectedLoadStatus === "OVERLOAD") {
          return percentageLoad >= 100;
        } else if (selectedLoadStatus === "Action Required") {
          return percentageLoad >= 70 && percentageLoad < 100;
        } else if (selectedLoadStatus === "OKAY") {
          return percentageLoad < 70;
        }
        return true;
      });
    }
    
    // Apply search filter
    if (searchTerm.trim() !== "") {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        (record.substationName && record.substationName.toLowerCase().includes(lower)) ||
        (record.substationNumber && record.substationNumber.toLowerCase().includes(lower)) ||
        (record.region && record.region.toLowerCase().includes(lower)) ||
        (record.district && record.district.toLowerCase().includes(lower)) ||
        (record.location && record.location.toLowerCase().includes(lower))
      );
    }
    
    // Sort by date (and time) descending so most recent is first
    filtered = filtered.slice().sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
      return dateB.getTime() - dateA.getTime();
    });

    return filtered;
  }, [loadMonitoringRecords, user, selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm, selectedLoadStatus]);

  // Format percentage loads when records change
  useEffect(() => {
    const formatted: Record<string, string> = {};
    filteredRecords.forEach(record => {
      formatted[record.id] = typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : "0.00";
    });
    setFormattedPercentageLoads(formatted);
  }, [filteredRecords]);

  const handleView = (id: string) => {
    navigate(`/asset-management/load-monitoring-details/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/asset-management/load-monitoring/edit/${id}`);
  };

  const handleDelete = (id: string) => {
    const record = loadMonitoringRecords?.find(r => r.id === id);
    if (!record) return;

    // Check if user has permission to delete
    if (user?.role === 'global_engineer' || user?.role === 'system_admin') {
      deleteLoadMonitoringRecord(id);
      toast.success("Load monitoring record deleted successfully");
      return;
    }

    if (user?.role === 'regional_engineer' && record.region === user.region) {
        deleteLoadMonitoringRecord(id);
        toast.success("Load monitoring record deleted successfully");
        return;
    }

    if ((user?.role === 'district_engineer' || user?.role === 'technician') && record.district === user.district) {
        deleteLoadMonitoringRecord(id);
        toast.success("Load monitoring record deleted successfully");
        return;
    }

    toast.error("You don't have permission to delete this record");
  };

  const handleExportToPDF = async (record: LoadMonitoringData) => {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      
      // Load fonts
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Define layout constants
      const { width, height } = page.getSize();
      const margin = 50;
      const lineHeight = 20;
      const sectionSpacing = 30;
      
      let currentY = height - margin;
      
      // Add header
      page.drawText('LOAD MONITORING REPORT', {
        x: margin,
        y: currentY,
        size: 24,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight * 2;

      // Add report metadata
      page.drawText(`Report Date: ${formatDate(record.date)}`, {
        x: margin,
        y: currentY,
        size: 12,
        color: rgb(0.2, 0.2, 0.2),
        font: regularFont,
      });
      currentY -= lineHeight;

      // Add basic information
      const basicInfoY = currentY;
      await page.drawText("Basic Information:", { x: 50, y: currentY, size: 12, font: boldFont });
      currentY -= 20;
      await page.drawText(`Date: ${formatDate(record.date)}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Time: ${record.time}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Substation: ${record.substationName}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Number: ${record.substationNumber}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Region: ${record.region}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`District: ${record.district}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Location: ${record.location}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Rating: ${record.rating} KVA`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Peak Load Status: ${record.peakLoadStatus}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Ownership: ${record.ownership || 'N/A'}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`Voltage Level: ${record.voltageLevel || 'N/A'}`, { x: 50, y: currentY, size: 10 });
      await page.drawText(`Created By: ${record.createdBy?.name || 'Unknown'}`, { x: 300, y: currentY, size: 10 });
      currentY -= 15;
      await page.drawText(`GPS Location: ${record.gpsLocation || 'N/A'}`, { x: 50, y: currentY, size: 10 });
      currentY -= 25;

      // Add feeder legs information
      currentY -= sectionSpacing;
      page.drawText('Feeder Legs Information:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      record.feederLegs.forEach((leg, index) => {
        if (currentY < margin + lineHeight * 5) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - margin;
        }

        page.drawText(`Feeder Leg ${index + 1}:`, {
          x: margin,
          y: currentY,
          size: 12,
          color: rgb(0.2, 0.2, 0.2),
          font: boldFont,
        });
        currentY -= lineHeight;

        const legInfo = [
          ['Red Phase Current', `${typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent.toFixed(2) : '0.00'} A`],
          ['Yellow Phase Current', `${typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent.toFixed(2) : '0.00'} A`],
          ['Blue Phase Current', `${typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent.toFixed(2) : '0.00'} A`],
          ['Neutral Current', `${typeof leg.neutralCurrent === 'number' ? leg.neutralCurrent.toFixed(2) : '0.00'} A`]
        ];

        legInfo.forEach(([label, value]) => {
          page.drawText(`${label}: ${value}`, {
            x: margin + 20,
            y: currentY,
            size: 12,
            color: rgb(0.2, 0.2, 0.2),
            font: regularFont,
          });
          currentY -= lineHeight;
        });

        currentY -= lineHeight;
      });

      // Add calculated load information
      currentY -= sectionSpacing;
      page.drawText('Calculated Load Information:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      const loadInfo = [
        ['Rated Load', `${typeof record.ratedLoad === 'number' ? record.ratedLoad.toFixed(2) : '0.00'} A`],
        ['Red Phase Bulk Load', `${typeof record.redPhaseBulkLoad === 'number' ? record.redPhaseBulkLoad.toFixed(2) : '0.00'} A`],
        ['Yellow Phase Bulk Load', `${typeof record.yellowPhaseBulkLoad === 'number' ? record.yellowPhaseBulkLoad.toFixed(2) : '0.00'} A`],
        ['Blue Phase Bulk Load', `${typeof record.bluePhaseBulkLoad === 'number' ? record.bluePhaseBulkLoad.toFixed(2) : '0.00'} A`],
        ['Average Current', `${typeof record.averageCurrent === 'number' ? record.averageCurrent.toFixed(2) : '0.00'} A`],
        ['Percentage Load', `${typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '0.00'}%`],
        ['Maximum Full Load', `${typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '0.00'}%`],
        ['10% Rated Neutral', `${typeof record.tenPercentFullLoadNeutral === 'number' ? record.tenPercentFullLoadNeutral.toFixed(2) : '0.00'} A`],
        ['Calculated Neutral', `${typeof record.calculatedNeutral === 'number' ? record.calculatedNeutral.toFixed(2) : '0.00'} A`]
      ];

      loadInfo.forEach(([label, value]) => {
        page.drawText(`${label}: ${value}`, {
          x: margin,
          y: currentY,
          size: 12,
          color: rgb(0.2, 0.2, 0.2),
          font: regularFont,
        });
        currentY -= lineHeight;
      });

      // Add load status
      currentY -= lineHeight;
      const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
      page.drawText(`Economical Load Status: ${loadStatus.status}`, {
        x: margin,
        y: currentY,
        size: 14,
        color: loadStatus.status === "OVERLOAD" ? rgb(0.8, 0.2, 0.2) : 
               loadStatus.status === "AVERAGE" ? rgb(0.8, 0.6, 0.2) : 
               rgb(0.2, 0.6, 0.2),
        font: boldFont,
      });

      // Add Maximum Full Load status
      currentY -= lineHeight;
      const maxFullLoadStatus = typeof record.percentageLoad === 'number' && record.percentageLoad >= 100 ? "OVERLOAD" : "OKAY";
      page.drawText(`Maximum Full Load Status: ${maxFullLoadStatus}`, {
        x: margin,
        y: currentY,
        size: 14,
        color: maxFullLoadStatus === "OVERLOAD" ? rgb(0.8, 0.2, 0.2) : rgb(0.2, 0.6, 0.2),
        font: boldFont,
      });

      // Add footer with page numbers
      const pages = pdfDoc.getPages();
      pages.forEach((page, index) => {
        page.drawText(`Page ${index + 1} of ${pages.length}`, {
          x: width - margin - 50,
          y: margin - 20,
          size: 10,
          color: rgb(0.5, 0.5, 0.5),
          font: regularFont,
        });
      });

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `load-monitoring-${record.substationNumber}-${formatDate(record.date)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  const handleExportToCSV = (record: LoadMonitoringData) => {
    // Create CSV content
    const csvContent = [
      ["Load Monitoring Report"],
      ["Date", formatDate(record.date)],
      ["Time", record.time],
      ["Substation Name", record.substationName],
      ["Substation Number", record.substationNumber],
      ["Region", record.region],
      ["District", record.district],
      ["Location", record.location],
      ["Rating (KVA)", record.rating],
      ["Peak Load Status", record.peakLoadStatus],
      ["Ownership", record.ownership || 'N/A'],
      ["Voltage Level", record.voltageLevel || 'N/A'],
      [],
      ["Feeder Legs Information"],
      ["Leg", "Red Phase (A)", "Yellow Phase (A)", "Blue Phase (A)", "Neutral (A)"]
    ];

    // Add feeder legs data
    record.feederLegs.forEach((leg, index) => {
      csvContent.push([
        `Leg ${index + 1}`,
        typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent.toFixed(2) : '0.00',
        typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent.toFixed(2) : '0.00',
        typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent.toFixed(2) : '0.00',
        typeof leg.neutralCurrent === 'number' ? leg.neutralCurrent.toFixed(2) : '0.00'
      ]);
    });

    csvContent.push(
      [],
      ["Calculated Load Information"],
      ["Metric", "Value"],
      ["Rated Load (A)", typeof record.ratedLoad === 'number' ? record.ratedLoad.toFixed(2) : '0.00'],
      ["Red Phase Bulk Load (A)", typeof record.redPhaseBulkLoad === 'number' ? record.redPhaseBulkLoad.toFixed(2) : '0.00'],
      ["Yellow Phase Bulk Load (A)", typeof record.yellowPhaseBulkLoad === 'number' ? record.yellowPhaseBulkLoad.toFixed(2) : '0.00'],
      ["Blue Phase Bulk Load (A)", typeof record.bluePhaseBulkLoad === 'number' ? record.bluePhaseBulkLoad.toFixed(2) : '0.00'],
      ["Average Current (A)", typeof record.averageCurrent === 'number' ? record.averageCurrent.toFixed(2) : '0.00'],
      ["Percentage Load (%)", typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '0.00'],
      ["10% Rated Neutral (A)", typeof record.tenPercentFullLoadNeutral === 'number' ? record.tenPercentFullLoadNeutral.toFixed(2) : '0.00'],
      ["Calculated Neutral (A)", typeof record.calculatedNeutral === 'number' ? record.calculatedNeutral.toFixed(2) : '0.00']
    );

    // Add load status
    const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
    csvContent.push(
      [],
      ["Load Status", loadStatus.status]
    );

    // Convert to CSV string
    const csvString = csvContent.map(row => row.join(",")).join("\n");
    
    // Create and download file
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `load-monitoring-${record.substationNumber}-${formatDate(record.date)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV report generated successfully");
  };

  const handleExportAllToCSV = () => {
    // Define headers
    const headers = [
      "Date",
      "Time",
      "Substation Name",
      "Substation Number",
      "Region",
      "District",
      "Location",
      "Rating (KVA)",
      "Peak Load Status",
      "Ownership",
      "Created By",
      "Rated Load (A)",
      "Red Phase Bulk Load (A)",
      "Yellow Phase Bulk Load (A)",
      "Blue Phase Bulk Load (A)",
      "Average Current (A)",
      "Percentage Load (%)",
      "10% Rated Neutral (A)",
      "Calculated Neutral (A)",
      "Load Status"
    ];

    // Add each record as a single row
    const rows = filteredRecords.map(record => {
      const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
      return [
        formatDate(record.date),
        formatTimeWithAMPM(record.time),
        record.substationName || '',
        record.substationNumber || '',
        record.region || '',
        record.district || '',
        record.location || '',
        record.rating || '',
        record.peakLoadStatus || '',
        record.ownership || 'N/A',
        record.createdBy?.name || 'Unknown',
        typeof record.ratedLoad === 'number' ? record.ratedLoad.toFixed(2) : '',
        typeof record.redPhaseBulkLoad === 'number' ? record.redPhaseBulkLoad.toFixed(2) : '',
        typeof record.yellowPhaseBulkLoad === 'number' ? record.yellowPhaseBulkLoad.toFixed(2) : '',
        typeof record.bluePhaseBulkLoad === 'number' ? record.bluePhaseBulkLoad.toFixed(2) : '',
        typeof record.averageCurrent === 'number' ? record.averageCurrent.toFixed(2) : '',
        typeof record.percentageLoad === 'number' ? record.percentageLoad.toFixed(2) : '',
        typeof record.tenPercentFullLoadNeutral === 'number' ? record.tenPercentFullLoadNeutral.toFixed(2) : '',
        typeof record.calculatedNeutral === 'number' ? record.calculatedNeutral.toFixed(2) : '',
        loadStatus.status
      ].map(value => {
        // Handle values that might contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `load-monitoring-records-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("All records exported to CSV successfully");
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedDate(null);
    setSelectedMonth(null);
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setSearchTerm("");
    setSelectedLoadStatus("all");
    updatePagination(1); // Reset to first page
    
    // Clear localStorage
    localStorage.removeItem('loadMonitoring_selectedDate');
    localStorage.removeItem('loadMonitoring_selectedMonth');
    localStorage.removeItem('loadMonitoring_selectedRegion');
    localStorage.removeItem('loadMonitoring_selectedDistrict');
    localStorage.removeItem('loadMonitoring_searchTerm');
    localStorage.removeItem('loadMonitoring_selectedLoadStatus');
  };

  // Calculate paginated records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage, pageSize]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRecords.length / pageSize);
  }, [filteredRecords.length, pageSize]);

  // Reset pagination when filters change
  useEffect(() => {
    updatePagination(1);
  }, [selectedDate, selectedMonth, selectedRegion, selectedDistrict, searchTerm]);

  return (
    <AccessControlWrapper type="asset">
      <Layout>
        <div className="container mx-auto p-4">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">Load Monitoring</h1>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={handleExportAllToCSV} variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export All to CSV
              </Button>
              <Button onClick={() => navigate('/asset-management/create-load-monitoring')} className="w-full sm:w-auto">
                Add New Record
              </Button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
            
            {/* Region Filter Dropdown */}
            {(user?.role === 'global_engineer' || user?.role === 'system_admin' || user?.role === 'regional_engineer' || user?.role === 'project_engineer' || user?.role === 'ashsub_t' || user?.role === 'accsub_t') && (
              <div className="space-y-2">
                <Label>Region</Label>
                <div className="w-full">
                  <Select
                    value={selectedRegion}
                    onValueChange={setSelectedRegion}
                    disabled={user?.role === 'regional_engineer' || user?.role === 'project_engineer'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {(user?.role === 'regional_engineer' || user?.role === 'project_engineer')
                        ? regions.filter(r => r.name === user.region).map(region => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))
                        : (user?.role === 'ashsub_t' || user?.role === 'accsub_t')
                        ? filteredRegions.map(region => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectItem>
                          ))
                        : regions.map(region => (
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
              user?.role === 'regional_engineer' ||
              user?.role === 'ashsub_t' ||
              user?.role === 'accsub_t') && (
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

          {/* Search Bar */}
          <div className="mb-4 flex justify-end">
            <input
              type="text"
              placeholder="Search by substation, number, region, district, or location..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 w-full max-w-xs focus:outline-none focus:ring focus:border-blue-300"
            />
          </div>

          {/* Reset Filters Button */}
          <div className="flex justify-end mb-4 gap-2">
            <Select
              value={selectedLoadStatus || "all"}
              onValueChange={setSelectedLoadStatus}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Economical Load Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OVERLOAD">Overload</SelectItem>
                <SelectItem value="Action Required">Action Required</SelectItem>
                <SelectItem value="OKAY">Okay</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              disabled={!selectedDate && !selectedMonth && !selectedRegion && !selectedDistrict && !searchTerm && selectedLoadStatus === "all"}
              className="w-full sm:w-auto"
            >
              Reset Filters
            </Button>
          </div>

          {/* Table Section */}
          <Card>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto relative">
                <Table>
                  <TableCaption>List of load monitoring records</TableCaption>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Time</TableHead>
                      <TableHead className="whitespace-nowrap">Region</TableHead>
                      <TableHead className="whitespace-nowrap">District</TableHead>
                      <TableHead className="whitespace-nowrap">Substation</TableHead>
                      <TableHead className="whitespace-nowrap">Rating (KVA)</TableHead>
                      <TableHead className="whitespace-nowrap">Voltage Level</TableHead>
                      <TableHead className="whitespace-nowrap">Percentage Loading</TableHead>
                      <TableHead className="whitespace-nowrap">Full Load Status</TableHead>
                      <TableHead className="whitespace-nowrap">Peak Status</TableHead>
                      <TableHead className="whitespace-nowrap">Created By</TableHead>
                      <TableHead className="whitespace-nowrap sticky right-0 bg-background">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record) => {
                      const region = regions.find(r => r.id === record.regionId);
                      const district = districts.find(d => d.id === record.districtId);
                      const loadStatus = getLoadStatus(typeof record.percentageLoad === 'number' ? record.percentageLoad : 0);
                      
                      return (
                        <TableRow 
                          key={record.id}
                          className="hover:bg-muted/50"
                        >
                          <TableCell className="whitespace-nowrap">{format(new Date(record.date), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatTimeWithAMPM(record.time)}</TableCell>
                          <TableCell className="whitespace-nowrap">{region?.name || 'Unknown'}</TableCell>
                          <TableCell className="whitespace-nowrap">{district?.name || 'Unknown'}</TableCell>
                          <TableCell className="whitespace-nowrap">{
                            record.substationName && record.substationNumber
                              ? `${record.substationName} (${record.substationNumber})`
                              : record.substationName || record.substationNumber || "-"
                          }</TableCell>
                          <TableCell className="whitespace-nowrap">{record.rating}</TableCell>
                          <TableCell className="whitespace-nowrap">{record.voltageLevel || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge className={Number(formattedPercentageLoads[record.id]) >= 100 ? 'bg-red-500' : 
                                             Number(formattedPercentageLoads[record.id]) >= 70 ? 'bg-yellow-500' : 
                                             'bg-green-500'}>
                              {formattedPercentageLoads[record.id] ?? "0.00"}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={Number(formattedPercentageLoads[record.id]) >= 100 ? 'bg-red-500' : 
                                             Number(formattedPercentageLoads[record.id]) >= 70 ? 'bg-yellow-500' : 
                                             'bg-green-500'}>
                              {Number(formattedPercentageLoads[record.id]) >= 100 ? 'OVERLOAD' : 
                               Number(formattedPercentageLoads[record.id]) >= 70 ? 'Action Required' : 
                               'OKAY'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{record.peakLoadStatus}</TableCell>
                          <TableCell className="whitespace-nowrap">{record.createdBy?.name || 'Unknown'}</TableCell>
                          <TableCell className="sticky right-0 bg-background">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleView(record.id)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportToPDF(record)}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Export to PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportToCSV(record)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Export to CSV
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEdit(record.id)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(record.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Add pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="flex-1 text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} results
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updatePagination(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updatePagination(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </AccessControlWrapper>
  );
}
