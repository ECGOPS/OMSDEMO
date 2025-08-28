import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BatchSubstationMigrationService, MigrationProgress, MigrationResult } from '@/services/BatchSubstationMigrationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Square, 
  Database,
  Image,
  HardDrive,
  Cloud,
  BarChart3
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SubstationMigrationPage() {
  const { user, isAuthenticated } = useAuth();
  const [migrationService] = useState(() => BatchSubstationMigrationService.getInstance());
  const [progress, setProgress] = useState<MigrationProgress>({
    total: 0,
    migrated: 0,
    remaining: 0,
    currentBatch: 0,
    totalBatches: 0,
    isRunning: false
  });
  const [batchSize, setBatchSize] = useState(10);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [lastBatchResult, setLastBatchResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('SubstationMigrationPage - Component rendering...');
    if (isAuthenticated && user) {
      console.log('SubstationMigrationPage - User:', user);
      console.log('SubstationMigrationPage - IsAuthenticated:', isAuthenticated);
      console.log('SubstationMigrationPage - User Role:', user.role);
      console.log('SubstationMigrationPage - Migration Service:', migrationService);
      loadMigrationProgress();
    }
  }, [isAuthenticated, user, migrationService]);

  const loadMigrationProgress = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading migration progress...');
      const progressData = await migrationService.getMigrationProgress();
      setProgress(progressData);
      console.log('✅ Progress data received:', progressData);
    } catch (error) {
      console.error('❌ Error loading migration progress:', error);
      toast.error('Failed to load migration progress');
    } finally {
      setIsLoading(false);
    }
  };

  const startMigration = async () => {
    try {
      if (progress.isRunning) {
        toast.error('Migration already in progress');
        return;
      }

      console.log('🚀 Starting substation image migration...');
      
      const onProgress = (progressData: MigrationProgress) => {
        setProgress(progressData);
        setCurrentBatch(progressData.currentBatch);
        
        // Calculate overall progress percentage
        if (progressData.total > 0) {
          const percentage = Math.round((progressData.migrated / progressData.total) * 100);
          setOverallProgress(percentage);
        }
      };

      const onBatchComplete = (result: MigrationResult) => {
        setLastBatchResult(result);
        console.log('✅ Batch completed:', result);
        
        if (result.success) {
          toast.success(`Batch completed: ${result.migratedCount} migrated, ${result.errorCount} errors`);
        } else {
          toast.error(`Batch failed: ${result.message}`);
        }
      };

      await migrationService.migrateAllSubstationImages(batchSize, onProgress, onBatchComplete);
      
      toast.success('Substation image migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Error starting migration:', error);
      toast.error('Failed to start migration');
    }
  };

  const stopMigration = () => {
    migrationService.stopMigration();
    toast.info('Migration stopped by user');
  };

  const testDatabase = async () => {
    try {
      console.log('🧪 Testing database connection...');
      
      // Test Firebase config import
      const { getFirestore } = await import('firebase/firestore');
      console.log('✅ Firebase config imported successfully');
      
      // Test database instance
      const db = getFirestore();
      console.log('✅ Database instance:', db);
      
      // Test collection reference
      const { collection, query, limit } = await import('firebase/firestore');
      const inspectionsRef = collection(db, 'substationInspections');
      console.log('✅ Collection reference created');
      
      // Test basic query
      const testQuery = query(inspectionsRef, limit(1));
      console.log('✅ Limited query created (limit 1)');
      
      // Test collection count
      console.log('🔍 Testing collection count...');
      const { getDocs } = await import('firebase/firestore');
      
      const countQuery = query(inspectionsRef, limit(1));
      const countSnapshot = await getDocs(countQuery);
      console.log('✅ Count query successful, found:', countSnapshot.size, 'documents');
      
      // Test collection existence
      console.log('🔍 Testing collection existence...');
      if (countSnapshot.empty) {
        console.log('✅ Collection exists, test document: does not exist');
      } else {
        console.log('✅ Collection exists, test document: exists');
      }
      
      console.log('✅ Database test completed');
      toast.success('Database connection test successful');
      
    } catch (error) {
      console.error('❌ Database test failed:', error);
      toast.error('Database connection test failed');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'system_admin') {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Substation Image Migration</h1>
        <p className="text-gray-600 mt-2">
          Migrate substation inspection base64 images to Firebase Storage for better performance
        </p>
      </div>

      {/* Database Test Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Connection Test
          </CardTitle>
          <CardDescription>
            Test the connection to Firestore and check collection access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={testDatabase} variant="outline" className="w-full">
            <Database className="mr-2 h-4 w-4" />
            Test Database Connection
          </Button>
        </CardContent>
      </Card>

      {/* Migration Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Migration Configuration
          </CardTitle>
          <CardDescription>
            Configure batch size and start the migration process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batchSize">Batch Size</Label>
              <Input
                id="batchSize"
                type="number"
                min="1"
                max="50"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                disabled={progress.isRunning}
              />
              <p className="text-sm text-gray-500 mt-1">
                Number of inspections to process in each batch (1-50)
              </p>
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={startMigration}
                disabled={progress.isRunning || isLoading}
                className="w-full"
              >
                {progress.isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migration Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Migration
                  </>
                )}
              </Button>
            </div>
          </div>

          {progress.isRunning && (
            <Button onClick={stopMigration} variant="destructive" className="w-full">
              <Square className="mr-2 h-4 w-4" />
              Stop Migration
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Migration Progress
          </CardTitle>
          <CardDescription>
            Overall progress and current status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{progress.total}</div>
              <div className="text-sm text-gray-600">Total Inspections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{progress.migrated}</div>
              <div className="text-sm text-gray-600">Migrated</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{progress.remaining}</div>
              <div className="text-sm text-gray-600">Remaining</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Current Batch</Label>
              <div className="text-lg font-semibold">{currentBatch} / {progress.totalBatches}</div>
            </div>
            <div>
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                {progress.isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <Badge variant="default" className="bg-blue-100 text-blue-800">
                      Running
                    </Badge>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Idle
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Batch Result */}
      {lastBatchResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Last Batch Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {lastBatchResult.migratedCount}
                </div>
                <div className="text-sm text-gray-600">Successfully Migrated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {lastBatchResult.errorCount}
                </div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {lastBatchResult.success ? 'Success' : 'Failed'}
                </div>
                <div className="text-sm text-gray-600">Status</div>
              </div>
            </div>
            
            {lastBatchResult.errors.length > 0 && (
              <div className="mt-4">
                <Label>Errors:</Label>
                <div className="mt-2 space-y-1">
                  {lastBatchResult.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                  {lastBatchResult.errors.length > 5 && (
                    <div className="text-sm text-gray-500">
                      ... and {lastBatchResult.errors.length - 5} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              What This Does
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              • Converts base64 images to Firebase Storage URLs
            </p>
            <p className="text-sm text-gray-600">
              • Improves page loading performance
            </p>
            <p className="text-sm text-gray-600">
              • Maintains all existing functionality
            </p>
            <p className="text-sm text-gray-600">
              • Processes images in batches for reliability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Storage Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              • Images stored in: <code>substation-inspections/{'{inspectionId}'}/</code>
            </p>
            <p className="text-sm text-gray-600">
              • Before images: <code>before_image_{'{index}'}_{'{timestamp}'}.jpg</code>
            </p>
            <p className="text-sm text-gray-600">
              • After images: <code>after_image_{'{index}'}_{'{timestamp}'}.jpg</code>
            </p>
            <p className="text-sm text-gray-600">
              • URLs stored in Firestore documents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="h-5 w-5" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• This process cannot be undone - images will be permanently moved to Storage</li>
            <li>• Ensure you have a stable internet connection during migration</li>
            <li>• Large datasets may take several hours to complete</li>
            <li>• The migration can be stopped and resumed later</li>
            <li>• All existing functionality will continue to work after migration</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
