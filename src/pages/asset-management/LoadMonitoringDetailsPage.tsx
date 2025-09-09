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
                 <DetailItem label="Ownership" value={record.ownership || 'N/A'} />
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

            {/* Diagnosis & Recommendations */}
            <Card className="border-l-4 border-l-orange-500 dark:border-l-orange-400">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full"></div>
                  Diagnosis & Recommendations
                </CardTitle>
                <CardDescription className="text-orange-700 dark:text-orange-300">
                  Comprehensive analysis of phase balance and load distribution issues
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const legs = record.feederLegs || [];
                  if (legs.length === 0) return <p className="text-sm">No feeder legs recorded.</p>;
                  
                  // Use the actual transformer rating (KVA) - the ratedLoad is already per-phase current
                  const transformerRating = record.rating || 0;
                  const ratedLoadPerPhase = transformerRating * 1.334; // This is already the per-phase current (267A for 200KVA)
                  const overloadThreshold = ratedLoadPerPhase * 0.8;
                  const messages: string[] = [];
                  let worstIdx = 0;
                  let worstPerc = -1;

                  // Check for overloaded phases and imbalance
                  legs.forEach((leg, idx) => {
                    const r = Number(leg.redPhaseCurrent) || 0;
                    const y = Number(leg.yellowPhaseCurrent) || 0;
                    const b = Number(leg.bluePhaseCurrent) || 0;
                    const maxP = Math.max(r, y, b);
                    const minP = Math.min(r, y, b);
                    const perc = maxP > 0 ? ((maxP - minP) / maxP) * 100 : 0;
                    if (perc > worstPerc) { worstPerc = perc; worstIdx = idx; }

                    // Check for overloaded phases on this leg
                    const phases = [
                      { name: 'Red', current: r },
                      { name: 'Yellow', current: y },
                      { name: 'Blue', current: b }
                    ];
                    
                    phases.forEach(phase => {
                      if (phase.current > overloadThreshold) {
                        const overloadPercent = ((phase.current / ratedLoadPerPhase) * 100).toFixed(1);
                        messages.push(`⚠️ OVERLOAD: ${phase.name} phase on Leg ${idx + 1} is at ${overloadPercent}% capacity (${phase.current.toFixed(1)}A).`);
                      }
                    });
                  });

                  // Check for phase imbalance
                  if (worstPerc >= 30) {
                    messages.push(`⚖️ IMBALANCE: Leg ${worstIdx + 1} has ${worstPerc.toFixed(1)}% phase imbalance.`);
                  }

                  // Check neutral current
                  const perLegNeutralThreshold = (record.tenPercentFullLoadNeutral || 0) / Math.max(1, legs.length);
                  legs.forEach((leg, idx) => {
                    const n = Number(leg.neutralCurrent) || 0;
                    if (n > perLegNeutralThreshold && perLegNeutralThreshold > 0) {
                      messages.push(`🔌 HIGH NEUTRAL: Leg ${idx + 1} neutral current is ${n.toFixed(1)}A (exceeds safe limit).`);
                    }
                  });

                  if (messages.length === 0) {
                    messages.push("✅ No issues detected. All phases are balanced and within safe limits.");
                  } else {
                    // Show current phase distribution for each problematic leg
                    legs.forEach((leg, idx) => {
                      const r = Number(leg.redPhaseCurrent) || 0;
                      const y = Number(leg.yellowPhaseCurrent) || 0;
                      const b = Number(leg.bluePhaseCurrent) || 0;
                      const maxP = Math.max(r, y, b);
                      const minP = Math.min(r, y, b);
                      const perc = maxP > 0 ? ((maxP - minP) / maxP) * 100 : 0;
                      
                      if (perc >= 30 || maxP > overloadThreshold) {
                        messages.push("");
                        messages.push(`📊 CURRENT PHASE DISTRIBUTION ON LEG ${idx + 1}:`);
                        messages.push(`   Red Phase: ${r.toFixed(1)}A`);
                        messages.push(`   Yellow Phase: ${y.toFixed(1)}A`);
                        messages.push(`   Blue Phase: ${b.toFixed(1)}A`);
                        
                        // Check if this is a severe imbalance case
                        if (perc >= 80) {
                          messages.push("");
                          messages.push(`🚨 CRITICAL IMBALANCE DETECTED ON LEG ${idx + 1}!`);
                          messages.push(`   • Imbalance: ${perc.toFixed(1)}% (Severe - requires immediate attention)`);
                          messages.push(`   • This can cause transformer overheating and equipment damage`);
                          messages.push(`   • Neutral current will be excessive due to poor phase balance`);
                        }
                        
                        // Identify which phases need load reduction and which can accept more
                        const phases = [
                          { name: 'Red', current: r },
                          { name: 'Yellow', current: y },
                          { name: 'Blue', current: b }
                        ].sort((a, b) => b.current - a.current);
                        
                        const overloadedPhases = phases.filter(p => p.current > overloadThreshold);
                        const underloadedPhases = phases.filter(p => p.current < overloadThreshold);
                        
                        if (overloadedPhases.length > 0 && underloadedPhases.length > 0) {
                          messages.push("");
                          messages.push(`🔄 SPECIFIC ACTIONS FOR LEG ${idx + 1}:`);
                          
                          // Calculate total excess load and available capacity
                          const totalExcessLoad = overloadedPhases.reduce((sum, phase) => sum + (phase.current - overloadThreshold), 0);
                          const totalAvailableCapacity = underloadedPhases.reduce((sum, phase) => sum + (overloadThreshold - phase.current), 0);
                          
                          if (totalExcessLoad <= totalAvailableCapacity) {
                            // We can balance by moving loads
                            overloadedPhases.forEach(overloaded => {
                              const excessLoad = overloaded.current - overloadThreshold;
                              const targetPhases = underloadedPhases.map(p => p.name).join(' or ');
                              messages.push(`   • Move ${excessLoad.toFixed(1)}A from ${overloaded.name} phase to ${targetPhases} phase`);
                            });
                          } else {
                            // Cannot balance with current capacity - need to reduce total load
                            const totalCurrentLoad = r + y + b;
                            const targetBalancedLoad = totalCurrentLoad / 3;
                            const reductionNeeded = totalCurrentLoad - (overloadThreshold * 3);
                            
                            messages.push(`   ⚠️ CRITICAL: Cannot balance with current capacity!`);
                            messages.push(`   • Total load: ${totalCurrentLoad.toFixed(1)}A (needs ${(overloadThreshold * 3).toFixed(1)}A max)`);
                            messages.push(`   • Reduce total load by ${reductionNeeded.toFixed(1)}A`);
                            messages.push(`   • Target balanced load: ~${targetBalancedLoad.toFixed(1)}A per phase`);
                            
                            // Show which phases need the most reduction
                            overloadedPhases.forEach(overloaded => {
                              const reductionNeeded = overloaded.current - targetBalancedLoad;
                              if (reductionNeeded > 0) {
                                messages.push(`   • Reduce ${overloaded.name} phase by ${reductionNeeded.toFixed(1)}A`);
                              }
                            });
                          }
                        } else if (perc >= 30) {
                          // Severe imbalance but no overload - focus on balancing
                          messages.push("");
                          messages.push(`🔄 BALANCING ACTIONS FOR LEG ${idx + 1}:`);
                          const targetLoad = (r + y + b) / 3;
                          
                          // Find phases that need to give up load and phases that can accept load
                          const heavyPhases = phases.filter(p => p.current > targetLoad);
                          const lightPhases = phases.filter(p => p.current < targetLoad);
                          
                          heavyPhases.forEach(heavyPhase => {
                            const excessLoad = heavyPhase.current - targetLoad;
                            if (excessLoad > 5) { // Only show if difference is significant
                              if (lightPhases.length === 1) {
                                // Only one target phase - move all to it
                                messages.push(`   • Move ${excessLoad.toFixed(1)}A from ${heavyPhase.name} phase to ${lightPhases[0].name} phase`);
                              } else if (lightPhases.length === 2) {
                                // Two target phases - split the load
                                const split1 = (excessLoad / 2).toFixed(1);
                                const split2 = (excessLoad - parseFloat(split1)).toFixed(1);
                                messages.push(`   • Move ${split1}A from ${heavyPhase.name} phase to ${lightPhases[0].name} phase`);
                                messages.push(`   • Move ${split2}A from ${heavyPhase.name} phase to ${lightPhases[1].name} phase`);
                              } else {
                                // Multiple target phases - show general guidance
                                const targetPhases = lightPhases.map(p => p.name).join(' or ');
                                messages.push(`   • Move ${excessLoad.toFixed(1)}A from ${heavyPhase.name} phase to ${targetPhases} phase`);
                              }
                            }
                          });
                        }
                      }
                    });
                    
                    messages.push("");
                    messages.push("🔧 URGENT BALANCING STEPS:");
                    messages.push("1. ⚠️ IMMEDIATE: Turn OFF single-phase loads on heaviest phases");
                    messages.push("2. 🔄 Reconnect them to the lightest phases (check circuit breakers/isolators)");
                    messages.push("3. 📊 Target: Aim for similar current values across all three phases");
                    messages.push("4. 🔍 Check for loose connections or faulty equipment");
                    messages.push("5. ⚡ Monitor neutral current - should be near zero when balanced");
                    messages.push("6. 🛠️ Consider installing load balancing equipment if imbalance persists");
                    messages.push("");
                    messages.push("⚠️ WARNING: Severe phase imbalance can cause:");
                    messages.push("   • Transformer overheating and premature failure");
                    messages.push("   • Voltage unbalance affecting connected equipment");
                    messages.push("   • Neutral conductor overload and potential fire hazard");
                    messages.push("   • Motor damage from unbalanced supply voltage");
                  }

                  return messages.map((message, i) => {
                    // Determine message type for styling
                    const isCritical = message.includes('🚨') || message.includes('CRITICAL');
                    const isWarning = message.includes('⚠️') || message.includes('OVERLOAD') || message.includes('IMBALANCE');
                    const isInfo = message.includes('📊') || message.includes('CURRENT PHASE DISTRIBUTION');
                    const isAction = message.includes('🔄') || message.includes('BALANCING ACTIONS') || message.includes('SPECIFIC ACTIONS');
                    const isStep = message.includes('🔧') || message.includes('URGENT BALANCING STEPS');
                    const isAlert = message.includes('⚠️ WARNING:') || message.includes('can cause:');
                    const isBullet = message.startsWith('   •') || message.startsWith('•');
                    
                    if (isCritical) {
                      return (
                        <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-red-500 dark:bg-red-400 rounded-full flex items-center justify-center text-white text-sm font-bold">!</div>
                            <div>
                              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">Critical Imbalance Detected</h4>
                              <p className="text-red-700 dark:text-red-300 text-sm">{message.replace('🚨 CRITICAL IMBALANCE DETECTED ON LEG', 'Leg').replace('!', '')}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    if (isWarning) {
                      return (
                        <div key={i} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-yellow-500 dark:bg-yellow-400 rounded-full flex items-center justify-center text-white text-xs">⚠</div>
                            <p className="text-yellow-800 dark:text-yellow-200 font-medium text-sm">{message}</p>
                          </div>
                        </div>
                      );
                    }
                    
                    if (isInfo) {
                      return (
                        <div key={i} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                            {message.replace('📊 ', '')}
                          </h4>
                        </div>
                      );
                    }
                    
                    if (isAction) {
                      return (
                        <div key={i} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500 dark:bg-green-400 rounded-full"></div>
                            {message.replace('🔄 ', '')}
                          </h4>
                        </div>
                      );
                    }
                    
                    if (isStep) {
                      return (
                        <div key={i} className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                          <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                            <div className="w-5 h-5 bg-purple-500 dark:bg-purple-400 rounded-full flex items-center justify-center text-white text-xs">🔧</div>
                            {message.replace('🔧 ', '')}
                          </h4>
                        </div>
                      );
                    }
                    
                    if (isAlert) {
                      return (
                        <div key={i} className="bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500 dark:border-l-red-400 p-4">
                          <h4 className="font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                            <div className="w-5 h-5 bg-red-500 dark:bg-red-400 rounded-full flex items-center justify-center text-white text-xs">⚠</div>
                            {message.replace('⚠️ WARNING: ', 'WARNING: ')}
                          </h4>
                        </div>
                      );
                    }
                    
                    if (isBullet) {
                      return (
                        <div key={i} className="ml-4 flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                          <p className="text-gray-700 dark:text-gray-300 text-sm">{message.replace('   • ', '')}</p>
                        </div>
                      );
                    }
                    
                    // Default styling for other messages
                    return (
                      <div key={i} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <p className="text-gray-800 dark:text-gray-200 text-sm">{message}</p>
                      </div>
                    );
                  });
                })()}
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
