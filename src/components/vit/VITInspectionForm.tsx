import { useState, useEffect, useRef, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, WifiOff, Camera, Upload, X } from "lucide-react";
import { VITInspectionChecklist, VITAsset, YesNoOption, GoodBadOption } from "@/lib/types";
import { toast } from "react-hot-toast";
import { serverTimestamp } from "firebase/firestore";
import { OfflineInspectionService } from "@/services/OfflineInspectionService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Webcam from "react-webcam";

interface VITInspectionFormProps {
  inspectionData?: VITInspectionChecklist;
  assetId?: string;
  onSubmit: (data: Partial<VITInspectionChecklist>) => void;
  onCancel: () => void;
}

export function VITInspectionForm({
  inspectionData,
  assetId,
  onSubmit,
  onCancel,
}: VITInspectionFormProps) {
  const { vitAssets, addVITInspection, updateVITInspection, regions, districts } = useData();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const offlineStorage = OfflineInspectionService.getInstance();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineInspections, setOfflineInspections] = useState<VITInspectionChecklist[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>(
    inspectionData?.photoUrls || []
  );
  const [showFullImage, setShowFullImage] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Form fields
  const [selectedAssetId, setSelectedAssetId] = useState<string>(assetId || inspectionData?.vitAssetId || "");
  const [inspectionDate, setInspectionDate] = useState(
    inspectionData?.inspectionDate ? new Date(inspectionData.inspectionDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [inspectedBy, setInspectedBy] = useState(
    inspectionData?.inspectedBy || user?.name || ""
  );

  // Checklist items
  const [rodentTermiteEncroachment, setRodentTermiteEncroachment] = useState<YesNoOption | undefined>(
    inspectionData?.rodentTermiteEncroachment
  );
  const [cleanDustFree, setCleanDustFree] = useState<YesNoOption | undefined>(
    inspectionData?.cleanDustFree
  );
  const [protectionButtonEnabled, setProtectionButtonEnabled] = useState<YesNoOption | undefined>(
    inspectionData?.protectionButtonEnabled
  );
  const [recloserButtonEnabled, setRecloserButtonEnabled] = useState<YesNoOption | undefined>(
    inspectionData?.recloserButtonEnabled
  );
  const [groundEarthButtonEnabled, setGroundEarthButtonEnabled] = useState<YesNoOption | undefined>(
    inspectionData?.groundEarthButtonEnabled
  );
  const [acPowerOn, setAcPowerOn] = useState<YesNoOption | undefined>(
    inspectionData?.acPowerOn
  );
  const [batteryPowerLow, setBatteryPowerLow] = useState<YesNoOption | undefined>(
    inspectionData?.batteryPowerLow
  );
  const [handleLockOn, setHandleLockOn] = useState<YesNoOption | undefined>(
    inspectionData?.handleLockOn
  );
  const [remoteButtonEnabled, setRemoteButtonEnabled] = useState<YesNoOption | undefined>(
    inspectionData?.remoteButtonEnabled
  );
  const [gasLevelLow, setGasLevelLow] = useState<YesNoOption | undefined>(
    inspectionData?.gasLevelLow
  );
  const [earthingArrangementAdequate, setEarthingArrangementAdequate] = useState<YesNoOption | undefined>(
    inspectionData?.earthingArrangementAdequate
  );
  const [noFusesBlown, setNoFusesBlown] = useState<YesNoOption | undefined>(
    inspectionData?.noFusesBlown
  );
  const [noDamageToBushings, setNoDamageToBushings] = useState<YesNoOption | undefined>(
    inspectionData?.noDamageToBushings
  );
  const [noDamageToHVConnections, setNoDamageToHVConnections] = useState<YesNoOption | undefined>(
    inspectionData?.noDamageToHVConnections
  );
  const [insulatorsClean, setInsulatorsClean] = useState<YesNoOption | undefined>(
    inspectionData?.insulatorsClean
  );
  const [paintworkAdequate, setPaintworkAdequate] = useState<YesNoOption | undefined>(
    inspectionData?.paintworkAdequate
  );
  const [ptFuseLinkIntact, setPtFuseLinkIntact] = useState<YesNoOption | undefined>(
    inspectionData?.ptFuseLinkIntact
  );
  const [noCorrosion, setNoCorrosion] = useState<YesNoOption | undefined>(
    inspectionData?.noCorrosion
  );
  const [silicaGelCondition, setSilicaGelCondition] = useState<GoodBadOption | undefined>(
    inspectionData?.silicaGelCondition
  );
  const [correctLabelling, setCorrectLabelling] = useState<YesNoOption | undefined>(
    inspectionData?.correctLabelling
  );
  const [remarks, setRemarks] = useState(inspectionData?.remarks || "");

  // Asset details
  const [selectedAsset, setSelectedAsset] = useState<VITAsset | null>(null);

  // When assetId changes, update the selectedAsset
  useEffect(() => {
    if (selectedAssetId) {
      const asset = vitAssets.find(asset => asset.id === selectedAssetId);
      if (asset) {
        setSelectedAsset(asset);
      }
    }
  }, [selectedAssetId, vitAssets]);

  // Add event listeners for offline sync
  useEffect(() => {
    const handleInspectionAdded = (event: CustomEvent) => {
      if (event.detail.type === 'vit') {
        if (event.detail.status === 'success') {
          toast.success("Inspection saved offline successfully");
        } else {
          toast.error(event.detail.error || "Failed to save inspection offline");
        }
      }
    };

    const handleInspectionSynced = (event: CustomEvent) => {
      if (event.detail.status === 'success') {
        toast.success("Offline inspection synced successfully");
      } else {
        toast.error(event.detail.error || "Failed to sync offline inspection");
      }
    };

    window.addEventListener('inspectionAdded', handleInspectionAdded as EventListener);
    window.addEventListener('inspectionSynced', handleInspectionSynced as EventListener);

    return () => {
      window.removeEventListener('inspectionAdded', handleInspectionAdded as EventListener);
      window.removeEventListener('inspectionSynced', handleInspectionSynced as EventListener);
    };
  }, []);

  // Add offline status indicator
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

  // Filter assets based on user role
  const filteredAssets = vitAssets.filter(asset => {
    if (user?.role === "global_engineer" || user?.role === "system_admin") return true;
    if (user?.role === "regional_engineer" && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      return userRegion ? asset.region === userRegion.name : false;
    }
    if ((user?.role === "district_engineer" || user?.role === "technician") && user.region && user.district) {
      const userRegion = regions.find(r => r.name === user.region);
      const userDistrict = districts.find(d => d.name === user.district);
      return userRegion && userDistrict ? 
        asset.region === userRegion.name && asset.district === userDistrict.name : false;
    }
    return false;
  });

  // Handle asset selection
  const handleAssetChange = (value: string) => {
    setSelectedAssetId(value);
  };

  // Calculate issues count
  const calculateIssuesCount = () => {
    let count = 0;
    
    if (rodentTermiteEncroachment === "Yes") count++;
    if (cleanDustFree === "No") count++;
    if (protectionButtonEnabled === "No") count++;
    if (recloserButtonEnabled === "No") count++;
    if (groundEarthButtonEnabled === "No") count++;
    if (acPowerOn === "No") count++;
    if (batteryPowerLow === "Yes") count++;
    if (handleLockOn === "No") count++;
    if (remoteButtonEnabled === "No") count++;
    if (gasLevelLow === "Yes") count++;
    if (earthingArrangementAdequate === "No") count++;
    if (noFusesBlown === "No") count++;
    if (noDamageToBushings === "No") count++;
    if (noDamageToHVConnections === "No") count++;
    if (insulatorsClean === "No") count++;
    if (paintworkAdequate === "No") count++;
    if (ptFuseLinkIntact === "No") count++;
    if (noCorrosion === "No") count++;
    if (silicaGelCondition === "Bad") count++;
    if (correctLabelling === "No") count++;
    
    return count;
  };

  // Check if device is mobile
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: isMobile ? "environment" : "user"
  };

  const handleCameraError = useCallback((error: any) => {
    console.error('Camera Error:', error);
    setCameraError(error.message || 'Failed to access camera');
    toast.error(
      'Camera access failed. Please check permissions and try again.',
      {
        duration: 5000,
        description: error.message || "Make sure your camera is not being used by another application"
      }
    );
  }, []);

  const captureImage = useCallback(() => {
    if (webcamRef.current) {
      try {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          setCapturedImages(prev => [...prev, imageSrc]);
          setIsCapturing(false);
          toast.success('Photo captured successfully!');
        } else {
          toast.error('Failed to capture image. Please try again.');
        }
      } catch (error) {
        console.error('Error capturing image:', error);
        toast.error('Failed to capture image. Please try again.');
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setCapturedImages(prev => [...prev, base64String]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAsset) {
      toast.error("Please select an asset");
      return;
    }

    if (!inspectionDate || !inspectedBy) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const timestamp = new Date().toISOString();
      const newInspectionData: Omit<VITInspectionChecklist, 'id'> = {
        vitAssetId: selectedAsset.id,
        region: selectedAsset.region,
        district: selectedAsset.district,
        inspectionDate,
        inspectedBy,
        remarks,
        photoUrls: capturedImages,
        rodentTermiteEncroachment: rodentTermiteEncroachment || "No",
        cleanDustFree: cleanDustFree || "No",
        protectionButtonEnabled: protectionButtonEnabled || "No",
        recloserButtonEnabled: recloserButtonEnabled || "No",
        groundEarthButtonEnabled: groundEarthButtonEnabled || "No",
        acPowerOn: acPowerOn || "No",
        batteryPowerLow: batteryPowerLow || "No",
        handleLockOn: handleLockOn || "No",
        remoteButtonEnabled: remoteButtonEnabled || "No",
        gasLevelLow: gasLevelLow || "No",
        earthingArrangementAdequate: earthingArrangementAdequate || "No",
        noFusesBlown: noFusesBlown || "No",
        noDamageToBushings: noDamageToBushings || "No",
        noDamageToHVConnections: noDamageToHVConnections || "No",
        insulatorsClean: insulatorsClean || "No",
        paintworkAdequate: paintworkAdequate || "No",
        ptFuseLinkIntact: ptFuseLinkIntact || "No",
        noCorrosion: noCorrosion || "No",
        silicaGelCondition: silicaGelCondition || "Good",
        correctLabelling: correctLabelling || "No",
        createdBy: user?.email || "unknown",
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const isOnline = navigator.onLine;
      console.log('[VITInspectionForm] Internet available:', isOnline);

      if (isOnline) {
        if (inspectionData?.id) {
          // Only update if we have a valid ID and the inspection exists
          try {
            await updateVITInspection(inspectionData.id, newInspectionData);
            toast.success("Inspection updated successfully");
          } catch (error) {
            console.error('[VITInspectionForm] Error updating inspection:', error);
            // If update fails, try to create a new inspection
            console.log('[VITInspectionForm] Attempting to create new inspection instead...');
            await addVITInspection(newInspectionData);
            toast.success("Inspection saved successfully");
          }
        } else {
          // Add new inspection
          await addVITInspection(newInspectionData);
          toast.success("Inspection saved successfully");
        }
      } else {
        console.log('[VITInspectionForm] Saving inspection offline...');
        try {
          await offlineStorage.saveInspectionOffline(newInspectionData);
          toast.success("Inspection saved offline. It will be synced when internet connection is restored.");
        } catch (error) {
          console.error('[VITInspectionForm] Error saving inspection offline:', error);
          toast.error("Failed to save inspection offline. Please try again when you have internet connection.");
          throw error;
        }
      }

      // Call onSubmit with the complete data including the photo
      onSubmit({
        ...newInspectionData,
        photoUrls: capturedImages
      });
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast.error("Failed to save inspection. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const issuesCount = calculateIssuesCount();

  return (
    <Card className="w-full">
      <CardHeader className="p-3 sm:p-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
          {inspectionData ? "Edit VIT Inspection" : "New VIT Inspection"}
        </CardTitle>
        {isOffline && (
          <div className="mt-1">
            <p className="text-xs sm:text-sm text-yellow-600">
              You are currently offline. Changes will be saved locally and synced when you're back online.
            </p>
            {offlineInspections.length > 0 && (
              <p className="text-xs sm:text-sm text-yellow-600 mt-1">
                You have {offlineInspections.length} inspection{offlineInspections.length === 1 ? '' : 's'} saved offline.
              </p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2 sm:p-4 max-w-full overflow-x-hidden">
        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-4">
          <div className="space-y-2 sm:space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-4">
              <div className="space-y-1">
                <Label htmlFor="assetSelect" className="text-xs sm:text-sm">VIT Asset *</Label>
                <Select
                  value={selectedAssetId}
                  onValueChange={handleAssetChange}
                  disabled={true}
                  required
                >
                  <SelectTrigger className="w-full h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Select VIT Asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAssets.map(asset => (
                      <SelectItem key={asset.id} value={asset.id} className="w-full text-xs sm:text-sm">
                        {asset.serialNumber} - {asset.typeOfUnit} ({asset.voltageLevel})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="inspectionDate" className="text-xs sm:text-sm">Inspection Date & Time *</Label>
                <Input
                  id="inspectionDate"
                  type="datetime-local"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  required
                  disabled={true}
                  className="w-full h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="inspectedBy" className="text-xs sm:text-sm">Inspected By *</Label>
              <Input
                id="inspectedBy"
                value={inspectedBy}
                onChange={(e) => setInspectedBy(e.target.value)}
                placeholder="Enter name of inspector"
                required
                disabled={true}
                className="w-full h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>

            {selectedAsset && (
              <div className="rounded-md bg-muted/50 p-3 sm:p-4 space-y-2 text-sm">
                <div className="font-medium">Asset Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <span className="font-medium">Type:</span> {selectedAsset.typeOfUnit}
                  </div>
                  <div>
                    <span className="font-medium">Voltage:</span> {selectedAsset.voltageLevel}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {selectedAsset.status}
                  </div>
                  <div className="sm:col-span-2 md:col-span-3">
                    <span className="font-medium">Location:</span> {selectedAsset.location}
                  </div>
                </div>
              </div>
            )}

            {issuesCount > 0 && (
              <Alert variant="destructive" className="bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {issuesCount} {issuesCount === 1 ? "issue" : "issues"} detected with this VIT asset
                </AlertDescription>
              </Alert>
            )}

            <Separator className="my-4" />
            
            <Accordion type="single" collapsible className="w-full" defaultValue="section-1">
              <AccordionItem value="section-1">
                <AccordionTrigger className="text-base">Cubicle and Protection</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Rodent/termite encroachments of cubicle</Label>
                    <RadioGroup
                      value={rodentTermiteEncroachment}
                      onValueChange={(val) => setRodentTermiteEncroachment(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="rodent-yes" />
                        <Label htmlFor="rodent-yes" className="text-red-500 font-medium">Yes (Issue)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="rodent-no" />
                        <Label htmlFor="rodent-no" className="text-green-500 font-medium">No (OK)</Label>
                      </div>
                    </RadioGroup>
                    {rodentTermiteEncroachment === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Clean and dust free compartments</Label>
                    <RadioGroup
                      value={cleanDustFree}
                      onValueChange={(val) => setCleanDustFree(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="clean-yes" />
                        <Label htmlFor="clean-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="clean-no" />
                        <Label htmlFor="clean-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {cleanDustFree === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Is protection button enabled</Label>
                    <RadioGroup
                      value={protectionButtonEnabled}
                      onValueChange={(val) => setProtectionButtonEnabled(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="protection-yes" />
                        <Label htmlFor="protection-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="protection-no" />
                        <Label htmlFor="protection-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {protectionButtonEnabled === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Is recloser button enabled</Label>
                    <RadioGroup
                      value={recloserButtonEnabled}
                      onValueChange={(val) => setRecloserButtonEnabled(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="recloser-yes" />
                        <Label htmlFor="recloser-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="recloser-no" />
                        <Label htmlFor="recloser-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {recloserButtonEnabled === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Is GROUND/EARTH button enabled</Label>
                    <RadioGroup
                      value={groundEarthButtonEnabled}
                      onValueChange={(val) => setGroundEarthButtonEnabled(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="ground-yes" />
                        <Label htmlFor="ground-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="ground-no" />
                        <Label htmlFor="ground-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {groundEarthButtonEnabled === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="section-2">
                <AccordionTrigger>Power and Controls</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Is AC power ON</Label>
                    <RadioGroup
                      value={acPowerOn}
                      onValueChange={(val) => setAcPowerOn(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="acpower-yes" />
                        <Label htmlFor="acpower-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="acpower-no" />
                        <Label htmlFor="acpower-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {acPowerOn === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Is Battery Power Low</Label>
                    <RadioGroup
                      value={batteryPowerLow}
                      onValueChange={(val) => setBatteryPowerLow(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="battery-yes" />
                        <Label htmlFor="battery-yes" className="text-red-500 font-medium">Yes (Issue)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="battery-no" />
                        <Label htmlFor="battery-no" className="text-green-500 font-medium">No (OK)</Label>
                      </div>
                    </RadioGroup>
                    {batteryPowerLow === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Is Handle Lock ON</Label>
                    <RadioGroup
                      value={handleLockOn}
                      onValueChange={(val) => setHandleLockOn(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="lock-yes" />
                        <Label htmlFor="lock-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="lock-no" />
                        <Label htmlFor="lock-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {handleLockOn === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Is remote button enabled</Label>
                    <RadioGroup
                      value={remoteButtonEnabled}
                      onValueChange={(val) => setRemoteButtonEnabled(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="remote-yes" />
                        <Label htmlFor="remote-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="remote-no" />
                        <Label htmlFor="remote-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {remoteButtonEnabled === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Is Gas Level Low</Label>
                    <RadioGroup
                      value={gasLevelLow}
                      onValueChange={(val) => setGasLevelLow(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="gas-yes" />
                        <Label htmlFor="gas-yes" className="text-red-500 font-medium">Yes (Issue)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="gas-no" />
                        <Label htmlFor="gas-no" className="text-green-500 font-medium">No (OK)</Label>
                      </div>
                    </RadioGroup>
                    {gasLevelLow === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="section-3">
                <AccordionTrigger>Physical Condition</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Earthing arrangement adequate</Label>
                    <RadioGroup
                      value={earthingArrangementAdequate}
                      onValueChange={(val) => setEarthingArrangementAdequate(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="earthing-yes" />
                        <Label htmlFor="earthing-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="earthing-no" />
                        <Label htmlFor="earthing-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {earthingArrangementAdequate === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>No fuses blown in control cubicle</Label>
                    <RadioGroup
                      value={noFusesBlown}
                      onValueChange={(val) => setNoFusesBlown(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="fuses-yes" />
                        <Label htmlFor="fuses-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="fuses-no" />
                        <Label htmlFor="fuses-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {noFusesBlown === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>No damage to bushings or insulators</Label>
                    <RadioGroup
                      value={noDamageToBushings}
                      onValueChange={(val) => setNoDamageToBushings(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="bushings-yes" />
                        <Label htmlFor="bushings-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="bushings-no" />
                        <Label htmlFor="bushings-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {noDamageToBushings === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>No damage to H.V. connections</Label>
                    <RadioGroup
                      value={noDamageToHVConnections}
                      onValueChange={(val) => setNoDamageToHVConnections(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="hvconn-yes" />
                        <Label htmlFor="hvconn-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="hvconn-no" />
                        <Label htmlFor="hvconn-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {noDamageToHVConnections === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Insulators clean</Label>
                    <RadioGroup
                      value={insulatorsClean}
                      onValueChange={(val) => setInsulatorsClean(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="insulators-yes" />
                        <Label htmlFor="insulators-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="insulators-no" />
                        <Label htmlFor="insulators-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {insulatorsClean === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="section-4">
                <AccordionTrigger>Maintenance Status</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Paintwork adequate</Label>
                    <RadioGroup
                      value={paintworkAdequate}
                      onValueChange={(val) => setPaintworkAdequate(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="paint-yes" />
                        <Label htmlFor="paint-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="paint-no" />
                        <Label htmlFor="paint-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {paintworkAdequate === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>PT fuse link intact</Label>
                    <RadioGroup
                      value={ptFuseLinkIntact}
                      onValueChange={(val) => setPtFuseLinkIntact(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="ptfuse-yes" />
                        <Label htmlFor="ptfuse-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="ptfuse-no" />
                        <Label htmlFor="ptfuse-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {ptFuseLinkIntact === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>No corrosion on equipment</Label>
                    <RadioGroup
                      value={noCorrosion}
                      onValueChange={(val) => setNoCorrosion(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="corrosion-yes" />
                        <Label htmlFor="corrosion-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="corrosion-no" />
                        <Label htmlFor="corrosion-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {noCorrosion === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Condition of silica gel</Label>
                    <RadioGroup
                      value={silicaGelCondition}
                      onValueChange={(val) => setSilicaGelCondition(val as GoodBadOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Good" id="silica-good" />
                        <Label htmlFor="silica-good" className="text-green-500 font-medium">Good</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Bad" id="silica-bad" />
                        <Label htmlFor="silica-bad" className="text-red-500 font-medium">Bad</Label>
                      </div>
                    </RadioGroup>
                    {silicaGelCondition === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Check for correct labelling and warning notices</Label>
                    <RadioGroup
                      value={correctLabelling}
                      onValueChange={(val) => setCorrectLabelling(val as YesNoOption)}
                      className="flex flex-col sm:flex-row gap-3 sm:gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Yes" id="label-yes" />
                        <Label htmlFor="label-yes" className="text-green-500 font-medium">Yes (OK)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="No" id="label-no" />
                        <Label htmlFor="label-no" className="text-red-500 font-medium">No (Issue)</Label>
                      </div>
                    </RadioGroup>
                    {correctLabelling === undefined && (
                      <p className="text-sm text-muted-foreground mt-1">Please select an option</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator className="my-4" />

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any additional observations or notes"
                rows={4}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Inspection Photos</Label>
              <div className="flex flex-col gap-4">
                {capturedImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {capturedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={image} 
                          alt={`Inspection photo ${index + 1}`} 
                          className="w-full h-32 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setShowFullImage(image)}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCapturing(true)}
                    className="w-full sm:flex-1"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:flex-1"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photos
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 w-full px-0">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Inspection"
              )}
            </Button>
          </CardFooter>
        </form>
      </CardContent>

      {/* Camera Dialog */}
      <Dialog open={isCapturing} onOpenChange={(open) => {
        if (!open) {
          setCameraError(null);
        }
        setIsCapturing(open);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Take Photo</DialogTitle>
            <DialogDescription>
              Take a photo of the inspection. Make sure the area is clearly visible and well-lit.
            </DialogDescription>
            {cameraError && (
              <p className="text-sm text-red-500 mt-2">
                Error: {cameraError}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative aspect-video bg-black">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                onUserMediaError={handleCameraError}
                className="w-full h-full rounded-md object-cover"
                mirrored={!isMobile}
                imageSmoothing={true}
              />
            </div>
            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCapturing(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={captureImage}
                disabled={!!cameraError}
              >
                Capture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Image Dialog */}
      <Dialog open={!!showFullImage} onOpenChange={(open) => !open && setShowFullImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <div className="relative w-full h-full">
            {showFullImage && (
              <img 
                src={showFullImage} 
                alt="Full inspection view" 
                className="w-full h-full object-contain"
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 bg-background/80 hover:bg-background"
              onClick={() => setShowFullImage(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
