import { SubstationInspection } from "@/lib/asset-types";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, ChevronLeft, Pencil, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface InspectionDetailsViewProps {
  inspection: SubstationInspection;
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

  // Remove all OverheadLineInspection logic and type guards, only handle SubstationInspection
  // - Remove isSubstationInspection
  // - Remove all code branches for OverheadLineInspection in getStatusSummary and renderPage
  // - Only use SubstationInspection fields
  const getStatusSummary = () => {
    if (!inspection) return { good: 0, requiresAttention: 0 };
    
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
  };

  const statusSummary = getStatusSummary();
  const totalPages = 8; // Only substation inspection has 8 pages

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const renderPage = () => {
    switch (currentPage) {
      case 1:
        return (
          <>
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
                    <p className="text-sm font-medium text-muted-foreground mb-1">Voltage Level</p>
                    <p className="text-lg font-semibold">{inspection.voltageLevel || "N/A"}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Time</p>
                    <p className="text-lg font-semibold">{inspection.time || "N/A"}</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                    <p className="text-lg font-semibold">{inspection.status || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Additional Notes section moved here */}
            <Card className="mb-8">
              <CardHeader className="border-b">
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
              </CardContent>
            </Card>
          </>
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
                {/* Do NOT render afterImages here */}
              </div>
            </CardContent>
          </Card>
        );
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
                Substation Inspection Details
              </h2>
              <p className="text-muted-foreground">
                Substation No: {inspection.substationNo}
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

      {/* Add after-inspection photos section for substation inspections (primary) */}
      {inspection.afterImages && inspection.afterImages.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>After Inspection Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inspection.afterImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`After inspection image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer"
                    onClick={() => setShowFullImage(image)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showFullImage && (
        <Dialog open={!!showFullImage} onOpenChange={setShowFullImage}>
          <DialogContent className="max-w-screen-xl h-[90vh]">
            <img src={showFullImage} alt="Full Inspection Image" className="w-full h-full object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}