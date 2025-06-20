import { useState, useEffect } from "react";
import {
  Table,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, FileEdit, Trash2, Eye, Download, FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import { OverheadLineInspection } from "@/lib/types";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface OverheadLineInspectionsTableProps {
  inspections: OverheadLineInspection[];
  allInspections?: OverheadLineInspection[];
  onEdit: (inspection: OverheadLineInspection) => void;
  onDelete: (inspection: OverheadLineInspection) => void;
  onView: (inspection: OverheadLineInspection) => void;
  userRole?: string;
}

export function OverheadLineInspectionsTable({
  inspections,
  allInspections,
  onEdit,
  onDelete,
  onView,
  userRole
}: OverheadLineInspectionsTableProps) {
  const [sortedInspections, setSortedInspections] = useState([...inspections]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Update sorted inspections whenever the inspections prop changes
  useEffect(() => {
    // Sort by date and time (if available), or createdAt, descending
    const sorted = [...inspections].sort((a, b) => {
      // Prefer date+time, fallback to createdAt
      const dateA = new Date((a.date ? `${a.date}T${a.time || '00:00'}` : a.createdAt));
      const dateB = new Date((b.date ? `${b.date}T${b.time || '00:00'}` : b.createdAt));
      return dateB.getTime() - dateA.getTime();
    });
    setSortedInspections(sorted);
    // Reset to first page when inspections change
    setCurrentPage(1);
  }, [inspections]);

  // Calculate pagination values
  const totalPages = Math.ceil(sortedInspections.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInspections = sortedInspections.slice(startIndex, endIndex);

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of table when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      // Scroll to top of table when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      // Scroll to top of table when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const exportToPDF = (inspection: OverheadLineInspection) => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Overhead Line Inspection Report', 14, 20);
    
    // Add inspection ID and date
    doc.setFontSize(12);
    doc.text(`Inspection ID: ${inspection.id}`, 14, 30);
    doc.text(`Date: ${inspection.date || format(new Date(inspection.createdAt), "dd/MM/yyyy")}`, 14, 37);
    
    // Basic Information
    doc.text('Basic Information', 14, 47);
    const basicInfo = [
      ['Region:', inspection.region],
      ['District:', inspection.district],
      ['Feeder Name:', inspection.feederName],
      ['Voltage Level:', inspection.voltageLevel],
      ['Reference Pole:', inspection.referencePole],
      ['Status:', inspection.status],
      ['Inspector:', inspection.inspector.name],
    ];
    
    autoTable(doc, {
      startY: 50,
      head: [['Field', 'Value']],
      body: basicInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Pole Information
    doc.text('Pole Information', 14, doc.lastAutoTable.finalY + 15);
    const poleInfo = [
      ['Pole ID:', inspection.poleId],
      ['Pole Height:', inspection.poleHeight],
      ['Pole Type:', inspection.poleType],
      ['Pole Location:', inspection.poleLocation],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: poleInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Pole Condition
    doc.text('Pole Condition', 14, doc.lastAutoTable.finalY + 15);
    const poleCondition = [
      ['Tilted:', inspection.poleCondition?.tilted ? 'Yes' : 'No'],
      ['Rotten:', inspection.poleCondition?.rotten ? 'Yes' : 'No'],
      ['Burnt:', inspection.poleCondition?.burnt ? 'Yes' : 'No'],
      ['Substandard:', inspection.poleCondition?.substandard ? 'Yes' : 'No'],
      ['Conflict with LV:', inspection.poleCondition?.conflictWithLV ? 'Yes' : 'No'],
      ['Notes:', inspection.poleCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: poleCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Stay Condition
    doc.text('Stay Condition', 14, doc.lastAutoTable.finalY + 15);
    const stayCondition = [
      ['Required but not available:', inspection.stayCondition?.requiredButNotAvailable ? 'Yes' : 'No'],
      ['Cut:', inspection.stayCondition?.cut ? 'Yes' : 'No'],
      ['Misaligned:', inspection.stayCondition?.misaligned ? 'Yes' : 'No'],
      ['Defective Stay:', inspection.stayCondition?.defectiveStay ? 'Yes' : 'No'],
      ['Notes:', inspection.stayCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: stayCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Cross Arm Condition
    doc.text('Cross Arm Condition', 14, doc.lastAutoTable.finalY + 15);
    const crossArmCondition = [
      ['Misaligned:', inspection.crossArmCondition?.misaligned ? 'Yes' : 'No'],
      ['Bend:', inspection.crossArmCondition?.bend ? 'Yes' : 'No'],
      ['Corroded:', inspection.crossArmCondition?.corroded ? 'Yes' : 'No'],
      ['Substandard:', inspection.crossArmCondition?.substandard ? 'Yes' : 'No'],
      ['Others:', inspection.crossArmCondition?.others ? 'Yes' : 'No'],
      ['Notes:', inspection.crossArmCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: crossArmCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Insulator Condition
    doc.text('Insulator Condition', 14, doc.lastAutoTable.finalY + 15);
    const insulatorCondition = [
      ['Broken/Cracked:', inspection.insulatorCondition?.brokenOrCracked ? 'Yes' : 'No'],
      ['Burnt/Flash over:', inspection.insulatorCondition?.burntOrFlashOver ? 'Yes' : 'No'],
      ['Shattered:', inspection.insulatorCondition?.shattered ? 'Yes' : 'No'],
      ['Defective Binding:', inspection.insulatorCondition?.defectiveBinding ? 'Yes' : 'No'],
      ['Notes:', inspection.insulatorCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: insulatorCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Conductor Condition
    doc.text('Conductor Condition', 14, doc.lastAutoTable.finalY + 15);
    const conductorCondition = [
      ['Loose Connectors:', inspection.conductorCondition?.looseConnectors ? 'Yes' : 'No'],
      ['Weak Jumpers:', inspection.conductorCondition?.weakJumpers ? 'Yes' : 'No'],
      ['Burnt Lugs:', inspection.conductorCondition?.burntLugs ? 'Yes' : 'No'],
      ['Sagged Line:', inspection.conductorCondition?.saggedLine ? 'Yes' : 'No'],
      ['Undersized:', inspection.conductorCondition?.undersized ? 'Yes' : 'No'],
      ['Notes:', inspection.conductorCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: conductorCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Lightning Arrester Condition
    doc.text('Lightning Arrester Condition', 14, doc.lastAutoTable.finalY + 15);
    const lightningArresterCondition = [
      ['Broken/Cracked:', inspection.lightningArresterCondition?.brokenOrCracked ? 'Yes' : 'No'],
      ['Flash over:', inspection.lightningArresterCondition?.flashOver ? 'Yes' : 'No'],
      ['No Earthing:', inspection.lightningArresterCondition?.noEarthing ? 'Yes' : 'No'],
      ['By-passed:', inspection.lightningArresterCondition?.bypassed ? 'Yes' : 'No'],
      ['No Arrester:', inspection.lightningArresterCondition?.noArrester ? 'Yes' : 'No'],
      ['Notes:', inspection.lightningArresterCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: lightningArresterCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Drop Out Fuse Condition
    doc.text('Drop Out Fuse Condition', 14, doc.lastAutoTable.finalY + 15);
    const dropOutFuseCondition = [
      ['Broken/Cracked:', inspection.dropOutFuseCondition?.brokenOrCracked ? 'Yes' : 'No'],
      ['Flash over:', inspection.dropOutFuseCondition?.flashOver ? 'Yes' : 'No'],
      ['Insufficient Clearance:', inspection.dropOutFuseCondition?.insufficientClearance ? 'Yes' : 'No'],
      ['Loose or No Earthing:', inspection.dropOutFuseCondition?.looseOrNoEarthing ? 'Yes' : 'No'],
      ['Corroded:', inspection.dropOutFuseCondition?.corroded ? 'Yes' : 'No'],
      ['Linked HV Fuses:', inspection.dropOutFuseCondition?.linkedHVFuses ? 'Yes' : 'No'],
      ['Others:', inspection.dropOutFuseCondition?.others ? 'Yes' : 'No'],
      ['Notes:', inspection.dropOutFuseCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: dropOutFuseCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Transformer Condition
    doc.text('Transformer Condition', 14, doc.lastAutoTable.finalY + 15);
    const transformerCondition = [
      ['Leaking Oil:', inspection.transformerCondition?.leakingOil ? 'Yes' : 'No'],
      ['Missing Earth leads:', inspection.transformerCondition?.missingEarthLeads ? 'Yes' : 'No'],
      ['Linked HV Fuses:', inspection.transformerCondition?.linkedHVFuses ? 'Yes' : 'No'],
      ['Rusted Tank:', inspection.transformerCondition?.rustedTank ? 'Yes' : 'No'],
      ['Cracked Bushing:', inspection.transformerCondition?.crackedBushing ? 'Yes' : 'No'],
      ['Others:', inspection.transformerCondition?.others ? 'Yes' : 'No'],
      ['Notes:', inspection.transformerCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: transformerCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Recloser Condition
    doc.text('Recloser Condition', 14, doc.lastAutoTable.finalY + 15);
    const recloserCondition = [
      ['Low Gas Level:', inspection.recloserCondition?.lowGasLevel ? 'Yes' : 'No'],
      ['Low Battery Level:', inspection.recloserCondition?.lowBatteryLevel ? 'Yes' : 'No'],
      ['Burnt Voltage Transformers:', inspection.recloserCondition?.burntVoltageTransformers ? 'Yes' : 'No'],
      ['Protection Disabled:', inspection.recloserCondition?.protectionDisabled ? 'Yes' : 'No'],
      ['By-passed:', inspection.recloserCondition?.bypassed ? 'Yes' : 'No'],
      ['Others:', inspection.recloserCondition?.others ? 'Yes' : 'No'],
      ['Notes:', inspection.recloserCondition?.notes || 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: recloserCondition,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Additional Information
    doc.text('Additional Information', 14, doc.lastAutoTable.finalY + 15);
    const additionalInfo = [
      ['Location:', `${inspection.latitude}, ${inspection.longitude}`],
      ['Additional Notes:', inspection.additionalNotes || 'None'],
      ['Images:', inspection.images?.length ? `${inspection.images.length} image(s) attached` : 'None'],
    ];
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Field', 'Value']],
      body: additionalInfo,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });
    
    // Images Section
    if (inspection.images && inspection.images.length > 0) {
      doc.addPage();
      doc.text('Inspection Images', 14, 20);
      
      const imageWidth = 180; // Maximum width for images
      const imageHeight = 100; // Maximum height for images
      let currentY = 30;
      
      for (let i = 0; i < inspection.images.length; i++) {
        const image = inspection.images[i];
        
        // Check if we need a new page
        if (currentY + imageHeight > 280) {
          doc.addPage();
          currentY = 20;
        }
        
        try {
          // Add image with caption
          doc.text(`Image ${i + 1}`, 14, currentY);
          doc.addImage(image, 'JPEG', 14, currentY + 5, imageWidth, imageHeight);
          currentY += imageHeight + 20; // Add some spacing between images
        } catch (error) {
          console.error('Error adding image to PDF:', error);
          doc.text(`Error loading image ${i + 1}`, 14, currentY);
          currentY += 20;
        }
      }
    }

    // Save the PDF
    doc.save(`overhead-line-inspection-${inspection.id}.pdf`);
  };

  const exportToCSV = (inspection: OverheadLineInspection) => {
    const headers = [
      'Region', 'District', 'Feeder Name', 'Voltage Level', 'Reference Pole',
      'Status', 'Date', 'Pole ID', 'Pole Height', 'Pole Type', 'Pole Location',
      'GPS Location',
      // Pole Condition
      'Pole Tilted', 'Pole Rotten', 'Pole Burnt', 'Pole Substandard', 'Pole Conflict with LV', 'Pole Condition Notes',
      // Stay Condition
      'Stay Required but Not Available', 'Stay Cut', 'Stay Misaligned', 'Stay Defective', 'Stay Condition Notes',
      // Cross Arm Condition
      'Cross Arm Misaligned', 'Cross Arm Bend', 'Cross Arm Corroded', 'Cross Arm Substandard', 'Cross Arm Others', 'Cross Arm Notes',
      // Insulator Condition
      'Insulator Broken/Cracked', 'Insulator Burnt/Flash Over', 'Insulator Shattered', 'Insulator Defective Binding', 'Insulator Notes',
      // Conductor Condition
      'Conductor Loose Connectors', 'Conductor Weak Jumpers', 'Conductor Burnt Lugs', 'Conductor Sagged Line', 'Conductor Undersized', 'Conductor Notes',
      // Lightning Arrester Condition
      'Arrester Broken/Cracked', 'Arrester Flash Over', 'Arrester No Earthing', 'Arrester Bypassed', 'Arrester No Arrester', 'Arrester Notes',
      'Inspector Name'
    ];
    
    const csvRows = inspections.map(inspection => [
      inspection.region || 'Unknown',
      inspection.district || 'Unknown',
      inspection.feederName,
      inspection.voltageLevel,
      inspection.referencePole,
      inspection.status,
      inspection.date || format(new Date(), 'dd/MM/yyyy'),
      inspection.poleId,
      inspection.poleHeight,
      inspection.poleType,
      inspection.poleLocation,
      `${inspection.latitude}, ${inspection.longitude}`,
      // Pole Condition
      inspection.poleCondition?.tilted ? 'Yes' : 'No',
      inspection.poleCondition?.rotten ? 'Yes' : 'No',
      inspection.poleCondition?.burnt ? 'Yes' : 'No',
      inspection.poleCondition?.substandard ? 'Yes' : 'No',
      inspection.poleCondition?.conflictWithLV ? 'Yes' : 'No',
      inspection.poleCondition?.notes || 'N/A',
      // Stay Condition
      inspection.stayCondition?.requiredButNotAvailable ? 'Yes' : 'No',
      inspection.stayCondition?.cut ? 'Yes' : 'No',
      inspection.stayCondition?.misaligned ? 'Yes' : 'No',
      inspection.stayCondition?.defectiveStay ? 'Yes' : 'No',
      inspection.stayCondition?.notes || 'N/A',
      // Cross Arm Condition
      inspection.crossArmCondition?.misaligned ? 'Yes' : 'No',
      inspection.crossArmCondition?.bend ? 'Yes' : 'No',
      inspection.crossArmCondition?.corroded ? 'Yes' : 'No',
      inspection.crossArmCondition?.substandard ? 'Yes' : 'No',
      inspection.crossArmCondition?.others ? 'Yes' : 'No',
      inspection.crossArmCondition?.notes || 'N/A',
      // Insulator Condition
      inspection.insulatorCondition?.brokenOrCracked ? 'Yes' : 'No',
      inspection.insulatorCondition?.burntOrFlashOver ? 'Yes' : 'No',
      inspection.insulatorCondition?.shattered ? 'Yes' : 'No',
      inspection.insulatorCondition?.defectiveBinding ? 'Yes' : 'No',
      inspection.insulatorCondition?.notes || 'N/A',
      // Conductor Condition
      inspection.conductorCondition?.looseConnectors ? 'Yes' : 'No',
      inspection.conductorCondition?.weakJumpers ? 'Yes' : 'No',
      inspection.conductorCondition?.burntLugs ? 'Yes' : 'No',
      inspection.conductorCondition?.saggedLine ? 'Yes' : 'No',
      inspection.conductorCondition?.undersized ? 'Yes' : 'No',
      inspection.conductorCondition?.notes || 'N/A',
      // Lightning Arrester Condition
      inspection.lightningArresterCondition?.brokenOrCracked ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.flashOver ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.noEarthing ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.bypassed ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.noArrester ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.notes || 'N/A',
      inspection.inspector.name
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => {
        // Escape commas and quotes in cell values
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `overhead-line-inspection-${inspection.id}.csv`;
    link.click();
  };

  const exportAllToCSV = () => {
    const dataToExport = allInspections || inspections;
    const headers = [
      'Region', 'District', 'Feeder Name', 'Voltage Level', 'Reference Pole',
      'Status', 'Date', 'Pole ID', 'Pole Height', 'Pole Type', 'Pole Location',
      'GPS Location',
      // Pole Condition
      'Pole Tilted', 'Pole Rotten', 'Pole Burnt', 'Pole Substandard', 'Pole Conflict with LV', 'Pole Condition Notes',
      // Stay Condition
      'Stay Required but Not Available', 'Stay Cut', 'Stay Misaligned', 'Stay Defective', 'Stay Condition Notes',
      // Cross Arm Condition
      'Cross Arm Misaligned', 'Cross Arm Bend', 'Cross Arm Corroded', 'Cross Arm Substandard', 'Cross Arm Others', 'Cross Arm Notes',
      // Insulator Condition
      'Insulator Broken/Cracked', 'Insulator Burnt/Flash Over', 'Insulator Shattered', 'Insulator Defective Binding', 'Insulator Notes',
      // Conductor Condition
      'Conductor Loose Connectors', 'Conductor Weak Jumpers', 'Conductor Burnt Lugs', 'Conductor Sagged Line', 'Conductor Undersized', 'Conductor Notes',
      // Lightning Arrester Condition
      'Arrester Broken/Cracked', 'Arrester Flash Over', 'Arrester No Earthing', 'Arrester Bypassed', 'Arrester No Arrester', 'Arrester Notes',
      'Inspector Name'
    ];
    
    const csvRows = dataToExport.map(inspection => [
      inspection.region || 'Unknown',
      inspection.district || 'Unknown',
          inspection.feederName,
          inspection.voltageLevel,
          inspection.referencePole,
      inspection.status,
      inspection.date || format(new Date(), 'dd/MM/yyyy'),
      inspection.poleId,
      inspection.poleHeight,
      inspection.poleType,
      inspection.poleLocation,
      `${inspection.latitude}, ${inspection.longitude}`,
      // Pole Condition
      inspection.poleCondition?.tilted ? 'Yes' : 'No',
      inspection.poleCondition?.rotten ? 'Yes' : 'No',
      inspection.poleCondition?.burnt ? 'Yes' : 'No',
      inspection.poleCondition?.substandard ? 'Yes' : 'No',
      inspection.poleCondition?.conflictWithLV ? 'Yes' : 'No',
      inspection.poleCondition?.notes || 'N/A',
      // Stay Condition
      inspection.stayCondition?.requiredButNotAvailable ? 'Yes' : 'No',
      inspection.stayCondition?.cut ? 'Yes' : 'No',
      inspection.stayCondition?.misaligned ? 'Yes' : 'No',
      inspection.stayCondition?.defectiveStay ? 'Yes' : 'No',
      inspection.stayCondition?.notes || 'N/A',
      // Cross Arm Condition
      inspection.crossArmCondition?.misaligned ? 'Yes' : 'No',
      inspection.crossArmCondition?.bend ? 'Yes' : 'No',
      inspection.crossArmCondition?.corroded ? 'Yes' : 'No',
      inspection.crossArmCondition?.substandard ? 'Yes' : 'No',
      inspection.crossArmCondition?.others ? 'Yes' : 'No',
      inspection.crossArmCondition?.notes || 'N/A',
      // Insulator Condition
      inspection.insulatorCondition?.brokenOrCracked ? 'Yes' : 'No',
      inspection.insulatorCondition?.burntOrFlashOver ? 'Yes' : 'No',
      inspection.insulatorCondition?.shattered ? 'Yes' : 'No',
      inspection.insulatorCondition?.defectiveBinding ? 'Yes' : 'No',
      inspection.insulatorCondition?.notes || 'N/A',
      // Conductor Condition
      inspection.conductorCondition?.looseConnectors ? 'Yes' : 'No',
      inspection.conductorCondition?.weakJumpers ? 'Yes' : 'No',
      inspection.conductorCondition?.burntLugs ? 'Yes' : 'No',
      inspection.conductorCondition?.saggedLine ? 'Yes' : 'No',
      inspection.conductorCondition?.undersized ? 'Yes' : 'No',
      inspection.conductorCondition?.notes || 'N/A',
      // Lightning Arrester Condition
      inspection.lightningArresterCondition?.brokenOrCracked ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.flashOver ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.noEarthing ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.bypassed ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.noArrester ? 'Yes' : 'No',
      inspection.lightningArresterCondition?.notes || 'N/A',
      inspection.inspector.name
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => {
        // Escape commas and quotes in cell values
        const stringCell = String(cell);
        if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
          return `"${stringCell.replace(/"/g, '""')}"`;
        }
        return stringCell;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'all-overhead-line-inspections.csv';
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={exportAllToCSV} variant="outline">
          <FileDown className="mr-2 h-4 w-4" />
          Export All to CSV
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Feeder Name</TableHead>
              <TableHead>Voltage Level</TableHead>
              <TableHead>Reference Pole</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentInspections.map((inspection) => (
              <TableRow
                key={inspection.id}
                onClick={e => {
                  if ((e.target as HTMLElement).closest('td')?.classList.contains('actions-cell')) return;
                  onView(inspection);
                }}
                className="cursor-pointer hover:bg-muted transition-colors"
              >
                <TableCell>
                  {inspection.date 
                    ? `${inspection.date}${inspection.time ? ` ${inspection.time}` : ''}`
                    : inspection.createdAt && inspection.createdAt !== "" && !isNaN(new Date(inspection.createdAt).getTime())
                    ? format(new Date(inspection.createdAt), "dd/MM/yyyy HH:mm")
                    : new Date().toLocaleDateString()}
                  {inspection.id.startsWith('inspection_') && (
                    <span className="ml-2 text-xs text-yellow-600">(Offline)</span>
                  )}
                </TableCell>
                <TableCell>{inspection.region || "Unknown"}</TableCell>
                <TableCell>{inspection.district || "Unknown"}</TableCell>
                <TableCell>{inspection.feederName}</TableCell>
                <TableCell>{inspection.voltageLevel}</TableCell>
                <TableCell>{inspection.referencePole}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      inspection.status === "completed"
                        ? "bg-green-500"
                        : inspection.status === "in-progress"
                        ? "bg-yellow-500"
                        : "bg-gray-500"
                    }
                  >
                    {inspection.status ? inspection.status.charAt(0).toUpperCase() + inspection.status.slice(1) : "Unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right actions-cell">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onView(inspection);
                      }}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {(userRole === 'global_engineer' || userRole === 'district_engineer' || userRole === 'regional_engineer' || userRole === 'technician' || userRole === 'system_admin') && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onEdit(inspection);
                        }}>
                          <FileEdit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        if (!inspection?.id) {
                          toast.error("Invalid inspection ID");
                          return;
                        }
                        onDelete(inspection);
                      }}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        exportToPDF(inspection);
                      }}>
                        <Download className="mr-2 h-4 w-4" />
                        Export to PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        exportToCSV(inspection);
                      }}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export to CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {inspections.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No inspections found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => goToPage(page)}
              className="w-8 h-8 p-0"
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
} 