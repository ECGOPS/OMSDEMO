import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { FeederLeg, LoadMonitoringData } from "@/lib/asset-types";
import { Region, District } from "@/lib/types"; // Import Region and District types
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useParams } from "react-router-dom";

export default function EditLoadMonitoringPage() {
  const { user } = useAuth();
  const { getLoadMonitoringRecord, updateLoadMonitoringRecord, regions, districts } = useData(); // Get regions & districts
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // State for filtered districts based on selected region
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);

  const [formData, setFormData] = useState<Partial<LoadMonitoringData>>({
    feederLegs: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const [loadInfo, setLoadInfo] = useState<{
    ratedLoad: number;
    redPhaseBulkLoad: number;
    yellowPhaseBulkLoad: number;
    bluePhaseBulkLoad: number;
    averageCurrent: number;
    percentageLoad: number;
    tenPercentFullLoadNeutral: number;
    calculatedNeutral: number;
    neutralWarningLevel: "normal" | "warning" | "critical";
    neutralWarningMessage: string;
    imbalancePercentage: number;
    imbalanceWarningLevel: "normal" | "warning" | "critical";
    imbalanceWarningMessage: string;
    maxPhaseCurrent: number;
    minPhaseCurrent: number;
    avgPhaseCurrent: number;
  }>({
    ratedLoad: 0,
    redPhaseBulkLoad: 0,
    yellowPhaseBulkLoad: 0,
    bluePhaseBulkLoad: 0,
    averageCurrent: 0,
    percentageLoad: 0,
    tenPercentFullLoadNeutral: 0,
    calculatedNeutral: 0,
    neutralWarningLevel: "normal",
    neutralWarningMessage: "",
    imbalancePercentage: 0,
    imbalanceWarningLevel: "normal",
    imbalanceWarningMessage: "",
    maxPhaseCurrent: 0,
    minPhaseCurrent: 0,
    avgPhaseCurrent: 0
  });

  // --- Diagnosis helper ---
  const diagnosis = (() => {
    const feederLegs = formData.feederLegs || [];
    if (feederLegs.length === 0) {
      return { messages: ["Add feeder leg readings to see diagnosis."], problemLegIndex: undefined };
    }

    const messages: string[] = [];
    let problemLegIndex: number | undefined = undefined;

    // Check for overloaded phases (exceeding 80% of rated load per phase)
    // Use the actual transformer rating (KVA) - the ratedLoad is already per-phase current
    const transformerRating = Number(formData.rating) || 0;
    const ratedLoadPerPhase = transformerRating * 1.334; // This is already the per-phase current (267A for 200KVA)
    const overloadThreshold = ratedLoadPerPhase * 0.8;

    // Identify leg with highest phase imbalance and overloaded phases
    let worstImbalance = -1;
    feederLegs.forEach((leg, idx) => {
      const r = Number(leg.redPhaseCurrent) || 0;
      const y = Number(leg.yellowPhaseCurrent) || 0;
      const b = Number(leg.bluePhaseCurrent) || 0;
      const maxP = Math.max(r, y, b);
      const minP = Math.min(r, y, b);
      const perc = maxP > 0 ? ((maxP - minP) / maxP) * 100 : 0;
      if (perc > worstImbalance) {
        worstImbalance = perc;
        problemLegIndex = idx;
      }

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

    if (problemLegIndex !== undefined) {
      const leg = feederLegs[problemLegIndex];
      const r = Number(leg.redPhaseCurrent) || 0;
      const y = Number(leg.yellowPhaseCurrent) || 0;
      const b = Number(leg.bluePhaseCurrent) || 0;
      const maxP = Math.max(r, y, b);
      const minP = Math.min(r, y, b);
      const perc = maxP > 0 ? ((maxP - minP) / maxP) * 100 : 0;
      if (perc >= 30) {
        messages.push(`⚖️ IMBALANCE: Leg ${problemLegIndex + 1} has ${perc.toFixed(1)}% phase imbalance.`);
      }
    }

    // Check neutral per leg vs share of rated neutral
    const perLegNeutralThreshold = (loadInfo.tenPercentFullLoadNeutral || 0) / Math.max(1, feederLegs.length);
    feederLegs.forEach((leg, idx) => {
      const n = Number(leg.neutralCurrent) || 0;
      if (n > perLegNeutralThreshold && perLegNeutralThreshold > 0) {
        messages.push(`🔌 HIGH NEUTRAL: Leg ${idx + 1} neutral current is ${n.toFixed(1)}A (exceeds safe limit).`);
      }
    });

    if (messages.length === 0) {
      messages.push("✅ No issues detected. All phases are balanced and within safe limits.");
    } else {
      // Show current phase distribution for each problematic leg
      feederLegs.forEach((leg, idx) => {
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

    return { messages, problemLegIndex };
  })();

  // Fetch existing record data and set initial dropdown state
  useEffect(() => {
    const initializeRecord = async () => {
      if (id && getLoadMonitoringRecord && regions && districts) {
        try {
          const record = await getLoadMonitoringRecord(id);
          if (record) {
            // Find the region and district IDs based on their names
            const existingRegion = regions.find(r => r.name === record.region);
            const existingDistrict = districts.find(d => d.name === record.district && d.regionId === existingRegion?.id);
            
            if (existingRegion) {
              // Set region and filter districts
              setFormData(prev => ({
                ...record,
                regionId: existingRegion.id,
                region: record.region
              }));
              
              // Filter districts for the selected region
              const regionDistricts = districts.filter(d => d.regionId === existingRegion.id);
              setFilteredDistricts(regionDistricts);
              
              // Set district if found
              if (existingDistrict) {
                setFormData(prev => ({
                  ...prev,
                  districtId: existingDistrict.id,
                  district: record.district
                }));
              }
            } else {
              // Region from record not found? Reset both.
              setFormData(prev => ({ ...prev, regionId: "", region: "", districtId: "", district: "" }));
              setFilteredDistricts([]);
            }
          } else {
            toast.error("Load monitoring record not found.");
            navigate("/asset-management/load-monitoring");
          }
        } catch (error) {
          console.error("Error loading record:", error);
          toast.error("Failed to load record. Please try again.");
          navigate("/asset-management/load-monitoring");
        }
        setIsLoading(false);
      } else if (!isLoading && (!regions || !districts)) {
          toast.error("Region/District data not loaded. Cannot edit.");
          navigate("/asset-management/load-monitoring");
          setIsLoading(false);
      } else if (!isLoading && !id) { // Added check for missing ID after loading
          toast.error("Invalid record ID.");
          navigate("/asset-management/load-monitoring");
          setIsLoading(false);
      }
    };

    initializeRecord();
  }, [id, getLoadMonitoringRecord, regions, districts, navigate, isLoading]);

  // --- Form Handling Functions ---
  const addFeederLeg = () => {
    if ((formData.feederLegs?.length || 0) >= 8) {
      toast.warning("Maximum of 8 feeder legs allowed");
      return;
    }
    setFormData(prev => ({
      ...prev,
      feederLegs: [
        ...(prev.feederLegs || []),
        {
          id: uuidv4(),
          redPhaseCurrent: 0,
          yellowPhaseCurrent: 0,
          bluePhaseCurrent: 0,
          neutralCurrent: 0
        }
      ]
    }));
  };

  const removeFeederLeg = (legId: string) => {
    if ((formData.feederLegs?.length || 0) <= 1) {
      toast.warning("At least one feeder leg is required");
      return;
    }
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.filter(leg => leg.id !== legId) || []
    }));
  };

  // Validation function to limit input to 3 digits while preserving decimal places
  const validateNumericInput = (value: string): string => {
    // Allow empty string
    if (value === '') return value;
    
    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Check if the integer part (before decimal) has more than 3 digits
    const integerPart = parts[0];
    if (integerPart.length > 3) {
      return integerPart.slice(0, 3) + (parts[1] ? '.' + parts[1] : '');
    }
    
    return cleaned;
  };

  const updateFeederLeg = (legId: string, field: keyof FeederLeg, value: string) => {
    // Apply validation to limit to 3 digits while preserving decimal places
    const validatedValue = validateNumericInput(value);
    const numericValue = validatedValue === '' ? 0 : parseFloat(validatedValue);
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.map(leg =>
        leg.id === legId ? { ...leg, [field]: isNaN(numericValue) ? validatedValue : numericValue } : leg
      ) || []
    }));
  };

  const handleInputChange = (field: keyof LoadMonitoringData, value: any) => {
    if (field === 'region' || field === 'district') return;
     if (field === 'rating') {
       setFormData(prev => ({
        ...prev,
        [field]: value === '' ? undefined : Number(value)
      }));
    } else {
       setFormData(prev => ({
         ...prev,
         [field]: value
       }));
    }
  };

  // Handle Region Change
  const handleRegionChange = (regionId: string) => {
    const selectedRegion = regions?.find(r => r.id === regionId);
    if (selectedRegion && districts) {
      const regionDistricts = districts.filter(d => d.regionId === regionId);
      setFilteredDistricts(regionDistricts);
      setFormData(prev => ({
        ...prev,
        regionId: regionId,
        region: selectedRegion.name,
        districtId: "",
        district: ""
      }));
    } else {
      setFilteredDistricts([]);
      setFormData(prev => ({ 
        ...prev, 
        regionId: "", 
        region: "", 
        districtId: "", 
        district: "" 
      }));
    }
  };

  // Handle District Change
  const handleDistrictChange = (districtId: string) => {
    const selectedDistrict = districts?.find(d => d.id === districtId);
    if (selectedDistrict) {
      setFormData(prev => ({ 
        ...prev, 
        districtId: districtId,
        district: selectedDistrict.name
      }));
    }
  };

  // --- Load Calculation Logic ---
   useEffect(() => {
    if (isLoading) return;

    const rating = Number(formData.rating);
    const feederLegs = formData.feederLegs || [];

    const areFeederCurrentsValid = feederLegs.every(leg =>
        typeof leg.redPhaseCurrent === 'number' && !isNaN(leg.redPhaseCurrent) &&
        typeof leg.yellowPhaseCurrent === 'number' && !isNaN(leg.yellowPhaseCurrent) &&
        typeof leg.bluePhaseCurrent === 'number' && !isNaN(leg.bluePhaseCurrent) &&
        typeof leg.neutralCurrent === 'number' && !isNaN(leg.neutralCurrent)
    );

    if (isNaN(rating) || rating <= 0 || feederLegs.length === 0 || !areFeederCurrentsValid) {
      setLoadInfo({
        ratedLoad: 0, redPhaseBulkLoad: 0, yellowPhaseBulkLoad: 0, bluePhaseBulkLoad: 0,
        averageCurrent: 0, percentageLoad: 0, tenPercentFullLoadNeutral: 0, calculatedNeutral: 0,
        neutralWarningLevel: "normal",
        neutralWarningMessage: "",
        imbalancePercentage: 0,
        imbalanceWarningLevel: "normal",
        imbalanceWarningMessage: "",
        maxPhaseCurrent: 0,
        minPhaseCurrent: 0,
        avgPhaseCurrent: 0
      });
      return;
    }

    const redPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.redPhaseCurrent), 0);
    const yellowPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.yellowPhaseCurrent), 0);
    const bluePhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + Number(leg.bluePhaseCurrent), 0);

    const averageCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
    const ratedLoad = rating * 1.334;
    const percentageLoad = ratedLoad > 0 ? (averageCurrent * 100) / ratedLoad : 0;
    const tenPercentFullLoadNeutral = 0.1 * ratedLoad;

    // Standard neutral current calculation for three-phase systems
    console.log("Calculating neutral with standard formula:", {
      redPhaseBulkLoad,
      yellowPhaseBulkLoad,
      bluePhaseBulkLoad
    });
    
    // Standard formula: In = √(IR² + IY² + IB² - IR·IY - IR·IB - IY·IB)
    const calculatedNeutral = Math.sqrt(
      Math.max(0,
        Math.pow(redPhaseBulkLoad, 2) + 
        Math.pow(yellowPhaseBulkLoad, 2) + 
        Math.pow(bluePhaseBulkLoad, 2) - 
        (redPhaseBulkLoad * yellowPhaseBulkLoad) - 
        (redPhaseBulkLoad * bluePhaseBulkLoad) - 
        (yellowPhaseBulkLoad * bluePhaseBulkLoad)
      )
    );
    
    console.log("Calculated neutral result:", calculatedNeutral);

    // Calculate phase imbalance analysis
    const maxPhaseCurrent = Math.max(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad);
    const minPhaseCurrent = Math.max(0, Math.min(redPhaseBulkLoad, yellowPhaseBulkLoad, bluePhaseBulkLoad));
    const avgPhaseCurrent = (redPhaseBulkLoad + yellowPhaseBulkLoad + bluePhaseBulkLoad) / 3;
    const imbalancePercentage = maxPhaseCurrent > 0 ? ((maxPhaseCurrent - minPhaseCurrent) / maxPhaseCurrent) * 100 : 0;
    
    // Determine neutral current warning level
    let neutralWarningLevel: "normal" | "warning" | "critical" = "normal";
    let neutralWarningMessage = "";
    
    if (calculatedNeutral > tenPercentFullLoadNeutral * 2) {
      neutralWarningLevel = "critical";
      neutralWarningMessage = "Critical: Neutral current exceeds 200% of rated neutral";
    } else if (calculatedNeutral > tenPercentFullLoadNeutral) {
      neutralWarningLevel = "warning";
      neutralWarningMessage = "Warning: Neutral current exceeds rated neutral";
    }
    
    // Determine phase imbalance warning level
    let imbalanceWarningLevel: "normal" | "warning" | "critical" = "normal";
    let imbalanceWarningMessage = "";
    
    if (imbalancePercentage > 50) {
      imbalanceWarningLevel = "critical";
      imbalanceWarningMessage = "Critical: Severe phase imbalance detected";
    } else if (imbalancePercentage > 30) {
      imbalanceWarningLevel = "warning";
      imbalanceWarningMessage = "Warning: Significant phase imbalance detected";
    }

    setLoadInfo({
      ratedLoad,
      redPhaseBulkLoad,
      yellowPhaseBulkLoad,
      bluePhaseBulkLoad,
      averageCurrent,
      percentageLoad,
      tenPercentFullLoadNeutral,
      calculatedNeutral: isNaN(calculatedNeutral) ? 0 : calculatedNeutral,
      neutralWarningLevel,
      neutralWarningMessage,
      imbalancePercentage,
      imbalanceWarningLevel,
      imbalanceWarningMessage,
      maxPhaseCurrent,
      minPhaseCurrent,
      avgPhaseCurrent
    });
  }, [formData.rating, formData.feederLegs, isLoading]);


  // --- Form Submission ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) {
        toast.error("Record ID is missing. Cannot update.");
        return;
    }

    const invalidFeeder = formData.feederLegs?.find(leg =>
        isNaN(Number(leg.redPhaseCurrent)) || isNaN(Number(leg.yellowPhaseCurrent)) ||
        isNaN(Number(leg.bluePhaseCurrent)) || isNaN(Number(leg.neutralCurrent))
    );

    if (invalidFeeder) {
        toast.error("Please ensure all feeder leg currents are valid numbers.");
        return;
    }

    if (!formData.date || !formData.time || !formData.regionId || !formData.districtId || !formData.substationName || !formData.substationNumber || formData.rating === undefined || formData.rating <= 0 || !formData.feederLegs) {
      toast.error("Please fill all required fields, including a valid rating (KVA > 0).");
      return;
    }

    // Get region and district names from IDs
    const region = regions?.find(r => r.id === formData.regionId);
    const district = districts?.find(d => d.id === formData.districtId);

    if (!region || !district) {
      toast.error("Invalid region or district selected.");
      return;
    }

    const processedFeederLegs = formData.feederLegs.map(leg => ({
        ...leg,
        redPhaseCurrent: Number(leg.redPhaseCurrent),
        yellowPhaseCurrent: Number(leg.yellowPhaseCurrent),
        bluePhaseCurrent: Number(leg.bluePhaseCurrent),
        neutralCurrent: Number(leg.neutralCurrent),
    }));

    const completeData: LoadMonitoringData = {
      id: id,
      date: formData.date,
      time: formData.time,
      regionId: formData.regionId,
      districtId: formData.districtId,
      region: region.name,
      district: district.name,
      substationName: formData.substationName,
      substationNumber: formData.substationNumber,
      location: formData.location || "",
      gpsLocation: formData.gpsLocation || "", // Add gpsLocation to completeData
      rating: formData.rating,
      peakLoadStatus: formData.peakLoadStatus || "day",
      ownership: formData.ownership || "public",
      voltageLevel: formData.voltageLevel || "",
      feederLegs: processedFeederLegs,
      ratedLoad: loadInfo.ratedLoad,
      redPhaseBulkLoad: loadInfo.redPhaseBulkLoad,
      yellowPhaseBulkLoad: loadInfo.yellowPhaseBulkLoad,
      bluePhaseBulkLoad: loadInfo.bluePhaseBulkLoad,
      averageCurrent: loadInfo.averageCurrent,
      percentageLoad: loadInfo.percentageLoad,
      tenPercentFullLoadNeutral: loadInfo.tenPercentFullLoadNeutral,
      calculatedNeutral: loadInfo.calculatedNeutral,
      neutralWarningLevel: loadInfo.neutralWarningLevel,
      neutralWarningMessage: loadInfo.neutralWarningMessage,
      imbalancePercentage: loadInfo.imbalancePercentage,
      imbalanceWarningLevel: loadInfo.imbalanceWarningLevel,
      imbalanceWarningMessage: loadInfo.imbalanceWarningMessage,
      maxPhaseCurrent: loadInfo.maxPhaseCurrent,
      minPhaseCurrent: loadInfo.minPhaseCurrent,
      avgPhaseCurrent: loadInfo.avgPhaseCurrent,
      createdBy: formData.createdBy || {
        id: user?.id || '',
        name: user?.name || 'Unknown'
      },
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: {
        id: user?.id || '',
        name: user?.name || 'Unknown'
      },
    };

    if (updateLoadMonitoringRecord) {
      updateLoadMonitoringRecord(id, completeData);
      navigate("/asset-management/load-monitoring");
    } else {
      toast.error("Failed to update data. Context function not available.");
    }
  };

  if (isLoading) {
      return <Layout><div>Loading record...</div></Layout>;
  }

 return ( // Ensure component returns JSX
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Edit Load Record</h1>
          <p className="text-muted-foreground mt-2">
            Update the details for this transformer load record.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:gap-6">
            {/* Basic Information Card */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Record when and where the load monitoring is taking place
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                   <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date || ''}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time || ''}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={formData.regionId || ""}
                      onValueChange={handleRegionChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "regional_engineer" || user?.role === "regional_general_manager" || user?.role === "technician"}
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Select Region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions?.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District</Label>
                    <Select
                      value={formData.districtId || ""}
                      onValueChange={handleDistrictChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "technician" || !formData.regionId || filteredDistricts.length === 0}
                    >
                      <SelectTrigger id="district" className={user?.role === "district_engineer" || user?.role === "district_manager" ? "bg-muted" : ""}>
                        <SelectValue placeholder="Select District" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredDistricts.map((district) => (
                          <SelectItem key={district.id} value={district.id}>
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="substationName">Substation Name</Label>
                    <Input
                      id="substationName"
                      type="text"
                      value={formData.substationName || ''}
                      onChange={(e) => handleInputChange('substationName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="substationNumber">Substation Number</Label>
                    <Input
                      id="substationNumber"
                      type="text"
                      value={formData.substationNumber || ''}
                      onChange={(e) => handleInputChange('substationNumber', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gpsLocation">GPS Location (Latitude, Longitude)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="gpsLocation"
                        type="text"
                        placeholder="e.g., 7.123456, -1.234567"
                        value={formData.gpsLocation || ''}
                        onChange={(e) => handleInputChange('gpsLocation', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                const latitude = position.coords.latitude.toFixed(6);
                                const longitude = position.coords.longitude.toFixed(6);
                                handleInputChange('gpsLocation', `${latitude}, ${longitude}`);
                              },
                              (error) => {
                                toast.error('Unable to retrieve your location.');
                              },
                              { enableHighAccuracy: true }
                            );
                          } else {
                            toast.error('Geolocation is not supported by your browser.');
                          }
                        }}
                      >
                        Get Location
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (KVA)</Label>
                    <Input
                      id="rating"
                      type="number"
                      value={formData.rating ?? ''}
                      onChange={(e) => handleInputChange('rating', e.target.value)}
                      min="0"
                      placeholder="Enter KVA rating"
                      required
                    />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="peakLoadStatus">Peak Load Status</Label>
                    <Select
                      value={formData.peakLoadStatus || 'day'}
                      onValueChange={(value) => handleInputChange('peakLoadStatus', value as 'day' | 'night')}
                    >
                      <SelectTrigger id="peakLoadStatus">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day Peak</SelectItem>
                        <SelectItem value="night">Night Peak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Ownership Select */}
                  <div className="space-y-2">
                    <Label htmlFor="ownership">Ownership</Label>
                    <Select
                      value={formData.ownership || "public"}
                      onValueChange={(value) => handleInputChange('ownership', value as 'public' | 'private')}
                    >
                      <SelectTrigger id="ownership">
                        <SelectValue placeholder="Select ownership" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Voltage Level Select */}
                  <div className="space-y-2">
                    <Label htmlFor="voltageLevel">Voltage Level</Label>
                    <Select
                      value={formData.voltageLevel || ""}
                      onValueChange={(value) => handleInputChange('voltageLevel', value)}
                    >
                      <SelectTrigger id="voltageLevel">
                        <SelectValue placeholder="Select voltage level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.433kV">0.433kV</SelectItem>
                        <SelectItem value="0.400kV">0.400kV</SelectItem>
                        <SelectItem value="11kV">11kV</SelectItem>
                        <SelectItem value="33kV">33kV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feeder Legs Card */}
             <Card>
              <CardHeader>
                <CardTitle>Feeder Legs Current (Amps)</CardTitle>
                <CardDescription>Enter current readings for each feeder leg. Maximum 8 legs.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formData.feederLegs?.map((leg, index) => (
                    <div key={leg.id} className="grid grid-cols-5 gap-4 items-center border p-4 rounded-md">
                      <Label className="col-span-5 font-medium">Feeder Leg {index + 1}</Label>
                      <div className="space-y-1">
                        <Label htmlFor={`red-${leg.id}`}>Red Phase</Label>
                        <Input
                          id={`red-${leg.id}`}
                          type="number"
                          value={leg.redPhaseCurrent ?? ''} // Handle potential non-number value during typing
                          onChange={(e) => updateFeederLeg(leg.id, 'redPhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`yellow-${leg.id}`}>Yellow Phase</Label>
                        <Input
                          id={`yellow-${leg.id}`}
                          type="number"
                           value={leg.yellowPhaseCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'yellowPhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`blue-${leg.id}`}>Blue Phase</Label>
                        <Input
                          id={`blue-${leg.id}`}
                          type="number"
                           value={leg.bluePhaseCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'bluePhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`neutral-${leg.id}`}>Neutral</Label>
                        <Input
                          id={`neutral-${leg.id}`}
                          type="number"
                          value={leg.neutralCurrent ?? ''}
                          onChange={(e) => updateFeederLeg(leg.id, 'neutralCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeederLeg(leg.id)}
                        disabled={(formData.feederLegs?.length || 0) <= 1}
                        className="justify-self-end"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFeederLeg}
                  className="mt-4"
                  disabled={(formData.feederLegs?.length || 0) >= 8}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Feeder Leg
                </Button>
              </CardContent>
            </Card>

            {/* Calculated Load Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Calculated Load Information</CardTitle>
                <CardDescription>Automatically calculated based on your inputs.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Rated Load (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.ratedLoad.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Avg. Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.averageCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">% Load</Label>
                  <p className="text-lg font-semibold">{loadInfo.percentageLoad.toFixed(2)} %</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Calculated Neutral (A)</Label>
                  <p className={`text-lg font-semibold ${
                    loadInfo.neutralWarningLevel === "critical" ? "text-red-500" : 
                    loadInfo.neutralWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {loadInfo.calculatedNeutral.toFixed(2)}
                  </p>
                  {loadInfo.neutralWarningMessage && (
                    <p className={`text-sm ${
                      loadInfo.neutralWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {loadInfo.neutralWarningMessage}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">10% Rated Neutral (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.tenPercentFullLoadNeutral.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Phase Imbalance (%)</Label>
                  <p className={`text-lg font-semibold ${
                    loadInfo.imbalanceWarningLevel === "critical" ? "text-red-500" : 
                    loadInfo.imbalanceWarningLevel === "warning" ? "text-yellow-500" : ""
                  }`}>
                    {loadInfo.imbalancePercentage.toFixed(2)}%
                  </p>
                  {loadInfo.imbalanceWarningMessage && (
                    <p className={`text-sm ${
                      loadInfo.imbalanceWarningLevel === "critical" ? "text-red-500" : "text-yellow-500"
                    }`}>
                      {loadInfo.imbalanceWarningMessage}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Max Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.maxPhaseCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Min Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.minPhaseCurrent.toFixed(2)}</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium text-muted-foreground">Avg Phase Current (A)</Label>
                  <p className="text-lg font-semibold">{loadInfo.avgPhaseCurrent.toFixed(2)}</p>
                </div>
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
                {diagnosis.messages.map((message, i) => {
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
                })}
              </CardContent>
            </Card>

            {/* Submit/Cancel Buttons */}
            <div className="flex justify-end gap-4 mt-2">
                <Button type="button" variant="outline" onClick={() => navigate("/asset-management/load-monitoring")}>
                    Cancel
                </Button>
                <Button type="submit">
                    Update Record
                </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
} // Added closing brace
