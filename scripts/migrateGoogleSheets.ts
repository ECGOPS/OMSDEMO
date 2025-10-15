import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Google Sheets API setup
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function downloadImage(imageUrl: string, fileName: string): Promise<string> {
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const tempPath = path.join(__dirname, 'temp', fileName);
  
  // Ensure temp directory exists
  if (!fs.existsSync(path.join(__dirname, 'temp'))) {
    fs.mkdirSync(path.join(__dirname, 'temp'));
  }
  
  fs.writeFileSync(tempPath, Buffer.from(buffer));
  return tempPath;
}

async function uploadToFirebaseStorage(filePath: string, destinationPath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const storageRef = ref(storage, destinationPath);
  
  await uploadBytes(storageRef, fileBuffer);
  const downloadURL = await getDownloadURL(storageRef);
  
  // Clean up temp file
  fs.unlinkSync(filePath);
  
  return downloadURL;
}

async function migrateData(spreadsheetId: string, range: string) {
  try {
    // Get data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found.');
      return;
    }

    // Assuming first row contains headers
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Process each row
    for (const row of dataRows) {
      const rowData: any = {};
      
      // Map data to headers
      headers.forEach((header, index) => {
        rowData[header] = row[index];
      });

      // Handle image if present
      if (rowData.imageUrl) {
        try {
          const fileName = `image_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const tempFilePath = await downloadImage(rowData.imageUrl, fileName);
          const storagePath = `images/${fileName}`;
          const imageUrl = await uploadToFirebaseStorage(tempFilePath, storagePath);
          
          // Replace the Google Sheets image URL with Firebase Storage URL
          rowData.imageUrl = imageUrl;
        } catch (error) {
          console.error('Error processing image:', error);
        }
      }

      // Add data to Firestore
      try {
        await addDoc(collection(db, 'your_collection_name'), {
          ...rowData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log('Successfully migrated row:', rowData);
      } catch (error) {
        console.error('Error adding document:', error);
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Usage example
const spreadsheetId = 'YOUR_SPREADSHEET_ID';
const range = 'Sheet1!A1:Z'; // Adjust range as needed

migrateData(spreadsheetId, range); 