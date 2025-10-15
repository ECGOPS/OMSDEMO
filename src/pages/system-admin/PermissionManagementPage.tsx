import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionService } from '@/services/PermissionService';
import { UserRole } from '@/lib/types';
import { toast } from '@/components/ui/sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Layout } from '@/components/layout/Layout';

interface PermissionSettings {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

interface RolePermissions {
  [key: string]: PermissionSettings;
}

interface FeaturePermissions {
  [key: string]: UserRole[];
}

interface FeatureCategory {
  name: string;
  features: {
    id: string;
    name: string;
    description: string;
  }[];
}

const featureCategories: FeatureCategory[] = [
  {
    name: "Asset Management",
    features: [
      {
        id: "asset_management",
        name: "Asset Management",
        description: "Manage and track all grid assets"
      },
      {
        id: "inspection_management",
        name: "Inspection Management",
        description: "Schedule and manage asset inspections"
      },
      {
        id: "load_monitoring",
        name: "Load Monitoring",
        description: "Monitor and analyze asset load data"
      },
      {
        id: "substation_inspection",
        name: "Substation Inspection",
        description: "Manage substation inspection records"
      },
      {
        id: "vit_inspection",
        name: "VIT Inspection",
        description: "Visual inspection tracking system"
      },
      {
        id: "overhead_line_inspection",
        name: "Overhead Line Inspection",
        description: "Manage overhead line inspections"
      },
      {
        id: "feeder_management",
        name: "Feeder Management",
        description: "Manage and monitor feeder operations"
      }
    ]
  },
  {
    name: "Fault Management",
    features: [
      {
        id: "fault_reporting",
        name: "Fault Reporting",
        description: "Report and track grid faults"
      },
      {
        id: "fault_analytics",
        name: "Fault Analytics",
        description: "Analyze fault patterns and trends"
      },
      {
        id: "control_outage_management",
        name: "Control & Outage Management",
        description: "Manage planned and unplanned outages"
      },
      {
        id: "op5_fault_management",
        name: "OP5 Fault Management",
        description: "Manage operational faults"
      }
    ]
  },
  {
    name: "Analytics",
    features: [
      {
        id: "analytics_dashboard",
        name: "Analytics Dashboard",
        description: "View system-wide analytics"
      },
      {
        id: "analytics_page",
        name: "Analytics Page",
        description: "Access detailed analytics and reports"
      },
      {
        id: "reliability_metrics",
        name: "Reliability Metrics",
        description: "Track system reliability KPIs"
      },
      {
        id: "performance_reports",
        name: "Performance Reports",
        description: "Generate detailed performance reports"
      }
    ]
  },
  {
    name: "Feeder Management",
    features: [
      {
        id: "feeder_management",
        name: "Feeder Management",
        description: "Manage feeders across regions and districts"
      },
      {
        id: "feeder_management_update",
        name: "Feeder Management Update",
        description: "Update feeder information"
      },
      {
        id: "feeder_management_delete",
        name: "Feeder Management Delete",
        description: "Delete individual feeders"
      },
      {
        id: "feeder_management_delete_all",
        name: "Delete All Feeders",
        description: "Delete all feeders in a selected region"
      }
    ]
  },
  {
    name: "User Management",
    features: [
      {
        id: "user_management",
        name: "User Management",
        description: "Manage system users and roles"
      },
      {
        id: "district_population",
        name: "District Population",
        description: "Manage district user assignments"
      },
      {
        id: "district_population_reset",
        name: "District Population Reset",
        description: "Reset district population data"
      }
    ]
  },
  {
    name: "System Administration",
    features: [
      {
        id: "system_configuration",
        name: "System Configuration",
        description: "Configure system-wide settings"
      },
      {
        id: "permission_management",
        name: "Permission Management",
        description: "Manage feature access permissions"
      },
      {
        id: "security_monitoring",
        name: "Security Monitoring",
        description: "Monitor system security status"
      },
      {
        id: "security_testing",
        name: "Security Testing",
        description: "Test security configurations"
      },
      {
        id: "feeder_offline_testing",
        name: "Feeder Offline Testing",
        description: "Test feeder offline functionality"
      },
      {
        id: "music_management",
        name: "Music Management",
        description: "Manage background music for the application"
      }
    ]
  },
  {
    name: "User Activity",
    features: [
      {
        id: "user_logs",
        name: "User Activity Logs",
        description: "View and manage user activity logs"
      },
      {
        id: "user_logs_update",
        name: "Update User Logs",
        description: "Update user activity log entries"
      },
      {
        id: "user_logs_delete",
        name: "Delete User Logs",
        description: "Delete individual user activity logs"
      },
      {
        id: "user_logs_delete_all",
        name: "Delete All User Logs",
        description: "Delete all user activity logs"
      }
    ]
  }
];

export default function PermissionManagementPage() {
  const { user } = useAuth();
  const permissionService = PermissionService.getInstance();
  const [newFeature, setNewFeature] = useState('');
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissions>({});
  const [editingFeature, setEditingFeature] = useState<string | null>(null);
  const [viewPermissions, setViewPermissions] = useState<UserRole[]>([]);
  const [editPermissions, setEditPermissions] = useState<UserRole[]>([]);
  const [deletePermissions, setDeletePermissions] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get all available roles in hierarchy order
  const allRoles: UserRole[] = [
    'technician',
    'district_engineer',
    'district_manager',
    'regional_engineer',
    'project_engineer',
    'regional_general_manager',
    'global_engineer',
    'system_admin'
  ];

  // Initialize and listen for permission changes from Firestore
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const initPermissions = async () => {
      setLoading(true);
      await permissionService.initialize();
      setFeaturePermissions(permissionService.getFeaturePermissions());
      unsubscribe = permissionService.listenToPermissions(() => {
        setFeaturePermissions(permissionService.getFeaturePermissions());
      });
      setLoading(false);
    };
    initPermissions();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Check if user has permission to access this page
  if (!permissionService.canAccessFeature(user?.role || null, 'permission_management')) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }

