import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SecondarySubstationInspection } from "@/lib/asset-types";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";

interface Props {
  inspection: SecondarySubstationInspection;
}

const checklistCategories = [
  { key: "siteCondition", label: "Site Condition" },
  { key: "transformer", label: "Transformer" },
  { key: "areaFuse", label: "Area Fuse" },
  { key: "arrestors", label: "Arrestors" },
  { key: "switchgear", label: "Switchgear" },
  { key: "distributionEquipment", label: "Distribution Equipment" },
  { key: "paintWork", label: "Paint Work" },
];

export default function SecondarySubstationInspectionDetailsPage({ inspection }: Props) {
  const navigate = useNavigate();
  const [showFullImage, setShowFullImage] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-4 flex items-center gap-2">
        <button
          className="inline-flex items-center px-4 py-2 bg-muted text-foreground rounded hover:bg-accent transition-colors border"
          onClick={() => navigate("/asset-management/inspection-management")}
        >
          ← Back
        </button>
        <button
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors border"
          onClick={() => navigate(`/asset-management/secondary-substation-inspection/${inspection.id}`)}
        >
          Edit
        </button>
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Secondary Substation Inspection Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Region:</Label> <span>{inspection.region}</span>
            </div>
            <div>
              <Label>District:</Label> <span>{inspection.district}</span>
            </div>
            <div>
              <Label>Date:</Label> <span>{inspection.date}</span>
            </div>
            <div>
              <Label>Time:</Label> <span>{inspection.time || "N/A"}</span>
            </div>
            <div>
              <Label>Voltage Level:</Label> <span>{inspection.voltageLevel || "N/A"}</span>
            </div>
            <div>
              <Label>Substation Number:</Label> <span>{inspection.substationNo}</span>
            </div>
            <div>
              <Label>Substation Name:</Label> <span>{inspection.substationName}</span>
            </div>
            <div>
              <Label>Type:</Label> <span>Secondary</span>
            </div>
            <div>
              <Label>Inspected By:</Label> <span>{inspection.inspectedBy}</span>
            </div>
            <div>
              <Label>Location:</Label> <span>{inspection.location}</span>
            </div>
            <div>
              <Label>GPS Location:</Label>{' '}
              {inspection.gpsLocation ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inspection.gpsLocation)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                  title="Open in Google Maps"
                >
                  {inspection.gpsLocation}
                </a>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>
            <div>
              <Label>Status:</Label> <span>{inspection.status || "N/A"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      {checklistCategories.map(cat => (
        <Card className="mb-6" key={cat.key}>
          <CardHeader>
            <CardTitle>{cat.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(inspection as any)[cat.key]?.map((item: any) => (
                <div key={item.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="font-medium">{item.name}</div>
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                    <span className="text-sm text-muted-foreground">Status: <span className="font-semibold text-foreground">{item.status || "-"}</span></span>
                    {item.remarks && (
                      <span className="text-xs text-muted-foreground">Remarks: {item.remarks}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground whitespace-pre-line">{inspection.remarks || "-"}</div>
        </CardContent>
      </Card>

      {/* Before Photos Section */}
      {inspection.images && inspection.images.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Before Inspection Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inspection.images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Before inspection image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer"
                    onClick={() => setShowFullImage(image)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* After Photos Section */}
      {inspection.afterImages && inspection.afterImages.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>After Inspection Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inspection.afterImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`After inspection image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer"
                    onClick={() => setShowFullImage(image)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
  );
} 