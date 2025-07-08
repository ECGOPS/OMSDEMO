import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator"; // Import Separator
import { toast } from "sonner";
import { LoadMonitoringData } from "@/lib/asset-types";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useParams } from "react-router-dom";
import { formatDate } from "@/utils/calculations"; // Import formatDate
import { ArrowLeft } from "lucide-react"; // For back button
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";

// Helper function to format time
const formatTime = (timeStr?: string) => {
  if (!timeStr || typeof timeStr !== 'string' || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
    return 'N/A';
  }
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 'N/A';
    const baseDate = new Date();
    baseDate.setHours(hours, minutes, 0, 0);
    return format(baseDate, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error, timeStr);
    return 'N/A';
  }
};

// Helper component to display a detail item
const DetailItem = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div className="flex flex-col space-y-1.5">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    <p className="text-base">{value ?? 'N/A'}</p>
  </div>
);

// Helper function to calculate warning levels
const calculateWarningLevels = (record: LoadMonitoringData) => {
  // Calculate neutral warning level
  let neutralWarningLevel: "normal" | "warning" | "critical" = "normal";
  let neutralWarningMessage = "";
  
  if (record.calculatedNeutral > record.tenPercentFullLoadNeutral * 2) {
    neutralWarningLevel = "critical";
    neutralWarningMessage = "Critical: Neutral current exceeds 200% of rated neutral";
  } else if (record.calculatedNeutral > record.tenPercentFullLoadNeutral) {
    neutralWarningLevel = "warning";
    neutralWarningMessage = "Warning: Neutral current exceeds rated neutral";
  }
  
  // Calculate phase imbalance and phase currents
  const redPhaseBulkLoad = record.redPhaseBulkLoad || 0;
  const yellowPhaseBulkLoad = record.yellowPhaseBulkLoad || 0;
  const bluePhaseBulkLoad = record.bluePhaseBulkLoad || 0;
  
  const maxPhaseCurrent = Math.max(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad);
  const minPhaseCurrent = Math.max(0, Math.min(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad));
  const avgPhaseCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
  const imbalancePercentage = maxPhaseCurrent > 0 ? ((maxPhaseCurrent - minPhaseCurrent) / maxPhaseCurrent) * 100 : 0;
  
  // Calculate phase imbalance warning level
  let imbalanceWarningLevel: "normal" | "warning" | "critical" = "normal";
  let imbalanceWarningMessage = "";
  
  if (imbalancePercentage > 50) {
    imbalanceWarningLevel = "critical";
    imbalanceWarningMessage = "Critical: Severe phase imbalance detected";
  } else if (imbalancePercentage > 30) {
    imbalanceWarningLevel = "warning";
    imbalanceWarningMessage = "Warning: Significant phase imbalance detected";
  }
  
  return {
    neutralWarningLevel,
    neutralWarningMessage,
    imbalanceWarningLevel,
    imbalanceWarningMessage,
    imbalancePercentage,
    maxPhaseCurrent,
    minPhaseCurrent,
    avgPhaseCurrent
  };
};

