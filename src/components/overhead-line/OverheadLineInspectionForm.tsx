import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MapPin, Camera, Upload, X } from "lucide-react";
import { NetworkInspection, ConditionStatus } from "@/lib/types";
import { getRegions, getDistricts } from "@/lib/api";
import { showNotification, showServiceWorkerNotification } from '@/utils/notifications';
import { serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { OfflineInspectionService } from '@/services/OfflineInspectionService';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { FeederService } from "@/services/FeederService";
import { processImageWithMetadata, captureImageWithMetadata } from "@/utils/imageUtils";
import { storage } from "@/config/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface OverheadLineInspectionFormProps {
  inspection?: NetworkInspection | null;
  onSubmit: (inspection: NetworkInspection) => void;
  onCancel: () => void;
}

interface FeederInfo {
  id: string;
  name: string;
  bspPss: string;
  region: string;
  district: string;
  regionId: string;
  districtId: string;
  voltageLevel: string;
  feederType: string;
}

export function OverheadLineInspectionForm({ inspection, onSubmit, onCancel }: OverheadLineInspectionFormProps) {
  const { regions, districts } = useData();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const navigate = useNavigate();
  const { addNetworkInspection, updateNetworkInspection } = useData();
  const offlineStorage = OfflineInspectionService.getInstance();
  const [offlineInspections, setOfflineInspections] = useState<NetworkInspection[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleCancelClick = () => {
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = () => {
    setShowCancelDialog(false);
    onCancel();
  };

  const handleCancelCancel = () => {
    setShowCancelDialog(false);
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [feeders, setFeeders] = useState<FeederInfo[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  // Add state for after-correction camera
  const [isCapturingAfter, setIsCapturingAfter] = useState(false);
  const videoRefAfter = useRef<HTMLVideoElement>(null);
  const [isVideoReadyAfter, setIsVideoReadyAfter] = useState(false);
  let cameraStreamAfter: MediaStream | null = null;
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  
  const feederService = FeederService.getInstance();

  // Function to upload image to cloud storage
  const uploadImageToStorage = async (base64Image: string, inspectionId: string, imageIndex: number): Promise<string> => {
    try {
      // Convert base64 to blob
      const byteString = atob(base64Image.split(',')[1]);
      const mimeString = base64Image.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      
      // Generate unique filename
      const fileName = `overhead-line-inspections/${inspectionId}/image_${imageIndex}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      // Upload to Firebase Storage
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image to storage:', error);
      // Return original base64 if upload fails
      return base64Image;
    }
  };

  const defaultInsulatorCondition = {
    insulatorType: "",
    brokenOrCracked: false,
    burntOrFlashOver: false,
    shattered: false,
    defectiveBinding: false,
    notes: ""
  };

  const [formData, setFormData] = useState<NetworkInspection>(() => {
    const defaultFormData: NetworkInspection = {
      id: "",
      region: "",
      district: "",
      feederName: "",
      voltageLevel: "",
      referencePole: "",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latitude: 0,
      longitude: 0,
      items: [],
      inspector: {
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || ""
      },
      poleId: "",
      poleHeight: "8m",
      poleType: "CP",
      groundCondition: "",
      poleCondition: {
        tilted: false,
        broken: false,
        rotten: false,
        burnt: false,
        substandard: false,
        conflictWithLV: false,
        notes: ""
      },
      stayCondition: {
        requiredButNotAvailable: false,
        cut: false,
        misaligned: false,
        defectiveStay: false,
        notes: ""
      },
      crossArmCondition: {
        misaligned: false,
        bend: false,
        corroded: false,
        substandard: false,
        others: false,
        notes: ""
      },
      insulatorCondition: defaultInsulatorCondition,
      conductorCondition: {
        looseConnectors: false,
        weakJumpers: false,
        burntLugs: false,
        saggedLine: false,
        broken: false,
        undersized: false,
        notes: ""
      },
      lightningArresterCondition: {
        brokenOrCracked: false,
        flashOver: false,
        noEarthing: false,
        bypassed: false,
        noArrester: false,
        notes: ""
      },
      dropOutFuseCondition: {
        brokenOrCracked: false,
        flashOver: false,
        insufficientClearance: false,
        looseOrNoEarthing: false,
        corroded: false,
        linkedHVFuses: false,
        others: false,
        notes: ""
      },
      transformerCondition: {
        leakingOil: false,
        lowOilLevel: false,
        missingEarthLeads: false,
        linkedHVFuses: false,
        rustedTank: false,
        crackedBushing: false,
        others: false,
        notes: ""
      },
      recloserCondition: {
        lowGasLevel: false,
        lowBatteryLevel: false,
        burntVoltageTransformers: false,
        protectionDisabled: false,
        bypassed: false,
        others: false,
        notes: ""
      },
      vegetationConflicts: {
        climbers: false,
        trees: false,
        notes: ""
      },
      additionalNotes: "",
      images: [],
      afterImages: [],
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5)
    };

    // Set region and district based on user role
    if (user) {
      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
        defaultFormData.region = user.region;
        defaultFormData.district = user.district;
      } else if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
        defaultFormData.region = user.region;
        // Set district to first district in this region if available
        const regionObj = regions.find(r => r.name === user.region);
        if (regionObj) {
          const regionDistricts = districts.filter(d => d.regionId === regionObj.id);
          if (regionDistricts.length > 0) {
            defaultFormData.district = regionDistricts[0].name;
          }
        }
      } else if (user.role === "system_admin" && regions.length > 0) {
        defaultFormData.region = regions[0].name;
        if (districts.length > 0) {
          defaultFormData.district = districts[0].name;
        }
      }
    }

    if (inspection) {
      return {
        ...defaultFormData,
        ...inspection,
        images: inspection.images || [],
        date: inspection.date ? inspection.date.split('T')[0] : new Date().toISOString().split('T')[0],
        time: inspection.time,
        status: inspection.status || "pending"
      };
    }

    if (!defaultFormData.afterImages) defaultFormData.afterImages = [];

    return defaultFormData;
  });

  // Filter regions and districts based on user role
  const filteredRegions = useMemo(() => {
    if (!user) return [];
    if (user.role === "global_engineer" || user.role === "system_admin" || user.role === "ashsub_t" || user.role === "accsub_t") return regions;
    if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
      return regions.filter(r => r.name === user.region);
    }
    if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region) {
      return regions.filter(r => r.name === user.region);
    }
    return [];
  }, [regions, user]);

  const filteredDistricts = useMemo(() => {
    if (!user || !formData.region) return [];
    const region = regions.find(r => r.name === formData.region);
    if (!region) return [];

    if (user.role === "global_engineer" || user.role === "system_admin" || user.role === "ashsub_t" || user.role === "accsub_t") {
      return districts.filter(d => d.regionId === region.id);
    }
    if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") {
      return districts.filter(d => d.regionId === region.id);
    }
    if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.district) {
      return districts.filter(d => d.name === user.district && d.regionId === region.id);
    }
    return [];
  }, [districts, formData.region, user, regions]);

  // Handle region change
  const handleRegionChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      region: value,
      district: "" // Reset district when region changes
    }));
  };

  // Handle district change
  const handleDistrictChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      district: value
    }));
  };

  // Show loading state while auth is being checked
  if (loading) {
    return <div>Loading...</div>;
  }

  // Update form data when user or regions/districts change
  useEffect(() => {
    if (user && !inspection) {
      if ((user.role === "district_engineer" || user.role === "district_manager" || user.role === "technician") && user.region && user.district) {
        setFormData(prev => ({
          ...prev,
          region: user.region,
          district: user.district,
          inspector: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        }));
      } else if ((user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region) {
        // Set region and default district for regional_general_manager
        const regionObj = regions.find(r => r.name === user.region);
        let defaultDistrict = "";
        if (regionObj) {
          const regionDistricts = districts.filter(d => d.regionId === regionObj.id);
          if (regionDistricts.length > 0) {
            defaultDistrict = regionDistricts[0].name;
          }
        }
        setFormData(prev => ({
          ...prev,
          region: user.region,
          district: defaultDistrict,
          inspector: {
            id: user.id,
            name: user.name,
            email: user.email
          }
        }));
      }
    }
  }, [user, inspection, regions, districts]);

  // Update form data when inspection prop changes
  useEffect(() => {
    if (inspection) {
      setFormData(currentData => ({
        ...currentData,
        ...inspection,
        date: inspection.date ? inspection.date.split('T')[0] : new Date().toISOString().split('T')[0],
        time: inspection.time,
        status: inspection.status || "pending",
        // Ensure backward compatibility for new fields
        vegetationConflicts: {
          climbers: inspection.vegetationConflicts?.climbers || false,
          trees: inspection.vegetationConflicts?.trees || false,
          notes: inspection.vegetationConflicts?.notes || ""
        }
      }));
    }
  }, [inspection]);

  // Memoize handlers
  const handleGetLocation = useCallback(() => {
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      setIsGettingLocation(false);
      toast({
        title: "Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setGpsAccuracy(accuracy); // Store accuracy for image metadata
        setIsGettingLocation(false);
        toast({
          title: "Success",
          description: `Location obtained successfully! Accuracy: ±${accuracy.toFixed(1)} meters`,
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Error",
          description: "Could not get your location. Please try again or enter coordinates manually.",
          variant: "destructive",
        });
      }
    );
  }, [toast]);

  const handleStatusChange = (status: "pending" | "in-progress" | "completed" | "rejected") => {
    setFormData(currentData => ({
      ...currentData,
      status
    }));

    // Show notification for status change
    const notificationTitle = 'Inspection Status Updated';
    const notificationBody = `Status changed to ${status}`;
    showNotification(notificationTitle, { body: notificationBody });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Only clean undefined and null values, keep empty strings and objects
      const cleanValue = (value: any): any => {
        if (value === null || value === undefined) return undefined;
        if (typeof value === 'object' && Object.keys(value).length === 0) return {};
        return value;
      };

      const cleanData = {
        ...formData,
        date: formData.date || new Date().toISOString().split('T')[0],
        time: formData.time || new Date().toTimeString().slice(0, 5),
        updatedAt: new Date().toISOString(),
        createdAt: formData.createdAt || new Date().toISOString(),
        // Ensure required fields are present
        region: formData.region || '',
        district: formData.district || '',
        feederName: formData.feederName || '',
        voltageLevel: formData.voltageLevel || '',
        referencePole: formData.referencePole || '',
        status: formData.status || 'pending',
        inspector: {
          id: formData.inspector?.id || user?.id || '',
          name: formData.inspector?.name || user?.name || '',
          email: formData.inspector?.email || user?.email || ''
        },
        // Ensure all condition objects are present with default values
        poleCondition: {
          tilted: formData.poleCondition?.tilted || false,
          broken: formData.poleCondition?.broken || false,
          rotten: formData.poleCondition?.rotten || false,
          burnt: formData.poleCondition?.burnt || false,
          substandard: formData.poleCondition?.substandard || false,
          conflictWithLV: formData.poleCondition?.conflictWithLV || false,
          notes: formData.poleCondition?.notes || ''
        },
        stayCondition: {
          requiredButNotAvailable: formData.stayCondition?.requiredButNotAvailable || false,
          cut: formData.stayCondition?.cut || false,
          misaligned: formData.stayCondition?.misaligned || false,
          defectiveStay: formData.stayCondition?.defectiveStay || false,
          notes: formData.stayCondition?.notes || ''
        },
        crossArmCondition: {
          misaligned: formData.crossArmCondition?.misaligned || false,
          bend: formData.crossArmCondition?.bend || false,
          corroded: formData.crossArmCondition?.corroded || false,
          substandard: formData.crossArmCondition?.substandard || false,
          others: formData.crossArmCondition?.others || false,
          notes: formData.crossArmCondition?.notes || ''
        },
        insulatorCondition: {
          insulatorType: formData.insulatorCondition.insulatorType || '',
          brokenOrCracked: formData.insulatorCondition.brokenOrCracked || false,
          burntOrFlashOver: formData.insulatorCondition.burntOrFlashOver || false,
          shattered: formData.insulatorCondition.shattered || false,
          defectiveBinding: formData.insulatorCondition.defectiveBinding || false,
          notes: formData.insulatorCondition.notes || ''
        },
        conductorCondition: {
          looseConnectors: formData.conductorCondition?.looseConnectors || false,
          weakJumpers: formData.conductorCondition?.weakJumpers || false,
          burntLugs: formData.conductorCondition?.burntLugs || false,
          saggedLine: formData.conductorCondition?.saggedLine || false,
          broken: formData.conductorCondition?.broken || false,
          undersized: formData.conductorCondition?.undersized || false,
          notes: formData.conductorCondition?.notes || ''
        },
        lightningArresterCondition: {
          brokenOrCracked: formData.lightningArresterCondition?.brokenOrCracked || false,
          flashOver: formData.lightningArresterCondition?.flashOver || false,
          noEarthing: formData.lightningArresterCondition?.noEarthing || false,
          bypassed: formData.lightningArresterCondition?.bypassed || false,
          noArrester: formData.lightningArresterCondition?.noArrester || false,
          notes: formData.lightningArresterCondition?.notes || ''
        },
        dropOutFuseCondition: {
          brokenOrCracked: formData.dropOutFuseCondition?.brokenOrCracked || false,
          flashOver: formData.dropOutFuseCondition?.flashOver || false,
          insufficientClearance: formData.dropOutFuseCondition?.insufficientClearance || false,
          looseOrNoEarthing: formData.dropOutFuseCondition?.looseOrNoEarthing || false,
          corroded: formData.dropOutFuseCondition?.corroded || false,
          linkedHVFuses: formData.dropOutFuseCondition?.linkedHVFuses || false,
          others: formData.dropOutFuseCondition?.others || false,
          notes: formData.dropOutFuseCondition?.notes || ''
        },
        transformerCondition: {
          leakingOil: formData.transformerCondition?.leakingOil || false,
          lowOilLevel: formData.transformerCondition?.lowOilLevel || false,
          missingEarthLeads: formData.transformerCondition?.missingEarthLeads || false,
          linkedHVFuses: formData.transformerCondition?.linkedHVFuses || false,
          rustedTank: formData.transformerCondition?.rustedTank || false,
          crackedBushing: formData.transformerCondition?.crackedBushing || false,
          others: formData.transformerCondition?.others || false,
          notes: formData.transformerCondition?.notes || ''
        },
        recloserCondition: {
          lowGasLevel: formData.recloserCondition?.lowGasLevel || false,
          lowBatteryLevel: formData.recloserCondition?.lowBatteryLevel || false,
          burntVoltageTransformers: formData.recloserCondition?.burntVoltageTransformers || false,
          protectionDisabled: formData.recloserCondition?.protectionDisabled || false,
          bypassed: formData.recloserCondition?.bypassed || false,
          others: formData.recloserCondition?.others || false,
          notes: formData.recloserCondition?.notes || ''
        },
        vegetationConflicts: {
          climbers: formData.vegetationConflicts?.climbers || false,
          trees: formData.vegetationConflicts?.trees || false,
          notes: formData.vegetationConflicts?.notes || ''
        }
      };

      const isOnline = offlineStorage.isInternetAvailable();
      console.log('[OverheadLineInspectionForm] Internet available:', isOnline);

      // For existing inspections, convert images to URLs first
      let finalImages = cleanData.images;
      if (inspection && isOnline && finalImages && Array.isArray(finalImages) && finalImages.length > 0) {
        try {
          const imageUrls = await Promise.all(
            finalImages.map(async (image, index) => {
              if (typeof image === 'string' && image.startsWith('data:image')) {
                // Convert base64 to URL using existing inspection ID
                return await uploadImageToStorage(image, inspection.id, index);
              }
              return image; // Already a URL
            })
          );
          finalImages = imageUrls;
        } catch (error) {
          console.error('Error converting images to URLs:', error);
          // Continue with original images if conversion fails
        }
      }

      const finalData = Object.fromEntries(
        Object.entries(cleanData)
          .map(([key, value]) => [key, key === 'images' ? finalImages : cleanValue(value)])
          .filter(([_, value]) => value !== undefined)
      ) as NetworkInspection;

      if (isOnline) {
        if (inspection) {
          try {
            await updateNetworkInspection(inspection.id, finalData);
            toast({ title: "Success", description: "Inspection updated successfully" });
          } catch (error) {
            if (error instanceof Error && error.message.includes("not found")) {
              // If the inspection was not found, create a new one instead
              const { id, ...dataWithoutId } = finalData;
              await addNetworkInspection(dataWithoutId);
              toast({ 
                title: "Success", 
                description: "Inspection was not found and has been recreated" 
              });
            } else {
              throw error;
            }
          }
        } else {
          // For new inspections, create document first, then upload images
          const { id, ...dataWithoutId } = finalData;
          
          // Create the inspection first to get a real ID
          const newInspectionId = await addNetworkInspection(dataWithoutId);
          
          // Now upload images using the real inspection ID
          if (isOnline && finalImages && Array.isArray(finalImages) && finalImages.length > 0) {
            try {
              const imageUrls = await Promise.all(
                finalImages.map(async (image, index) => {
                  if (typeof image === 'string' && image.startsWith('data:image')) {
                    // Convert base64 to URL using the new inspection ID
                    return await uploadImageToStorage(image, newInspectionId, index);
                  }
                  return image; // Already a URL
                })
              );
              
              // Update the inspection with the image URLs
              const updatedData = { ...dataWithoutId, images: imageUrls };
              await updateNetworkInspection(newInspectionId, updatedData);
            } catch (error) {
              console.error('Error uploading images for new inspection:', error);
              // Continue with base64 images if upload fails
            }
          }
          
          toast({ title: "Success", description: "Inspection created successfully" });
        }
      } else {
        console.log('[OverheadLineInspectionForm] Saving inspection offline...');
        try {
          const { id, ...dataWithoutId } = finalData;
          await offlineStorage.saveInspectionOffline(dataWithoutId);
          toast({ 
            title: "Success", 
            description: "Inspection saved offline. It will be synced when internet connection is restored." 
          });
        } catch (error) {
          console.error('[OverheadLineInspectionForm] Error saving inspection offline:', error);
          toast({ 
            title: "Error", 
            description: "Failed to save inspection offline. Please try again when you have internet connection.",
            variant: "destructive"
          });
          throw error;
        }
      }
      
      setIsSubmitting(false);
      onCancel();
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to save inspection",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  // Load regions only once on mount
  useEffect(() => {
    async function loadRegions() {
      try {
        const regions = await getRegions();
        if (regions.length > 0 && !formData.region) {
          setFormData(prev => ({ ...prev, region: regions[0].name }));
        }
      } catch (error) {
        toast({
          title: "Error loading regions",
          description: "Failed to load regions. Please try again.",
          variant: "destructive",
        });
      }
    }
    loadRegions();
  }, [toast]);

  // Load districts when region changes
  useEffect(() => {
    async function loadDistricts() {
      if (!formData.region) return;
      try {
        const districts = await getDistricts(regions.find(r => r.name === formData.region)?.id);
        if (districts.length > 0 && !formData.district) {
          setFormData(prev => ({ ...prev, district: districts[0].name }));
        }
      } catch (error) {
        toast({
          title: "Error loading districts",
          description: "Failed to load districts. Please try again.",
          variant: "destructive",
        });
      }
    }
    loadDistricts();
  }, [formData.region, toast]);

  // Fetch feeders when region changes
  useEffect(() => {
    const fetchFeeders = async () => {
      if (!formData.region) {
        setFeeders([]);
        return;
      }

      try {
        const region = regions.find(r => r.name === formData.region);
        console.log('Selected region:', formData.region);
        console.log('Found region:', region);
        
        if (!region) {
          console.log('No region found for:', formData.region);
          return;
        }

        // Use FeederService for offline support
        const feedersData = await feederService.getFeedersByRegion(region.id);
        
        console.log('Fetched feeders:', feedersData);
        const sortedFeeders = feedersData.sort((a, b) => a.name.localeCompare(b.name));
        console.log('Sorted feeders:', sortedFeeders.map(f => f.name));
        setFeeders(sortedFeeders);

        // If we have feeders and no feeder is selected, select the first one (alphabetically)
        if (sortedFeeders.length > 0 && !formData.feederName) {
          const firstFeeder = sortedFeeders[0];
          setFormData(prev => ({
            ...prev,
            feederName: firstFeeder.name,
            voltageLevel: firstFeeder.voltageLevel
          }));
        }
      } catch (error) {
        console.error("Error fetching feeders:", error);
        toast({
          title: "Error",
          description: "Failed to load feeders",
          variant: "destructive",
        });
      }
    };

    fetchFeeders();
  }, [formData.region, regions, feederService]);

  // Handle feeder selection
  const handleFeederChange = (feederName: string) => {
    console.log('Selected feeder name:', feederName); // Debug log
    const selectedFeeder = feeders.find(f => f.name === feederName);
    console.log('Found feeder:', selectedFeeder); // Debug log
    
    if (selectedFeeder) {
      setFormData(prev => ({
        ...prev,
        feederName: selectedFeeder.name,
        voltageLevel: selectedFeeder.voltageLevel
      }));
    }
  };

  // Memoize form sections
  const renderInspectorInfo = useMemo(() => (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Inspector Name</Label>
            <p className="text-sm">{formData.inspector.name}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Inspector Email</Label>
            <p className="text-sm">{formData.inspector.email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  const renderBasicInformation = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region *</Label>
            <Select
              value={formData.region}
              onValueChange={handleRegionChange}
              disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "regional_general_manager"}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {filteredRegions.map((region) => (
                  <SelectItem key={region.id} value={region.name}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="district">District *</Label>
            <Select
              value={formData.district}
              onValueChange={handleDistrictChange}
              disabled={user?.role === "district_engineer" || user?.role === "technician" || !formData.region}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {filteredDistricts.map((district) => (
                  <SelectItem key={district.id} value={district.name}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feeder">Feeder *</Label>
            <Select
              value={formData.feederName}
              onValueChange={handleFeederChange}
              disabled={!formData.region}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select feeder" />
              </SelectTrigger>
              <SelectContent>
                {feeders
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((feeder) => (
                  <SelectItem key={`${feeder.id}-${feeder.name}`} value={feeder.name}>
                    {feeder.name} ({feeder.voltageLevel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voltageLevel">Voltage Level *</Label>
            <Input
              id="voltageLevel"
              value={formData.voltageLevel}
              readOnly
              placeholder="Voltage level will be set automatically"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referencePole">Reference Pole *</Label>
            <Input
              id="referencePole"
              value={formData.referencePole}
              onChange={(e) => setFormData({ ...formData, referencePole: e.target.value })}
              placeholder="Enter reference pole"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date || new Date().toISOString().split('T')[0]}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time *</Label>
            <Input
              id="time"
              type="time"
              value={formData.time || new Date().toTimeString().slice(0, 5)}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>GPS</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Latitude (GPS)"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
              />
              <Input
                type="number"
                placeholder="Longitude (GPS)"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleGetLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              type="text"
              placeholder="Enter location description (optional)"
              value={formData.location || ''}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData, filteredRegions, filteredDistricts, feeders, handleGetLocation, isGettingLocation]);

  // Add pole information section
  const renderPoleInformation = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pole Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="poleId">Pole ID / No. (Range)</Label>
            <Input
              id="poleId"
              value={formData.poleId}
              onChange={(e) => setFormData({ ...formData, poleId: e.target.value })}
              placeholder="Enter pole ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleHeight">Pole Height</Label>
            <Select
              value={formData.poleHeight}
              onValueChange={(value) => setFormData({ ...formData, poleHeight: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pole height" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8m">8m</SelectItem>
                <SelectItem value="9m">9m</SelectItem>
                <SelectItem value="10m">10m</SelectItem>
                <SelectItem value="11m">11m</SelectItem>
                <SelectItem value="14m">14m</SelectItem>
                <SelectItem value="16m">16m</SelectItem>
                <SelectItem value="18m">18m</SelectItem>
                <SelectItem value="20m">20m</SelectItem>
                <SelectItem value="24m">24m</SelectItem>
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleType">Pole Type</Label>
            <Select
              value={formData.poleType}
              onValueChange={(value) => setFormData({ ...formData, poleType: value as any })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pole type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CP">CP - Concrete</SelectItem>
                <SelectItem value="WP">WP - Wood</SelectItem>
                <SelectItem value="SP">SP - Steel Tubular</SelectItem>
                <SelectItem value="ST">ST - Steel Tower</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="groundCondition">Ground Condition</Label>
            <Select
              value={formData.groundCondition}
              onValueChange={value => setFormData({ ...formData, groundCondition: value })}
            >
              <SelectTrigger id="groundCondition">
                <SelectValue placeholder="Select Ground Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Waterlog">Waterlog</SelectItem>
                <SelectItem value="Rocky">Rocky</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Update pole condition section
  const renderPoleCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pole Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleTilted"
              checked={formData.poleCondition.tilted}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, tilted: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleTilted">Tilted</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleBroken"
              checked={formData.poleCondition.broken}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, broken: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleBroken">Broken Pole</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleRotten"
              checked={formData.poleCondition.rotten}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, rotten: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleRotten">Rotten</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleBurnt"
              checked={formData.poleCondition.burnt}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, burnt: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleBurnt">Burnt</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleSubstandard"
              checked={formData.poleCondition.substandard}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, substandard: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleSubstandard">Substandard</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="poleConflictWithLV"
              checked={formData.poleCondition.conflictWithLV}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  poleCondition: { ...formData.poleCondition, conflictWithLV: checked as boolean },
                })
              }
            />
            <Label htmlFor="poleConflictWithLV">Conflict with LV</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="poleNotes">Notes</Label>
            <Textarea
              id="poleNotes"
              value={formData.poleCondition.notes}
              onChange={(e) => setFormData({ ...formData, poleCondition: { ...formData.poleCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Update stay condition section
  const renderStayCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Stay Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayRequiredButNotAvailable"
              checked={formData.stayCondition.requiredButNotAvailable}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, requiredButNotAvailable: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayRequiredButNotAvailable">Required but not available</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayCut"
              checked={formData.stayCondition.cut}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, cut: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayCut">Cut</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayMisaligned"
              checked={formData.stayCondition.misaligned}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, misaligned: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayMisaligned">Misaligned</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="stayDefectiveStay"
              checked={formData.stayCondition.defectiveStay}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  stayCondition: { ...formData.stayCondition, defectiveStay: checked as boolean },
                })
              }
            />
            <Label htmlFor="stayDefectiveStay">Defective Stay (Spread)</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stayNotes">Notes</Label>
            <Textarea
              id="stayNotes"
              value={formData.stayCondition.notes}
              onChange={(e) => setFormData({ ...formData, stayCondition: { ...formData.stayCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add cross arm condition section
  const renderCrossArmCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cross Arm Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmMisaligned"
              checked={formData.crossArmCondition.misaligned}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, misaligned: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmMisaligned">Misaligned</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmBend"
              checked={formData.crossArmCondition.bend}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, bend: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmBend">Bend</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmCorroded"
              checked={formData.crossArmCondition.corroded}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, corroded: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmCorroded">Corroded</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmSubstandard"
              checked={formData.crossArmCondition.substandard}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, substandard: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmSubstandard">Substandard</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crossArmOthers"
              checked={formData.crossArmCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  crossArmCondition: { ...formData.crossArmCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="crossArmOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="crossArmNotes">Notes</Label>
            <Textarea
              id="crossArmNotes"
              value={formData.crossArmCondition.notes}
              onChange={(e) => setFormData({ ...formData, crossArmCondition: { ...formData.crossArmCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add insulator condition section
  const renderInsulatorCondition = useMemo(() => {
    const insulatorTypes = [
      { value: 'pin', label: 'Pin Insulator' },
      { value: 'post', label: 'Post Insulator' },
      { value: 'strain', label: 'Strain Insulator' },
      { value: 'shackle', label: 'Shackle Insulator' },
    ];
    const typeSelected = !!formData.insulatorCondition.insulatorType;
    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Insulator Condition</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insulatorType">Insulator Type</Label>
              <Select
                value={formData.insulatorCondition.insulatorType || ''}
                onValueChange={value => setFormData({
                  ...formData,
                  insulatorCondition: { ...formData.insulatorCondition, insulatorType: value }
                })}
              >
                <SelectTrigger id="insulatorType">
                  <SelectValue placeholder="Select Insulator Type" />
                </SelectTrigger>
                <SelectContent>
                  {insulatorTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorBrokenOrCracked"
                checked={formData.insulatorCondition.brokenOrCracked}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, brokenOrCracked: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorBrokenOrCracked">Broken/Cracked</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorBurntOrFlashOver"
                checked={formData.insulatorCondition.burntOrFlashOver}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, burntOrFlashOver: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorBurntOrFlashOver">Burnt/Flash over</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorShattered"
                checked={formData.insulatorCondition.shattered}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, shattered: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorShattered">Shattered</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insulatorDefectiveBinding"
                checked={formData.insulatorCondition.defectiveBinding}
                disabled={!typeSelected}
                onCheckedChange={(checked) => 
                  setFormData({
                    ...formData,
                    insulatorCondition: { ...formData.insulatorCondition, defectiveBinding: checked as boolean },
                  })
                }
              />
              <Label htmlFor="insulatorDefectiveBinding">Defective Binding</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insulatorNotes">Notes</Label>
              <Textarea
                id="insulatorNotes"
                value={formData.insulatorCondition.notes}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  insulatorCondition: { ...formData.insulatorCondition, notes: e.target.value } 
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [formData]);

  // Add conductor condition section
  const renderConductorCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Conductor Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorLooseConnectors"
              checked={formData.conductorCondition.looseConnectors}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, looseConnectors: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorLooseConnectors">Loose Connectors</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorWeakJumpers"
              checked={formData.conductorCondition.weakJumpers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, weakJumpers: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorWeakJumpers">Weak Jumpers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorBurntLugs"
              checked={formData.conductorCondition.burntLugs}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, burntLugs: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorBurntLugs">Burnt Lugs</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorSaggedLine"
              checked={formData.conductorCondition.saggedLine}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, saggedLine: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorSaggedLine">Sagged Line</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorBroken"
              checked={formData.conductorCondition.broken}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, broken: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorBroken">Broken Conductor</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="conductorUndersized"
              checked={formData.conductorCondition.undersized}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  conductorCondition: { ...formData.conductorCondition, undersized: checked as boolean },
                })
              }
            />
            <Label htmlFor="conductorUndersized">Undersized</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="conductorNotes">Notes</Label>
            <Textarea
              id="conductorNotes"
              value={formData.conductorCondition.notes}
              onChange={(e) => setFormData({ ...formData, conductorCondition: { ...formData.conductorCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add lightning arrester condition section
  const renderLightningArresterCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Lightning Arrester Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterBrokenOrCracked"
              checked={formData.lightningArresterCondition.brokenOrCracked}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, brokenOrCracked: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterBrokenOrCracked">Broken/Cracked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterFlashOver"
              checked={formData.lightningArresterCondition.flashOver}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, flashOver: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterFlashOver">Flash over</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterNoEarthing"
              checked={formData.lightningArresterCondition.noEarthing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, noEarthing: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterNoEarthing">No Earthing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterBypassed"
              checked={formData.lightningArresterCondition.bypassed}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, bypassed: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterBypassed">By-passed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="arresterNoArrester"
              checked={formData.lightningArresterCondition.noArrester}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  lightningArresterCondition: { ...formData.lightningArresterCondition, noArrester: checked as boolean },
                })
              }
            />
            <Label htmlFor="arresterNoArrester">No Arrester</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="arresterNotes">Notes</Label>
            <Textarea
              id="arresterNotes"
              value={formData.lightningArresterCondition.notes}
              onChange={(e) => setFormData({ ...formData, lightningArresterCondition: { ...formData.lightningArresterCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add drop out fuse condition section
  const renderDropOutFuseCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drop Out Fuse/Isolator Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseBrokenOrCracked"
              checked={formData.dropOutFuseCondition.brokenOrCracked}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, brokenOrCracked: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseBrokenOrCracked">Broken/Cracked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseFlashOver"
              checked={formData.dropOutFuseCondition.flashOver}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, flashOver: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseFlashOver">Flash over</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseInsufficientClearance"
              checked={formData.dropOutFuseCondition.insufficientClearance}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, insufficientClearance: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseInsufficientClearance">Insufficient Clearance</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseLooseOrNoEarthing"
              checked={formData.dropOutFuseCondition.looseOrNoEarthing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, looseOrNoEarthing: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseLooseOrNoEarthing">Loose or No Earthing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseCorroded"
              checked={formData.dropOutFuseCondition.corroded}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, corroded: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseCorroded">Corroded</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseLinkedHVFuses"
              checked={formData.dropOutFuseCondition.linkedHVFuses}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, linkedHVFuses: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseLinkedHVFuses">Linked HV Fuses</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="fuseOthers"
              checked={formData.dropOutFuseCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  dropOutFuseCondition: { ...formData.dropOutFuseCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="fuseOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuseNotes">Notes</Label>
            <Textarea
              id="fuseNotes"
              value={formData.dropOutFuseCondition.notes}
              onChange={(e) => setFormData({ ...formData, dropOutFuseCondition: { ...formData.dropOutFuseCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add transformer condition section
  const renderTransformerCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Transformer Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLeakingOil"
              checked={formData.transformerCondition.leakingOil}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, leakingOil: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLeakingOil">Leaking Oil</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLowOilLevel"
              checked={formData.transformerCondition.lowOilLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, lowOilLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLowOilLevel">Low Oil Level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerMissingEarthLeads"
              checked={formData.transformerCondition.missingEarthLeads}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, missingEarthLeads: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerMissingEarthLeads">Missing Earth leads (HV/LV)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerLinkedHVFuses"
              checked={formData.transformerCondition.linkedHVFuses}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, linkedHVFuses: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerLinkedHVFuses">Linked HV Fuses</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerRustedTank"
              checked={formData.transformerCondition.rustedTank}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, rustedTank: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerRustedTank">Rusted Tank</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerCrackedBushing"
              checked={formData.transformerCondition.crackedBushing}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, crackedBushing: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerCrackedBushing">Cracked Bushing</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="transformerOthers"
              checked={formData.transformerCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  transformerCondition: { ...formData.transformerCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="transformerOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transformerNotes">Notes</Label>
            <Textarea
              id="transformerNotes"
              value={formData.transformerCondition.notes}
              onChange={(e) => setFormData({ ...formData, transformerCondition: { ...formData.transformerCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add recloser condition section
  const renderRecloserCondition = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recloser/Sectionalizer (VIT) Condition</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserLowGasLevel"
              checked={formData.recloserCondition.lowGasLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, lowGasLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserLowGasLevel">Low Gas Level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserLowBatteryLevel"
              checked={formData.recloserCondition.lowBatteryLevel}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, lowBatteryLevel: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserLowBatteryLevel">Low Battery level</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserBurntVoltageTransformers"
              checked={formData.recloserCondition.burntVoltageTransformers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, burntVoltageTransformers: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserBurntVoltageTransformers">Burnt Voltage Transformers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserProtectionDisabled"
              checked={formData.recloserCondition.protectionDisabled}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, protectionDisabled: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserProtectionDisabled">Protection Disabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserBypassed"
              checked={formData.recloserCondition.bypassed}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, bypassed: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserBypassed">By-passed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="recloserOthers"
              checked={formData.recloserCondition.others}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  recloserCondition: { ...formData.recloserCondition, others: checked as boolean },
                })
              }
            />
            <Label htmlFor="recloserOthers">Others</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recloserNotes">Notes</Label>
            <Textarea
              id="recloserNotes"
              value={formData.recloserCondition.notes}
              onChange={(e) => setFormData({ ...formData, recloserCondition: { ...formData.recloserCondition, notes: e.target.value } })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add vegetation conflicts section
  const renderVegetationConflicts = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Vegetation Conflicts</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="vegetationClimbers"
              checked={formData.vegetationConflicts.climbers}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  vegetationConflicts: { ...formData.vegetationConflicts, climbers: checked as boolean },
                })
              }
            />
            <Label htmlFor="vegetationClimbers">Climbers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="vegetationTrees"
              checked={formData.vegetationConflicts.trees}
              onCheckedChange={(checked) => 
                setFormData({
                  ...formData,
                  vegetationConflicts: { ...formData.vegetationConflicts, trees: checked as boolean },
                })
              }
            />
            <Label htmlFor="vegetationTrees">Trees</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vegetationNotes">Notes</Label>
            <Textarea
              id="vegetationNotes"
              value={formData.vegetationConflicts.notes}
              onChange={(e) => setFormData({ ...formData, vegetationConflicts: { ...formData.vegetationConflicts, notes: e.target.value } })}
              placeholder="Enter any vegetation-related observations or notes..."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  const renderAdditionalNotes = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
        <div className="space-y-2">
          <Textarea
            value={formData.additionalNotes}
            onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
            placeholder="Enter any additional observations or notes..."
            className="min-h-[100px]"
          />
        </div>
      </CardContent>
    </Card>
  ), [formData]);

  // Add event listeners for offline sync
  useEffect(() => {
    const handleInspectionAdded = (event: CustomEvent) => {
      if (event.detail.type === 'overhead') {
        if (event.detail.status === 'success') {
          toast({ 
            title: "Success", 
            description: "Inspection saved offline successfully" 
          });
        } else {
          toast({ 
            title: "Error", 
            description: event.detail.error || "Failed to save inspection offline",
            variant: "destructive"
          });
        }
      }
    };

    const handleInspectionSynced = (event: CustomEvent) => {
      if (event.detail.status === 'success') {
        toast({ 
          title: "Success", 
          description: "Offline inspection synced successfully" 
        });
      } else {
        toast({ 
          title: "Error", 
          description: event.detail.error || "Failed to sync offline inspection",
          variant: "destructive"
        });
      }
    };

    window.addEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    window.addEventListener('inspectionSynced', handleInspectionSynced as EventListener);

    return () => {
      window.removeEventListener('inspectionAdded', handleInspectionAdded as EventListener);
      window.removeEventListener('inspectionSynced', handleInspectionSynced as EventListener);
    };
  }, [toast]);

  // Add offline status indicator
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      offlineStorage.syncPendingInspections();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineStorage]);

  // Add event listener for offline inspections updates
  useEffect(() => {
    const handleOfflineInspectionsUpdate = (event: CustomEvent) => {
      setOfflineInspections(event.detail.inspections);
    };

    // Load initial offline inspections
    setOfflineInspections(offlineStorage.getOfflineInspections());

    window.addEventListener('offlineInspectionsUpdated', handleOfflineInspectionsUpdate as EventListener);

    return () => {
      window.removeEventListener('offlineInspectionsUpdated', handleOfflineInspectionsUpdate as EventListener);
    };
  }, [offlineStorage]);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Effect to handle video stream when it's available
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play()
          .then(() => {
            console.log('Video playback started');
            setIsVideoReady(true);
          })
          .catch(error => {
            console.error('Error playing video:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to start video playback"
            });
          });
      };
    }
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      console.log('Starting camera...');
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained:', stream);
      
      streamRef.current = stream;
      setCameraStream(stream);
      setIsCapturing(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to access camera. Please check your camera permissions."
      });
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    setCameraStream(null);
    setIsVideoReady(false);
    setIsCapturing(false);
    console.log('Camera stopped');
  };

  // Helper to add timestamp to an image on a canvas and return a data URL
  const addTimestampToImage = (canvas, ctx) => {
    const timestamp = new Date().toLocaleString();
    ctx.font = '24px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const padding = 10;
    const textWidth = ctx.measureText(timestamp).width;
    const x = canvas.width - textWidth - padding;
    const y = canvas.height - padding;
    ctx.fillRect(x - 5, y - 28, textWidth + 10, 32);
    ctx.fillStyle = 'white';
    ctx.fillText(timestamp, x, y);
    return canvas.toDataURL('image/jpeg');
  };

  const captureImage = async () => {
    if (videoRef.current) {
      try {
        // Capture the image immediately
        const baseImage = captureImageWithMetadata(
          videoRef.current,
          `${formData.latitude}, ${formData.longitude}`,
          gpsAccuracy
        );
        
        // Add the image to form data immediately
        setFormData(prev => ({
          ...prev,
          images: [...(Array.isArray(prev.images) ? prev.images : []), baseImage]
        }));
        
        stopCamera();
        toast({
          title: "Success",
          description: "Photo captured successfully!"
        });

        // Get fresh GPS location in the background and update the image
        const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
          return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'));
              return;
            }
            
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                resolve({ latitude, longitude, accuracy });
              },
              (error) => {
                reject(error);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          });
        };

        // Update image with fresh GPS in background using the base image
        getCurrentGPS().then(async gpsData => {
          const updatedImage = await processImageWithMetadata(
            baseImage,
            `${gpsData.latitude}, ${gpsData.longitude}`,
            gpsData.accuracy
          );
          
          // Update the last added image with fresh GPS
          setFormData(prev => ({
            ...prev,
            images: prev.images.map((img, index) => 
              index === prev.images.length - 1 ? updatedImage : img
            )
          }));
          
          toast({
            title: "GPS Updated",
            description: `Photo updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
          });
        }).catch(error => {
          console.error('Error getting GPS for image:', error);
          // Don't show error to user since photo was already captured
        });
        
      } catch (error) {
        console.error('Error capturing image:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to capture image"
        });
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // Process image immediately with current GPS
            const baseImage = await processImageWithMetadata(
              reader.result as string,
              `${formData.latitude}, ${formData.longitude}`,
              gpsAccuracy
            );
            
            // Add image to form data immediately
            setFormData(prev => ({
              ...prev,
              images: [...(Array.isArray(prev.images) ? prev.images : []), baseImage]
            }));
            
            toast({
              title: "Success",
              description: "Image uploaded successfully!"
            });

            // Get fresh GPS location in the background and update the image
            const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
              return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error('Geolocation not supported'));
                  return;
                }
                
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    resolve({ latitude, longitude, accuracy });
                  },
                  (error) => {
                    reject(error);
                  },
                  {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                  }
                );
              });
            };

            // Update image with fresh GPS in background
            getCurrentGPS().then(async gpsData => {
              const updatedImage = await processImageWithMetadata(
                reader.result as string,
                `${gpsData.latitude}, ${gpsData.longitude}`,
                gpsData.accuracy
              );
              
              // Update the last added image with fresh GPS
              setFormData(prev => ({
                ...prev,
                images: prev.images.map((img, index) => 
                  index === prev.images.length - 1 ? updatedImage : img
                )
              }));
              
              toast({
                title: "GPS Updated",
                description: `Image updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
              });
            }).catch(error => {
              console.error('Error getting GPS for uploaded image:', error);
              // Don't show error to user since image was already uploaded
            });
            
          } catch (error) {
            console.error('Error processing uploaded image:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to process uploaded image"
            });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: (Array.isArray(prev.images) ? prev.images : []).filter((_, i) => i !== index)
    }));
  };

  // Update the camera view section
  const renderCameraView = useMemo(() => {
    if (!isCapturing) return null;

    return (
      <div className="relative border-2 border-gray-300 rounded-lg p-2">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full max-w-md rounded-lg bg-black"
          style={{ 
            transform: 'scaleX(-1)',
            minHeight: '300px',
            objectFit: 'cover'
          }}
        />
        {isVideoReady && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <Button
              type="button"
              onClick={captureImage}
              className="bg-white text-black hover:bg-gray-100"
            >
              Capture
            </Button>
            <Button
              type="button"
              onClick={stopCamera}
              variant="destructive"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }, [isCapturing, isVideoReady]);

  // Update the image upload section to use the new camera view
  const renderImageUpload = useMemo(() => (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Images</h3>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={startCamera}
              disabled={isCapturing}
              className="w-full sm:w-auto"
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <div className="relative w-full sm:w-auto">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="image-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('image-upload')?.click()}
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </Button>
            </div>
          </div>

          {renderCameraView}

          {formData.images && formData.images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {formData.images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Inspection image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  ), [formData.images, isCapturing, isVideoReady]);

  const handleAfterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // Process after image immediately with current GPS
            const baseImage = await processImageWithMetadata(
              reader.result as string,
              `${formData.latitude}, ${formData.longitude}`,
              gpsAccuracy
            );
            
            // Add image to form data immediately
            setFormData(prev => ({
              ...prev,
              afterImages: [...(Array.isArray(prev.afterImages) ? prev.afterImages : []), baseImage]
            }));
            
            toast({
              title: "Success",
              description: "After image uploaded successfully!"
            });

            // Get fresh GPS location in the background and update the image
            const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
              return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                  reject(new Error('Geolocation not supported'));
                  return;
                }
                
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    resolve({ latitude, longitude, accuracy });
                  },
                  (error) => {
                    reject(error);
                  },
                  {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                  }
                );
              });
            };

            // Update image with fresh GPS in background
            getCurrentGPS().then(async gpsData => {
              const updatedImage = await processImageWithMetadata(
                reader.result as string,
                `${gpsData.latitude}, ${gpsData.longitude}`,
                gpsData.accuracy
              );
              
              // Update the last added after image with fresh GPS
              setFormData(prev => ({
                ...prev,
                afterImages: prev.afterImages.map((img, index) => 
                  index === prev.afterImages.length - 1 ? updatedImage : img
                )
              }));
              
              toast({
                title: "GPS Updated",
                description: `After image updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
              });
            }).catch(error => {
              console.error('Error getting GPS for uploaded after image:', error);
              // Don't show error to user since image was already uploaded
            });
            
          } catch (error) {
            console.error('Error processing uploaded after image:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to process uploaded after image"
            });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeAfterImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      afterImages: (Array.isArray(prev.afterImages) ? prev.afterImages : []).filter((_, i) => i !== index)
    }));
  };

  const startCameraAfter = async () => {
    setIsCapturingAfter(true);
    setIsVideoReadyAfter(false);
    try {
      cameraStreamAfter = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      if (videoRefAfter.current) {
        videoRefAfter.current.srcObject = cameraStreamAfter;
        videoRefAfter.current.onloadedmetadata = () => setIsVideoReadyAfter(true);
      }
    } catch (err) {
      setIsCapturingAfter(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to access camera for after-correction photo."
      });
    }
  };
  const stopCameraAfter = () => {
    setIsCapturingAfter(false);
    setIsVideoReadyAfter(false);
    if (videoRefAfter.current) {
      videoRefAfter.current.srcObject = null;
    }
    if (cameraStreamAfter) {
      cameraStreamAfter.getTracks().forEach(track => track.stop());
      cameraStreamAfter = null;
    }
  };
  const captureAfterImage = async () => {
    if (videoRefAfter.current) {
      try {
        // Capture the after image immediately
        const baseImage = captureImageWithMetadata(
          videoRefAfter.current,
          `${formData.latitude}, ${formData.longitude}`,
          gpsAccuracy
        );
        
        // Add the image to form data immediately
        setFormData(prev => ({
          ...prev,
          afterImages: [...(Array.isArray(prev.afterImages) ? prev.afterImages : []), baseImage]
        }));
        
        stopCameraAfter();
        toast({
          title: "Success",
          description: "After photo captured successfully!"
        });

        // Get fresh GPS location in the background and update the image
        const getCurrentGPS = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
          return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'));
              return;
            }
            
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                resolve({ latitude, longitude, accuracy });
              },
              (error) => {
                reject(error);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          });
        };

        // Update image with fresh GPS in background using the base image
        getCurrentGPS().then(async gpsData => {
          const updatedImage = await processImageWithMetadata(
            baseImage,
            `${gpsData.latitude}, ${gpsData.longitude}`,
            gpsData.accuracy
          );
          
          // Update the last added after image with fresh GPS
          setFormData(prev => ({
            ...prev,
            afterImages: prev.afterImages.map((img, index) => 
              index === prev.afterImages.length - 1 ? updatedImage : img
            )
          }));
          
          toast({
            title: "GPS Updated",
            description: `After photo updated with fresh GPS! Accuracy: ±${gpsData.accuracy.toFixed(1)} meters`
          });
        }).catch(error => {
          console.error('Error getting GPS for after image:', error);
          // Don't show error to user since photo was already captured
        });
        
      } catch (error) {
        console.error('Error capturing after image:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to capture after image"
        });
      }
    }
  };
  const renderCameraViewAfter = useMemo(() => {
    if (!isCapturingAfter) return null;
    return (
      <div className="relative border-2 border-gray-300 rounded-lg p-2">
        <video
          ref={videoRefAfter}
          autoPlay
          playsInline
          muted
          className="w-full max-w-md rounded-lg bg-black"
          style={{
            transform: 'scaleX(-1)',
            minHeight: '300px',
            objectFit: 'cover'
          }}
        />
        {isVideoReadyAfter && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <Button
              type="button"
              onClick={captureAfterImage}
              className="bg-white text-black hover:bg-gray-100"
            >
              Capture
            </Button>
            <Button
              type="button"
              onClick={stopCameraAfter}
              variant="destructive"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }, [isCapturingAfter, isVideoReadyAfter]);

  const renderAfterImages = useMemo(() => {
    // Only show after images section if there are before images
    if (!formData.images || formData.images.length === 0) {
      return null;
    }

    return (
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">After Inspection Correction Photos</h3>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={startCameraAfter}
                disabled={isCapturingAfter}
                className="w-full sm:w-auto"
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
              <div className="relative w-full sm:w-auto">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAfterImageUpload}
                  className="hidden"
                  id="after-image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('after-image-upload')?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </Button>
              </div>
            </div>
            {renderCameraViewAfter}
            {formData.afterImages && formData.afterImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {formData.afterImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`After Correction image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeAfterImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }, [formData.images, formData.afterImages, isCapturingAfter, isVideoReadyAfter]);

  useEffect(() => {
    if (user && !inspection && (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") && user.region && regions.length > 0 && districts.length > 0) {
      const regionObj = regions.find(r => r.name === user.region);
      if (regionObj) {
        const regionDistricts = districts.filter(d => d.regionId === regionObj.id);
        if (regionDistricts.length > 0 && !formData.district) {
          setFormData(prev => ({
            ...prev,
            region: user.region,
            district: regionDistricts[0].name,
            inspector: {
              id: user.id,
              name: user.name,
              email: user.email
            }
          }));
        }
      }
    }
  }, [user, inspection, regions, districts, formData.district]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {inspection ? "Edit Network Inspection" : "New Network Inspection"}
          </h2>
          {isOffline && (
            <div className="mt-1">
              <p className="text-sm text-yellow-600">
                You are currently offline. Changes will be saved locally and synced when you're back online.
              </p>
              {offlineInspections.length > 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  You have {offlineInspections.length} inspection{offlineInspections.length === 1 ? '' : 's'} saved offline.
                </p>
              )}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={handleCancelClick}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {renderInspectorInfo}
        {renderBasicInformation}
        {renderPoleInformation}
        {renderPoleCondition}
        {renderStayCondition}
        {renderCrossArmCondition}
        {renderInsulatorCondition}
        {renderConductorCondition}
        {renderLightningArresterCondition}
        {renderDropOutFuseCondition}
        {renderTransformerCondition}
        {renderRecloserCondition}
        {renderVegetationConflicts}
        {renderAdditionalNotes}
        {renderImageUpload}
        {renderAfterImages}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={handleCancelClick}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {inspection ? "Updating..." : "Submitting..."}
              </>
            ) : (
              inspection ? "Update Inspection" : "Submit Inspection"
            )}
          </Button>
        </div>
      </form>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Inspection</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this inspection? All unsaved changes will be lost and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCancel}>
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Cancel Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 