import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface ActiveUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  lastActive: Timestamp;
  ipAddress?: string;
  status: 'online' | 'idle' | 'offline';
}

export function ActiveUsers() {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  useEffect(() => {
    // Query users who have been active in the last 15 minutes
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);

    const q = query(
      collection(db, 'users'),
      where('lastActive', '>=', Timestamp.fromDate(fifteenMinutesAgo))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        const lastActive = data.lastActive as Timestamp;
        const now = new Date();
        const lastActiveDate = lastActive.toDate();
        const minutesSinceActive = Math.floor((now.getTime() - lastActiveDate.getTime()) / 60000);

        let status: ActiveUser['status'] = 'offline';
        if (minutesSinceActive < 5) {
          status = 'online';
        } else if (minutesSinceActive < 15) {
          status = 'idle';
        }

        return {
          id: doc.id,
          email: data.email,
          name: data.name,
          role: data.role,
          lastActive,
          ipAddress: data.lastIpAddress,
          status
        } as ActiveUser;
      });

      setActiveUsers(users.sort((a, b) => b.lastActive.seconds - a.lastActive.seconds));
    });

    return () => unsubscribe();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Users ({activeUsers.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{user.name || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {user.role.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    user.status === 'online' ? 'default' :
                    user.status === 'idle' ? 'secondary' :
                    'outline'
                  }>
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{user.ipAddress || 'unknown'}</TableCell>
                <TableCell>
                  {user.lastActive.toDate().toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 