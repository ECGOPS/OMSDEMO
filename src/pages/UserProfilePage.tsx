import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Camera, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/config/firebase";

export default function UserProfilePage() {
  const { user, setUser } = useAuth();
  const { regions, districts } = useData();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return <Layout><div className="p-8">Not logged in.</div></Layout>;

  // Lookup region and district names
  const regionName = user.regionId
    ? regions.find(r => r.id === user.regionId)?.name
    : user.region || "N/A";
  const districtName = user.districtId
    ? districts.find(d => d.id === user.districtId)?.name
    : user.district || "N/A";

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Update user document in Firestore
        await updateDoc(doc(db, "users", user.id), {
          photoURL: base64String,
          updatedAt: new Date().toISOString()
        });

        // Fetch updated user data
        const updatedUserDoc = await getDoc(doc(db, "users", user.id));
        if (updatedUserDoc.exists()) {
          const updatedUserData = updatedUserDoc.data();
          // Update the user state with the new data
          setUser({
            ...user,
            ...updatedUserData
          });
        }

        toast.success('Profile picture updated successfully');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <Layout>
      <div className="container py-6 px-2 sm:px-4 max-w-lg mx-auto">
        <Card className="shadow-lg border-none">
          <CardHeader className="flex flex-col items-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg pb-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 mb-4">
                {user.photoURL ? (
                  <AvatarImage src={user.photoURL} alt={user.name} />
                ) : (
                  <AvatarFallback className="text-4xl">
                    {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <Upload className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <CardTitle className="text-2xl font-bold mb-1 text-center break-words">{user.name}</CardTitle>
            <div className="text-muted-foreground text-sm text-center break-all">{user.email}</div>
            <div className="mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide text-center">
              {user.role?.replace(/_/g, ' ')}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Staff ID</div>
                <div className="font-medium text-base break-all">{user.staffId || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Region</div>
                <div className="font-medium text-base break-words">{regionName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">District</div>
                <div className="font-medium text-base break-words">{districtName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Email</div>
                <div className="font-medium text-base break-all">{user.email}</div>
              </div>
            </div>
            <div className="mt-8 text-center text-xs text-muted-foreground">
              For any changes to your profile, please contact your system administrator.
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
} 