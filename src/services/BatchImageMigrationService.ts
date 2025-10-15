import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/config/firebase';
import { collection, doc, updateDoc, getDocs, query, limit, startAfter, orderBy, writeBatch } from 'firebase/firestore';

export class BatchImageMigrationService {
  private static instance: BatchImageMigrationService;
  
  public static getInstance(): BatchImageMigrationService {
    if (!BatchImageMigrationService.instance) {
      BatchImageMigrationService.instance = new BatchImageMigrationService();
    }
    return BatchImageMigrationService.instance;
  }

  /**
   * Convert base64 image to blob
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
   * Upload image to Firebase Storage and return URL
   */
  private async uploadImageToStorage(base64Image: string, inspectionId: string, imageIndex: number): Promise<string> {
    try {
      const blob = this.base64ToBlob(base64Image);
      const fileName = `overhead-line-inspections/${inspectionId}/image_${imageIndex}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error(`Error uploading image ${imageIndex} for inspection ${inspectionId}:`, error);
      throw error;
    }
  }

  /**
   * Process a single batch of documents
   */
  private async processBatch(
    batchDocs: any[], 
    batchNumber: number, 
    onProgress: (batchNumber: number, processed: number, total: number) => void
  ): Promise<{ processed: number; migrated: number; errors: number }> {
    let processed = 0;
    let migrated = 0;
    let errors = 0;

    console.log(`🔄 Processing batch ${batchNumber} with ${batchDocs.length} documents`);

    for (const docSnapshot of batchDocs) {
      try {
        const inspection = docSnapshot.data();
        
        if (inspection.images && Array.isArray(inspection.images) && inspection.images.length > 0) {
          // Check if images are already URLs (already migrated)
          const hasBase64Images = inspection.images.some((img: string) => 
            img.startsWith('data:image') || img.length > 1000
          );
          
          if (hasBase64Images) {
            console.log(`📸 Migrating ${inspection.images.length} images for inspection ${docSnapshot.id}`);
            
            try {
              const imageUrls = await Promise.all(
                inspection.images.map(async (image: string, index: number) => {
                  if (typeof image === 'string' && (image.startsWith('data:image') || image.length > 1000)) {
                    return await this.uploadImageToStorage(image, docSnapshot.id, index);
                  }
                  return image; // Already a URL
                })
              );
              
              // Update the inspection with new image URLs
              await updateDoc(doc(db, 'overheadLineInspections', docSnapshot.id), {
                images: imageUrls,
                imageMigrationCompleted: true,
                imageMigrationDate: new Date().toISOString(),
                batchNumber: batchNumber
              });
              
              migrated++;
              console.log(`✅ Successfully migrated inspection ${docSnapshot.id}`);
            } catch (error) {
              console.error(`❌ Failed to migrate inspection ${docSnapshot.id}:`, error);
              errors++;
            }
          }
        }
        
        processed++;
        onProgress(batchNumber, processed, batchDocs.length);
        
      } catch (error) {
        console.error(`❌ Error processing document ${docSnapshot.id}:`, error);
        errors++;
        processed++;
      }
    }

    return { processed, migrated, errors };
  }

  /**
   * Migrate all overhead line inspections in batches
   */
  public async migrateAllOverheadLineImages(
    batchSize: number = 10,
    onProgress?: (batchNumber: number, processed: number, total: number, overallProgress: number) => void
  ): Promise<{ totalBatches: number; totalProcessed: number; totalMigrated: number; totalErrors: number }> {
    try {
      console.log('🚀 Starting batch image migration...');
      console.log(`📦 Batch size: ${batchSize} documents`);
      
      let totalProcessed = 0;
      let totalMigrated = 0;
      let totalErrors = 0;
      let batchNumber = 0;
      let lastDoc: any = null;
      let hasMore = true;

      while (hasMore) {
        batchNumber++;
        
        try {
          // Build query for this batch
          let batchQuery = query(
            collection(db, 'overheadLineInspections'),
            orderBy('__name__'), // Order by document ID for consistent pagination
            limit(batchSize)
          );
          
          if (lastDoc) {
            batchQuery = query(
              collection(db, 'overheadLineInspections'),
              orderBy('__name__'),
              startAfter(lastDoc),
              limit(batchSize)
            );
          }

          console.log(`🔍 Fetching batch ${batchNumber}...`);
          
          // Add timeout to prevent hanging
          const snapshot = await Promise.race([
            getDocs(batchQuery),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Batch ${batchNumber} query timeout after 30 seconds`)), 30000)
            )
          ]);

          if (snapshot.empty) {
            console.log('✅ No more documents to process');
            hasMore = false;
            break;
          }

          console.log(`📊 Batch ${batchNumber}: Retrieved ${snapshot.docs.length} documents`);
          
          // Process this batch
          const batchResult = await this.processBatch(
            snapshot.docs, 
            batchNumber,
            (batchNum, processed, total) => {
              if (onProgress) {
                const overallProgress = Math.round(((totalProcessed + processed) / (totalProcessed + total)) * 100);
                onProgress(batchNum, processed, total, overallProgress);
              }
            }
          );

          totalProcessed += batchResult.processed;
          totalMigrated += batchResult.migrated;
          totalErrors += batchResult.errors;

          // Update last document for next batch
          lastDoc = snapshot.docs[snapshot.docs.length - 1];

          console.log(`✅ Batch ${batchNumber} completed:`, {
            processed: batchResult.processed,
            migrated: batchResult.migrated,
            errors: batchResult.errors,
            totalProcessed,
            totalMigrated,
            totalErrors
          });

          // Small delay between batches to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Error processing batch ${batchNumber}:`, error);
          
          if (error.message.includes('timeout')) {
            console.log('⏰ Batch timed out, retrying with smaller batch size...');
            batchSize = Math.max(1, Math.floor(batchSize / 2));
            console.log(`📦 New batch size: ${batchSize}`);
          }
          
          totalErrors++;
          
          // If we get too many errors, stop
          if (totalErrors > 10) {
            console.error('❌ Too many errors, stopping migration');
            break;
          }
        }
      }

      console.log('🎉 Batch migration completed!', {
        totalBatches: batchNumber,
        totalProcessed,
        totalMigrated,
        totalErrors
      });

      return {
        totalBatches: batchNumber,
        totalProcessed,
        totalMigrated,
        totalErrors
      };

    } catch (error) {
      console.error('❌ Error during batch migration:', error);
      throw error;
    }
  }

  /**
   * Get migration progress (without loading all documents)
   */
  public async getMigrationProgress(): Promise<{ total: number; migrated: number; remaining: number }> {
    try {
      console.log('🔍 Getting migration progress...');
      
      // Use a very small sample to estimate progress
      const sampleQuery = query(
        collection(db, 'overheadLineInspections'),
        limit(5)
      );
      
      const snapshot = await Promise.race([
        getDocs(sampleQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Progress query timeout after 10 seconds')), 10000)
        )
      ]);

      if (snapshot.empty) {
        return { total: 0, migrated: 0, remaining: 0 };
      }

      let total = 0;
      let migrated = 0;

      snapshot.docs.forEach(doc => {
        const inspection = doc.data();
        if (inspection.images && Array.isArray(inspection.images) && inspection.images.length > 0) {
          total++;
          if (inspection.imageMigrationCompleted) {
            migrated++;
          }
        }
      });

      // Estimate total based on sample
      const estimatedTotal = total > 0 ? Math.max(total, 100) : 0; // Assume at least 100 if we found any
      const estimatedMigrated = migrated;
      const estimatedRemaining = estimatedTotal - estimatedMigrated;

      console.log('📊 Progress estimation:', {
        sampleTotal: total,
        sampleMigrated: migrated,
        estimatedTotal: estimatedTotal,
        estimatedMigrated: estimatedMigrated,
        estimatedRemaining: estimatedRemaining
      });

      return {
        total: estimatedTotal,
        migrated: estimatedMigrated,
        remaining: estimatedRemaining
      };

    } catch (error) {
      console.error('❌ Error getting migration progress:', error);
      return { total: 0, migrated: 0, remaining: 0 };
    }
  }
}
