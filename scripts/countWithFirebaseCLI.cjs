const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting collection count with Firebase CLI...');

// Check if Firebase CLI is installed
exec('firebase --version', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Firebase CLI not found. Please install it first:');
    console.log('   npm install -g firebase-tools');
    console.log('   firebase login');
    return;
  }
  
  console.log('✅ Firebase CLI version:', stdout.trim());
  
  // Get the project ID from .firebaserc
  const firebasercPath = path.join(__dirname, '..', '.firebaserc');
  
  try {
    const firebasercContent = fs.readFileSync(firebasercPath, 'utf8');
    const firebaserc = JSON.parse(firebasercContent);
    
    if (!firebaserc.projects || !firebaserc.projects.default) {
      console.error('❌ No default project found in .firebaserc');
      return;
    }
    
    const projectId = firebaserc.projects.default;
    console.log('🔗 Project ID:', projectId);
    
    // Use Firebase CLI to get collection info
    console.log('🔍 Attempting to get collection info...');
    
    // First, try to get a sample document to see the structure
    const sampleQuery = `firebase firestore:get overheadLineInspections --project ${projectId} --limit 1`;
    
    exec(sampleQuery, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️ Could not get sample document:', error.message);
        console.log('💡 This might mean the collection is very large or has permission issues');
        
        // Try a different approach - check if we can list collections
        console.log('\n🔍 Trying to list collections...');
        const listCollections = `firebase firestore:collections --project ${projectId}`;
        
        exec(listCollections, (error, stdout, stderr) => {
          if (error) {
            console.log('❌ Could not list collections:', error.message);
            console.log('\n💡 Alternative approaches:');
            console.log('   1. Use Firebase Console to view collection size');
            console.log('   2. Check Firestore usage in Firebase Console');
            console.log('   3. Use the web-based migration page we created');
          } else {
            console.log('✅ Collections found:');
            console.log(stdout);
          }
        });
        
      } else {
        console.log('✅ Sample document retrieved:');
        console.log(stdout);
        
        // Now try to get more documents to estimate size
        console.log('\n🔍 Attempting to get more documents for size estimation...');
        const sizeQuery = `firebase firestore:get overheadLineInspections --project ${projectId} --limit 10`;
        
        exec(sizeQuery, (error, stdout, stderr) => {
          if (error) {
            console.log('⚠️ Could not get multiple documents:', error.message);
            console.log('💡 Collection might be too large for CLI operations');
          } else {
            console.log('✅ Multiple documents retrieved for analysis');
            
            // Parse the output to count documents
            const lines = stdout.split('\n');
            let documentCount = 0;
            let hasImages = 0;
            
            lines.forEach(line => {
              if (line.includes('Document ID:')) {
                documentCount++;
              }
              if (line.includes('images:') && line.includes('[')) {
                hasImages++;
              }
            });
            
            console.log(`\n📊 Analysis results:`);
            console.log(`  - Documents found: ${documentCount}`);
            console.log(`  - Documents with images: ${hasImages}`);
            console.log(`  - This is a sample - actual collection may be much larger`);
          }
        });
      }
    });
    
  } catch (parseError) {
    console.error('❌ Error parsing .firebaserc file:', parseError.message);
    console.log('💡 Please check the .firebaserc file format');
  }
});
