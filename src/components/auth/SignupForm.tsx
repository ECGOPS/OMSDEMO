import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { UserRole } from "@/lib/types";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase";

export function SignupForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    staffId: "",
    name: "",
    role: "",
    region: "",
    district: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFieldsLocked, setIsFieldsLocked] = useState(false);
  const [isValidatingStaffId, setIsValidatingStaffId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({
    password: "",
    staffId: "",
    role: "",
    region: "",
    district: ""
  });
  const { signup, staffIds } = useAuth();
  // Use secure API endpoints for signup data (no authentication required)
  const [signupRegions, setSignupRegions] = useState<any[]>([]);
  const [signupDistricts, setSignupDistricts] = useState<any[]>([]);
  const [isLoadingSignupData, setIsLoadingSignupData] = useState(true);
  const [signupDataError, setSignupDataError] = useState<string | null>(null);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const navigate = useNavigate();

  // Load signup data via secure API endpoints (no authentication required)
  useEffect(() => {
    const loadSignupData = async () => {
      try {
        setIsLoadingSignupData(true);
        setSignupDataError(null);

        // Call secure API endpoint to get signup data
        const getSignupData = httpsCallable(functions, 'getSignupData');
        const result = await getSignupData();
        
        const { regions, districts } = result.data as any;
        
        setSignupRegions(regions);
        setSignupDistricts(districts);
        setIsLoadingSignupData(false);
      } catch (error) {
        console.error('Error loading signup data:', error);
        setSignupDataError('Failed to load regions and districts. Please try again.');
        setIsLoadingSignupData(false);
      }
    };

    loadSignupData();
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced staff ID validation
  const debouncedValidateStaffId = useCallback((staffId: string) => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      if (staffId.trim() && !isValidatingStaffId) {
        setIsValidatingStaffId(true);
        try {
          const result = await verifyStaffIdSecure(staffId);
          console.log('🔍 Staff ID validation result:', result);
          
          if (result.exists === true) {
            if (result.canRegister) {
              setIsFieldsLocked(true);
              setErrors(prev => ({ ...prev, staffId: "" })); // Clear any previous errors
              toast.success("Staff ID verified successfully!");
              
              // Pre-populate form with staff data
              if (result.staffData) {
                setFormData(prev => ({
                  ...prev,
                  name: result.staffData.name || "",
                  role: result.staffData.role || "",
                  region: result.staffData.region || "",
                  district: result.staffData.district || ""
                }));
              }
            } else {
              setErrors(prev => ({ ...prev, staffId: "Staff ID is already registered" }));
              toast.error("Staff ID is already registered");
            }
          } else {
            setErrors(prev => ({ ...prev, staffId: "Staff ID not found" }));
            toast.error("Staff ID not found");
          }
        } catch (error) {
          console.error("Staff ID verification failed:", error);
          setErrors(prev => ({ ...prev, staffId: (error as Error).message }));
          toast.error((error as Error).message || "Failed to verify staff ID");
        } finally {
          setIsValidatingStaffId(false);
        }
      }
    }, 800); // Increased delay to 800ms for better debouncing
  }, [isValidatingStaffId]);

  const handleStaffIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStaffId = e.target.value;
    setFormData(prev => ({ ...prev, staffId: newStaffId }));
    setErrors(prev => ({ ...prev, staffId: "" }));

    // Clear previous information when a new staff ID is entered
    setIsFieldsLocked(false);
    setIsValidatingStaffId(false);
    setFormData(prev => ({ 
      ...prev, 
      staffId: newStaffId,
      name: "",
      role: "",
      region: "",
      district: ""
    }));

    // Use debounced validation
    debouncedValidateStaffId(newStaffId);
  };

  // Secure staff ID verification using API endpoint
  const verifyStaffIdSecure = async (staffId: string) => {
    try {
      const validateStaffId = httpsCallable(functions, 'validateStaffId');
      const result = await validateStaffId({ staffId });
      console.log('🔍 Raw API response:', result.data);
      return result.data as any;
    } catch (error: any) {
      console.error('Error validating staff ID:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      
      // Provide more specific error messages
      if (error.code === 'functions/unavailable') {
        throw new Error('Service temporarily unavailable. Please try again.');
      } else if (error.code === 'functions/timeout') {
        throw new Error('Request timed out. Please try again.');
      } else {
        throw new Error('Failed to validate staff ID. Please try again.');
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const newErrors = {
      password: "",
      staffId: "",
      role: "",
      region: "",
      district: ""
    };

    // Password validation
    if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = "Password must contain at least one number";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.password = "Passwords do not match";
    }

    // Staff ID validation - use the secure API validation
    if (!formData.staffId) {
      newErrors.staffId = "Staff ID is required";
    } else {
      // Check if staff ID was already verified during input
      if (!isFieldsLocked) {
        newErrors.staffId = "Please verify your staff ID first";
      }
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = "Role is required";
    }

    // Region validation for applicable roles
    if (formData.role && formData.role !== "global_engineer" && formData.role !== "system_admin") {
      if (!formData.region) {
        newErrors.region = "Region is required";
      }
    }

    // District validation for applicable roles
    if (formData.role === "district_engineer" || formData.role === "technician") {
      if (!formData.district) {
        newErrors.district = "District is required";
      }
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!validateForm()) {
      setIsLoading(false);
      return;
    }
    
    try {
      await signup(
        formData.email,
        formData.password,
        formData.name,
        formData.role as UserRole,
        formData.region || undefined,
        formData.district || undefined,
        formData.staffId
      );

      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter districts based on selected region
  const filteredDistricts = signupDistricts.filter(
    district => district.regionId === signupRegions.find(r => r.name === formData.region)?.id
  );

  if (isLoadingSignupData) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Loading regions and districts...</p>
      </div>
    );
  }

  if (signupDataError) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <p className="text-sm text-destructive">{signupDataError}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1 sm:space-y-2">
        <CardTitle className="text-xl sm:text-2xl">Create an Account</CardTitle>
        <CardDescription className="text-sm">
          Sign up to access ECG Network Management System
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="staffId" className="text-sm">Staff ID</Label>
              <Input
                id="staffId"
                value={formData.staffId}
                onChange={handleStaffIdChange}
                placeholder="Enter your staff ID"
                className="h-9 sm:h-10"
              />
              {errors.staffId && <p className="text-xs sm:text-sm text-red-500 mt-1">{errors.staffId}</p>}
              {isValidatingStaffId && (
                <p className="text-xs sm:text-sm text-blue-600 mt-1">🔄 Validating staff ID...</p>
              )}
              {isFieldsLocked && !errors.staffId && !isValidatingStaffId && (
                <p className="text-xs sm:text-sm text-green-600 mt-1">✅ Staff ID verified successfully!</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Used for ECG staff identity verification.
              </p>
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="name" className="text-sm">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter your name"
                disabled={isFieldsLocked}
                className="h-9 sm:h-10"
              />
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Enter your email"
                className="h-9 sm:h-10"
              />
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="role" className="text-sm">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleChange("role", value)}
                disabled={isFieldsLocked}
              >
                <SelectTrigger className="h-9 sm:h-10">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_admin">System Admin</SelectItem>
                  <SelectItem value="global_engineer">Global Engineer</SelectItem>
                  <SelectItem value="regional_general_manager">Regional General Manager</SelectItem>
                  <SelectItem value="regional_engineer">Regional Engineer</SelectItem>
                  <SelectItem value="project_engineer">Project Engineer</SelectItem>
                  <SelectItem value="district_manager">District Manager</SelectItem>
                  <SelectItem value="district_engineer">District Engineer</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="ict">ICT</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs sm:text-sm text-red-500 mt-1">{errors.role}</p>}
            </div>
            
            {/* Region Select (if applicable) */}
            {formData.role && formData.role !== "global_engineer" && formData.role !== "system_admin" && (
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="region" className="text-sm">Region</Label>
                <Select 
                  value={formData.region} 
                  onValueChange={(value) => handleChange("region", value)}
                  disabled={isFieldsLocked}
                >
                  <SelectTrigger className="h-9 sm:h-10">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {signupRegions.map(region => (
                      <SelectItem key={region.id} value={region.name}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region && <p className="text-xs sm:text-sm text-red-500 mt-1">{errors.region}</p>}
              </div>
            )}
            
            {/* District Select (if applicable) */}
            {(formData.role === "district_engineer" || formData.role === "technician") && (
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="district" className="text-sm">District</Label>
                <Select 
                  value={formData.district} 
                  onValueChange={(value) => handleChange("district", value)}
                  disabled={!formData.region || isFieldsLocked}
                >
                  <SelectTrigger className="h-9 sm:h-10">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDistricts.map(district => (
                      <SelectItem key={district.id} value={district.name}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.district && <p className="text-xs sm:text-sm text-red-500 mt-1">{errors.district}</p>}
              </div>
            )}
            
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="Enter your password"
                  className="h-9 sm:h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && <p className="text-xs sm:text-sm text-red-500 mt-1">{errors.password}</p>}
            </div>
            
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  placeholder="Confirm your password"
                  className="h-9 sm:h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            <Button type="submit" className="w-full h-9 sm:h-10" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center py-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-ecg-blue hover:underline">
            Login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
