const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Path to service account file in root directory
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');

async function countCollectionWithServiceAccount() {
  try {
    console.log('🔍 Starting collection count with service account...');
    
    // Check if service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Service account file not found at:', serviceAccountPath);
      console.log('💡 Please ensure service-account.json exists in the root directory');
      return;
    }
    
    console.log('✅ Service account file found');
    
    // Read and parse service account
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Service account parsed successfully');
    
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('✅ Firebase Admin SDK initialized');
    console.log('🔗 Project ID:', serviceAccount.project_id);
    
    const db = admin.firestore();
    const collectionRef = db.collection('overheadLineInspections');
    
    console.log('🔍 Attempting to count collection...');
    
    // Method 1: Try to get all documents (may timeout on very large collections)
    try {
      console.log('📊 Method 1: Counting all documents...');
      const snapshot = await collectionRef.get();
      console.log(`✅ Total documents: ${snapshot.size}`);
      
      if (snapshot.size > 0) {
        // Analyze first few documents
        const firstDoc = snapshot.docs[0];
        const data = firstDoc.data();
        
        console.log('\n📋 First document analysis:');
        console.log('  - ID:', firstDoc.id);
        console.log('  - Has images field:', !!data.images);
        console.log('  - Images array:', Array.isArray(data.images));
        console.log('  - Image count:', data.images?.length || 0);
        
        if (data.images && data.images.length > 0) {
          const firstImage = data.images[0];
          console.log('  - First image type:', typeof firstImage);
          console.log('  - First image length:', firstImage?.length || 0);
          console.log('  - First image size:', (firstImage?.length / 1024).toFixed(2), 'KB');
          console.log('  - Is base64:', firstImage?.startsWith('data:image') || false);
        }
        
        // Sample analysis of first 10 documents
        console.log('\n📊 Sample analysis of first 10 documents:');
        let totalImageSize = 0;
        let documentsWithImages = 0;
        let base64Images = 0;
        
        snapshot.docs.slice(0, 10).forEach((doc, index) => {
          const docData = doc.data();
          if (docData.images && Array.isArray(docData.images)) {
            documentsWithImages++;
            docData.images.forEach(img => {
              if (typeof img === 'string') {
                totalImageSize += img.length;
                if (img.startsWith('data:image') || img.length > 1000) {
                  base64Images++;
                }
              }
            });
          }
        });
        
        console.log('  - Documents with images:', documentsWithImages);
        console.log('  - Total image data size:', (totalImageSize / 1024 / 1024).toFixed(2), 'MB');
        console.log('  - Base64 images found:', base64Images);
        
        // Estimate full collection size
        const avgSizePerDoc = totalImageSize / Math.min(snapshot.size, 10);
        const estimatedTotalSize = (avgSizePerDoc * snapshot.size / 1024 / 1024).toFixed(2);
        console.log('  - Estimated full collection size:', estimatedTotalSize, 'MB');
      }
      
    } catch (error) {
      console.log('⚠️ Method 1 failed:', error.message);
      
      // Method 2: Try with pagination and smaller batches
      console.log('\n📊 Method 2: Counting with pagination...');
      try {
        let totalCount = 0;
        let batchCount = 0;
        let lastDoc = null;
        const batchSize = 100;
        
        while (true) {
          batchCount++;
          let query = collectionRef.orderBy('__name__').limit(batchSize);
          
          if (lastDoc) {
            query = query.startAfter(lastDoc);
          }
          
          console.log(`  🔍 Processing batch ${batchCount}...`);
          const snapshot = await query.get();
          
          if (snapshot.empty) {
            break;
          }
          
          totalCount += snapshot.docs.length;
          lastDoc = snapshot.docs[snapshot.docs.length - 1];
          
          console.log(`  ✅ Batch ${batchCount}: ${snapshot.docs.length} documents (Total: ${totalCount})`);
          
          // Safety check - don't process more than 10,000 documents
          if (totalCount >= 10000) {
            console.log('  ⚠️ Reached safety limit of 10,000 documents');
            break;
          }
        }
        
        console.log(`\n📊 Final count with pagination: ${totalCount} documents`);
        
      } catch (paginationError) {
        console.log('⚠️ Method 2 also failed:', paginationError.message);
        
        // Method 3: Just check if collection exists and has any data
        console.log('\n📊 Method 3: Basic collection check...');
        try {
          const testQuery = collectionRef.limit(1);
          const testSnapshot = await testQuery.get();
          
          if (testSnapshot.empty) {
            console.log('✅ Collection exists but is empty');
          } else {
            console.log('✅ Collection exists and has at least 1 document');
            console.log('💡 Collection is too large to count efficiently');
            console.log('💡 Consider using Firestore console or Firebase CLI for exact count');
          }
        } catch (basicError) {
          console.log('❌ Basic collection check failed:', basicError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during collection count:', error);
  } finally {
    // Clean up
    if (admin.apps.length > 0) {
      await admin.app().delete();
      console.log('✅ Firebase Admin SDK cleaned up');
    }
  }
}

// Run the function
console.log('🚀 Starting collection count...');
countCollectionWithServiceAccount()
  .then(() => {
    console.log('✅ Collection count completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Collection count failed:', error);
    process.exit(1);
  });
