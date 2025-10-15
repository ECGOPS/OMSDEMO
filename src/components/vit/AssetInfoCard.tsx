import { VITAsset } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { LocationMap } from "./LocationMap";
import { db } from "@/config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface AssetInfoCardProps {
  asset: VITAsset;
  getRegionName: (id: string) => string;
  getDistrictName: (id: string) => string;
}

const formatDate = (timestamp: any) => {
  if (!timestamp) return "Not available";
  
  // Handle Firestore timestamp
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }
  
  // Handle string date
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) ? date.toLocaleString() : "Invalid date";
};

export const AssetInfoCard = ({ asset, getRegionName, getDistrictName }: AssetInfoCardProps) => {
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [creatorName, setCreatorName] = useState<string>("Loading...");

  useEffect(() => {
    const fetchCreatorName = async () => {
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", asset.createdBy));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          setCreatorName(userData.name || asset.createdBy);
        } else {
          setCreatorName(asset.createdBy);
        }
      } catch (error) {
        console.error("Error fetching creator name:", error);
        setCreatorName(asset.createdBy);
      }
    };

    if (asset.createdBy) {
      fetchCreatorName();
    }
  }, [asset.createdBy]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-semibold">Region</h3>
              <p>{asset.region}</p>
            </div>
            <div>
              <h3 className="font-semibold">District</h3>
              <p>{asset.district}</p>
            </div>
            <div>
              <h3 className="font-semibold">Feeder Name</h3>
              <p>{asset.feederName || "Not specified"}</p>
            </div>
            <div>
              <h3 className="font-semibold">Voltage Level</h3>
              <p>{asset.voltageLevel}</p>
            </div>
            <div>
              <h3 className="font-semibold">Type of Unit</h3>
              <p>{asset.typeOfUnit}</p>
            </div>
            <div>
              <h3 className="font-semibold">Serial Number</h3>
              <p>{asset.serialNumber}</p>
            </div>
            <div>
              <h3 className="font-semibold">Location</h3>
              <p>{asset.location}</p>
            </div>
            <div>
              <h3 className="font-semibold">GPS Coordinates</h3>
              <p>{asset.gpsCoordinates || "Not specified"}</p>
            </div>
            <div>
              <h3 className="font-semibold">Status</h3>
              <p>{asset.status}</p>
            </div>
            <div>
              <h3 className="font-semibold">Protection</h3>
              <p>{asset.protection || "Not specified"}</p>
            </div>
            <div>
              <h3 className="font-semibold">Created By</h3>
              <p>{creatorName}</p>
            </div>
            <div>
              <h3 className="font-semibold">Created At</h3>
              <p>{formatDate(asset.createdAt)}</p>
            </div>
            <div>
              <h3 className="font-semibold">Last Updated</h3>
              <p>{formatDate(asset.updatedAt)}</p>
            </div>
          </div>

          {asset.gpsCoordinates && asset.gpsCoordinates.trim() !== '' && (
            <div className="mt-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Location Map</p>
              <LocationMap 
                coordinates={asset.gpsCoordinates} 
                assetName={`${asset.typeOfUnit} - ${asset.serialNumber}`} 
              />
            </div>
          )}
          
          {!asset.gpsCoordinates && (
            <div className="mt-6 p-4 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">No location data available for this asset.</p>
            </div>
          )}
          
          {asset.photoUrl && (
            <div className="mt-6">
              <p className="text-sm font-medium text-muted-foreground mb-2">Asset Photo</p>
              <img 
                src={asset.photoUrl} 
                alt={`${asset.typeOfUnit} - ${asset.serialNumber}`}
                className="w-full h-auto rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsPhotoDialogOpen(true)}
              />
            </div>
          )}

          <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
            <DialogContent className="max-w-4xl">
              {asset.photoUrl && (
                <img 
                  src={asset.photoUrl} 
                  alt={`${asset.typeOfUnit} - ${asset.serialNumber}`}
                  className="w-full h-auto rounded-md"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};
