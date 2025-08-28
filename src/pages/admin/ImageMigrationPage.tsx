import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { BatchImageMigrationService } from '@/services/BatchImageMigrationService';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';

export default function ImageMigrationPage() {
  console.log('ImageMigrationPage - Component rendering...');
  
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState({ total: 0, migrated: 0, remaining: 0 });
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [batchSize, setBatchSize] = useState(10);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);

  const migrationService = BatchImageMigrationService.getInstance();

  // Debug logging
  useEffect(() => {
    console.log('ImageMigrationPage - User:', user);
    console.log('ImageMigrationPage - IsAuthenticated:', isAuthenticated);
    console.log('ImageMigrationPage - User Role:', user?.role);
    console.log('ImageMigrationPage - Migration Service:', migrationService);
  }, [user, isAuthenticated, migrationService]);

  // Simple role check to prevent redirect loop
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p>Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'system_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You need system admin privileges to access this page.</p>
          <p className="text-sm text-gray-600 mt-2">Your role: {user?.role || 'Unknown'}</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      console.log('🔄 Loading migration progress...');
      const progressData = await migrationService.getMigrationProgress();
      console.log('✅ Progress data received:', progressData);
      setProgress(progressData);
    } catch (error) {
      console.error('❌ Error loading progress:', error);
    }
  };

  const startMigration = async () => {
    if (!confirm(`This will migrate all base64 images to cloud storage in batches of ${batchSize}. This process cannot be undone. Continue?`)) {
      return;
    }

    setIsMigrating(true);
    setMigrationStatus('running');
    setCurrentBatch(0);
    setOverallProgress(0);

    try {
      const result = await migrationService.migrateAllOverheadLineImages(
        batchSize,
        (batchNumber, processed, total, overallProgress) => {
          setCurrentBatch(batchNumber);
          setOverallProgress(overallProgress);
          console.log(`Batch ${batchNumber}: ${processed}/${total} (${overallProgress}% overall)`);
        }
      );
      
      setMigrationStatus('completed');
      toast({
        title: 'Migration Completed',
        description: `Successfully processed ${result.totalBatches} batches with ${result.totalMigrated} inspections migrated.`,
      });
      await loadProgress(); // Refresh progress
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationStatus('error');
      toast({
        title: 'Migration Failed',
        description: error.message || 'An error occurred during migration. Please check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const getStatusIcon = () => {
    switch (migrationStatus) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      case 'running':
        return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
      default:
        return <Upload className="h-6 w-6 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (migrationStatus) {
      case 'completed':
        return 'Migration completed successfully';
      case 'error':
        return 'Migration failed';
      case 'running':
        return 'Migration in progress...';
      default:
        return 'Ready to migrate';
    }
  };

  const getProgressPercentage = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.migrated / progress.total) * 100);
  };

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Image Migration</h1>
            <p className="text-muted-foreground mt-2">
              Migrate base64 images to cloud storage to improve performance
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon()}
                Image Migration Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{progress.total}</div>
                  <div className="text-sm text-gray-600">Total Inspections</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{progress.migrated}</div>
                  <div className="text-sm text-gray-600">Migrated</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{progress.remaining}</div>
                  <div className="text-sm text-gray-600">Remaining</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Migration Progress</span>
                  <span>{getProgressPercentage()}%</span>
                </div>
                <Progress value={getProgressPercentage()} className="w-full" />
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">{getStatusText()}</p>
                
                                                  {migrationStatus === 'idle' && (
                   <div className="space-y-4">
                     <div className="flex flex-col space-y-2">
                       <label className="text-sm font-medium">Batch Size (documents per batch):</label>
                       <select 
                         value={batchSize} 
                         onChange={(e) => setBatchSize(Number(e.target.value))}
                         className="px-3 py-2 border rounded-md"
                         disabled={isMigrating}
                       >
                         <option value={5}>5 (Conservative - Slower but safer)</option>
                         <option value={10}>10 (Balanced - Recommended)</option>
                         <option value={20}>20 (Aggressive - Faster but may timeout)</option>
                         <option value={50}>50 (Very Aggressive - May cause issues)</option>
                       </select>
                       <p className="text-xs text-gray-600">
                         Smaller batches are safer for very large datasets. Start with 10.
                       </p>
                     </div>
                     
                     <div className="flex flex-wrap gap-2">
                       <Button 
                         onClick={loadProgress} 
                         variant="outline"
                         className="w-full md:w-auto"
                       >
                         🔍 Refresh Progress
                       </Button>
                       
                       <Button 
                         onClick={async () => {
                           try {
                             console.log('🧪 Testing database connection...');
                             const { db } = await import('@/config/firebase');
                             console.log('✅ Firebase config imported successfully');
                             console.log('✅ Database instance:', db);
                             
                             // Test a simple query with timeout
                             const { collection, getDocs, query, limit, orderBy } = await import('firebase/firestore');
                             const testRef = collection(db, 'overheadLineInspections');
                             console.log('✅ Collection reference created');
                             
                             // Try to get just the collection count first (much faster)
                             console.log('🔍 Testing collection count...');
                             try {
                               const countQuery = query(testRef, limit(1));
                               const countSnapshot = await Promise.race([
                                 getDocs(countQuery),
                                 new Promise((_, reject) => 
                                   setTimeout(() => reject(new Error('Count query timeout after 5 seconds')), 5000)
                                 )
                               ]);
                               console.log('✅ Count query successful, found:', countSnapshot.docs.length, 'documents');
                             } catch (countError) {
                               console.log('⚠️ Count query failed:', countError.message);
                             }
                             
                             // Now try a more targeted approach - check if collection exists
                             console.log('🔍 Testing collection existence...');
                             try {
                               const { getDoc, doc } = await import('firebase/firestore');
                               const testDoc = doc(db, 'overheadLineInspections', 'test-doc');
                               const docSnap = await getDoc(testDoc);
                               console.log('✅ Collection exists, test document:', docSnap.exists() ? 'exists' : 'does not exist');
                             } catch (docError) {
                               console.log('⚠️ Document test failed:', docError.message);
                             }
                             
                             console.log('✅ Database test completed');
                             
                             toast({
                               title: 'Database Test Completed',
                               description: 'Check console for detailed results',
                             });
                           } catch (error) {
                             console.error('❌ Database test failed:', error);
                             toast({
                               title: 'Database Test Failed',
                               description: error.message,
                               variant: 'destructive',
                             });
                           }
                         }}
                         variant="outline"
                         className="w-full md:w-auto"
                       >
                         🧪 Test Database
                       </Button>
                       
                       <Button 
                         onClick={startMigration} 
                         disabled={progress.total === 0}
                         className="w-full md:w-auto"
                       >
                         <Upload className="mr-2 h-4 w-4" />
                         Start Migration
                       </Button>
                     </div>
                   </div>
                 )}

                                 {migrationStatus === 'running' && (
                   <div className="space-y-4">
                     <div className="text-center">
                       <div className="flex items-center justify-center gap-2 mb-2">
                         <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                         <span className="font-medium">Migration in Progress</span>
                       </div>
                       <p className="text-sm text-gray-600">
                         Processing batch {currentBatch} • Overall progress: {overallProgress}%
                       </p>
                     </div>
                     
                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                       <h4 className="font-semibold text-blue-800 mb-2">Current Status:</h4>
                       <ul className="text-sm text-blue-700 space-y-1">
                         <li>• Processing documents in batches of {batchSize}</li>
                         <li>• Current batch: {currentBatch}</li>
                         <li>• Overall progress: {overallProgress}%</li>
                         <li>• This may take several hours for large datasets</li>
                         <li>• You can leave this page open and monitor progress</li>
                       </ul>
                     </div>
                   </div>
                 )}

                {migrationStatus === 'completed' && (
                  <Button 
                    onClick={loadProgress} 
                    variant="outline"
                    className="w-full md:w-auto"
                  >
                    Refresh Progress
                  </Button>
                )}

                {migrationStatus === 'error' && (
                  <Button 
                    onClick={startMigration} 
                    variant="destructive"
                    className="w-full md:w-auto"
                  >
                    Retry Migration
                  </Button>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Important Notes:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• This process will convert all base64 images to cloud storage URLs</li>
                  <li>• Original base64 data will be replaced with download URLs</li>
                  <li>• Migration cannot be undone once completed</li>
                  <li>• Ensure you have sufficient cloud storage space</li>
                  <li>• The process may take several minutes for large datasets</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
