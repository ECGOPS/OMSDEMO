import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { SubstationInspection } from "@/lib/asset-types";
import { useData } from "@/contexts/DataContext";
import { toast } from "@/components/ui/sonner";
import { InspectionDetailsView } from "@/components/inspection/InspectionDetailsView";
import SecondarySubstationInspectionDetailsPage from "./SecondarySubstationInspectionDetailsPage";

export default function InspectionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSavedInspection } = useData();
  const [inspection, setInspection] = useState<SubstationInspection | null>(null);

  useEffect(() => {
    if (id) {
      const loadedInspection = getSavedInspection(id);
      if (loadedInspection) {
        setInspection(loadedInspection);
      } else {
        toast.error("Inspection not found");
        navigate("/asset-management/inspection-management");
      }
    }
  }, [id, getSavedInspection, navigate]);

  if (!inspection) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Loading inspection details...</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        {String(inspection.type) === "secondary" ? (
          <SecondarySubstationInspectionDetailsPage inspection={inspection as any} />
        ) : (
          <InspectionDetailsView
            inspection={inspection}
            showHeader={true}
            showBackButton={true}
            onBack={() => navigate("/asset-management/inspection-management")}
            onEdit={() => navigate(`/asset-management/edit-inspection/${id}`)}
          />
        )}
      </div>
    </Layout>
  );
}
