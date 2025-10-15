import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useData } from "@/contexts/DataContext";
import { VITInspectionForm } from "@/components/vit/VITInspectionForm";
import { toast } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VITInspectionChecklist } from "@/lib/types";

export default function EditVITInspectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vitInspections } = useData();
  const [inspection, setInspection] = useState<VITInspectionChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (id) {
      const foundInspection = vitInspections.find(insp => insp.id === id);
      if (foundInspection) {
        setInspection(foundInspection);
        setIsLoading(false);
      } else {
        toast.error("Inspection record not found");
        navigate("/asset-management/vit-inspection-management");
      }
    }
  }, [id, vitInspections, navigate]);
  
  const handleSubmit = () => {
    toast.success("Inspection updated successfully");
    navigate(`/asset-management/vit-inspection-management`);
  };
  
  const handleCancel = () => {
    navigate(`/asset-management/vit-inspection-management`);
  };
  
  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Loading inspection data...</p>
        </div>
      </Layout>
    );
  }
  
  if (!inspection) {
    return (
      <Layout>
        <div className="container py-8">
          <p>Inspection record not found</p>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container px-2 sm:px-4 py-4 sm:py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/asset-management/vit-inspection-management")}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Inspection Management
        </Button>
        
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Edit VIT Inspection</h1>
          <p className="text-muted-foreground mt-1">
            Update the inspection record details
          </p>
        </div>
        
        <div className="rounded-lg border shadow-sm p-3 sm:p-6">
          <VITInspectionForm
            assetId={inspection.vitAssetId}
            inspectionData={inspection}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </Layout>
  );
}
