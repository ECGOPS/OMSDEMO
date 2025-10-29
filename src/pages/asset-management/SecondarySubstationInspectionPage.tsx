import { useState, useEffect, useMemo, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { v4 as uuidv4 } from "uuid";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ConditionStatus, InspectionItem } from "@/lib/types";
import { SecondarySubstationInspection } from "@/lib/asset-types"; // Assuming a type for secondary inspection
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useNavigate, useParams, Link } from "react-router-dom";
import { SubstationInspectionService } from "@/services/SubstationInspectionService"; // Reuse the service or create a new one
import { ChevronLeft, ChevronRight, ChevronRightIcon, Camera, Upload, X } from "lucide-react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Webcam from "react-webcam";
import { processImageWithMetadata, captureImageWithMetadata } from "@/utils/imageUtils";

interface Category {
  id: string;
  name: string;
  items: SecondaryInspectionItem[];
}

// Extend InspectionItem locally to include options for select fields
interface SecondaryInspectionItem extends InspectionItem {
  options?: string[];
}

// Add a helper function at the top of the file
function getValidTimeFromDate(dateString?: string): string {
  if (!dateString) return new Date().toISOString().split('T')[1].slice(0,5);
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? new Date().toISOString().split('T')[1].slice(0,5) : date.toISOString().split('T')[1].slice(0,5);
}

