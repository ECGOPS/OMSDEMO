import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/config/firebase';
import { collection, doc, updateDoc, getDocs, query, where, limit } from 'firebase/firestore';

export class ImageMigrationService {
  private static instance: ImageMigrationService;
  
  public static getInstance(): ImageMigrationService {
    if (!ImageMigrationService.instance) {
      ImageMigrationService.instance = new ImageMigrationService();
    }
    return ImageMigrationService.instance;
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
   * Migrate a single inspection's images from base64 to URLs
   */
  public async migrateInspectionImages(inspectionId: string, base64Images: string[]): Promise<string[]> {
    const imageUrls: string[] = [];
    
    for (let i = 0; i < base64Images.length; i++) {
      try {
        const imageUrl = await this.uploadImageToStorage(base64Images[i], inspectionId, i);
        imageUrls.push(imageUrl);
        console.log(`Migrated image ${i + 1}/${base64Images.length} for inspection ${inspectionId}`);
      } catch (error) {
        console.error(`Failed to migrate image ${i} for inspection ${inspectionId}:`, error);
        // Keep original base64 if migration fails
        imageUrls.push(base64Images[i]);
      }
    }
    
    return imageUrls;
  }

  /**
   * Migrate all overhead line inspections
   */
  public async migrateAllOverheadLineImages(): Promise<void> {
    try {
      console.log('Starting image migration for all overhead line inspections...');
      
      const inspectionsRef = collection(db, 'overheadLineInspections');
      const snapshot = await getDocs(inspectionsRef);
      
      let migratedCount = 0;
      let totalImages = 0;
      
      for (const docSnapshot of snapshot.docs) {
        const inspection = docSnapshot.data();
        
        if (inspection.images && Array.isArray(inspection.images) && inspection.images.length > 0) {
          // Check if images are already URLs (already migrated)
          const hasBase64Images = inspection.images.some((img: string) => 
            img.startsWith('data:image') || img.length > 1000
          );
          
          if (hasBase64Images) {
            console.log(`Migrating ${inspection.images.length} images for inspection ${docSnapshot.id}`);
            
            try {
              const imageUrls = await this.migrateInspectionImages(docSnapshot.id, inspection.images);
              
              // Update the inspection with new image URLs
              await updateDoc(doc(db, 'overheadLineInspections', docSnapshot.id), {
                images: imageUrls,
                imageMigrationCompleted: true,
                imageMigrationDate: new Date().toISOString()
              });
              
              migratedCount++;
              totalImages += imageUrls.length;
              
              console.log(`Successfully migrated inspection ${docSnapshot.id}`);
            } catch (error) {
              console.error(`Failed to migrate inspection ${docSnapshot.id}:`, error);
            }
          }
        }
      }
      
      console.log(`Migration completed. Migrated ${migratedCount} inspections with ${totalImages} total images.`);
    } catch (error) {
      console.error('Error during image migration:', error);
      throw error;
    }
  }

  /**
   * Get migration progress
   */
  public async getMigrationProgress(): Promise<{ total: number; migrated: number; remaining: number }> {
    try {
      console.log('🔍 Starting migration progress check...');
      console.log('🔍 Database instance:', db);
      console.log('🔍 Collection path: overheadLineInspections');
      
      const inspectionsRef = collection(db, 'overheadLineInspections');
      console.log('🔍 Collection reference created:', inspectionsRef);
      
      console.log('🔍 Attempting to get documents...');
      
      // Add timeout and limit to prevent hanging on large datasets
      const limitedQuery = query(inspectionsRef, limit(100)); // Limit to 100 for testing
      console.log('🔍 Using limited query (max 100 documents)');
      
      const snapshot = await Promise.race([
        getDocs(limitedQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
        )
      ]);
      
      console.log('🔍 Documents retrieved successfully');
      
      console.log(`📊 Found ${snapshot.docs.length} total overhead line inspections`);
      
      let total = 0;
      let migrated = 0;
      let totalImages = 0;
      let base64Images = 0;
      
      snapshot.docs.forEach((doc, index) => {
        const inspection = doc.data();
        console.log(`📋 Inspection ${index + 1}:`, {
          id: doc.id,
          hasImages: !!inspection.images,
          imagesArray: Array.isArray(inspection.images),
          imageCount: inspection.images?.length || 0,
          firstImageType: inspection.images?.[0]?.substring(0, 50) + '...' || 'No images'
        });
        
        if (inspection.images && Array.isArray(inspection.images) && inspection.images.length > 0) {
          total++;
          totalImages += inspection.images.length;
          
          // Check if any images are base64
          const hasBase64 = inspection.images.some((img: string) => 
            img.startsWith('data:image') || img.length > 1000
          );
          
          if (hasBase64) {
            base64Images += inspection.images.filter((img: string) => 
              img.startsWith('data:image') || img.length > 1000
            ).length;
          }
          
          if (inspection.imageMigrationCompleted) {
            migrated++;
          }
        }
      });
      
      console.log(`📈 Progress Summary:`, {
        totalInspections: total,
        totalImages: totalImages,
        base64Images: base64Images,
        migratedInspections: migrated,
        remainingInspections: total - migrated
      });
      
      return {
        total,
        migrated,
        remaining: total - migrated
      };
    } catch (error) {
      console.error('❌ Error getting migration progress:', error);
      return { total: 0, migrated: 0, remaining: 0 };
    }
  }
}
