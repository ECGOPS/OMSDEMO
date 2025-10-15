import { SecurityMonitoring } from "@/components/admin/SecurityMonitoring";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Activity, Bell, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface UserStatus {
  online: number;
  idle: number;
  offline: number;
}

export default function SecurityMonitoringPage() {
  const [userStatus, setUserStatus] = useState<UserStatus>({ online: 0, idle: 0, offline: 0 });

  useEffect(() => {
    // Query users who have been active in the last 15 minutes
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

    const q = query(
      collection(db, 'users'),
      where('lastActive', '>=', Timestamp.fromDate(fifteenMinutesAgo))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let online = 0;
      let idle = 0;
      let offline = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const lastActive = data.lastActive as Timestamp;
        const now = new Date();
        const lastActiveDate = lastActive.toDate();
        const minutesSinceActive = Math.floor((now.getTime() - lastActiveDate.getTime()) / 60000);

        if (minutesSinceActive < 5) {
          online++;
        } else if (minutesSinceActive < 15) {
          idle++;
        } else {
          offline++;
        }
      });

      setUserStatus({ online, idle, offline });
    });

    return () => unsubscribe();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
        <div className="container mx-auto px-4 py-8">
          {/* Enhanced Page Header with Stats */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Security Monitoring
              </h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Monitor and manage security events across the system with real-time updates and comprehensive filtering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Quick Stats Cards */}
            <Card className="bg-gradient-to-br from-blue-500/20 via-blue-600/20 to-blue-700/20 border-blue-500/20 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-blue-500">Active Monitoring</CardTitle>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600">Real-time</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/20 via-purple-600/20 to-purple-700/20 border-purple-500/20 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-purple-500">Event Notifications</CardTitle>
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Bell className="h-4 w-4 text-purple-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-600">Instant</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/20 via-indigo-600/20 to-indigo-700/20 border-indigo-500/20 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-indigo-500">Security Status</CardTitle>
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Shield className="h-4 w-4 text-indigo-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-indigo-600">Protected</p>
              </CardHeader>
            </Card>
          </div>

          {/* User Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-emerald-500/20 via-emerald-600/20 to-emerald-700/20 border-emerald-500/20 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-emerald-500">Online Users</CardTitle>
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Users className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{userStatus.online}</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/20 via-amber-600/20 to-amber-700/20 border-amber-500/20 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-amber-500">Idle Users</CardTitle>
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Users className="h-4 w-4 text-amber-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-600">{userStatus.idle}</p>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-slate-500/20 via-slate-600/20 to-slate-700/20 border-slate-500/20 hover:border-slate-500/30 hover:shadow-lg hover:shadow-slate-500/10 transition-all">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-500">Offline Users</CardTitle>
                  <div className="p-2 bg-slate-500/10 rounded-lg">
                    <Users className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-600">{userStatus.offline}</p>
              </CardHeader>
            </Card>
          </div>

          <Separator className="my-8 bg-border/40" />

          {/* Main Content with enhanced styling */}
          <Card className="bg-gradient-to-br from-slate-800/10 via-slate-900/10 to-slate-950/10 border-slate-700/20 hover:border-slate-700/30 shadow-xl">
            <CardHeader className="border-b border-slate-700/20 bg-slate-900/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">Security Events</CardTitle>
                <div className="p-2 bg-slate-500/10 rounded-lg">
                  <Activity className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <SecurityMonitoring />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
} 