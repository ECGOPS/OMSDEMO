import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'react-hot-toast';
import { db } from '../../config/firebase';
import { collection, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { RegionPopulation } from '../../lib/types';
import LoggingService from '../../services/LoggingService';

export function DistrictPopulationReset() {
  const { regions } = useData();
  const { user } = useAuth();
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async () => {
    if (!selectedRegion) {
      toast.error('Please select a region');
      return;
    }

    setIsLoading(true);
    try {
      // Get all districts in the selected region
      const districtsRef = collection(db, 'districts');
      const q = query(districtsRef, where('regionId', '==', selectedRegion));
      const querySnapshot = await getDocs(q);

      // Update each district with proper population structure
      const updates = querySnapshot.docs.map(async (docSnapshot) => {
        const districtRef = doc(db, 'districts', docSnapshot.id);
        const districtData = docSnapshot.data();
        const resetPopulation: RegionPopulation = {
          rural: null,
          urban: null,
          metro: null
        };

        // Log the reset action for each district
        if (user?.uid && user?.name && user?.role) {
          console.log("[Reset] LoggingService.logAction will be called with:", {
            userId: user.uid,
            userName: user.name,
            userRole: user.role,
            id: docSnapshot.id,
            districtName: districtData.name,
            region: selectedRegion,
            oldPopulation: districtData.population,
            newPopulation: resetPopulation
          });
          const loggingService = LoggingService.getInstance();
          await loggingService.logAction(
            user.uid,
            user.name,
            user.role,
            "Reset",
            "DistrictPopulation",
            docSnapshot.id,
            `Reset population for district ${districtData.name}`,
            selectedRegion,
            districtData.name
          );
        }

        await updateDoc(districtRef, {
          population: resetPopulation,
          lastPopulationReset: new Date().toISOString()
        });
      });

      await Promise.all(updates);
      toast.success('District populations reset successfully');
    } catch (error) {
      console.error('Error resetting district populations:', error);
      toast.error('Failed to reset district populations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset District Populations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Select Region</label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleReset} 
            disabled={!selectedRegion || isLoading}
            variant="destructive"
          >
            {isLoading ? 'Resetting...' : 'Reset Populations'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 