  const handleEditClick = (feature: string) => {
    const currentPermissions = featurePermissions[feature] || [];
    const updateFeature = `${feature}_update`;
    const deleteFeature = `${feature}_delete`;
    
    setEditingFeature(feature);
    setViewPermissions(currentPermissions);
    setEditPermissions(featurePermissions[updateFeature] || []);
    setDeletePermissions(featurePermissions[deleteFeature] || []);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingFeature(null);
    setViewPermissions([]);
    setEditPermissions([]);
    setDeletePermissions([]);
  };

  const handlePermissionToggle = (role: UserRole, operation: 'view' | 'edit' | 'delete') => {
    switch (operation) {
      case 'view':
        setViewPermissions(prev => {
          if (prev.includes(role)) {
            return prev.filter(r => r !== role);
          } else {
            return [...prev, role];
          }
        });
        break;
      case 'edit':
        setEditPermissions(prev => {
          if (prev.includes(role)) {
            return prev.filter(r => r !== role);
          } else {
            return [...prev, role];
          }
        });
        break;
      case 'delete':
        setDeletePermissions(prev => {
          if (prev.includes(role)) {
            return prev.filter(r => r !== role);
          } else {
            return [...prev, role];
          }
        });
        break;
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingFeature) return;
    try {
      // Get current permissions from the service
      const currentPermissions = permissionService.getFeaturePermissions();
      
      // Create updated permissions
      const updatedPermissions = { ...currentPermissions };
      
      // Update all permissions at once
      updatedPermissions[editingFeature] = [...viewPermissions];
      updatedPermissions[`${editingFeature}_update`] = [...editPermissions];
      updatedPermissions[`${editingFeature}_delete`] = [...deletePermissions];

      // Save all changes in a single update
      await permissionService.updateAllPermissions(updatedPermissions);
      
      // Update local state
      setFeaturePermissions(updatedPermissions);
      
      // Close dialog and reset state
      setEditingFeature(null);
      setViewPermissions([]);
      setEditPermissions([]);
      setDeletePermissions([]);
      setIsDialogOpen(false);
      
      toast.success(`Permissions updated for "${editingFeature}"`);
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update permissions');
    }
  };

