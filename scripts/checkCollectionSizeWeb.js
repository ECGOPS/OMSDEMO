// This script can be run in the browser console to check collection size
// Copy and paste this into your browser console on the Image Migration page

async function checkCollectionSizeWeb() {
  try {
    console.log('🔍 Checking overheadLineInspections collection size (web version)...');
    
    // Import Firebase functions
    const { db } = await import('/src/config/firebase');
    const { collection, getDocs, query, limit, orderBy } = await import('firebase/firestore');
    
    // Get collection reference
    const collectionRef = collection(db, 'overheadLineInspections');
    
    console.log('🔍 Attempting to get collection count...');
    
    // Try with a very small limit first
    const countQuery = query(collectionRef, limit(1));
    
    // Add timeout to prevent hanging
    const snapshot = await Promise.race([
      getDocs(countQuery),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
      )
    ]);
    
    console.log(`📊 Collection contains at least ${snapshot.size} documents`);
    
    if (snapshot.size > 0) {
      // Get the first document to check structure
      const firstDoc = snapshot.docs[0];
      const data = firstDoc.data();
      
      console.log('📋 First document structure:');
      console.log('  - ID:', firstDoc.id);
      console.log('  - Has images field:', !!data.images);
      console.log('  - Images array:', Array.isArray(data.images));
      console.log('  - Image count:', data.images?.length || 0);
      
      if (data.images && data.images.length > 0) {
        const firstImage = data.images[0];
        console.log('  - First image type:', typeof firstImage);
        console.log('  - First image length:', firstImage?.length || 0);
        console.log('  - Is base64:', firstImage?.startsWith('data:image') || false);
        console.log('  - First 100 chars:', firstImage?.substring(0, 100) + '...');
        
        // Calculate size of first image
        const imageSizeKB = (firstImage.length / 1024).toFixed(2);
        console.log('  - First image size:', imageSizeKB, 'KB');
      }
      
      // Try to get a few more documents to estimate total size
      console.log('🔍 Attempting to get more documents for size estimation...');
      
      const sizeQuery = query(collectionRef, limit(10));
      const sizeSnapshot = await Promise.race([
        getDocs(sizeQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Size query timeout after 15 seconds')), 15000)
        )
      ]);
      
      console.log(`📊 Retrieved ${sizeSnapshot.size} documents for size estimation`);
      
      let totalSize = 0;
      let documentsWithImages = 0;
      
      sizeSnapshot.docs.forEach((doc, index) => {
        const docData = doc.data();
        if (docData.images && Array.isArray(docData.images)) {
          documentsWithImages++;
          docData.images.forEach(img => {
            if (typeof img === 'string') {
              totalSize += img.length;
            }
          });
        }
      });
      
      console.log('📈 Size estimation:');
      console.log('  - Documents with images:', documentsWithImages);
      console.log('  - Total image data size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
      
      // Estimate full collection size (assuming uniform distribution)
      if (sizeSnapshot.size > 0) {
        const avgSizePerDoc = totalSize / sizeSnapshot.size;
        console.log('  - Average size per document:', (avgSizePerDoc / 1024).toFixed(2), 'KB');
        console.log('  - Estimated full collection size:', 
          (avgSizePerDoc * snapshot.size / 1024 / 1024).toFixed(2), 'MB');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking collection:', error);
    
    if (error.message.includes('timeout')) {
      console.log('💡 This suggests the collection is very large and queries are hanging');
      console.log('💡 You likely have thousands of documents with massive base64 images');
    }
  }
}

// Run the function
console.log('🚀 Starting collection size check...');
checkCollectionSizeWeb();
