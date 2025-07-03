import { OverheadLineInspection } from "@/lib/types";
import { SubstationInspection } from "@/lib/asset-types";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, ChevronLeft, Pencil, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface InspectionDetailsViewProps {
  inspection: SubstationInspection | OverheadLineInspection;
  showHeader?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
}

export function InspectionDetailsView({
  inspection,
  showHeader = true,
  showBackButton = false,
  onBack,
  onEdit
}: InspectionDetailsViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 1;
  const [showFullImage, setShowFullImage] = useState<string | null>(null);

  const isSubstationInspection = (inspection: SubstationInspection | OverheadLineInspection): inspection is SubstationInspection => {
    return 'substationNo' in inspection;
  };

  const getStatusSummary = () => {
    if (!inspection) return { good: 0, requiresAttention: 0 };
    
    if (isSubstationInspection(inspection)) {
      // Get all items from category-specific arrays
      const allItems = [
        ...(inspection.siteCondition || []),
        ...(inspection.generalBuilding || []),
        ...(inspection.controlEquipment || []),
        ...(inspection.powerTransformer || []),
        ...(inspection.outdoorEquipment || []),
        ...(inspection.basement || [])
      ].filter(item => item && item.status);
      
      const goodItems = allItems.filter(item => item.status === "good").length;
      const badItems = allItems.filter(item => item.status === "bad").length;
      
      return { good: goodItems, requiresAttention: badItems };
    } else {
      // For overhead line inspections, count conditions that are true as requiring attention
      const conditions = [
        inspection.poleCondition,
        inspection.stayCondition,
        inspection.crossArmCondition,
        inspection.insulatorCondition,
        inspection.conductorCondition,
        inspection.lightningArresterCondition,
        inspection.dropOutFuseCondition,
        inspection.transformerCondition,
        inspection.recloserCondition
      ];

      let requiresAttention = 0;
      conditions.forEach(condition => {
        if (condition) {
          Object.entries(condition).forEach(([key, value]) => {
            if (key !== 'notes' && value === true) {
              requiresAttention++;
            }
          });
        }
      });

      return { good: 0, requiresAttention };
    }
  };

  const statusSummary = getStatusSummary();
  const totalPages = isSubstationInspection(inspection) ? 8 : 9;

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const renderPage = () => {
    if (isSubstationInspection(inspection)) {
      switch (currentPage) {
        case 1:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Region</p>
                    <p className="text-lg font-semibold">{inspection.region}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">District</p>
                    <p className="text-lg font-semibold">{inspection.district}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Substation Number</p>
                    <p className="text-lg font-semibold">{inspection.substationNo}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Substation Name</p>
                    <p className="text-lg font-semibold">{inspection.substationName || "N/A"}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                    <p className="text-lg font-semibold capitalize">{inspection.type}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Date</p>
                    <p className="text-lg font-semibold">
                      {inspection.date && !isNaN(new Date(inspection.date).getTime()) 
                        ? format(new Date(inspection.date), "PPP") 
                        : "N/A"}
                    </p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Created By</p>
                    <p className="text-lg font-semibold">{inspection.createdBy || "N/A"}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Ground Condition</p>
                    {inspection.groundCondition ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inspection.groundCondition)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline hover:text-blue-800"
                        title="Open in Google Maps"
                      >
                        {inspection.groundCondition}
                      </a>
                    ) : (
                      <p className="text-lg font-semibold text-muted-foreground">N/A</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 2:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Site Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.siteCondition?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 3:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>General Building</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.generalBuilding?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 4:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Control Equipment</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.controlEquipment?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 5:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Basement</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.basement?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 6:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Power Transformer</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.powerTransformer?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 7:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Outdoor Equipment</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {inspection.outdoorEquipment?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{item.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === "good" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : item.status === "bad" ? (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">Not inspected</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        case 8:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Additional Notes</Label>
                    <p className="text-muted-foreground whitespace-pre-line">{inspection.remarks || "-"}</p>
                  </div>
                  {inspection.images && inspection.images.length > 0 && (
                    <div className="space-y-2">
                      <Label>Photos</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {inspection.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={image}
                              alt={`Inspection image ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg cursor-pointer"
                              onClick={() => setShowFullImage(image)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
      }
    } else {
      // Overhead Line Inspection cases
      switch (currentPage) {
        case 1:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Region</p>
                    <p>{inspection.region || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">District</p>
                    <p>{inspection.district || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Feeder Name</p>
                    <p>{inspection.feederName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Voltage Level</p>
                    <p>{inspection.voltageLevel}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reference Pole</p>
                    <p>{inspection.referencePole}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <p>{inspection.status}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created At</p>
                    <p>{inspection.date 
                      ? `${inspection.date}${inspection.time ? ` ${inspection.time}` : ''}`
                      : inspection.createdAt && !isNaN(new Date(inspection.createdAt).getTime())
                      ? format(new Date(inspection.createdAt), "dd/MM/yyyy HH:mm")
                      : new Date().toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                    <p>{inspection.updatedAt && !isNaN(new Date(inspection.updatedAt).getTime())
                      ? format(new Date(inspection.updatedAt), "dd/MM/yyyy HH:mm")
                      : new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 2:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Pole Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pole ID</p>
                    <p>{inspection.poleId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pole Height</p>
                    <p>{inspection.poleHeight}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pole Type</p>
                    <p>{inspection.poleType}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ground Condition</p>
                    <p>{inspection.groundCondition}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 3:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Pole Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tilted</p>
                    <p>{inspection.poleCondition?.tilted ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rotten</p>
                    <p>{inspection.poleCondition?.rotten ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Burnt</p>
                    <p>{inspection.poleCondition?.burnt ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Substandard</p>
                    <p>{inspection.poleCondition?.substandard ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Conflict with LV</p>
                    <p>{inspection.poleCondition?.conflictWithLV ? "Yes" : "No"}</p>
                  </div>
                </div>
                {inspection.poleCondition?.notes && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted-foreground">Notes</p>
                    <p>{inspection.poleCondition.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        case 4:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Stay Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Required but not available</p>
                    <p>{inspection.stayCondition?.requiredButNotAvailable ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cut</p>
                    <p>{inspection.stayCondition?.cut ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Misaligned</p>
                    <p>{inspection.stayCondition?.misaligned ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Defective Stay</p>
                    <p>{inspection.stayCondition?.defectiveStay ? "Yes" : "No"}</p>
                  </div>
                </div>
                {inspection.stayCondition?.notes && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted-foreground">Notes</p>
                    <p>{inspection.stayCondition.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        case 5:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Cross Arm Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Misaligned</p>
                    <p>{inspection.crossArmCondition?.misaligned ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Bend</p>
                    <p>{inspection.crossArmCondition?.bend ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Corroded</p>
                    <p>{inspection.crossArmCondition?.corroded ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Substandard</p>
                    <p>{inspection.crossArmCondition?.substandard ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Others</p>
                    <p>{inspection.crossArmCondition?.others ? "Yes" : "No"}</p>
                  </div>
                </div>
                {inspection.crossArmCondition?.notes && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted-foreground">Notes</p>
                    <p>{inspection.crossArmCondition.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        case 6:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Insulator Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
                    <p>{inspection.insulatorCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Burnt/Flash over</p>
                    <p>{inspection.insulatorCondition?.burntOrFlashOver ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Shattered</p>
                    <p>{inspection.insulatorCondition?.shattered ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Defective Binding</p>
                    <p>{inspection.insulatorCondition?.defectiveBinding ? "Yes" : "No"}</p>
                  </div>
                </div>
                {inspection.insulatorCondition?.notes && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted-foreground">Notes</p>
                    <p>{inspection.insulatorCondition.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        case 7:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Conductor Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Loose Connectors</p>
                    <p>{inspection.conductorCondition?.looseConnectors ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Weak Jumpers</p>
                    <p>{inspection.conductorCondition?.weakJumpers ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Burnt Lugs</p>
                    <p>{inspection.conductorCondition?.burntLugs ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sagged Line</p>
                    <p>{inspection.conductorCondition?.saggedLine ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Undersized</p>
                    <p>{inspection.conductorCondition?.undersized ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Linked</p>
                    <p>{inspection.conductorCondition?.linked ? "Yes" : "No"}</p>
                  </div>
                </div>
                {inspection.conductorCondition?.notes && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-muted-foreground">Notes</p>
                    <p>{inspection.conductorCondition.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        case 8:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Lightning Arrester & Drop Out Fuse Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Lightning Arrester</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
                        <p>{inspection.lightningArresterCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Flash over</p>
                        <p>{inspection.lightningArresterCondition?.flashOver ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Missing</p>
                        <p>{inspection.lightningArresterCondition?.missing ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">No Earthing</p>
                        <p>{inspection.lightningArresterCondition?.noEarthing ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">By-passed</p>
                        <p>{inspection.lightningArresterCondition?.bypassed ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">No Arrester</p>
                        <p>{inspection.lightningArresterCondition?.noArrester ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    {inspection.lightningArresterCondition?.notes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground">Notes</p>
                        <p>{inspection.lightningArresterCondition.notes}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Drop Out Fuse</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Broken/Cracked</p>
                        <p>{inspection.dropOutFuseCondition?.brokenOrCracked ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Flash over</p>
                        <p>{inspection.dropOutFuseCondition?.flashOver ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Insufficient Clearance</p>
                        <p>{inspection.dropOutFuseCondition?.insufficientClearance ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Loose or No Earthing</p>
                        <p>{inspection.dropOutFuseCondition?.looseOrNoEarthing ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Corroded</p>
                        <p>{inspection.dropOutFuseCondition?.corroded ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Linked HV Fuses</p>
                        <p>{inspection.dropOutFuseCondition?.linkedHVFuses ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Others</p>
                        <p>{inspection.dropOutFuseCondition?.others ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    {inspection.dropOutFuseCondition?.notes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground">Notes</p>
                        <p>{inspection.dropOutFuseCondition.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 9:
          return (
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Transformer & Recloser Condition</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Transformer</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Leaking Oil</p>
                        <p>{inspection.transformerCondition?.leakingOil ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Missing Earth leads</p>
                        <p>{inspection.transformerCondition?.missingEarthLeads ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Linked HV Fuses</p>
                        <p>{inspection.transformerCondition?.linkedHVFuses ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Rusted Tank</p>
                        <p>{inspection.transformerCondition?.rustedTank ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Cracked Bushing</p>
                        <p>{inspection.transformerCondition?.crackedBushing ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Others</p>
                        <p>{inspection.transformerCondition?.others ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    {inspection.transformerCondition?.notes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground">Notes</p>
                        <p>{inspection.transformerCondition.notes}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Recloser</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Low Gas Level</p>
                        <p>{inspection.recloserCondition?.lowGasLevel ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Low Battery Level</p>
                        <p>{inspection.recloserCondition?.lowBatteryLevel ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Burnt Voltage Transformers</p>
                        <p>{inspection.recloserCondition?.burntVoltageTransformers ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Protection Disabled</p>
                        <p>{inspection.recloserCondition?.protectionDisabled ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">By-passed</p>
                        <p>{inspection.recloserCondition?.bypassed ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Others</p>
                        <p>{inspection.recloserCondition?.others ? "Yes" : "No"}</p>
                      </div>
                    </div>
                    {inspection.recloserCondition?.notes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground">Notes</p>
                        <p>{inspection.recloserCondition.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
      }
    }
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {isSubstationInspection(inspection) ? "Substation" : "Overhead Line"} Inspection Details
              </h2>
              <p className="text-muted-foreground">
                {isSubstationInspection(inspection) 
                  ? `Substation No: ${inspection.substationNo}`
                  : `Feeder: ${inspection.feederName}`}
              </p>
            </div>
          </div>
          {onEdit && (
            <Button onClick={onEdit} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit Inspection
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusSummary.good + statusSummary.requiresAttention}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Good Condition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusSummary.good}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requires Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusSummary.requiresAttention}</div>
          </CardContent>
        </Card>
      </div>

      {renderPage()}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Full Image Dialog */}
      <Dialog open={!!showFullImage} onOpenChange={(open) => !open && setShowFullImage(null)}>
        <DialogContent className="max-w-4xl">
          {showFullImage && (
            <img
              src={showFullImage}
              alt="Full size inspection image"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 