export default function LoadMonitoringDetailsPage() {
  const { getLoadMonitoringRecord } = useData();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [record, setRecord] = useState<LoadMonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formattedPercentageLoad, setFormattedPercentageLoad] = useState<string>("0.00");
  const [warningLevels, setWarningLevels] = useState<{
    neutralWarningLevel: "normal" | "warning" | "critical";
    neutralWarningMessage: string;
    imbalanceWarningLevel: "normal" | "warning" | "critical";
    imbalanceWarningMessage: string;
    imbalancePercentage: number;
    maxPhaseCurrent: number;
    minPhaseCurrent: number;
    avgPhaseCurrent: number;
  }>({
    neutralWarningLevel: "normal",
    neutralWarningMessage: "",
    imbalanceWarningLevel: "normal",
    imbalanceWarningMessage: "",
    imbalancePercentage: 0,
    maxPhaseCurrent: 0,
    minPhaseCurrent: 0,
    avgPhaseCurrent: 0
  });

  useEffect(() => {
    let isMounted = true;

    const fetchRecordData = async () => {
      if (!id || !getLoadMonitoringRecord) {
        toast.error("Invalid record ID or data context unavailable.");
        navigate("/asset-management/load-monitoring");
        return;
      }
      
      try {
        const fetchedRecord = await getLoadMonitoringRecord(id);
        
        if (!isMounted) return;
        
        if (!fetchedRecord) {
          toast.error("Load monitoring record not found.");
          navigate("/asset-management/load-monitoring");
          return;
        }

        // Convert Firestore Timestamp to ISO string if needed
        const convertTimestamp = (val: any) => {
          if (val && typeof val === 'object' && typeof val.toDate === 'function') {
            return val.toDate().toISOString();
          }
          return val;
        };
        fetchedRecord.updatedAt = convertTimestamp(fetchedRecord.updatedAt);
        fetchedRecord.createdAt = convertTimestamp(fetchedRecord.createdAt);

        setRecord(fetchedRecord);
        setFormattedPercentageLoad(fetchedRecord.percentageLoad?.toFixed(2) ?? "0.00");
        setWarningLevels(calculateWarningLevels(fetchedRecord));
      } catch (error) {
        console.error("Error fetching load monitoring record:", error);
        if (isMounted) {
          toast.error("Failed to load record details.");
          navigate("/asset-management/load-monitoring");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRecordData();

    return () => {
      isMounted = false;
    };
  }, [id, getLoadMonitoringRecord, navigate]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="icon" onClick={() => navigate("/asset-management/load-monitoring")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-8 w-64 bg-muted animate-pulse rounded"></div>
            <div className="w-10"></div>
          </div>

          <div className="grid gap-6">
            {/* Loading skeleton for Basic Information Card */}
            <Card>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                    <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Loading skeleton for Feeder Legs Card */}
            <Card>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="border p-4 rounded-md">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded mb-3"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="space-y-2">
                          <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                          <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Loading skeleton for Calculated Load Information Card */}
            <Card>
              <CardHeader>
                <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                    <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (!record) {
    return <Layout><div>Record not found.</div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
           <Button variant="outline" size="icon" onClick={() => navigate("/asset-management/load-monitoring")}>
             <ArrowLeft className="h-4 w-4" />
           </Button>
           <h1 className="text-2xl font-bold tracking-tight">Load Monitoring Record Details</h1>
           <div className="w-10"></div> {/* Spacer */}
        </div>

        <div className="grid gap-4 sm:gap-6">
            {/* Basic Information Card */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                 <DetailItem label="Date" value={formatDate(record.date)} />
                 <DetailItem label="Time" value={formatTime(record.time)} />
                 <DetailItem label="Region" value={record.region} />
                 <DetailItem label="District" value={record.district} />
                 <DetailItem label="Substation Name" value={record.substationName} />
                 <DetailItem label="Substation Number" value={record.substationNumber} />
                 <DetailItem label="Location" value={record.location} />
                 <DetailItem label="GPS Location" value={record.gpsLocation || 'N/A'} />
                 <DetailItem label="Rating (KVA)" value={record.rating} />
                 <DetailItem label="Peak Load Status" value={record.peakLoadStatus} />
                 <div className="flex flex-col space-y-1">
                   <Label className="text-sm font-medium text-muted-foreground">Load Status</Label>
                   <Badge className={`w-fit ${
                     record.percentageLoad >= 70 ? "bg-red-500" :
                     record.percentageLoad >= 45 ? "bg-yellow-500" :
                     "bg-green-500"
                   }`}>
                     {record.percentageLoad >= 70 ? "OVERLOAD" :
                      record.percentageLoad >= 45 ? "AVERAGE" :
                      "OKAY"}
                   </Badge>
                 </div>
                 <DetailItem label="Created By" value={record.createdBy?.name || 'Unknown'} />
                 <DetailItem label="Updated By" value={`${record.updatedBy?.name || record.createdBy?.name || 'Unknown'} (${isValidDate(record.updatedAt) ? format(new Date(record.updatedAt), 'MMM d, yyyy h:mm a') : 'N/A'})`} />
              </CardContent>
            </Card>

            {/* Feeder Legs Card */}
             <Card>
              <CardHeader>
                <CardTitle>Feeder Legs Current (Amps)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  {record.feederLegs?.map((leg, index) => (
                    <div key={leg.id} className="border p-4 rounded-md">
                       <Label className="block font-medium mb-3">Feeder Leg {index + 1}</Label>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           <DetailItem label="Red Phase" value={typeof leg.redPhaseCurrent === 'number' ? leg.redPhaseCurrent.toFixed(2) : 'N/A'} />
                           <DetailItem label="Yellow Phase" value={typeof leg.yellowPhaseCurrent === 'number' ? leg.yellowPhaseCurrent.toFixed(2) : 'N/A'} />
                           <DetailItem label="Blue Phase" value={typeof leg.bluePhaseCurrent === 'number' ? leg.bluePhaseCurrent.toFixed(2) : 'N/A'} />
                           <DetailItem label="Neutral" value={typeof leg.neutralCurrent === 'number' ? leg.neutralCurrent.toFixed(2) : 'N/A'} />
                       </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Calculated Load Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Calculated Load Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <DetailItem label="Rated Load (A)" value={record.ratedLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Avg. Current (A)" value={record.averageCurrent?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="% Load" value={`${formattedPercentageLoad} %`} />
                <div className="flex flex-col space-y-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">Calculated Neutral (A)</Label>
                  <p className={`text-base ${
                    warningLevels.neutralWarningLevel === "critical" ? "text-red-500" : 
                    warningLevels.neutralWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {record.calculatedNeutral?.toFixed(2) ?? 'N/A'}
                  </p>
                  {warningLevels.neutralWarningMessage && (
                    <p className={`text-sm ${
                      warningLevels.neutralWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {warningLevels.neutralWarningMessage}
                    </p>
                  )}
                </div>
                <DetailItem label="10% Rated Neutral (A)" value={record.tenPercentFullLoadNeutral?.toFixed(2) ?? 'N/A'} />
                <div className="flex flex-col space-y-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">Phase Imbalance (%)</Label>
                  <p className={`text-base ${
                    warningLevels.imbalanceWarningLevel === "critical" ? "text-red-500" : 
                    warningLevels.imbalanceWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {warningLevels.imbalancePercentage.toFixed(2)}%
                  </p>
                  {warningLevels.imbalanceWarningMessage && (
                    <p className={`text-sm ${
                      warningLevels.imbalanceWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {warningLevels.imbalanceWarningMessage}
                    </p>
                  )}
                </div>
                <DetailItem label="Red Phase Bulk (A)" value={record.redPhaseBulkLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Yellow Phase Bulk (A)" value={record.yellowPhaseBulkLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Blue Phase Bulk (A)" value={record.bluePhaseBulkLoad?.toFixed(2) ?? 'N/A'} />
                <DetailItem label="Max Phase Current (A)" value={warningLevels.maxPhaseCurrent.toFixed(2)} />
                <DetailItem label="Min Phase Current (A)" value={warningLevels.minPhaseCurrent.toFixed(2)} />
                <DetailItem label="Avg Phase Current (A)" value={warningLevels.avgPhaseCurrent.toFixed(2)} />
              </CardContent>
            </Card>

             <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={() => navigate("/asset-management/load-monitoring")}>
                    Back to List
                </Button>
            </div>
        </div>
      </div>
    </Layout>
  );
}

// Helper to check if a date string is valid
function isValidDate(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}