export default function SecondarySubstationInspectionPage() {
  const { user } = useAuth();
  const { regions, districts, saveInspection, getSavedInspection, updateSubstationInspection } = useData(); 
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const inspectionService = SubstationInspectionService.getInstance(); // Reuse service
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(inspectionService.isInternetAvailable());
  const [regionId, setRegionId] = useState<string>("");
  const [districtId, setDistrictId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showFullImage, setShowFullImage] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Function to upload image to cloud storage
  const uploadImageToStorage = async (base64Image: string, inspectionId: string, imageIndex: number, isAfterImage: boolean = false): Promise<string> => {
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
      const fileName = `substation-inspections/${inspectionId}/image_${imageIndex}_${Date.now()}.jpg`;
      const storageRef = ref(getStorage(), fileName);
      
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
  
  // Add state for after-correction camera
  const [isCapturingAfter, setIsCapturingAfter] = useState(false);
  const [afterImages, setAfterImages] = useState<string[]>(() => []);
  const videoRefAfter = useRef<HTMLVideoElement>(null);
  const [isVideoReadyAfter, setIsVideoReadyAfter] = useState(false);
  let cameraStreamAfter: MediaStream | null = null;
  const [gpsAccuracy, setGpsAccuracy] = useState<number | undefined>(undefined);
  const [formData, setFormData] = useState<SecondarySubstationInspection>({
    id: id || uuidv4(),
    date: new Date().toISOString().split('T')[0],
    time: new Date().toISOString().split('T')[1].slice(0,5),
    inspectionDate: new Date().toISOString().split('T')[0],
    substationNo: "",
    substationName: "",
    type: "secondary", // Fixed type for this page
    location: "",
    region: "",
    district: "",
    regionId: "",
    districtId: "",
    voltageLevel: "",
    remarks: "",
    createdBy: user?.name || "Unknown",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inspectedBy: user?.name || "Unknown",
    status: "Pending",
    // Initialize other fields from the form data
    siteCondition: [],
    transformer: [],
    areaFuse: [],
    arrestors: [],
    switchgear: [],
    distributionEquipment: [],
    paintWork: []
  });
  const [categories, setCategories] = useState<Category[]>([]);

  // Add video constraints
  const videoConstraints = {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

  // Handle camera error
  const handleCameraError = (error: string | DOMException) => {
    console.error('Camera error:', error);
    setCameraError(error.toString());
    toast.error("Failed to access camera. Please check your camera permissions.");
  };

  // Capture image from webcam with metadata
  const captureImage = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        try {
          const processedImage = await processImageWithMetadata(
            imageSrc,
            formData.gpsLocation,
            gpsAccuracy
          );
          setCapturedImages(prev => [...prev, processedImage]);
          setIsCapturing(false);
          setCameraError(null);
        } catch (error) {
          console.error('Error processing image:', error);
          toast.error('Failed to process image with metadata');
        }
      }
    }
  };

  // Handle file upload with metadata
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const processedImage = await processImageWithMetadata(
              reader.result as string,
              formData.gpsLocation,
              gpsAccuracy
            );
            setCapturedImages(prev => [...prev, processedImage]);
          } catch (error) {
            console.error('Error processing uploaded image:', error);
            toast.error('Failed to process uploaded image with metadata');
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Add functions for after images with metadata
  const handleAfterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const processedImage = await processImageWithMetadata(
              reader.result as string,
              formData.gpsLocation,
              gpsAccuracy
            );
            setAfterImages(prev => [...prev, processedImage]);
          } catch (error) {
            console.error('Error processing uploaded after image:', error);
            toast.error('Failed to process uploaded after image with metadata');
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeAfterImage = (index: number) => {
    setAfterImages(prev => prev.filter((_, i) => i !== index));
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
      toast.error("Failed to access camera for after-correction photo.");
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
        const processedImage = captureImageWithMetadata(
          videoRefAfter.current,
          formData.gpsLocation,
          gpsAccuracy
        );
        setAfterImages(prev => [...prev, processedImage]);
        stopCameraAfter();
      } catch (error) {
        console.error('Error capturing after image:', error);
        toast.error('Failed to capture after image with metadata');
      }
    }
  };



  // Update formData when capturedImages changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      images: capturedImages
    }));
  }, [capturedImages]);

  // Always sync afterImages to formData
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      afterImages: afterImages
    }));
  }, [afterImages]);

  // Add the photo section to the form
  const renderPhotoSection = () => (
    <div className="space-y-6">
      {/* Before Inspection Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Before Inspection Photos</CardTitle>
          <CardDescription>Take or upload photos of the inspection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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

            {capturedImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {capturedImages.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Inspection image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg cursor-pointer"
                      onClick={() => setShowFullImage(image)}
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

      {/* After Inspection Photos - Only show if there are before images */}
      {capturedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>After Inspection Correction Photos</CardTitle>
            <CardDescription>Take or upload photos after corrections have been made</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCameraAfter}
                  disabled={isCapturingAfter}
                  className="w-full sm:flex-1"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:flex-1"
                  onClick={() => document.getElementById('after-file-upload')?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photos
                  <input
                    id="after-file-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAfterImageUpload}
                  />
                </Button>
              </div>

              {/* After Camera View */}
              {isCapturingAfter && (
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
              )}

              {afterImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {afterImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`After Correction image ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer"
                        onClick={() => setShowFullImage(image)}
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
      )}
    </div>
  );

  // Define the inspection items based on the provided list
  const defaultItems: Category[] = [
    {
      id: "site-condition",
      name: "Site Condition",
      items: [
        { id: uuidv4(), name: "Surroundings of Substation", category: "siteCondition", options: ["Bushy", "Untidy", "Tidy"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Substation Building", category: "siteCondition", options: ["Cracked", "Roofing leakage"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Doors and Padlocks", category: "siteCondition", options: ["Broken doors", "Padlock out of place"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "General condition of Room", category: "siteCondition", options: ["Dusty", "Cobweb", "Untidy"], status: undefined, remarks: "" },
      ],
    },
    {
      id: "transformer",
      name: "Transformer",
      items: [
        { id: uuidv4(), name: "Gerneral state of transformer", category: "transformer", options: ["Good", "Bad"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Name Plate", category: "transformer", options: ["Faded", "Painted", "Not In Place"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Transformer oil Level", category: "transformer", options: ["Below Minimum", "Normal", "Above Maximum"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Oil Leakage", category: "transformer", options: ["Bushing", "LV stud", "Gauge", "Valve/Fins"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Silica Gel", category: "transformer", options: ["Blue", "Pink", "White"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Transformer Earth bonding", category: "transformer", options: ["In Place", "Cut", "Removed"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Nuetral Earth", category: "transformer", options: ["In Place", "Cut", "Removed"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Tap Position", category: "transformer", options: ["Tap One", "Tap Two", "Tap Three", "Tap Four", "Tap Five"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Transformer Bushing", category: "transformer", options: ["Cracked", "Flash over", "Dusty"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Oil Gauge", category: "transformer", options: ["Cracked", "Good Condition"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Breather", category: "transformer", options: ["Good", "Bad", "Not in place"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Arcing Horns", category: "transformer", options: ["Rusted", "Not In place", "imapproprate Diemension"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Stud condition", category: "transformer", options: ["Normal", "Bad", "Darken"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Stud worked on before", category: "transformer", options: ["Yes", "No"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Stud phase worked on", category: "transformer", options: ["Red", "Yellow", "Blue"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Transformer Fins", category: "transformer", options: ["Rusted", "Leakage", "Good condition"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Transformer Seat", category: "transformer", options: ["Firmly seated", "Bracket not in place", "Tilted"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Transformer Cabling", category: "transformer", options: ["Tensioned on stud", "Frayed"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Cable Termination on transformer", category: "transformer", options: ["Firmly Tighten", "loose tighten"], status: undefined, remarks: "" },
      ],
    },
    {
      id: "area-fuse",
      name: "Area Fuse",
      items: [
        { id: uuidv4(), name: "Area Fuse Cabling", category: "areaFuse", options: ["Properly Arranged", "Improperly Arranged"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Area Fuse termination", category: "areaFuse", options: ["Logged", "Not logged"], status: undefined, remarks: "" },
      ],
    },
    {
      id: "arrestors",
      name: "Arrestors",
      items: [
        { id: uuidv4(), name: "Arrestor shattered", category: "arrestors", options: ["Yes", "No."], status: undefined, remarks: "" },
        { id: uuidv4(), name: "If yes, which phase", category: "arrestors", options: ["Red", "Yellow", "Blue"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Arrestors Earth", category: "arrestors", options: ["In place", "Cut", "Removed"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Arrestor Position", category: "arrestors", options: ["On Transformer tank", "Line"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Franklin Arrestors", category: "arrestors", options: ["In Place", "Not In Place"], status: undefined, remarks: "" },
      ],
    },
    {
      id: "switchgear",
      name: "Switchgear",
      items: [
        { id: uuidv4(), name: "Expulsion Fusegear", category: "switchgear", options: ["In Place", "Not In Place", "Linked", "Not linked"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Linked Expulsion fuse", category: "switchgear", options: ["Red", "Yellow", "Blue"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Ring Main Unit State", category: "switchgear", options: ["Good", "Bad"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Extensible switch condition", category: "switchgear", options: ["Good", "Bad"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Swich oil level", category: "switchgear", options: ["Below Minimum", "Nornal", "Above Maximum"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Switch leakage", category: "switchgear", options: ["Gauge", "LV Busing", "HV Bushing", "Cable Ends"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Cable Ends / Termination", category: "switchgear", options: ["Tracking", "Loose contact", "Flashover", "Oil leakage"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "End Cap", category: "switchgear", options: ["Well Positioned", "Well Tightened", "Not well Positioned", "Loose Tightened"], status: undefined, remarks: "" },
      ],
    },
    {
      id: "distribution-equipment",
      name: "Distribution Equipment",
      items: [
        { id: uuidv4(), name: "Type of distribution equipment", category: "distributionEquipment", options: ["Distribution Pillar (Fused)", "Distribution Panel (MCCB)", "Aerial Fuse"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Number of circuit", category: "distributionEquipment", options: ["1", "2", "3", "4", "5", "6", "7", "8"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "If fuse state condition", category: "distributionEquipment", options: ["Good", "Linked"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "State number of fuse linked", category: "distributionEquipment", options: ["1", "2", "3", "4", "5", "6", "7", "8"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Number of fuse holders", category: "distributionEquipment", options: ["1", "2", "3", "4", "5", "6", "7", "8"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "Is DP rusty", category: "distributionEquipment", options: ["Yes", "No"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "DP Plint condition", category: "distributionEquipment", options: ["Good", "Bad"], status: undefined, remarks: "" },
        { id: uuidv4(), name: "DP Earth condition", category: "distributionEquipment", options: ["Intact", "Missing"], status: undefined, remarks: "" },
      ],
    },
    {
      id: "paint-work",
      name: "Paint Work",
      items: [
        { id: uuidv4(), name: "Paint Work on Equipment", category: "paintWork", options: ["Adequate", "Inadequate"], status: undefined, remarks: "" },
      ],
    },
  ];

  // Update item status (similar logic as primary form)
  const updateItemStatus = (categoryIndex: number, itemIndex: number, status: string | undefined) => {
    setCategories(prevCategories => {
      const newCategories = [...prevCategories];
      newCategories[categoryIndex] = {
        ...newCategories[categoryIndex],
        items: newCategories[categoryIndex].items.map((item, index) =>
          index === itemIndex ? { ...item, status } : item
        ),
      };
      return newCategories;
    });

    // Update formData with the changed category
    const categoryName = categories[categoryIndex].id;
    setFormData(prev => ({
      ...prev,
      [categoryName]: categories[categoryIndex].items.map((item, index) =>
        index === itemIndex ? { ...item, status } : item
      ),
    }));
  };

  // Update item remarks (similar logic as primary form)
  const updateItemRemarks = (categoryIndex: number, itemIndex: number, remarks: string) => {
    setCategories(prevCategories => {
      const newCategories = [...prevCategories];
      newCategories[categoryIndex] = {
        ...newCategories[categoryIndex],
        items: newCategories[categoryIndex].items.map((item, index) =>
          index === itemIndex ? { ...item, remarks } : item
        ),
      };
      return newCategories;
    });

    // Also update formData
    const categoryName = categories[categoryIndex].id;
     setFormData(prev => ({
      ...prev,
      [categoryName]: categories[categoryIndex].items.map((item, index) =>
        index === itemIndex ? { ...item, remarks } : item
      ),
    }));
  };

  // Initialize region and district based on user's assigned values (similar logic)
  useEffect(() => {
    if (
      user?.role === "district_engineer" ||
      user?.role === "regional_engineer" ||
      user?.role === "regional_general_manager" ||
      user?.role === "technician" ||
      user?.role === "district_manager"
    ) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        setRegionId(userRegion.id);
        setFormData(prev => ({ ...prev, region: userRegion.name }));

        if ((user.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district) {
          const userDistrict = districts.find(d => 
            d.regionId === userRegion.id && d.name === user.district
          );
          if (userDistrict) {
            setDistrictId(userDistrict.id);
            setFormData(prev => ({ ...prev, district: userDistrict.name }));
          }
        }
        // For regional_engineer and regional_general_manager, set district to first in region if available
        if ((user.role === "regional_engineer" || user.role === "regional_general_manager") && !user.district) {
          const regionDistricts = districts.filter(d => d.regionId === userRegion.id);
          if (regionDistricts.length > 0) {
            setDistrictId(regionDistricts[0].id);
            setFormData(prev => ({ ...prev, district: regionDistricts[0].name }));
          }
        }
      }
    }
  }, [user, regions, districts]);

  // Ensure district engineer's, technician's, and district manager's district is always set correctly (similar logic)
  useEffect(() => {
    if ((user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") && user.district && user.region) {
      const userRegion = regions.find(r => r.name === user.region);
      if (userRegion) {
        const userDistrict = districts.find(d => 
          d.regionId === userRegion.id && d.name === user.district
        );
        if (userDistrict) {
          setRegionId(userRegion.id);
          setDistrictId(userDistrict.id);
          setFormData(prev => ({ 
            ...prev,
            region: userRegion.name,
            district: userDistrict.name
          }));
        }
      }
    }
  }, [user, regions, districts]);

   // Filter regions and districts based on user role (similar logic)
  const filteredRegions = (user?.role === "global_engineer" || user?.role === "system_admin")
    ? regions
    : user?.role === "ashsub_t"
    ? regions.filter(r => 
        ['SUBTRANSMISSION ASHANTI', 'ASHANTI EAST REGION', 'ASHANTI WEST REGION', 'ASHANTI SOUTH REGION'].includes(r.name)
      )
    : user?.role === "accsub_t"
    ? regions.filter(r => 
        ['ACCRA EAST REGION', 'ACCRA WEST REGION', 'SUBTRANSMISSION ACCRA'].includes(r.name)
      )
    : regions.filter(r => user?.region ? r.name === user.region : true);
  
  const filteredDistricts = regionId
    ? districts.filter(d => {
        if (d.regionId !== regionId) return false;
        
        // For ashsub_t and accsub_t, show all districts in their allowed regions
        if (user?.role === "ashsub_t" || user?.role === "accsub_t") {
          return true; // All districts in selected region are visible
        }
        
        if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") {
          return d.name === user.district;
        }
        
        if (user?.role === "regional_engineer" || user?.role === "regional_general_manager") {
          const userRegion = regions.find(r => r.name === user.region);
          return userRegion ? d.regionId === userRegion.id : false;
        }
        
        return true;
      })
    : [];

  // Handle region change - prevent district engineers, technicians, and district managers from changing region (similar logic)
  const handleRegionChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager" || user?.role === "regional_general_manager") return; 
    
    setRegionId(value);
    const region = regions.find(r => r.id === value);
    setFormData(prev => ({ ...prev, region: region?.name || "" }));
    setDistrictId("");
    setFormData(prev => ({ ...prev, district: "" }));
  };

  // Handle district change - prevent district engineers, technicians, and district managers from changing district (similar logic)
  const handleDistrictChange = (value: string) => {
    if (user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager") return; 
    
    setDistrictId(value);
    const district = districts.find(d => d.id === value);
    setFormData(prev => ({ ...prev, district: district?.name || "" }));
  };

  // Handle generic form input changes
  const handleInputChange = (field: keyof SecondarySubstationInspection, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

   // Add a new useEffect to handle district loading when region changes
  useEffect(() => {
    if (regionId && id) {
      const inspection = getSavedInspection(id);
      if (inspection && String(inspection.type) === "secondary") {
        const district = districts.find(d => d.id === inspection.districtId);
        if (district) {
          setDistrictId(district.id);
          setFormData(prev => ({
            ...prev,
            district: district.name,
            districtId: district.id
          }));
        }
      }
    }
  }, [regionId, districts, id]);

  // Initialize formData with categories and potentially load existing data if editing
  useEffect(() => {
    if (id) {
      // Load the inspection by id
      const inspection = getSavedInspection(id);
      if (inspection && inspection.type && String(inspection.type) === "secondary") {
        // Map saved inspection items to the correct checklist structure
        const itemsWithSavedStatus = defaultItems.map(category => ({
          ...category,
          items: category.items.map(item => {
            // Find the saved item by name in the corresponding category
            const savedItem = (inspection[item.category] || []).find((saved: any) => saved.name === item.name);
            return {
              ...item,
              status: savedItem ? savedItem.status : undefined,
              remarks: savedItem ? savedItem.remarks : ""
            };
          })
        }));
        setCategories(itemsWithSavedStatus);
        // Prepare formData with all fields from inspection and mapped items
        const initialFormData = itemsWithSavedStatus.reduce((acc, category) => {
          (acc as any)[category.id] = category.items;
          return acc;
        }, {});

        // Set region first
        const region = regions.find(r => r.id === inspection.regionId);
        if (region) {
          setRegionId(region.id);
          setFormData(prev => ({
            ...prev,
            region: region.name,
            regionId: region.id
          }));
        }

        // Set the rest of the form data
        setFormData(prev => ({
          ...prev,
          ...inspection,
          time: inspection.time || getValidTimeFromDate(inspection.createdAt),
          transformer: initialFormData["transformer"],
          areaFuse: initialFormData["area-fuse"],
          arrestors: initialFormData["arrestors"],
          switchgear: initialFormData["switchgear"],
          distributionEquipment: initialFormData["distribution-equipment"],
          paintWork: initialFormData["paint-work"],
          siteCondition: initialFormData["site-condition"],
          type: "secondary"
        }));

        // Load captured images and after images if they exist
        if (inspection.images && inspection.images.length > 0) {
          setCapturedImages(inspection.images);
        }
        // Always set afterImages, even if empty
        setAfterImages(Array.isArray(inspection.afterImages) ? inspection.afterImages : []);
        return;
      }
    }
    // New inspection logic (or fallback if not found or not secondary)
    const itemsWithIds = defaultItems.map(category => ({
      ...category,
      items: category.items.map(item => ({ ...item, id: item.id || uuidv4() }))
    }));
    setCategories(itemsWithIds);
    const initialFormData = itemsWithIds.reduce((acc, category) => {
      (acc as any)[category.id] = category.items;
      return acc;
    }, {});
    setFormData(prev => ({
      ...prev,
      ...initialFormData,
      id: uuidv4(),
      type: "secondary",
      date: new Date().toISOString().split('T')[0],
      inspectionDate: new Date().toISOString().split('T')[0],
      createdBy: user?.name || "Unknown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inspectedBy: user?.name || "Unknown",
      status: "Pending"
    }));
    setAfterImages([]); // Always initialize to empty array for new inspections
  }, [id, user]);

   // Add online status listener (similar logic)
  useEffect(() => {
    const handleOnlineStatusChange = () => {
      setIsOnline(inspectionService.isInternetAvailable());
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regionId || !districtId) {
      toast.error("Region and District are required.");
      return;
    }
    setIsSubmitting(true);

    try {
      const selectedRegionName = regions.find(r => r.id === regionId)?.name || "";
      const selectedDistrictName = districts.find(d => d.id === districtId)?.name || "";

      const inspectionData: SecondarySubstationInspection = {
        ...formData,
        time: formData.time || new Date().toISOString().split('T')[1].slice(0,5),
        region: selectedRegionName,
        regionId: regionId,
        district: selectedDistrictName,
        districtId: districtId,
        type: "secondary",
        // Ensure all category items are included
        siteCondition: categories.find(c => c.id === 'site-condition')?.items || [],
        transformer: categories.find(c => c.id === 'transformer')?.items || [],
        areaFuse: categories.find(c => c.id === 'area-fuse')?.items || [],
        arrestors: categories.find(c => c.id === 'arrestors')?.items || [],
        switchgear: categories.find(c => c.id === 'switchgear')?.items || [],
        distributionEquipment: categories.find(c => c.id === 'distribution-equipment')?.items || [],
        paintWork: categories.find(c => c.id === 'paint-work')?.items || [],
        createdBy: formData.createdBy || user?.name || "Unknown",
        createdAt: formData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inspectedBy: formData.inspectedBy || user?.name || "Unknown",
        images: capturedImages, // Add the captured images to the inspection data
        afterImages: afterImages // Add the after images to the inspection data
      };

      // Upload images to Storage if online
      let finalImages = capturedImages;
      let finalAfterImages = afterImages;
      
      if (isOnline && capturedImages.length > 0) {
        try {
          const uploadedImages = await Promise.all(
            capturedImages.map((image, index) => 
              uploadImageToStorage(image, inspectionData.id, index, false)
            )
          );
          finalImages = uploadedImages;
        } catch (error) {
          console.error('Error uploading before images:', error);
          toast.error('Failed to upload some images, but inspection will be saved');
        }
      }
      
      if (isOnline && afterImages.length > 0) {
        try {
          const uploadedAfterImages = await Promise.all(
            afterImages.map((image, index) => 
              uploadImageToStorage(image, inspectionData.id, index, true)
            )
          );
          finalAfterImages = uploadedAfterImages;
        } catch (error) {
          console.error('Error uploading after images:', error);
          toast.error('Failed to upload some images, but inspection will be saved');
        }
      }
      
      // Update inspection data with Storage URLs
      const finalInspectionData = {
        ...inspectionData,
        images: finalImages,
        afterImages: finalAfterImages
      };

      console.log('Saving inspection data:', finalInspectionData); // Debug log

      if (id) {
        // Edit mode: update existing inspection
        const { type, ...updatePayload } = finalInspectionData;
        await updateSubstationInspection(id, updatePayload);
      } else {
        // Create mode: save new inspection
        await saveInspection(finalInspectionData as any);
      }
      navigate("/asset-management/inspection-management");
    } catch (error) {
      console.error("Error saving secondary inspection:", error);
      toast.error("Failed to save secondary inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

   // Render function for each page/category
   const renderCategoryItems = (category: Category | undefined) => {
    if (!category) return null;
    return (
       <Card>
            <CardHeader>
              <CardTitle>{category.name}</CardTitle>
              <CardDescription>Record the condition of {category.name.toLowerCase()} items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {category.items.map((item, itemIndex) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-4">
                    <h3 className="text-base font-medium flex-1">{item.name}</h3>
                    <div className="flex items-center space-x-6">
                      {/* Use dropdown if options are present, otherwise text input */}
                      {item.options && item.options.length > 0 ? (
                        <Select
                          value={item.status}
                          onValueChange={(value) => updateItemStatus(categories.findIndex(c => c.id === category.id), itemIndex, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            {item.options.map(option => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="text"
                          value={item.status || ''}
                          onChange={(e) => updateItemStatus(categories.findIndex(c => c.id === category.id), itemIndex, e.target.value)}
                          placeholder="Enter status"
                          className="w-40"
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`remarks-${item.id}`} className="text-sm">Remarks</Label>
                    <Textarea
                      id={`remarks-${item.id}`}
                      value={item.remarks}
                      onChange={(e) => updateItemRemarks(categories.findIndex(c => c.id === category.id), itemIndex, e.target.value)}
                      placeholder="Add any comments or observations"
                      className="mt-1 h-20"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
    )
   }

  const renderPage = (page: number) => {
    // Map page numbers to categories
    const pageCategoryMap: { [key: number]: string } = {
        1: "basic-info", // Basic Info on page 1
        2: "site-condition",
        3: "transformer",
        4: "area-fuse",
        5: "arrestors",
        6: "switchgear",
        7: "distribution-equipment",
        8: "paint-work",
        9: "additional-notes" // Additional Notes on the last page
    };
    
    const categoryId = pageCategoryMap[page];
    
    // Handle Additional Notes page
    if (categoryId === "additional-notes") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Additional Notes</CardTitle>
                    <CardDescription>Add any additional notes or observations</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="remarks">Additional Notes</Label>
                            <Textarea
                                id="remarks"
                                value={formData.remarks || ''}
                                onChange={(e) => handleInputChange("remarks", e.target.value)}
                                placeholder="Add any additional notes or observations"
                                className="h-32"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    if (categoryId === "basic-info") {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>Enter the basic information about the secondary substation inspection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Substation Type - Allow switching back to Primary */}
                        <div className="space-y-2">
                            <Label htmlFor="type">Substation Type</Label>
                            <Select
                                value="secondary"
                                onValueChange={(value) => {
                                    if (value === "primary") {
                                        // Navigate back to the primary substation inspection form
                                        navigate("/asset-management/substation-inspection");
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select substation type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="primary">Primary</SelectItem>
                                    <SelectItem value="secondary">Secondary</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Region */}
                        <div className="space-y-2">
                            <Label htmlFor="region">Region</Label>
                            <Select
                                value={regionId}
                                onValueChange={handleRegionChange}
                                required
                                disabled={user?.role === "district_engineer" || user?.role === "regional_engineer" || user?.role === "technician" || user?.role === "district_manager" || user?.role === "regional_general_manager"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Region" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredRegions.map((region) => (
                                        <SelectItem key={region.id} value={region.id}>
                                            {region.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* District */}
                        <div className="space-y-2">
                            <Label htmlFor="district">District</Label>
                            <Select
                                value={districtId}
                                onValueChange={handleDistrictChange}
                                required
                                disabled={user?.role === "district_engineer" || user?.role === "technician" || user?.role === "district_manager" || !regionId}
                            >
                                <SelectTrigger>
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

                        {/* Date */}
                        <div className="space-y-2">
                            <Label htmlFor="date">Inspection Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => handleInputChange("date", e.target.value)}
                                required
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="time">Time</Label>
                            <Input
                                id="time"
                                type="time"
                                value={formData.time}
                                onChange={(e) => handleInputChange("time", e.target.value)}
                                required
                                className="w-full"
                            />
                        </div>

                        {/* Substation Number */}
                        <div className="space-y-2">
                            <Label htmlFor="substationNo">Substation Number</Label>
                            <Input
                                id="substationNo"
                                type="text"
                                value={formData.substationNo || ''}
                                onChange={(e) => handleInputChange('substationNo', e.target.value)}
                                required
                                className="w-full"
                                placeholder="Enter substation number"
                            />
                        </div>

                        {/* Substation Name */}
                        <div className="space-y-2">
                            <Label htmlFor="substationName">Substation Name (Optional)</Label>
                            <Input
                                id="substationName"
                                type="text"
                                value={formData.substationName || ''}
                                onChange={(e) => handleInputChange('substationName', e.target.value)}
                                className="w-full"
                                placeholder="Enter substation name"
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                type="text"
                                value={formData.location || ''}
                                onChange={(e) => handleInputChange('location', e.target.value)}
                                className="w-full"
                                placeholder="Enter location details"
                            />
                        </div>

                        {/* GPS Location */}
                        <div className="space-y-2">
                            <Label htmlFor="gpsLocation">GPS Location</Label>
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <Input
                                        id="gpsLocation"
                                        type="text"
                                        value={formData.gpsLocation || ''}
                                        onChange={(e) => handleInputChange('gpsLocation', e.target.value)}
                                        placeholder="Latitude, Longitude"
                                        readOnly
                                        className="w-full"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            if (navigator.geolocation) {
                                                toast.info("Getting location... This may take a few moments.");
                                                const options = {
                                                    enableHighAccuracy: true,
                                                    timeout: 30000,
                                                    maximumAge: 0
                                                };
                                                navigator.geolocation.getCurrentPosition(
                                                    (position) => {
                                                        const { latitude, longitude, accuracy } = position.coords;
                                                        const preciseLat = latitude.toFixed(6);
                                                        const preciseLong = longitude.toFixed(6);
                                                        handleInputChange('gpsLocation', `${preciseLat}, ${preciseLong}`);
                                                        setGpsAccuracy(accuracy); // Store accuracy for image metadata
                                                        if (accuracy > 20) {
                                                            toast.warning(`GPS accuracy is poor (±${accuracy.toFixed(1)} meters). Please try again for a better reading.`);
                                                        } else {
                                                            toast.success(`Location captured! Accuracy: ±${accuracy.toFixed(1)} meters`);
                                                        }
                                                    },
                                                    (error) => {
                                                        let errorMessage = 'Error getting location: ';
                                                        switch (error.code) {
                                                            case error.TIMEOUT:
                                                                errorMessage += 'Location request timed out. Please try again.';
                                                                break;
                                                            case error.POSITION_UNAVAILABLE:
                                                                errorMessage += 'Location information is unavailable. Please check your device settings.';
                                                                break;
                                                            case error.PERMISSION_DENIED:
                                                                errorMessage += 'Location permission denied. Please enable location services.';
                                                                break;
                                                            default:
                                                                errorMessage += error.message;
                                                        }
                                                        toast.error(errorMessage);
                                                    },
                                                    options
                                                );
                                            } else {
                                                toast.error('Geolocation is not supported by your browser');
                                            }
                                        }}
                                    >
                                        Get Location
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Click "Get Location" to capture GPS coordinates. The accuracy will be shown in meters.
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="voltageLevel">Voltage Level</Label>
                                <Select
                                    value={formData.voltageLevel || ""}
                                    onValueChange={value => handleInputChange('voltageLevel', value)}
                                    required
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select voltage level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="11kV">11kV</SelectItem>
                                        <SelectItem value="33kV">33kV</SelectItem>
                                        <SelectItem value="69kV">69kV</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={formData.status || "Pending"}
                                    onValueChange={value => handleInputChange('status', value)}
                                    required
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // For other pages, render the category items
    const category = categories.find(c => c.id === categoryId);
    if (!category) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{category.name}</CardTitle>
                <CardDescription>Record the condition of {category.name.toLowerCase()} items</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
                {category.items.map((item, itemIndex) => (
                    <div key={item.id} className="border rounded-lg p-6 bg-card">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
                            <h3 className="text-base font-medium flex-1">{item.name}</h3>
                            <div className="flex items-center space-x-6">
                                {item.options ? (
                                    <Select
                                        value={item.status}
                                        onValueChange={(value) => updateItemStatus(
                                            categories.findIndex(c => c.id === categoryId),
                                            itemIndex,
                                            value as ConditionStatus
                                        )}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {item.options.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {option}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <RadioGroup
                                        value={item.status}
                                        onValueChange={(value) => updateItemStatus(
                                            categories.findIndex(c => c.id === categoryId),
                                            itemIndex,
                                            value as ConditionStatus
                                        )}
                                        className="flex items-center space-x-4"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem
                                                value="good"
                                                id={`good-${item.id}`}
                                                className="text-green-500 border-green-500 focus:ring-green-500"
                                            />
                                            <Label htmlFor={`good-${item.id}`} className="text-green-600">Good</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem
                                                value="bad"
                                                id={`bad-${item.id}`}
                                                className="text-red-500 border-red-500 focus:ring-red-500"
                                            />
                                            <Label htmlFor={`bad-${item.id}`} className="text-red-600">Bad</Label>
                                        </div>
                                    </RadioGroup>
                                )}
                            </div>
                        </div>
                        <div className="mt-4">
                            <Label htmlFor={`remarks-${item.id}`} className="text-sm font-medium">Remarks</Label>
                            <Textarea
                                id={`remarks-${item.id}`}
                                value={item.remarks}
                                onChange={(e) => updateItemRemarks(
                                    categories.findIndex(c => c.id === categoryId),
                                    itemIndex,
                                    e.target.value
                                )}
                                placeholder="Add any comments or observations"
                                className="mt-2 h-24 resize-none"
                            />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

  const totalPages = 8; // Basic Info, 6 item categories, Additional Notes

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Add breadcrumb navigation */}
        <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-6">
          <Link to="/asset-management/inspection-management" className="hover:text-foreground transition-colors">
            Inspection Management
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="text-foreground">New Secondary Substation Inspection</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Secondary Substation Inspection</h1>
            <p className="text-muted-foreground mt-1">
              Record a new inspection for a secondary substation
              {!isOnline && (
                <span className="ml-2 text-yellow-600 font-medium">
                  (Offline Mode)
                </span>
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {renderPage(currentPage)}
          {currentPage === 8 && renderPhotoSection()}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground order-2 sm:order-none">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="w-full sm:w-auto"
                disabled={currentPage === 1 && (!regionId || !districtId)}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? "Saving..." : "Save Inspection"}
                </Button>
              </div>
            )}
          </div>
        </form>

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
    </Layout>
  );
} 