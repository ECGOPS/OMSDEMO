const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json'); // Update this path

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Script to populate public collections for signup
 * This creates minimal public versions of regions, districts, and staff IDs
 * that contain only non-sensitive data needed for signup validation
 */

async function populatePublicCollections() {
  try {
    console.log('Starting to populate public collections...');

    // 1. Populate public_regions from regions
    console.log('Populating public_regions...');
    const regionsSnapshot = await db.collection('regions').get();
    
    for (const doc of regionsSnapshot.docs) {
      const regionData = doc.data();
      
      // Only include non-sensitive fields
      await db.collection('public_regions').doc(doc.id).set({
        id: doc.id,
        name: regionData.name,
        // Exclude: population, coordinates, sensitive metadata
      });
      
      console.log(`Synced region: ${regionData.name}`);
    }

    // 2. Populate public_districts from districts
    console.log('Populating public_districts...');
    const districtsSnapshot = await db.collection('districts').get();
    
    for (const doc of districtsSnapshot.docs) {
      const districtData = doc.data();
      
      // Only include non-sensitive fields
      await db.collection('public_districts').doc(doc.id).set({
        id: doc.id,
        name: districtData.name,
        regionId: districtData.regionId,
        // Exclude: population, coordinates, sensitive metadata
      });
      
      console.log(`Synced district: ${districtData.name}`);
    }

    // 3. Populate public_staff_lookup from staffIds
    console.log('Populating public_staff_lookup...');
    const staffIdsSnapshot = await db.collection('staffIds').get();
    
    for (const doc of staffIdsSnapshot.docs) {
      const staffData = doc.data();
      
      // Only include fields needed for signup validation
      await db.collection('public_staff_lookup').doc(doc.id).set({
        staffId: doc.id,
        email: staffData.email,
        isActive: staffData.isActive || true,
        isRegistered: staffData.isRegistered || false,
        // Exclude: personal details, phone numbers, addresses, etc.
      });
      
      console.log(`Synced staff ID: ${doc.id}`);
    }

    console.log('✅ Successfully populated all public collections!');
    console.log('\n📊 Summary:');
    console.log(`- Public Regions: ${regionsSnapshot.size}`);
    console.log(`- Public Districts: ${districtsSnapshot.size}`);
    console.log(`- Public Staff IDs: ${staffIdsSnapshot.size}`);
    
    console.log('\n🔒 Security Notes:');
    console.log('- Public collections contain only minimal data needed for signup');
    console.log('- Sensitive information (population, coordinates, personal details) excluded');
    console.log('- Staff lookup only includes: staffId, email, isActive, isRegistered');
    console.log('- Regions only include: id, name');
    console.log('- Districts only include: id, name, regionId');

  } catch (error) {
    console.error('❌ Error populating public collections:', error);
  }
}

// Run the script
populatePublicCollections()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
