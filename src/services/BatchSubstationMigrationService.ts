import { getFirestore, collection, query, orderBy, startAfter, limit, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { SubstationInspection } from '@/lib/asset-types';

export interface MigrationProgress {
  total: number;
  migrated: number;
  remaining: number;
  currentBatch: number;
  totalBatches: number;
  isRunning: boolean;
  lastError?: string;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  migratedCount: number;
  errorCount: number;
  errors: string[];
}

export class BatchSubstationMigrationService {
  private static instance: BatchSubstationMigrationService;
  private isRunning = false;
  private currentBatch = 0;
  private totalBatches = 0;
  private totalInspections = 0;
  private migratedCount = 0;

  public static getInstance(): BatchSubstationMigrationService {
    if (!BatchSubstationMigrationService.instance) {
      BatchSubstationMigrationService.instance = new BatchSubstationMigrationService();
    }
    return BatchSubstationMigrationService.instance;
  }

  /**
   * Convert base64 image to blob for upload
   */
  private base64ToBlob(base64: string): Blob {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
  }

  /**
   * Upload image to Firebase Storage
   */
  private async uploadImageToStorage(imageData: string, inspectionId: string, imageIndex: number, isAfterImage: boolean = false): Promise<string> {
    try {
      const storage = getStorage();
      const imageType = imageData.startsWith('data:image/jpeg') ? 'jpg' : 'png';
      const imageName = `${isAfterImage ? 'after' : 'before'}_image_${imageIndex}_${Date.now()}.${imageType}`;
      const imagePath = `substation-inspections/${inspectionId}/${imageName}`;
      
      const imageRef = ref(storage, imagePath);
      
      if (imageData.startsWith('data:')) {
        // Base64 image
        const blob = this.base64ToBlob(imageData);
        await uploadBytes(imageRef, blob);
      } else {
        // Already a URL, skip
        return imageData;
      }
      
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (error) {
      console.error(`Error uploading image ${imageIndex} for inspection ${inspectionId}:`, error);
      throw error;
    }
  }

  /**
   * Process a batch of inspections
   */
  private async processBatch(
    batchQuery: any,
    batchSize: number,
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    const batchDocs = await getDocs(batchQuery);
    const results: MigrationResult = {
      success: true,
      message: `Processed batch ${this.currentBatch + 1}`,
      migratedCount: 0,
      errorCount: 0,
      errors: []
    };

    for (const docSnapshot of batchDocs.docs) {
      try {
        const inspection = docSnapshot.data() as SubstationInspection;
        
                 // Check if already migrated
         if (inspection.imageMigrationCompleted) {
           console.log(`Inspection ${docSnapshot.id} already migrated, skipping`);
           continue;
         }
        
                 // Verify document still exists before processing
         const db = getFirestore();
         const docRef = doc(db, 'substationInspections', docSnapshot.id); // Use docSnapshot.id instead of inspection.id
         const docSnap = await getDoc(docRef);
         
         if (!docSnap.exists()) {
           console.log(`Document ${docSnapshot.id} no longer exists, skipping`);
           continue; // Skip this document
         }

        let hasChanges = false;
        const updatedImages: string[] = [];
        const updatedAfterImages: string[] = [];

                 // Process before images
         if (inspection.images && Array.isArray(inspection.images)) {
           console.log(`🔍 Processing inspection ${docSnapshot.id}:`, {
             hasImages: true,
             imageCount: inspection.images.length,
             firstImageType: typeof inspection.images[0],
             firstImageStartsWith: inspection.images[0]?.substring(0, 50),
             isBase64: inspection.images[0]?.startsWith('data:')
           });
          
                     for (let i = 0; i < inspection.images.length; i++) {
             const image = inspection.images[i];
             if (typeof image === 'string' && image.startsWith('data:')) {
               console.log(`✅ Found base64 image ${i} in inspection ${docSnapshot.id}`);
               try {
                 const storageURL = await this.uploadImageToStorage(image, docSnapshot.id, i, false);
                 updatedImages.push(storageURL);
                 hasChanges = true;
               } catch (error) {
                 console.error(`Error processing before image ${i} for inspection ${docSnapshot.id}:`, error);
                 updatedImages.push(image); // Keep original if upload fails
               }
             } else {
               console.log(`⏭️ Image ${i} is not base64:`, typeof image, image?.substring(0, 50));
               updatedImages.push(image);
             }
           }
                 } else {
           console.log(`🔍 Inspection ${docSnapshot.id}:`, {
             hasImages: !!inspection.images,
             imagesType: typeof inspection.images,
             isArray: Array.isArray(inspection.images)
           });
         }

                 // Process after images
         if (inspection.afterImages && Array.isArray(inspection.afterImages)) {
           console.log(`🔍 Processing after images for inspection ${docSnapshot.id}:`, {
             hasAfterImages: true,
             afterImageCount: inspection.afterImages.length,
             firstAfterImageType: typeof inspection.afterImages[0],
             firstAfterImageStartsWith: inspection.afterImages[0]?.substring(0, 50),
             isBase64: inspection.afterImages[0]?.startsWith('data:')
           });
          
                     for (let i = 0; i < inspection.afterImages.length; i++) {
             const image = inspection.afterImages[i];
             if (typeof image === 'string' && image.startsWith('data:')) {
               console.log(`✅ Found base64 after image ${i} in inspection ${docSnapshot.id}`);
               try {
                 const storageURL = await this.uploadImageToStorage(image, docSnapshot.id, i, true);
                 updatedAfterImages.push(storageURL);
                 hasChanges = true;
               } catch (error) {
                 console.error(`Error processing after image ${i} for inspection ${docSnapshot.id}:`, error);
                 updatedAfterImages.push(image); // Keep original if upload fails
               }
             } else {
               console.log(`⏭️ After image ${i} is not base64:`, typeof image, image?.substring(0, 50));
               updatedAfterImages.push(image);
             }
           }
        } else {
          console.log(`🔍 Inspection ${docSnapshot.id} after images:`, {
            hasAfterImages: !!inspection.afterImages,
            afterImagesType: typeof inspection.afterImages,
            isArray: Array.isArray(inspection.afterImages)
          });
        }

        // Update document if changes were made
        if (hasChanges) {
          console.log(`🚀 Migrating inspection ${docSnapshot.id}:`, {
            beforeImagesCount: updatedImages.length,
            afterImagesCount: updatedAfterImages.length,
            hasChanges: true
          });
          
                     try {
             const db = getFirestore();
             const inspectionRef = doc(db, 'substationInspections', docSnapshot.id); // Use docSnapshot.id instead of inspection.id
             
             await updateDoc(inspectionRef, {
               images: updatedImages,
               afterImages: updatedAfterImages,
               imageMigrationCompleted: true,
               imageMigrationDate: new Date().toISOString(),
               batchNumber: this.currentBatch
             });

            results.migratedCount++;
            this.migratedCount++;
            console.log(`✅ Successfully migrated inspection ${docSnapshot.id}`);
          } catch (updateError) {
            console.error(`Error updating document ${docSnapshot.id}:`, updateError);
            
            if (updateError.code === 'not-found') {
              results.errors.push(`Document ${docSnapshot.id}: Document was deleted during update`);
            } else {
              results.errors.push(`Document ${docSnapshot.id}: Update failed - ${updateError.message || updateError}`);
            }
            
            results.errorCount++;
          }
        }

        // Update progress
        if (onProgress) {
          onProgress({
            total: this.totalInspections,
            migrated: this.migratedCount,
            remaining: this.totalInspections - this.migratedCount,
            currentBatch: this.currentBatch,
            totalBatches: this.totalBatches,
            isRunning: this.isRunning
          });
        }

      } catch (error) {
        console.error(`Error processing inspection ${docSnapshot.id}:`, error);
        
        // Better error categorization
        if (error.code === 'not-found') {
          results.errors.push(`Document ${docSnapshot.id}: Document was deleted during migration`);
        } else {
          results.errors.push(`Document ${docSnapshot.id}: ${error.message || error}`);
        }
        
        results.errorCount++;
      }
    }

    return results;
  }

  /**
   * Migrate all substation inspection images
   */
  public async migrateAllSubstationImages(
    batchSize: number = 10,
    onProgress?: (progress: MigrationProgress) => void,
    onBatchComplete?: (result: MigrationResult) => void
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('Migration already in progress');
    }

    try {
      this.isRunning = true;
      this.currentBatch = 0;
      this.migratedCount = 0;

      const db = getFirestore();
      const inspectionsRef = collection(db, 'substationInspections');
      
      // Get total count for progress tracking
      const countQuery = query(inspectionsRef, limit(1000)); // Reasonable limit for counting
      const countSnapshot = await getDocs(countQuery);
      this.totalInspections = countSnapshot.size;
      this.totalBatches = Math.ceil(this.totalInspections / batchSize);

      console.log(`Starting substation image migration: ${this.totalInspections} inspections, ${this.totalBatches} batches`);

      // Initial progress update
      if (onProgress) {
        onProgress({
          total: this.totalInspections,
          migrated: 0,
          remaining: this.totalInspections,
          currentBatch: 0,
          totalBatches: this.totalBatches,
          isRunning: true
        });
      }

      let lastDoc: any = null;
      let hasMore = true;

      while (hasMore && this.isRunning) {
        try {
          let batchQuery;
          
          if (lastDoc) {
            batchQuery = query(
              inspectionsRef,
              orderBy('__name__'),
              startAfter(lastDoc),
              limit(batchSize)
            );
          } else {
            batchQuery = query(
              inspectionsRef,
              orderBy('__name__'),
              limit(batchSize)
            );
          }

          const batchSnapshot = await getDocs(batchQuery);
          
          if (batchSnapshot.empty) {
            hasMore = false;
            break;
          }

          // Process batch
          const result = await this.processBatch(batchQuery, batchSize, onProgress);
          
          if (onBatchComplete) {
            onBatchComplete(result);
          }

          // Update for next batch
          lastDoc = batchSnapshot.docs[batchSnapshot.docs.length - 1];
          this.currentBatch++;

          // Check if we should continue
          if (batchSnapshot.docs.length < batchSize) {
            hasMore = false;
          }

          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`Error processing batch ${this.currentBatch}:`, error);
          this.currentBatch++;
          
          if (onProgress) {
            onProgress({
              total: this.totalInspections,
              migrated: this.migratedCount,
              remaining: this.totalInspections - this.migratedCount,
              currentBatch: this.currentBatch,
              totalBatches: this.totalBatches,
              isRunning: true,
              lastError: `Batch ${this.currentBatch}: ${error}`
            });
          }
        }
      }

      console.log(`Substation image migration completed: ${this.migratedCount} inspections migrated`);

    } catch (error) {
      console.error('Error in substation image migration:', error);
      throw error;
    } finally {
      this.isRunning = false;
      
      if (onProgress) {
        onProgress({
          total: this.totalInspections,
          migrated: this.migratedCount,
          remaining: this.totalInspections - this.migratedCount,
          currentBatch: this.currentBatch,
          totalBatches: this.totalBatches,
          isRunning: false
        });
      }
    }
  }

  /**
   * Stop the migration process
   */
  public stopMigration(): void {
    this.isRunning = false;
    console.log('Substation image migration stopped by user');
  }

  /**
   * Get current migration progress
   */
  public async getMigrationProgress(): Promise<MigrationProgress> {
    try {
      const db = getFirestore();
      const inspectionsRef = collection(db, 'substationInspections');
      
      // Get a small sample to estimate progress
      const sampleQuery = query(inspectionsRef, limit(5));
      const sampleSnapshot = await getDocs(sampleQuery);
      
      let migratedCount = 0;
      let totalCount = 0;
      
      console.log('🔍 Sample documents for debugging:');
      sampleSnapshot.forEach(doc => {
        const inspection = doc.data() as SubstationInspection;
        totalCount++;
        
        console.log(`📄 Document ${doc.id}:`, {
          hasImages: !!inspection.images,
          imagesType: typeof inspection.images,
          isArray: Array.isArray(inspection.images),
          imageCount: inspection.images?.length || 0,
          firstImage: inspection.images?.[0]?.substring(0, 100) || 'none',
          hasAfterImages: !!inspection.afterImages,
          afterImagesType: typeof inspection.afterImages,
          afterImageCount: inspection.afterImages?.length || 0,
          firstAfterImage: inspection.afterImages?.[0]?.substring(0, 100) || 'none',
          imageMigrationCompleted: inspection.imageMigrationCompleted
        });
        
        if (inspection.imageMigrationCompleted) {
          migratedCount++;
        }
      });

      // Estimate total based on sample
      const estimatedTotal = Math.max(100, sampleSnapshot.size * 20); // Conservative estimate
      const estimatedMigrated = Math.round((migratedCount / sampleSnapshot.size) * estimatedTotal);

      return {
        total: estimatedTotal,
        migrated: estimatedMigrated,
        remaining: estimatedTotal - estimatedMigrated,
        currentBatch: this.currentBatch,
        totalBatches: this.totalBatches,
        isRunning: this.isRunning
      };
    } catch (error) {
      console.error('Error getting migration progress:', error);
      return {
        total: 0,
        migrated: 0,
        remaining: 0,
        currentBatch: 0,
        totalBatches: 0,
        isRunning: false
      };
    }
  }
}