  const handleResetPermissions = async () => {
    try {
      await permissionService.resetToDefaults();
      toast.success('Permissions reset to defaults');
    } catch (error) {
      toast.error('Failed to reset permissions');
    }
  };

  const handleAddFeature = async () => {
    if (!newFeature.trim()) {
      toast.error('Please enter a feature name');
      return;
    }
    try {
      await permissionService.addFeature(newFeature, []);
      toast.success(`Feature "${newFeature}" added successfully`);
      setNewFeature('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add feature');
    }
  };

  const handleRemoveFeature = async (feature: string) => {
    try {
      await permissionService.removeFeature(feature);
      toast.success(`Feature "${feature}" removed successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove feature');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Permission Management</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleResetPermissions}
              className="text-red-600 hover:text-red-800 hover:bg-red-50 w-full sm:w-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Reset to Defaults
            </Button>
            <div className="relative w-full sm:w-auto">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Enter new feature name"
                className="pr-24 w-full"
              />
              <Button 
                onClick={handleAddFeature}
                className="absolute right-1 top-1 h-8"
              >
                Add Feature
              </Button>
            </div>
          </div>
        </div>

        {/* Feature Categories */}
        <div className="grid gap-4 sm:gap-6 md:gap-8">
          {featureCategories.map((category) => (
            <div key={category.name} className="bg-card rounded-lg shadow-sm border">
              <div className="px-4 sm:px-6 py-4 border-b">
                <h2 className="text-lg sm:text-xl font-semibold">{category.name}</h2>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid gap-4">
                  {category.features.map((feature) => (
                    <div key={feature.id} className="bg-muted/50 rounded-lg p-4 hover:bg-muted transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-base sm:text-lg font-medium">{feature.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleEditClick(feature.id)}
                          className="text-primary hover:text-primary hover:bg-primary/10 w-full sm:w-auto"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          Edit Permissions
                        </Button>
                      </div>
                      <div className="mt-3">
                        <span className="text-sm font-medium">Allowed roles: </span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {featurePermissions[feature.id]?.map((role) => (
                            <span 
                              key={role} 
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                            >
                              {role.replace('_', ' ').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit Permissions Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold">
                Edit Permissions for {editingFeature?.replace('_', ' ').toUpperCase()}
              </DialogTitle>
              <DialogDescription>
                Manage access permissions for different user roles. View allows basic access, Edit allows modifications, and Delete allows removal of records.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                {allRoles.map((role) => (
                  <div key={role} className="flex flex-col xs:flex-row xs:items-center justify-between p-3 bg-muted/50 rounded-lg gap-2 xs:gap-0">
                    <span className="font-medium mb-2 xs:mb-0">
                      {role.replace('_', ' ').toUpperCase()}
                    </span>
                    <div className="flex flex-wrap gap-3 xs:gap-4 w-full xs:w-auto">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={viewPermissions.includes(role)}
                          onCheckedChange={() => handlePermissionToggle(role, 'view')}
                          className="h-5 w-5"
                          aria-label={`Allow ${role} to view`}
                        />
                        <Label>View</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={editPermissions.includes(role)}
                          onCheckedChange={() => handlePermissionToggle(role, 'edit')}
                          disabled={!viewPermissions.includes(role)}
                          className="h-5 w-5"
                          aria-label={`Allow ${role} to edit`}
                        />
                        <Label>Edit</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={deletePermissions.includes(role)}
                          onCheckedChange={() => handlePermissionToggle(role, 'delete')}
                          disabled={!viewPermissions.includes(role) || !editPermissions.includes(role)}
                          className="h-5 w-5"
                          aria-label={`Allow ${role} to delete`}
                        />
                        <Label>Delete</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdatePermissions}
                  className="w-full sm:w-auto"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
} 