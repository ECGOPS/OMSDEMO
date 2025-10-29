import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { SecondarySubstationInspection } from "@/types/inspection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";
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

export default function EditSecondarySubstationInspectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSavedInspection, updateSubstationInspection } = useData();
  const [formData, setFormData] = useState<Partial<SecondarySubstationInspection>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showFullImage, setShowFullImage] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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

  // Load inspection data when component mounts
  useEffect(() => {
    if (id) {
      const inspection = getSavedInspection(id);
      if (inspection) {
        console.log('Loading inspection for edit:', inspection); // Debug log
        setFormData(inspection);
        // Set captured images if they exist
        if (inspection.images && inspection.images.length > 0) {
          console.log('Loading saved images:', inspection.images); // Debug log
          setCapturedImages(inspection.images);
        }
      } else {
        toast.error("Inspection not found");
        navigate("/asset-management");
      }
    }
  }, [id, getSavedInspection, navigate]);

  const videoConstraints = {
    facingMode: "environment",
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

  const handleCameraError = (error: string | DOMException) => {
    console.error('Camera error:', error);
    setCameraError(error.toString());
    toast.error("Failed to access camera. Please check your camera permissions.");
  };

  const captureImage = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImages(prev => [...prev, imageSrc]);
        setIsCapturing(false);
        setCameraError(null);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Update formData when capturedImages changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      images: capturedImages
    }));
  }, [capturedImages]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Upload new images to Storage if they're base64
      let finalImages = capturedImages;
      
      const newImages = capturedImages.filter(img => img.startsWith('data:'));
      if (newImages.length > 0) {
        try {
          const uploadedImages = await Promise.all(
            newImages.map((image, index) => 
              uploadImageToStorage(image, id!, index)
            )
          );
          
          // Replace base64 images with Storage URLs
          finalImages = capturedImages.map(img => {
            if (img.startsWith('data:')) {
              const newIndex = newImages.indexOf(img);
              return uploadedImages[newIndex];
            }
            return img;
          });
        } catch (error) {
          console.error('Error uploading images:', error);
          toast.error('Failed to upload some images, but inspection will be saved');
        }
      }
      
      const updatedData: Partial<SecondarySubstationInspection> = {
        ...formData,
        images: finalImages,
        updatedAt: new Date().toISOString()
      };

      console.log('Submitting inspection data:', updatedData); // Debug log
      await updateSubstationInspection(id!, updatedData);
      toast.success("Inspection updated successfully");
      navigate("/asset-management/inspection-management");
    } catch (error) {
      console.error("Error updating inspection:", error);
      toast.error("Failed to update inspection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhotoSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Photos</CardTitle>
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
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {renderPhotoSection()}
          
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
                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Add any additional notes or observations"
                    className="h-32"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

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