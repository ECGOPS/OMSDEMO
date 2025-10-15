import { useState, useEffect, useRef, useCallback } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { VITAsset, VITStatus, VoltageLevel } from "@/lib/types";
import { Loader2, MapPin, Camera, Upload, Info, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { db } from "@/config/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { LocationMap } from "./LocationMap";
import { FeederService } from "@/services/FeederService";

interface VITAssetFormProps {
  asset?: VITAsset;
  onSubmit: () => void;
  onCancel: () => void;
}

interface FeederInfo {
  id: string;
  name: string;
  bsp: string;
  bspPss: string;
  regionId: string;
  districtId: string;
}

export function VITAssetForm({ asset, onSubmit, onCancel }: VITAssetFormProps) {
  const { regions, districts, addVITAsset, updateVITAsset, vitAssets } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [serialNumberError, setSerialNumberError] = useState<string | null>(null);
  const [feeders, setFeeders] = useState<FeederInfo[]>([]);
  const [selectedFeeder, setSelectedFeeder] = useState<string>("");
  const [feederSearch, setFeederSearch] = useState("");
  const [isFeederDropdownOpen, setIsFeederDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const feederService = FeederService.getInstance();

  const [regionId, setRegionId] = useState<string>(
    asset ? regions.find(r => r.name === asset.region)?.id || "" : ""
  );
  const [districtId, setDistrictId] = useState<string>(
    asset ? districts.find(d => d.name === asset.district)?.id || "" : ""
  );
  const [voltageLevel, setVoltageLevel] = useState<VoltageLevel>(asset?.voltageLevel || "11KV");
  const [typeOfUnit, setTypeOfUnit] = useState(asset?.typeOfUnit || "");
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber || "");
  const [location, setLocation] = useState(asset?.location || "");
  const [gpsCoordinates, setGpsCoordinates] = useState(asset?.gpsCoordinates || "");
  const [status, setStatus] = useState<VITStatus>(asset?.status || "Operational");
  const [protection, setProtection] = useState(asset?.protection || "");
  const [photoUrl, setPhotoUrl] = useState(asset?.photoUrl || "");
  const [feederName, setFeederName] = useState(asset?.feederName || "");
  const [formData, setFormData] = useState<Partial<VITAsset>>({
    region: asset?.region || "",
    district: asset?.district || "",
    voltageLevel: asset?.voltageLevel || "11KV",
    typeOfUnit: asset?.typeOfUnit || "",
    serialNumber: asset?.serialNumber || "",
    location: asset?.location || "",
    gpsCoordinates: asset?.gpsCoordinates || "",
    status: asset?.status || "Operational",
    protection: asset?.protection || "",
    photoUrl: asset?.photoUrl || "",
    feederName: asset?.feederName || "",
    createdBy: user?.email || "unknown"
  });

  // Initialize region and district based on user's assigned values or existing asset
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const initializeData = async () => {
      try {
        // If editing an existing asset, use its values
        if (asset) {
          if (isMounted) {
            // Find the region and district IDs based on their names
            const existingRegion = regions.find(r => r.name === asset.region);
            const existingDistrict = districts.find(d => d.name === asset.district);
            
            if (existingRegion) {
              setRegionId(existingRegion.id);
              setFormData(prev => ({ ...prev, region: asset.region }));
              
              // Set district after region is set
              if (existingDistrict) {
                setDistrictId(existingDistrict.id);
                setFormData(prev => ({ ...prev, district: asset.district }));
              }
            }
          }
        }
        // For technical roles, set based on user's assigned values
        else if (user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "district_manager" || user?.role === "regional_general_manager") {
          const userRegion = regions.find(r => r.name === user.region);
          if (userRegion && isMounted) {
            setRegionId(userRegion.id);
            setFormData(prev => ({ ...prev, region: user.region }));
            
            if ((user.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district) {
              const userDistrict = districts.find(d => 
                d.regionId === userRegion.id && d.name === user.district
              );
              if (userDistrict && isMounted) {
                setDistrictId(userDistrict.id);
                setFormData(prev => ({ ...prev, district: user.district }));
              }
            }
          }
        }
      } catch (error) {
        console.error("Error initializing region/district data:", error);
        if (retryCount < maxRetries && isMounted) {
          retryCount++;
          setTimeout(initializeData, 1000 * retryCount);
        } else {
          toast.error("Failed to load region/district data. Please refresh the page.");
        }
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, [user, regions, districts, asset]);

  // Add a new effect to handle district initialization when region changes
  useEffect(() => {
    if (asset && regionId) {
      const existingDistrict = districts.find(d => 
        d.regionId === regionId && d.name === asset.district
      );
      if (existingDistrict) {
        setDistrictId(existingDistrict.id);
        setFormData(prev => ({ ...prev, district: asset.district }));
      }
    }
  }, [regionId, districts, asset]);

  // Ensure district engineer's, technician's, and district manager's district is always set correctly
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const updateDistrict = async () => {
      try {
        // Only update district for district engineers, technicians, and district managers
        if ((user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district && !asset) {
          const userRegion = regions.find(r => r.name === user.region);
          if (userRegion && isMounted) {
            const userDistrict = districts.find(d => 
              d.regionId === userRegion.id && d.name === user.district
            );
            if (userDistrict && userDistrict.id !== districtId && isMounted) {
              setDistrictId(userDistrict.id);
              setFormData(prev => ({ ...prev, district: user.district }));
            }
          }
        }
      } catch (error) {
        console.error("Error updating district data:", error);
        if (retryCount < maxRetries && isMounted) {
          retryCount++;
          setTimeout(updateDistrict, 1000 * retryCount);
        } else {
          toast.error("Failed to update district data. Please refresh the page.");
        }
      }
    };

    updateDistrict();

    return () => {
      isMounted = false;
    };
  }, [user, regions, districts, districtId, asset]);

  // Fetch feeders when region changes
  useEffect(() => {
    const fetchFeeders = async () => {
      if (!regionId) {
        setFeeders([]);
        return;
      }

      try {
        // Use FeederService for offline support
        const feedersData = await feederService.getFeedersByRegion(regionId);
        setFeeders(feedersData);

        // If editing an existing asset, find and set the selected feeder
        if (asset?.feederName) {
          const existingFeeder = feedersData.find(f => f.name === asset.feederName);
          if (existingFeeder) {
            setSelectedFeeder(existingFeeder.id);
          }
        }
      } catch (error) {
        console.error("Error fetching feeders:", error);
        toast.error("Failed to load feeders");
      }
    };

    fetchFeeders();
  }, [regionId, asset?.feederName, feederService]);

  // Update feeder name when feeder changes
  useEffect(() => {
    if (selectedFeeder) {
      const feeder = feeders.find(f => f.id === selectedFeeder);
      if (feeder) {
        setFeederName(feeder.name);
      }
    } else {
      setFeederName("");
    }
  }, [selectedFeeder, feeders]);

  // Filter feeders based on search
  const filteredFeeders = feeders.filter(feeder => 
    feeder.name.toLowerCase().includes(feederSearch.toLowerCase())
  );

  // Handle search input focus
  const handleSearchFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isFeederDropdownOpen) {
      setIsFeederDropdownOpen(true);
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeederSearch(e.target.value);
  };

  // Handle search input keydown
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  // Add this effect to handle focus
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isFeederDropdownOpen && window.innerWidth > 768) { // Only auto-focus on desktop
      timeoutId = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isFeederDropdownOpen]);

  // Filter regions and districts based on user role
  const filteredRegions = user?.role === "global_engineer"
    ? regions
    : regions.filter(r => user?.region ? r.name === user.region : true);
  
  const filteredDistricts = regionId
    ? districts.filter(d => {
        // First check if district belongs to selected region
        if (d.regionId !== regionId) return false;
        
        // For district engineers, technicians, and district managers, only show their assigned district
        if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") {
          return d.name === user.district;
        }
        
        // For regional engineers and regional general managers, only show districts in their region
        if (user?.role === "regional_engineer" || user?.role === "regional_general_manager") {
          const userRegion = regions.find(r => r.name === user.region);
          return userRegion ? d.regionId === userRegion.id : false;
        }
        
        // For other roles, show all districts in the selected region
        return true;
      })
    : [];
  
  const handleGetLocation = () => {
    console.log("=== Geolocation Debug Logs ===");
    console.log("Browser Info:", {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language
    });
    
    // Check if we're in a secure context
    if (!window.isSecureContext) {
      console.error("Geolocation requires a secure context (HTTPS)");
      toast.error("Geolocation requires a secure connection (HTTPS). Please contact your administrator.");
      return;
    }
    
    console.log("Geolocation API Available:", !!navigator.geolocation);
    console.log("Permissions API Available:", !!navigator.permissions);
    
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      console.error("Geolocation API not supported by browser");
      setIsGettingLocation(false);
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    // Check if we can access the permissions API
    if (navigator.permissions && navigator.permissions.query) {
      console.log("Checking geolocation permission status...");
      navigator.permissions.query({ name: 'geolocation' })
        .then(permissionStatus => {
          console.log("Initial permission status:", permissionStatus.state);
          
          // Log when permission state changes
          permissionStatus.onchange = () => {
            console.log("Permission state changed to:", permissionStatus.state);
          };
        })
        .catch(err => {
          console.error("Error checking permission status:", err);
        });
    } else {
      console.log("Permissions API not available, cannot check permission status");
    }

    // First try with high accuracy
    const highAccuracyOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const lowAccuracyOptions = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 0
    };

    const tryGetLocation = (options: PositionOptions) => {
      console.log("Attempting to get location with options:", JSON.stringify(options));
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Location obtained successfully:", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: new Date(position.timestamp).toISOString()
          });
          
          const { latitude, longitude } = position.coords;
          const accuracy = position.coords.accuracy;
          
          // Format coordinates without spaces
          setGpsCoordinates(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
          setIsGettingLocation(false);
          toast.success("Location obtained successfully!");
          
          if (accuracy > 100) {
            toast.warning(`Location accuracy is ${Math.round(accuracy)} meters. Consider moving to an open area for better accuracy.`);
          }
        },
        (error) => {
          console.error("Geolocation error details:", {
            code: error.code,
            message: error.message,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT,
            browser: navigator.userAgent,
            platform: navigator.platform,
            vendor: navigator.vendor,
            secureContext: window.isSecureContext,
            protocol: window.location.protocol,
            hostname: window.location.hostname
          });

          if (options.enableHighAccuracy && error.code === error.TIMEOUT) {
            console.log("High accuracy location timed out, trying low accuracy...");
            toast.info("High accuracy location timed out. Trying with lower accuracy...");
            tryGetLocation(lowAccuracyOptions);
            return;
          }

          setIsGettingLocation(false);
          let errorMessage = "Could not get your location. ";
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              if (error.message.includes("permissions policy")) {
                console.log("Geolocation blocked by permissions policy");
                errorMessage = "Geolocation is blocked by your browser's permissions policy. Please follow these steps:";
                toast.error(errorMessage, {
                  duration: 10000,
                  description: (
                    <div className="space-y-2">
                      <p>1. Open Chrome Settings</p>
                      <p>2. Go to Privacy and Security → Site Settings</p>
                      <p>3. Find "Location" under Permissions</p>
                      <p>4. Make sure it's set to "Ask before accessing" or "Allowed"</p>
                      <p>5. Refresh the page and try again</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        If the issue persists, you may need to:
                        <br />- Clear your browser cache
                        <br />- Check if any extensions are blocking location access
                        <br />- Try using a different browser
                      </p>
                    </div>
                  )
                });
              } else {
                console.log("Permission denied error details:", {
                  browser: navigator.userAgent,
                  platform: navigator.platform,
                  vendor: navigator.vendor,
                  secureContext: window.isSecureContext,
                  protocol: window.location.protocol,
                  hostname: window.location.hostname
                });
                errorMessage = "Location access was denied. Please follow these steps:";
                toast.error(errorMessage, {
                  duration: 10000,
                  description: (
                    <div className="space-y-2">
                      <p>1. Click the lock/info icon in your address bar</p>
                      <p>2. Find 'Location' in site settings</p>
                      <p>3. Change to 'Allow'</p>
                      <p>4. Refresh the page and try again</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        If you're using Chrome on Android, you may also need to:
                        <br />- Go to Settings → Site Settings → Location
                        <br />- Find this website and set it to 'Allow'
                      </p>
                    </div>
                  )
                });
              }
              break;
            case error.POSITION_UNAVAILABLE:
              console.log("Position unavailable error details:", {
                browser: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                secureContext: window.isSecureContext,
                protocol: window.location.protocol,
                hostname: window.location.hostname
              });
              errorMessage += "Location information is unavailable. Please check your GPS settings and ensure you're not in airplane mode. On some devices, an internet connection may be required for automatic detection. You can enter coordinates manually below.";
              toast.error(errorMessage);
              break;
            case error.TIMEOUT:
              console.log("Timeout error details:", {
                browser: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                secureContext: window.isSecureContext,
                protocol: window.location.protocol,
                hostname: window.location.hostname
              });
              errorMessage += "Location request timed out. Please check your internet connection and try again.";
              toast.error(errorMessage);
              break;
            default:
              console.log("Unknown error details:", {
                browser: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                secureContext: window.isSecureContext,
                protocol: window.location.protocol,
                hostname: window.location.hostname
              });
              errorMessage += "Please try again or enter coordinates manually.";
              toast.error(errorMessage);
          }
        },
        options
      );
    };

    // Start with high accuracy
    console.log("Initiating high accuracy location request...");
    tryGetLocation(highAccuracyOptions);
  };
  
  // Add validation for serial number
  const validateSerialNumber = (value: string) => {
    if (!value) {
      setSerialNumberError("Serial number is required");
      return false;
    }
    
    // Check for duplicates only when adding a new asset
    if (!asset) {
      const isDuplicate = vitAssets.some(
        existingAsset => 
          existingAsset.serialNumber.toLowerCase() === value.toLowerCase() &&
          existingAsset.id !== asset?.id
      );
      
      if (isDuplicate) {
        setSerialNumberError("This serial number already exists. Please use a different one.");
        return false;
      }
    }
    
    setSerialNumberError(null);
    return true;
  };

  // Update serial number handler
  const handleSerialNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSerialNumber(value);
    validateSerialNumber(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    console.log("Entering handleSubmit for VITAssetForm");
    e.preventDefault();
    
    if (!regionId || !districtId || !serialNumber || !typeOfUnit || !location || !voltageLevel) {
      toast.error("Please fill all required fields");
      return;
    }

    // Validate serial number before submitting
    if (!validateSerialNumber(serialNumber)) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get the region and district names
      const selectedRegion = filteredRegions.find(r => r.id === regionId);
      const selectedDistrict = filteredDistricts.find(d => d.id === districtId);

      if (!selectedRegion || !selectedDistrict) {
        toast.error("Invalid region or district selection");
        return;
      }

      const assetData = {
        region: selectedRegion.name,
        district: selectedDistrict.name,
        voltageLevel,
        typeOfUnit,
        serialNumber,
        location,
        gpsCoordinates,
        status,
        protection,
        photoUrl: capturedImage || photoUrl,
        feederName,
        createdBy: user?.email || "unknown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "VIT" as const,
        syncStatus: "created" as const,
        ...(asset?.originalOfflineId ? { originalOfflineId: asset.originalOfflineId } : {})
      };
      
      console.log("Submitting asset data:", assetData);
      
      if (asset) {
        // Update existing asset
        console.log("Updating asset:", asset.id);
        await updateVITAsset(asset.id, assetData);
        toast.success("Asset updated successfully");
      } else {
        // Add new asset
        console.log("Adding new asset");
        const isOnline = navigator.onLine;
        
        if (isOnline) {
          await addVITAsset(assetData);
          toast.success("Asset added successfully");
        } else {
          // Save offline and dispatch event
          const offlineAsset = await addVITAsset(assetData);
          // Dispatch custom event for offline asset
          window.dispatchEvent(new CustomEvent('assetAdded', {
            detail: {
              type: 'vit',
              asset: {
                ...assetData,
                id: offlineAsset,
                syncStatus: 'created'
              },
              status: 'success'
            }
          }));
          toast.success("Asset saved offline. It will be synced when internet connection is restored.");
        }
      }
      
      // Only reset form if it's a new asset
      if (!asset) {
        setVoltageLevel("11KV");
        setTypeOfUnit("");
        setSerialNumber("");
        setLocation("");
        setGpsCoordinates("");
        setStatus("Operational");
        setProtection("");
        setPhotoUrl("");
        setCapturedImage(null);
      }

      // Call onSubmit to close the form after successful save
      onSubmit();
    } catch (error) {
      console.error("Error submitting VIT asset:", error);
      toast.error("Failed to save asset. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Detect if user is on mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(mobile);
    };
    checkMobile();
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
          setCapturedImage(imageSrc);
          setPhotoUrl(imageSrc);
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

  // Handle region change - prevent district engineers, technicians, and district managers from changing region
  const handleRegionChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") return; // Prevent district engineers, technicians, and district managers from changing region
    
    setRegionId(value);
    const region = regions.find(r => r.id === value);
    setFormData(prev => ({ ...prev, region: region?.name || "" }));
    setDistrictId("");
    setFormData(prev => ({ ...prev, district: "" }));
  };

  // Handle district change - prevent district engineers, technicians, and district managers from changing district
  const handleDistrictChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") return; // Prevent district engineers, technicians, and district managers from changing district
    
    setDistrictId(value);
    const district = districts.find(d => d.id === value);
    setFormData(prev => ({ ...prev, district: district?.name || "" }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCapturedImage(base64String);
        setPhotoUrl(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Update the Dialog component to ensure proper cleanup
  useEffect(() => {
    // Cleanup function to ensure camera is stopped when dialog is closed
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{asset ? "Edit VIT Asset" : "Add New VIT Asset"}</CardTitle>
      </CardHeader>
      <CardContent className="bg-card">
        <form id="vit-asset-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Select 
                value={regionId} 
                onValueChange={handleRegionChange}
                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "district_manager" || user?.role === "regional_general_manager"}
                required
              >
                <SelectTrigger id="region" className="w-full">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRegions.map(region => (
                    <SelectItem key={region.id} value={region.id || "unknown-region"} className="w-full">
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="district">District *</Label>
              <Select 
                value={districtId} 
                onValueChange={handleDistrictChange}
                disabled={user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager" || !regionId}
                required
              >
                <SelectTrigger id="district" className="w-full">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDistricts.map(district => (
                    <SelectItem key={district.id} value={district.id || "unknown-district"} className="w-full">
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="feederName">Feeder Name *</Label>
            <Select
              value={selectedFeeder}
              onValueChange={(value) => {
                setSelectedFeeder(value);
                const feeder = feeders.find(f => f.id === value);
                if (feeder) {
                  setFeederName(feeder.name);
                }
              }}
              disabled={!regionId}
              open={isFeederDropdownOpen}
              onOpenChange={(open) => {
                if (window.innerWidth > 768) { // Only auto-close on desktop
                  setIsFeederDropdownOpen(open);
                } else {
                  setIsFeederDropdownOpen(true); // Keep open on mobile
                }
              }}
            >
              <SelectTrigger id="feederName" className="w-full">
                <SelectValue placeholder="Select feeder" />
              </SelectTrigger>
              <SelectContent 
                className="max-h-[300px]"
                position="popper"
                sideOffset={4}
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                }}
                onPointerDownOutside={(e) => {
                  if (window.innerWidth > 768) { // Only close on desktop
                    e.preventDefault();
                    setIsFeederDropdownOpen(false);
                  }
                }}
              >
                <div className="sticky top-0 bg-background z-10 border-b p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search feeders..."
                      value={feederSearch}
                      onChange={handleSearchChange}
                      onFocus={handleSearchFocus}
                      onKeyDown={handleSearchKeyDown}
                      className="h-9 pl-9 pr-9 bg-background/50 border-muted focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                      autoFocus={window.innerWidth > 768}
                    />
                    {feederSearch && (
                      <button
                        onClick={() => {
                          setFeederSearch("");
                          if (searchInputRef.current) {
                            searchInputRef.current.focus();
                          }
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {window.innerWidth <= 768 && (
                    <button
                      onClick={() => setIsFeederDropdownOpen(false)}
                      className="absolute right-2 top-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-[250px]">
                  {filteredFeeders.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No feeders found
                    </div>
                  ) : (
                    filteredFeeders.map((feeder) => (
                      <SelectItem 
                        key={feeder.id} 
                        value={feeder.id}
                        onSelect={(e) => {
                          e.preventDefault();
                          setSelectedFeeder(feeder.id);
                          const selectedFeeder = feeders.find(f => f.id === feeder.id);
                          if (selectedFeeder) {
                            setFeederName(selectedFeeder.name);
                          }
                          if (window.innerWidth > 768) { // Only close on desktop
                            setIsFeederDropdownOpen(false);
                          }
                        }}
                      >
                        {feeder.name}
                      </SelectItem>
                    ))
                  )}
                </div>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="voltageLevel">Voltage Level *</Label>
              <Select 
                value={voltageLevel} 
                onValueChange={(val) => setVoltageLevel(val as VoltageLevel)}
                required
              >
                <SelectTrigger id="voltageLevel" className="w-full">
                  <SelectValue placeholder="Select voltage level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="11KV">11KV</SelectItem>
                  <SelectItem value="33KV">33KV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select 
                value={status} 
                onValueChange={(val) => setStatus(val as VITStatus)}
                required
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operational">Operational</SelectItem>
                  <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                  <SelectItem value="Faulty">Faulty</SelectItem>
                  <SelectItem value="Decommissioned">Decommissioned</SelectItem>
                  <SelectItem value="Not started">Not started</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="typeOfUnit">Type of Unit *</Label>
              <Select 
                value={typeOfUnit} 
                onValueChange={(val) => setTypeOfUnit(val)}
              >
                <SelectTrigger id="typeOfUnit" className="w-full">
                  <SelectValue placeholder="Select type of unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Recloser">Recloser</SelectItem>
                  <SelectItem value="LBS">LBS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number *</Label>
              <Input
                id="serialNumber"
                value={serialNumber}
                onChange={handleSerialNumberChange}
                placeholder="E.g., RMU2023-001"
                required
                className={`w-full ${serialNumberError ? 'border-red-500' : ''}`}
              />
              {serialNumberError && (
                <p className="text-sm text-red-500 mt-1">{serialNumberError}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="E.g., Main Street Substation"
              required
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="gpsCoordinates" className="flex items-center gap-1">
              GPS Coordinates
              <span title="On some devices and browsers, automatic location may require an internet connection. You can enter coordinates manually if needed.">
                <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="gpsCoordinates"
                value={gpsCoordinates}
                onChange={(e) => setGpsCoordinates(e.target.value)}
                placeholder="e.g., 5.603717, -0.186964"
                className="w-full"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
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
            <div className="mt-4">
              <LocationMap 
                coordinates={gpsCoordinates} 
                assetName={`VIT Asset ${serialNumber}`}
                onLocationChange={(lat, lng) => setGpsCoordinates(`${lat.toFixed(6)},${lng.toFixed(6)}`)}
                isEditable={true}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="protection">Protection</Label>
            <Select 
              value={protection} 
              onValueChange={(val) => setProtection(val)}
            >
              <SelectTrigger id="protection" className="w-full">
                <SelectValue placeholder="Select protection status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Protection Enable">Protection Enable</SelectItem>
                <SelectItem value="Protection Disable">Protection Disable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Asset Photo</Label>
            <div className="flex flex-col gap-4">
              {capturedImage && (
                <div className="relative">
                  <img 
                    src={capturedImage} 
                    alt="Captured asset" 
                    className="w-full h-48 object-cover rounded-md"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setCapturedImage(null);
                      setPhotoUrl("");
                    }}
                  >
                    Remove
                  </Button>
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
                  Upload Photo
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </Button>
              </div>
            </div>
          </div>
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 w-full">
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
                asset ? "Update Asset" : "Add Asset"
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
              Take a photo of the VIT asset using your camera. Make sure the asset is clearly visible and well-lit.
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
    </Card>
  );
}
