import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const cspReport = functions.https.onRequest(async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const report = req.body;
    
    // Log the CSP violation to Firestore
    await admin.firestore().collection('csp-violations').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      report: report,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error processing CSP report:', error);
    res.status(500).send('Internal Server Error');
  }
}); 