import React, { createContext, useContext, useEffect, useState } from "react";
import { User, UserRole } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { auth, db, functions } from "@/config/firebase";
import { httpsCallable } from "firebase/functions";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updatePassword,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { StaffIdEntry } from "@/components/user-management/StaffIdManagement";
import { securityMonitoringService, EVENT_TYPES } from "@/services/SecurityMonitoringService";
import LoggingService from "@/services/LoggingService";
import { resetFirestoreConnection } from '../utils/firestore';

// Export the interface
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole, region?: string, district?: string, staffId?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  users: User[];
  usersLoading: boolean;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  addUser: (user: Omit<User, "id">) => Promise<string>;
  updateUser: (id: string, userData: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserStatus: (id: string, disabled: boolean) => Promise<void>;
  resetUserPassword: (email: string) => void;
  adminResetUserPassword: (userId: string) => Promise<{ tempPassword: string; email: string }>;
  verifyStaffId: (staffId: string) => { isValid: boolean; staffInfo?: { name: string; role: UserRole; region?: string; district?: string } };
  staffIds: StaffIdEntry[];
  setStaffIds: React.Dispatch<React.SetStateAction<StaffIdEntry[]>>;
  addStaffId: (entry: Omit<StaffIdEntry, "id"> & { customId?: string }) => Promise<string>;
  updateStaffId: (id: string, entry: Omit<StaffIdEntry, "id">) => void;
  deleteStaffId: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

// Add this function before the AuthProvider component
const handleFirestoreError = (error: any) => {
  if (error.code === 'permission-denied') {
    throw new Error('You do not have permission to perform this action');
  } else if (error.code === 'unavailable') {
    throw new Error('The service is currently unavailable. Please try again later');
  } else {
    throw new Error('An error occurred while accessing the database');
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [staffIds, setStaffIds] = useState<StaffIdEntry[]>([]);

  useEffect(() => {
    setLoading(true);

    // Load staff IDs immediately for signup verification
    const loadStaffIds = async () => {
      try {
        const staffIdsSnapshot = await getDocs(collection(db, "staffIds"));
        const staffIdsList: StaffIdEntry[] = [];
        staffIdsSnapshot.forEach((doc) => {
          staffIdsList.push({ id: doc.id, ...doc.data() } as StaffIdEntry);
        });
        setStaffIds(staffIdsList);
      } catch (error) {
        // toast.error("Error loading staff IDs"); // Disabled for signup page
      }
    };

    // Call loadStaffIds immediately
    loadStaffIds();

    // Subscribe to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData.disabled) {
              await signOut(auth);
              toast.error("This account has been disabled");
              return;
            }
            
            // Initialize user state with basic data
            const userState: User = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: userData.name || "",
              name: userData.name || "",
              role: userData.role,
              region: userData.region,
              regionId: userData.regionId,
              district: userData.district,
              districtId: userData.districtId,
              staffId: userData.staffId || "",
              disabled: userData.disabled,
              mustChangePassword: userData.mustChangePassword,
              photoURL: userData.photoURL
            };

            setUser(userState);
          } else {
            await signOut(auth);
            toast.error("User account not found");
          }
        } catch (error) {
          await signOut(auth);
          toast.error("Error loading user data");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Subscribe to users collection only if authenticated
    const usersUnsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        try {
          const usersList: User[] = [];
          snapshot.forEach((doc) => {
            usersList.push({ id: doc.id, ...doc.data() } as User);
          });
          setUsers(usersList);
          setUsersLoading(false); // Set loading to false when users are loaded
        } catch (error) {
          toast.error("Error loading users data");
          setUsersLoading(false); // Set loading to false even on error
        }
      },
      (error) => {
        // toast.error("Error in users connection"); // Disabled for signup page
        setUsersLoading(false); // Set loading to false on error
      }
    );

    // Subscribe to staffIds collection with error handling
    const staffIdsUnsubscribe = onSnapshot(
      collection(db, "staffIds"),
      (snapshot) => {
        try {
          const staffIdsList: StaffIdEntry[] = [];
          snapshot.forEach((doc) => {
            staffIdsList.push({ id: doc.id, ...doc.data() } as StaffIdEntry);
          });
          setStaffIds(staffIdsList);
        } catch (error) {
          // toast.error("Error loading staff IDs data"); // Disabled for signup page
        }
      },
      (error) => {
        // toast.error("Error in staff IDs connection"); // Disabled for signup page
      }
    );

    return () => {
      unsubscribeAuth();
      usersUnsubscribe();
      staffIdsUnsubscribe();
    };
  }, []);

  // Add a separate effect to handle auth state changes
  useEffect(() => {
    if (user) {
    }
  }, [user]);

  // Add activity tracking
  useEffect(() => {
    if (!user) return;

    let activityTimeout: NodeJS.Timeout;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    const updateActivity = async () => {
      try {
        // Check connection state
        if (!navigator.onLine) {
          return;
        }

        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          lastActive: serverTimestamp()
        });
        retryCount = 0;
      } catch (error) {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          setTimeout(updateActivity, RETRY_DELAY);
        }
      }
    };

    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(updateActivity, 5000);
    };

    // Add event listeners for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Initial activity update
    updateActivity();

    return () => {
      clearTimeout(activityTimeout);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [user]);

  // Add IP address fetching
  const fetchIpAddress = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // Check if the device is mobile
      const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // Set persistence to LOCAL for mobile devices
      if (isMobile) {
        await setPersistence(auth, browserLocalPersistence);
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (!userDoc.exists()) {
        throw new Error("User account not found");
      }

      const userData = userDoc.data();
      if (userData.disabled) {
        await signOut(auth);
        throw new Error("This account has been disabled");
      }

      // Log successful login
      securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.LOGIN_SUCCESS,
        details: `Successful login for user ${email}`,
        severity: 'low',
        status: 'new',
        userId: userCredential.user.uid,
        timestamp: new Date().toISOString()
      });

      toast.success("Login successful");
    } catch (error: any) {
      // Log failed login attempt
      securityMonitoringService.logEvent({
        eventType: EVENT_TYPES.LOGIN_FAILURE,
        details: `Failed login attempt for user ${email}: ${error.message}`,
        severity: 'medium',
        status: 'new',
        timestamp: new Date().toISOString()
      });

      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        toast.error("Invalid email or password");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many failed attempts. Please try again later.");
      } else {
        toast.error(error.message || "Failed to login");
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string, role: UserRole, region?: string, district?: string, staffId?: string) => {
    try {
      // Get signup data (regions/districts) via Cloud Function
      const getSignupData = httpsCallable(functions, 'getSignupData');
      const signupDataResult = await getSignupData();
      const { regions: signupRegions, districts: signupDistricts } = signupDataResult.data as any;

      // SECURITY: Rate limiting check
      const rateLimitKey = `signup_${email}`;
      const now = Date.now();
      const lastAttempt = localStorage.getItem(rateLimitKey);
      
      if (lastAttempt) {
        const timeDiff = now - parseInt(lastAttempt);
        const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
        const MAX_ATTEMPTS = 3;
        
        if (timeDiff < RATE_LIMIT_WINDOW) {
          const attempts = parseInt(localStorage.getItem(`${rateLimitKey}_attempts`) || '0');
          if (attempts >= MAX_ATTEMPTS) {
            throw new Error('Too many signup attempts. Please try again later.');
          }
          localStorage.setItem(`${rateLimitKey}_attempts`, (attempts + 1).toString());
        } else {
          localStorage.removeItem(rateLimitKey);
          localStorage.removeItem(`${rateLimitKey}_attempts`);
        }
      }
      
      localStorage.setItem(rateLimitKey, now.toString());

      // SECURITY: Enhanced input validation
      if (!email || !password || !name || !role) {
        throw new Error('All required fields must be provided');
      }
      
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      
      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
        throw new Error('Please provide a valid email address');
      }
      
      if (name.length < 2 || name.length > 50) {
        throw new Error('Name must be between 2 and 50 characters');
      }

      // Validate required fields based on role
      if (role === 'technician' || role === 'district_engineer') {
        if (!region || !district) {
          throw new Error('Region and district are required for technicians and district engineers');
        }
      } else if (role === 'regional_engineer') {
        if (!region) {
          throw new Error('Region is required for regional engineers');
        }
      }

      // Validate staff ID using secure API endpoint
      if (staffId) {
        try {
          const validateStaffId = httpsCallable(functions, 'validateStaffId');
          const result = await validateStaffId({ staffId });
          const validation = result.data as any;
          
          if (!validation.exists) {
            throw new Error('Staff ID not found');
          }
          
          if (!validation.isValid) {
            throw new Error('Invalid staff ID');
          }
          
          if (!validation.canRegister) {
            throw new Error('Staff ID is already registered');
          }
        } catch (error: any) {
          throw new Error(error.message || 'Staff ID validation failed');
        }
      }

      // Get region and district IDs from the signup data (already loaded by getSignupData)
      let regionId = '';
      let districtId = '';

      // Find region ID from the signup data
      if (region) {
        const regionData = signupRegions.find(r => r.name === region);
        if (regionData) {
          regionId = regionData.id;
        } else {
          throw new Error(`Region "${region}" not found`);
        }
      }

      // Find district ID from the signup data
      if (district && regionId) {
        const districtData = signupDistricts.find(d => d.name === district && d.regionId === regionId);
        if (districtData) {
          districtId = districtData.id;
        } else {
          throw new Error(`District "${district}" not found in region "${region}"`);
        }
      }

      // Reset Firestore connection before creating user to ensure clean state
      await resetFirestoreConnection();

      // Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Wait for authentication state to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Ensure user is authenticated before proceeding
      if (!auth.currentUser) {
        throw new Error('Authentication failed');
      }

      console.log('🔍 Auth state after creation:', {
        currentUser: auth.currentUser?.uid,
        userUid: user.uid,
        isAuthenticated: !!auth.currentUser
      });

      // Create user document in Firestore
      const userData = {
        email,
        name,
        role,
        region: region || "",
        regionId: regionId || "",
        district: district || "",
        districtId: districtId || "",
        staffId: staffId || "",
        disabled: false,
        mustChangePassword: false
      };

      try {
        console.log('🔍 Creating user document directly:', userData);
        console.log('🔍 User UID:', user.uid);
        console.log('🔍 Auth UID:', auth.currentUser?.uid);
        
        // Create user document directly in Firestore
        await setDoc(doc(db, "users", user.uid), userData);
        
        console.log('✅ User document created successfully');
      } catch (firestoreError) {
        console.error('❌ Firestore error:', firestoreError);
        console.error('❌ Error code:', firestoreError.code);
        console.error('❌ Error message:', firestoreError.message);
        
        // If Firestore error occurs, handle it and clean up the auth user
        handleFirestoreError(firestoreError);
        await user.delete();
        throw new Error('Failed to create user document. Please try again.');
      }

      // Set user state
      const userState: User = {
        id: user.uid,
        uid: user.uid,
        email: user.email || "",
        displayName: name,
        name: name,
        role: role,
        region: region || "",
        regionId: regionId || "",
        district: district || "",
        districtId: districtId || "",
        staffId: staffId || "",
        disabled: false,
        mustChangePassword: false
      };
      setUser(userState);

      // SECURITY: Clear rate limiting data on successful signup
      localStorage.removeItem(rateLimitKey);
      localStorage.removeItem(`${rateLimitKey}_attempts`);

      // SECURITY: Log successful signup for monitoring
      try {
        await securityMonitoringService.logEvent({
          eventType: EVENT_TYPES.USER_SIGNUP,
          userId: user.uid,
          email: email,
          role: role,
          region: region || '',
          district: district || '',
          timestamp: new Date().toISOString(),
          severity: 'low',
          details: `Successful signup for ${email}`,
          ipAddress: 'unknown',
          userAgent: navigator.userAgent
        });
      } catch (logError) {
        console.warn('Failed to log signup event:', logError);
      }

      toast.success("Account created successfully");
    } catch (error: any) {
      // SECURITY: Log failed signup attempt for monitoring
      try {
        await securityMonitoringService.logEvent({
          eventType: EVENT_TYPES.SIGNUP_FAILED,
          userId: user?.uid || 'unknown',
          email: email,
          role: role,
          error: error.message || 'Unknown error',
          timestamp: new Date().toISOString(),
          severity: 'high',
          details: `Failed signup attempt for ${email}`,
          ipAddress: 'unknown',
          userAgent: navigator.userAgent
        });
      } catch (logError) {
        console.warn('Failed to log signup failure event:', logError);
      }

      // If there's an error, attempt to clean up the auth user
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (deleteError) {
        }
      }
      toast.error(error.message || "Failed to create account");
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const resetUserPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset instructions have been sent to your email");
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        toast.error("No account found with this email");
      } else {
        toast.error("Failed to send password reset email. Please try again.");
      }
      throw error;
    }
  };

  const adminResetUserPassword = async (userId: string) => {
    try {
      // Check if current user is a system admin
      if (user?.role !== "system_admin") {
        toast.error("Only system administrators can reset user passwords");
        return { tempPassword: "", email: "" };
      }

      // Get the user document
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        toast.error("User not found");
        return { tempPassword: "", email: "" };
      }

      const userData = userDoc.data();
      const userEmail = userData.email;

      if (!userEmail) {
        toast.error("User email not found");
        return { tempPassword: "", email: "" };
      }

      // Generate a temporary password that meets Firebase's requirements
      const tempPassword = Math.random().toString(36).slice(-8) + "A1!"; // Add complexity requirements
      
      try {
        // Send password reset email to the user
        await sendPasswordResetEmail(auth, userEmail);
        
        // Update Firestore with the temporary password and flag
        await updateDoc(doc(db, "users", userId), {
          tempPassword: tempPassword,
          mustChangePassword: true,
          updatedAt: serverTimestamp()
        });
        
        toast.success("Password reset email sent to user");
        return { tempPassword, email: userEmail };
      } catch (error) {
        throw error;
      }
    } catch (error: any) {
      toast.error("Failed to reset user password");
      throw error;
    }
  };

  const verifyStaffId = (staffId: string) => {
    const staffInfo = staffIds.find(id => id.id === staffId);
    if (!staffInfo) {
      return {
        isValid: false,
        staffInfo: undefined
      };
    }

    return {
      isValid: true,
      staffInfo: {
        name: staffInfo.name,
        role: staffInfo.role,
        region: staffInfo.region,
        district: staffInfo.district
      }
    };
  };

  const addStaffId = async (entry: Omit<StaffIdEntry, "id"> & { customId?: string }) => {
    try {
      // Check if current user is a system admin
      if (user?.role !== "system_admin") {
        toast.error("Only system administrators can manage staff IDs");
        return;
      }
      
      // Generate a random ID if not provided
      const id = entry.customId || Math.random().toString(36).substr(2, 9);
      
      // Check for duplicate staff ID
      const existingStaffId = await getDoc(doc(db, "staffIds", id));
      if (existingStaffId.exists()) {
        throw new Error(`Staff ID "${id}" already exists. Please use a different ID.`);
      }
      
      // Create a cleaned entry with no undefined values
      const cleanedEntry = {
        name: entry.name,
        role: entry.role,
        region: entry.region || "",
        district: entry.district || ""
      };
      
      // Set the document
      await setDoc(doc(db, "staffIds", id), cleanedEntry);
      
      setStaffIds(prev => [...prev, { id, ...cleanedEntry }]);
      toast.success("Staff ID added successfully");
      return id; // Return the ID for duplicate checking
    } catch (error) {
      let errorMessage = "Failed to add staff ID";
      
      // More specific error message
      if (error instanceof Error) {
        if (error.message.includes("permission")) {
          errorMessage = "Permission denied. Only system administrators can add staff IDs.";
        } else if (error.message.includes("already exists")) {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      throw error; // Re-throw the error to be caught by the caller
    }
  };

  const updateStaffId = async (id: string, entry: Omit<StaffIdEntry, "id">) => {
    try {
      // Create a cleaned entry with no undefined values
      const cleanedEntry = {
        name: entry.name,
        role: entry.role,
        region: entry.region || "",
        district: entry.district || ""
      };
      
      await updateDoc(doc(db, "staffIds", id), cleanedEntry);
      setStaffIds(prev => prev.map(s => s.id === id ? { id, ...cleanedEntry } : s));
      toast.success("Staff ID updated successfully");
    } catch (error) {
      toast.error("Failed to update staff ID");
    }
  };

  const deleteStaffId = async (id: string) => {
    try {
      await deleteDoc(doc(db, "staffIds", id));
      setStaffIds(prev => prev.filter(s => s.id !== id));
      toast.success("Staff ID deleted successfully");
    } catch (error) {
      toast.error("Failed to delete staff ID");
    }
  };

  const addUser = async (userData: Omit<User, "id">): Promise<string> => {
    try {
      // Create a new document with auto-generated ID
      const userRef = doc(collection(db, "users"));
      
      // Find region and district IDs if not provided
      let regionId = userData.regionId;
      let districtId = userData.districtId;
      
      if (!regionId && userData.region) {
        const regionDoc = await getDocs(query(collection(db, "regions"), where("name", "==", userData.region)));
        regionId = regionDoc.docs[0]?.id || "";
      }
      
      if (!districtId && userData.district && regionId) {
        const districtDoc = await getDocs(query(collection(db, "districts"), where("name", "==", userData.district), where("regionId", "==", regionId)));
        districtId = districtDoc.docs[0]?.id || "";
      }
      
      // Clean the data to prevent undefined values
      const cleanedData = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        region: userData.region || "",
        regionId: regionId || "",
        district: userData.district || "",
        districtId: districtId || "",
        password: userData.password || "",
        tempPassword: userData.tempPassword || "",
        mustChangePassword: userData.mustChangePassword || false,
        disabled: userData.disabled || false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(userRef, cleanedData);

      toast.success("User added successfully");
      return userRef.id;
    } catch (error) {
      toast.error("Failed to add user");
      throw error;
    }
  };
  
  const updateUser = async (id: string, userData: Partial<User>): Promise<void> => {
    try {
      const userRef = doc(db, "users", id);
      
      // Get the user data before updating
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }
      const oldUserData = userDoc.data();
      
      // Find region and district IDs if not provided
      let regionId = userData.regionId;
      let districtId = userData.districtId;
      
      if (!regionId && userData.region) {
        const regionDoc = await getDocs(query(collection(db, "regions"), where("name", "==", userData.region)));
        regionId = regionDoc.docs[0]?.id || "";
      }
      
      if (!districtId && userData.district && regionId) {
        const districtDoc = await getDocs(query(collection(db, "districts"), where("name", "==", userData.district), where("regionId", "==", regionId)));
        districtId = districtDoc.docs[0]?.id || "";
      }
      
      // Remove undefined values and add updatedAt timestamp
      const updateData: any = { 
        ...userData,
        regionId: regionId || "",
        districtId: districtId || "",
        updatedAt: serverTimestamp() 
      };
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          updateData[key] = "";
        }
      });
      
      await updateDoc(userRef, updateData);

      toast.success("User updated successfully");
    } catch (error) {
      toast.error("Failed to update user");
      throw error;
    }
  };
  
  const deleteUser = async (id: string): Promise<void> => {
    try {
      // Get the user data before deleting
      const userRef = doc(db, "users", id);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }
      const userData = userDoc.data();

      // Delete the user from Firebase Auth first
      try {
        const deleteUserFromAuth = httpsCallable(functions, 'deleteUserFromAuth');
        await deleteUserFromAuth({ uid: id });
        console.log('✅ User deleted from Firebase Auth');
      } catch (authError) {
        console.error('❌ Failed to delete user from Firebase Auth:', authError);
        // Continue with Firestore deletion even if Auth deletion fails
        toast.error("Warning: User deleted from database but may still exist in Firebase Auth");
      }

      // Delete the user document from Firestore
      await deleteDoc(userRef);

      toast.success("User deleted successfully");
    } catch (error) {
      toast.error("Failed to delete user");
      throw error;
    }
  };
  
  const toggleUserStatus = async (id: string, disabled: boolean): Promise<void> => {
    try {
      // Get the user data before updating
      const userRef = doc(db, "users", id);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }
      const userData = userDoc.data();

      // Update the user status
      await updateDoc(userRef, { 
        disabled,
        updatedAt: serverTimestamp()
      });

      toast.success(`User ${disabled ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
      toast.error(`Failed to ${disabled ? 'disable' : 'enable'} user`);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        users,
        usersLoading,
        setUsers,
        setUser,
        addUser,
        updateUser,
        deleteUser,
        toggleUserStatus,
        resetUserPassword,
        adminResetUserPassword,
        verifyStaffId,
        staffIds,
        setStaffIds,
        addStaffId,
        updateStaffId,
        deleteStaffId
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
