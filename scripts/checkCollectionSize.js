const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../secure/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCollectionSize() {
  try {
    console.log('🔍 Checking overheadLineInspections collection size...');
    
    // Get collection reference
    const collectionRef = db.collection('overheadLineInspections');
    
    // Get just the count without loading documents
    const snapshot = await collectionRef.get();
    
    console.log(`📊 Collection contains ${snapshot.size} documents`);
    
    if (snapshot.size > 0) {
      // Get just the first document to check structure
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
      }
      
      // Estimate total size
      let totalSize = 0;
      let documentsWithImages = 0;
      
      snapshot.docs.forEach((doc, index) => {
        const docData = doc.data();
        if (docData.images && Array.isArray(docData.images)) {
          documentsWithImages++;
          docData.images.forEach(img => {
            if (typeof img === 'string') {
              totalSize += img.length;
            }
          });
        }
        
        // Only process first 10 documents for performance
        if (index >= 9) return;
      });
      
      console.log('📈 Size estimation (first 10 docs):');
      console.log('  - Documents with images:', documentsWithImages);
      console.log('  - Total image data size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('  - Estimated full collection size:', 
        (totalSize * snapshot.size / 10 / 1024 / 1024).toFixed(2), 'MB');
    }
    
  } catch (error) {
    console.error('❌ Error checking collection:', error);
  } finally {
    process.exit(0);
  }
}

checkCollectionSize();
