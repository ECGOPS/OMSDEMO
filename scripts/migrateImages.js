const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../secure/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'your-project-id.appspot.com' // Replace with your bucket
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function base64ToBuffer(base64String) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

async function uploadImageToStorage(base64Image, inspectionId, imageIndex) {
  try {
    const buffer = await base64ToBuffer(base64Image);
    const fileName = `overhead-line-inspections/${inspectionId}/image_${imageIndex}_${Date.now()}.jpg`;
    const file = bucket.file(fileName);
    
    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
      }
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    console.log(`Uploaded image ${imageIndex + 1} for inspection ${inspectionId}`);
    
    return publicUrl;
  } catch (error) {
    console.error(`Error uploading image ${imageIndex} for inspection ${inspectionId}:`, error);
    throw error;
  }
}

async function migrateInspectionImages(inspectionId, base64Images) {
  const imageUrls = [];
  
  for (let i = 0; i < base64Images.length; i++) {
    try {
      const imageUrl = await uploadImageToStorage(base64Images[i], inspectionId, i);
      imageUrls.push(imageUrl);
    } catch (error) {
      console.error(`Failed to migrate image ${i} for inspection ${inspectionId}:`, error);
      // Keep original base64 if migration fails
      imageUrls.push(base64Images[i]);
    }
  }
  
  return imageUrls;
}

async function migrateAllOverheadLineImages() {
  try {
    console.log('Starting image migration for all overhead line inspections...');
    
    const inspectionsRef = db.collection('overheadLineInspections');
    const snapshot = await inspectionsRef.get();
    
    let migratedCount = 0;
    let totalImages = 0;
    let errorCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const inspection = docSnapshot.data();
      
      if (inspection.images && Array.isArray(inspection.images) && inspection.images.length > 0) {
        // Check if images are already URLs (already migrated)
        const hasBase64Images = inspection.images.some(img => 
          img.startsWith('data:image') || img.length > 1000
        );
        
        if (hasBase64Images) {
          console.log(`\nMigrating ${inspection.images.length} images for inspection ${docSnapshot.id}`);
          
          try {
            const imageUrls = await migrateInspectionImages(docSnapshot.id, inspection.images);
            
            // Update the inspection with new image URLs
            await docSnapshot.ref.update({
              images: imageUrls,
              imageMigrationCompleted: true,
              imageMigrationDate: new Date().toISOString()
            });
            
            migratedCount++;
            totalImages += imageUrls.length;
            
            console.log(`✅ Successfully migrated inspection ${docSnapshot.id}`);
          } catch (error) {
            console.error(`❌ Failed to migrate inspection ${docSnapshot.id}:`, error);
            errorCount++;
          }
        }
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Results:`);
    console.log(`   - Total inspections processed: ${snapshot.docs.length}`);
    console.log(`   - Successfully migrated: ${migratedCount}`);
    console.log(`   - Total images migrated: ${totalImages}`);
    console.log(`   - Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Error during image migration:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  migrateAllOverheadLineImages()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = {
  migrateAllOverheadLineImages,
  migrateInspectionImages
};
