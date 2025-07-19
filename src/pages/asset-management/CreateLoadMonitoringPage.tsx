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
import { useNavigate } from "react-router-dom";

export default function CreateLoadMonitoringPage() {
  const { user } = useAuth();
  const { saveLoadMonitoringRecord, regions, districts } = useData(); // Get regions & districts
  const navigate = useNavigate();

  // State for filtered districts based on selected region
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);

  const [formData, setFormData] = useState<Partial<LoadMonitoringData>>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    regionId: "", // Add regionId
    districtId: "", // Add districtId
    region: "", // Keep region name
    district: "", // Keep district name
    substationName: "",
    substationNumber: "",
    location: "",
    gpsLocation: "", // Add gpsLocation
    rating: undefined,
    peakLoadStatus: "day",
    feederLegs: [
      {
        id: uuidv4(),
        redPhaseCurrent: '',
        yellowPhaseCurrent: '',
        bluePhaseCurrent: '',
        neutralCurrent: ''
      }
    ]
  });

  // Consolidated useEffect for initializing region and district based on user context
  useEffect(() => {
    console.log("Initialization Effect: Running...");
    console.log("Initialization Effect: User:", user);
    console.log("Initialization Effect: Regions:", regions);
    console.log("Initialization Effect: Districts:", districts);

    // Ensure all necessary data is loaded
    if (!user || !regions || !districts) {
      console.log("Initialization Effect: Missing data, exiting.");
      setFilteredDistricts([]); // Clear districts if data is missing
      return;
    }

    console.log(`Initialization Effect: Searching for region: ${user.region}`);
    // Find the user's region
    const userRegion = regions.find(r => r.name === user.region);
    console.log("Initialization Effect: Found userRegion:", userRegion);

    if (userRegion) {
      console.log(`Initialization Effect: Filtering districts for regionId: ${userRegion.id}`);
      // Filter districts for the user's region
      const regionDistricts = districts.filter(d => d.regionId === userRegion.id);
      console.log("Initialization Effect: Filtered regionDistricts:", regionDistricts);
      setFilteredDistricts(regionDistricts);

      console.log(`Initialization Effect: Searching for district: ${user.district} in filtered list`);
      // Find the user's district within those districts
      const userDistrict = user.district ? regionDistricts.find(d => d.name === user.district) : undefined;
      console.log("Initialization Effect: Found userDistrict:", userDistrict);

      // Set form data with region and potentially district
      const newFormData = {
        regionId: userRegion.id,
        region: userRegion.name,
        districtId: userDistrict ? userDistrict.id : "", // Set district ID if found, else clear
        district: userDistrict ? userDistrict.name : ""   // Set district name if found, else clear
      };
      console.log("Initialization Effect: Setting formData with:", newFormData);
      setFormData(prev => ({
        ...prev,
        ...newFormData
      }));
    } else {
      console.log("Initialization Effect: User region not found, clearing selections.");
      // If the user's region isn't found (e.g., admin user), clear filters/selections
      setFilteredDistricts([]);
      setFormData(prev => ({
        ...prev,
        regionId: "",
        region: "",
        districtId: "",
        district: ""
      }));
    }
  }, [user, regions, districts]); // Depend on user, regions, and districts data

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
          redPhaseCurrent: '',
          yellowPhaseCurrent: '',
          bluePhaseCurrent: '',
          neutralCurrent: ''
        }
      ]
    }));
  };

  const removeFeederLeg = (id: string) => {
    if ((formData.feederLegs?.length || 0) <= 1) {
      toast.warning("At least one feeder leg is required");
      return;
    }
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.filter(leg => leg.id !== id) || []
    }));
  };

  const updateFeederLeg = (id: string, field: keyof FeederLeg, value: string) => {
    setFormData(prev => ({
      ...prev,
      feederLegs: prev.feederLegs?.map(leg =>
        leg.id === id
          ? { ...leg, [field]: value === '' ? '' : (isNaN(Number(value)) ? value : Number(value)) }
          : leg
      ) || []
    }));
  };

  // Updated handleInputChange to ignore region/district (handled by selects)
  const handleInputChange = (field: keyof LoadMonitoringData, value: any) => {
    if (field === 'region' || field === 'district') return; // Ignore, handled by selects
    
    if (field === 'rating') {
       setFormData(prev => ({ ...prev, [field]: value === '' ? undefined : Number(value) }));
    } else {
       setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  // Handle Region Change
  const handleRegionChange = (regionId: string) => {
    const selectedRegion = regions?.find(r => r.id === regionId);
    if (selectedRegion && districts) {
      const regionDistricts = districts.filter(d => d.regionId === regionId);
      setFilteredDistricts(regionDistricts);
      
      // If user is district engineer or technician, try to find their district in the new region
      if ((user?.role === "district_engineer" || user?.role === "technician") && user.district) {
        const userDistrict = regionDistricts.find(d => d.name === user.district);
        if (userDistrict) {
          setFormData(prev => ({
            ...prev,
            regionId: regionId,
            region: selectedRegion.name,
            districtId: userDistrict.id,
            district: userDistrict.name
          }));
          return;
        }
      }
      
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
        districtId: districtId, // Store district ID
        district: selectedDistrict.name // Store district name
      }));
    }
  };

  // --- Load Calculation Logic ---
   useEffect(() => {
    const rating = Number(formData.rating); // Will be NaN if formData.rating is undefined
    const feederLegs = formData.feederLegs || [];

    if (isNaN(rating) || rating <= 0 || feederLegs.length === 0) {
      setLoadInfo({
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
      return;
    }

    // Use 0 for any empty or invalid phase/neutral values
    const safeNumber = (val: any) => (val === '' || isNaN(Number(val))) ? 0 : Number(val);
    const redPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + safeNumber(leg.redPhaseCurrent), 0);
    const yellowPhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + safeNumber(leg.yellowPhaseCurrent), 0);
    const bluePhaseBulkLoad = feederLegs.reduce((sum, leg) => sum + safeNumber(leg.bluePhaseCurrent), 0);

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
  }, [formData.rating, formData.feederLegs]);


  // --- Form Submission ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

     // Validate all feeder leg currents are numbers
    const invalidFeeder = formData.feederLegs?.find(leg =>
        isNaN(Number(leg.redPhaseCurrent)) || isNaN(Number(leg.yellowPhaseCurrent)) ||
        isNaN(Number(leg.bluePhaseCurrent)) || isNaN(Number(leg.neutralCurrent))
    );

    if (invalidFeeder) {
        toast.error("Please ensure all feeder leg currents are valid numbers.");
        return;
    }


    if (!formData.date || !formData.time || !formData.regionId || !formData.districtId || !formData.region || !formData.district || !formData.substationName || !formData.substationNumber || formData.rating === undefined || formData.rating <= 0 || !formData.feederLegs) {
      toast.error("Please fill all required fields, including a valid rating (KVA > 0).");
      return;
    }


    // Ensure feeder legs currents are numbers before saving
    const processedFeederLegs = formData.feederLegs.map(leg => ({
        ...leg,
        redPhaseCurrent: Number(leg.redPhaseCurrent),
        yellowPhaseCurrent: Number(leg.yellowPhaseCurrent),
        bluePhaseCurrent: Number(leg.bluePhaseCurrent),
        neutralCurrent: Number(leg.neutralCurrent),
    }));


    // Construct the data object to save, ensuring all required fields are present and correctly typed
    const completeData: Omit<LoadMonitoringData, 'id'> = {
      date: formData.date,
      time: formData.time,
      regionId: formData.regionId,
      districtId: formData.districtId,
      region: formData.region,
      district: formData.district,
      substationName: formData.substationName,
      substationNumber: formData.substationNumber,
      location: formData.location || "",
      gpsLocation: formData.gpsLocation || "", // Include gpsLocation
      rating: formData.rating,
      peakLoadStatus: formData.peakLoadStatus || "day",
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
      createdBy: {
        id: user?.id || '',
        name: user?.name || 'Unknown'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };


    if (saveLoadMonitoringRecord) {
      saveLoadMonitoringRecord(completeData);
      // Toast is handled in DataContext
      navigate("/asset-management/load-monitoring"); // Navigate back to list after save
    } else {
      toast.error("Failed to save data. Context function not available.");
    }
  };

 return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create New Load Record</h1>
          <p className="text-muted-foreground mt-2">
            Fill in the details below to record transformer load metrics.
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
                  {/* Date, Time Inputs */}
                   <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      required
                    />
                  </div>
                  {/* Region Select */}
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select
                      value={formData.regionId || ""}
                      onValueChange={handleRegionChange}
                      required
                      disabled={user?.role === "district_engineer" || user?.role === "district_manager" || user?.role === "regional_engineer" || user?.role === "project_engineer" || user?.role === "regional_general_manager" || user?.role === "technician"}
                    >
                      <SelectTrigger id="region">
                        <SelectValue placeholder="Select Region" />
                      </SelectTrigger>
                      <SelectContent>
                        {(user?.role === "regional_engineer" || user?.role === "project_engineer")
                          ? regions.filter(r => r.name === user.region).map(region => (
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
                  {/* District Select */}
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
                   {/* Substation Name, Number, Location, Rating Inputs */}
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
                  {/* GPS Location Field */}
                  <div className="space-y-2">
                    <Label htmlFor="gpsLocation">GPS Location (Latitude, Longitude)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="gpsLocation"
                        type="text"
                        placeholder="e.g., 7.12345, -1.23456"
                        value={formData.gpsLocation || ''}
                        onChange={(e) => handleInputChange('gpsLocation', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
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
                      value={formData.rating ?? ''} // Use ?? to handle undefined for controlled input
                      onChange={(e) => handleInputChange('rating', e.target.value)}
                      min="0"
                      placeholder="Enter KVA rating"
                      required
                    />
                  </div>
                   {/* Peak Load Status Select */}
                   <div className="space-y-2">
                    <Label htmlFor="peakLoadStatus">Peak Load Status</Label>
                    <Select
                      value={formData.peakLoadStatus}
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
                    <div key={leg.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center border p-4 rounded-md">
                      <Label className="col-span-1 sm:col-span-2 lg:col-span-5 font-medium">Feeder Leg {index + 1}</Label>
                      <div className="space-y-1">
                        <Label htmlFor={`red-${leg.id}`}>Red Phase</Label>
                        <Input
                          id={`red-${leg.id}`}
                          type="number"
                          value={leg.redPhaseCurrent}
                          onChange={(e) => updateFeederLeg(leg.id, 'redPhaseCurrent', e.target.value)}
                          placeholder="Amps"
                          min="0"
                          step="any" // Allow decimals
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`yellow-${leg.id}`}>Yellow Phase</Label>
                        <Input
                          id={`yellow-${leg.id}`}
                          type="number"
                          value={leg.yellowPhaseCurrent}
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
                          value={leg.bluePhaseCurrent}
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
                          value={leg.neutralCurrent}
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
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 {/* Display calculated values */}
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
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 mt-2">
                <Button type="button" variant="outline" onClick={() => navigate("/asset-management/load-monitoring")}>
                    Cancel
                </Button>
                <Button type="submit">
                    Save Record
                </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
