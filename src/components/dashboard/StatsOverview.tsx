import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { Zap, Users, Clock, MonitorSmartphone } from "lucide-react";
import { OP5Fault, ControlSystemOutage } from "@/lib/types";
import { calculateOutageDuration } from "@/lib/calculations";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export interface StatsOverviewProps {
  op5Faults: OP5Fault[];
  controlOutages: ControlSystemOutage[];
  filterRegion?: string;
  filterDistrict?: string;
}

export function StatsOverview({ op5Faults, controlOutages, filterRegion, filterDistrict }: StatsOverviewProps) {
  const { regions, districts } = useData();
  const [totalFaults, setTotalFaults] = useState(0);
  const [totalOutages, setTotalOutages] = useState(0);
  const [affectedPopulation, setAffectedPopulation] = useState(0);
  const [averageOutageTime, setAverageOutageTime] = useState(0);

  // Get region and district names
  const regionName = filterRegion ? regions.find(r => r.id === filterRegion)?.name : undefined;
  const districtName = filterDistrict ? districts.find(d => d.id === filterDistrict)?.name : undefined;

  useEffect(() => {
    // Calculate total faults and outages
    setTotalFaults(op5Faults.length);
    setTotalOutages(controlOutages.length);

    // Calculate total affected population
    let totalAffected = 0;
    op5Faults.forEach(fault => {
      if (fault.affectedPopulation) {
        totalAffected += fault.affectedPopulation.rural + fault.affectedPopulation.urban + fault.affectedPopulation.metro;
      }
    });
    setAffectedPopulation(totalAffected);

    // Calculate average outage time (in hours)
    let totalDuration = 0;
    const faultsWithDuration = op5Faults.filter(fault => 
      fault.occurrenceDate && fault.restorationDate && 
      new Date(fault.restorationDate) > new Date(fault.occurrenceDate)
    );
    
    faultsWithDuration.forEach(fault => {
      const duration = calculateOutageDuration(fault.occurrenceDate, fault.restorationDate);
      totalDuration += duration;
    });
    
    const avgDuration = faultsWithDuration.length > 0 ? totalDuration / faultsWithDuration.length : 0;
    setAverageOutageTime(avgDuration);

  }, [op5Faults, controlOutages]);

  const locationText = districtName 
    ? `in ${districtName}` 
    : regionName 
      ? `in ${regionName}` 
      : "ECG Global";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="group bg-gradient-to-br from-red-50 to-red-100 dark:from-[#2a2325] dark:to-[#3a2a2d] border border-red-200 dark:border-red-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Total Faults
              </CardTitle>
              <p className={cn(
                "text-sm mt-1 transition-colors duration-300",
                "text-gray-600 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Zap className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardDescription className="text-gray-600 dark:text-gray-400 mt-2">
            Number of reported OP5 faults
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={totalFaults} />
          </div>
        </CardContent>
      </Card>

      <Card className="group bg-gradient-to-br from-orange-50 to-orange-100 dark:from-[#2a2820] dark:to-[#3a2a20] border border-orange-200 dark:border-orange-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Total Outages
              </CardTitle>
              <p className={cn(
                "text-sm mt-1 transition-colors duration-300",
                "text-gray-600 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <MonitorSmartphone className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <CardDescription className="text-gray-600 dark:text-gray-400 mt-2">
            Number of control system outages
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={totalOutages} />
          </div>
        </CardContent>
      </Card>

      <Card className="group bg-gradient-to-br from-blue-50 to-blue-100 dark:from-[#20232a] dark:to-[#2a2a3a] border border-blue-200 dark:border-blue-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Affected Population
              </CardTitle>
              <p className={cn(
                "text-sm mt-1 transition-colors duration-300",
                "text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardDescription className="text-gray-600 dark:text-gray-400 mt-2">
            Total population affected by faults
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={affectedPopulation} formatValue={(val) => val.toLocaleString()} />
          </div>
        </CardContent>
      </Card>

      <Card className="group bg-gradient-to-br from-green-50 to-green-100 dark:from-[#202a23] dark:to-[#2a3a2a] border border-green-200 dark:border-green-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
        <CardHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Avg. Outage Time
              </CardTitle>
              <p className={cn(
                "text-sm mt-1 transition-colors duration-300",
                "text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400"
              )}>
                {locationText}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardDescription className="text-gray-600 dark:text-gray-400 mt-2">
            Average time to resolve a fault (hours)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <AnimatedNumber value={averageOutageTime} formatValue={(val) => val.toFixed(1)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
