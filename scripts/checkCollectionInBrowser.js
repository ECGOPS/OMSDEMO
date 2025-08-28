// This script can be run in the browser console on the Image Migration page
// Copy and paste this into your browser console

async function checkCollectionInBrowser() {
  try {
    console.log('🔍 Checking overheadLineInspections collection in browser...');
    
    // Import Firebase functions
    const { db } = await import('/src/config/firebase');
    const { collection, getDocs, query, limit, orderBy, startAfter } = await import('firebase/firestore');
    
    // Get collection reference
    const collectionRef = collection(db, 'overheadLineInspections');
    
    console.log('🔍 Attempting to get collection info...');
    
    // Method 1: Try with a very small limit first
    console.log('📊 Method 1: Testing with limit 1...');
    try {
      const countQuery = query(collectionRef, limit(1));
      const snapshot = await Promise.race([
        getDocs(countQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
        )
      ]);
      
      console.log(`✅ Found at least ${snapshot.size} documents`);
      
      if (snapshot.size > 0) {
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
      }
      
    } catch (error) {
      console.log('⚠️ Method 1 failed:', error.message);
    }
    
    // Method 2: Try with pagination to estimate total size
    console.log('\n📊 Method 2: Estimating total size with pagination...');
    try {
      let totalCount = 0;
      let batchCount = 0;
      let lastDoc = null;
      const batchSize = 50;
      let hasMore = true;
      
      while (hasMore && batchCount < 20) { // Limit to 20 batches for safety
        batchCount++;
        
        let batchQuery = query(collectionRef, orderBy('__name__'), limit(batchSize));
        if (lastDoc) {
          batchQuery = query(collectionRef, orderBy('__name__'), startAfter(lastDoc), limit(batchSize));
        }
        
        console.log(`  🔍 Processing batch ${batchCount}...`);
        
        const snapshot = await Promise.race([
          getDocs(batchQuery),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Batch ${batchCount} timeout after 15 seconds`)), 15000)
          )
        ]);
        
        if (snapshot.empty) {
          console.log('  ✅ No more documents');
          hasMore = false;
          break;
        }
        
        totalCount += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        
        console.log(`  ✅ Batch ${batchCount}: ${snapshot.docs.length} documents (Total: ${totalCount})`);
        
        // Analyze this batch for image data
        let batchImageSize = 0;
        let batchDocumentsWithImages = 0;
        
        snapshot.docs.forEach(doc => {
          const docData = doc.data();
          if (docData.images && Array.isArray(docData.images)) {
            batchDocumentsWithImages++;
            docData.images.forEach(img => {
              if (typeof img === 'string') {
                batchImageSize += img.length;
              }
            });
          }
        });
        
        console.log(`  📸 Batch ${batchCount} images: ${batchDocumentsWithImages} docs, ${(batchImageSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`\n📊 Pagination results:`);
      console.log(`  - Total documents processed: ${totalCount}`);
      console.log(`  - Batches processed: ${batchCount}`);
      console.log(`  - This is a sample - actual collection may be much larger`);
      
      if (totalCount >= 1000) {
        console.log('  🚨 Collection appears to be very large (>1000 documents)');
        console.log('  💡 This explains why queries are hanging');
        console.log('  💡 The batch migration approach is the right solution');
      }
      
    } catch (error) {
      console.log('⚠️ Method 2 failed:', error.message);
    }
    
    // Method 3: Check if collection has any documents at all
    console.log('\n📊 Method 3: Basic collection check...');
    try {
      const testQuery = query(collectionRef, limit(1));
      const testSnapshot = await Promise.race([
        getDocs(testQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Basic check timeout after 5 seconds')), 5000)
        )
      ]);
      
      if (testSnapshot.empty) {
        console.log('✅ Collection exists but is empty');
      } else {
        console.log('✅ Collection exists and has at least 1 document');
        console.log('💡 Collection size estimation completed');
      }
      
    } catch (error) {
      console.log('❌ Basic collection check failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error checking collection:', error);
  }
}

// Run the function
console.log('🚀 Starting collection check in browser...');
checkCollectionInBrowser();
