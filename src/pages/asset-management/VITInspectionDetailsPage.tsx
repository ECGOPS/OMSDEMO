import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { VITAsset, VITInspectionChecklist } from "@/lib/types";
import { AssetInfoCard } from "@/components/vit/AssetInfoCard";
import { InspectionRecord } from "@/components/vit/InspectionRecord";
import { VITSyncService } from "@/services/VITSyncService";

export default function VITInspectionDetailsPage() {
  const { id: assetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vitAssets, vitInspections, regions, districts, deleteVITInspection } = useData();
  const vitSyncService = VITSyncService.getInstance();
  
  const [asset, setAsset] = useState<VITAsset | null>(null);
  const [inspections, setInspections] = useState<VITInspectionChecklist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const loadAsset = async () => {
      if (assetId) {
        setLoading(true);
        try {
          // First check online assets
          const foundAsset = vitAssets.find(a => a.id === assetId);
          if (foundAsset) {
            setAsset(foundAsset);
            
            // Find all inspections for this asset
            const assetInspections = vitInspections.filter(i => i.vitAssetId === assetId);
            setInspections(assetInspections);
            setLoading(false);
            return;
          }

          // If not found in online assets, check offline assets
          const offlineAssets = await vitSyncService.getPendingVITAssets();
          const offlineAsset = offlineAssets.find(a => a.id === assetId);
          if (offlineAsset) {
            setAsset(offlineAsset);
            // Offline assets won't have inspections yet
            setInspections([]);
            setLoading(false);
            return;
          }

          // If still not found, show error
          toast.error("Asset not found");
          navigate("/asset-management/vit-inspection");
        } catch (error) {
          console.error("Error loading asset:", error);
          toast.error("Failed to load asset");
          navigate("/asset-management/vit-inspection");
        }
      }
    };

    loadAsset();
  }, [assetId, vitAssets, vitInspections, navigate]);
  
  const getRegionName = (regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    return region ? region.name : "Unknown";
  };
  
  const getDistrictName = (districtId: string) => {
    const district = districts.find(d => d.id === districtId);
    return district ? district.name : "Unknown";
  };
  
  const handleEdit = (inspectionId: string) => {
    navigate(`/asset-management/edit-vit-inspection/${inspectionId}`);
  };
  
  const handleDelete = (inspectionId: string) => {
    if (window.confirm("Are you sure you want to delete this inspection record?")) {
      deleteVITInspection(inspectionId);
      // Update the local state to reflect the deletion
      setInspections(prev => prev.filter(i => i.id !== inspectionId));
      toast.success("Inspection record deleted successfully");
    }
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Loading asset data...</p>
        </div>
      </Layout>
    );
  }
  
  if (!asset) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Asset not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/asset-management/vit-inspection")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">VIT Asset Details</h1>
        </div>
        
        <div className="space-y-6">
          <AssetInfoCard
            asset={asset}
            getRegionName={getRegionName}
            getDistrictName={getDistrictName}
          />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Inspection Records</h2>
              <Button onClick={() => navigate(`/asset-management/vit-inspection-form/${assetId}`)}>
                Add Inspection
              </Button>
            </div>
            
            {inspections.length === 0 ? (
              <p className="text-muted-foreground">No inspection records found</p>
            ) : (
              <div className="space-y-4">
                {inspections.map((inspection) => (
                  <InspectionRecord
                    key={inspection.id}
                    inspection={inspection}
                    asset={asset}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    getRegionName={getRegionName}
                    getDistrictName={getDistrictName}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
