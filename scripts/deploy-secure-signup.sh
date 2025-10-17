#!/bin/bash

# Secure Signup API Deployment Script
echo "🚀 Deploying Secure Signup API Solution..."

# Step 1: Deploy Cloud Functions
echo "📦 Deploying Cloud Functions..."
cd functions
npm install
firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo "✅ Cloud Functions deployed successfully!"
else
    echo "❌ Cloud Functions deployment failed!"
    exit 1
fi

# Step 2: Deploy Firestore Rules
echo "🔒 Deploying Firestore Rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Firestore Rules deployed successfully!"
else
    echo "❌ Firestore Rules deployment failed!"
    exit 1
fi

# Step 3: Build and Deploy Frontend
echo "🌐 Building and deploying frontend..."
cd ..
npm run build
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo "✅ Frontend deployed successfully!"
else
    echo "❌ Frontend deployment failed!"
    exit 1
fi

echo ""
echo "🎉 Secure Signup API Solution deployed successfully!"
echo ""
echo "📋 What was deployed:"
echo "✅ Cloud Functions: validateStaffId, getSignupData"
echo "✅ Firestore Rules: All collections secure, unauthenticated signup allowed"
echo "✅ Frontend: Updated signup form using API endpoints"
echo ""
echo "🔒 Security Features:"
echo "✅ Zero data exposure - no public collections"
echo "✅ Staff ID validation via secure API"
echo "✅ Email matching validation"
echo "✅ Registration status checking"
echo "✅ Rate limiting and input validation"
echo ""
echo "🧪 Next Steps:"
echo "1. Test signup process with valid staff ID"
echo "2. Verify regions/districts load without authentication"
echo "3. Confirm staff ID validation works correctly"
echo "4. Test with invalid staff ID to ensure proper error handling"
