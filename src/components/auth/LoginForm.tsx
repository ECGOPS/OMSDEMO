import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loginAttempts >= 5) {
      setIsLocked(true);
      const timer = setTimeout(() => {
        setIsLocked(false);
        setLoginAttempts(0);
      }, 15 * 60 * 1000); // 15 minutes lockout
      return () => clearTimeout(timer);
    }
  }, [loginAttempts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      toast.error("Too many login attempts. Please try again later.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);
      setLoginAttempts(0);
      // Don't navigate here - let the LoginPage handle navigation
    } catch (error: any) {
      setLoginAttempts(prev => prev + 1);
      console.error("Login failed. Error details:", {
        code: error.code,
        message: error.message,
        fullError: error
      });
      
      // More specific error messages based on the error code
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/wrong-password' || 
          error.code === 'auth/invalid-email' ||
          error.code === 'auth/invalid-login-credentials') {
        toast.error("Invalid email or password. Please try again.");
      } else if (error.code === 'auth/user-not-found') {
        toast.error("No account found with this email.");
      } else if (error.code === 'auth/too-many-requests') {
        toast.error("Too many login attempts. Please try again later.");
      } else if (error.code === 'auth/user-disabled') {
        toast.error("This account has been disabled. Please contact support.");
      } else if (error.code === 'auth/network-request-failed') {
        toast.error("Network error. Please check your internet connection.");
      } else {
        toast.error(`Login failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto mb-2 sm:mb-4">
          <img 
            src="/ecg-images/ecg-logo.png" 
            alt="ECG Logo" 
            className="h-12 sm:h-16 w-auto mx-auto"
          />
        </div>
        <CardTitle className="text-xl sm:text-2xl">Login to ECG Network Management System</CardTitle>
        <CardDescription className="text-sm">
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLocked}
              className="h-9 sm:h-10"
            />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Link to="/forgot-password" className="text-xs sm:text-sm text-ecg-blue hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLocked}
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
          </div>
          <Button 
            type="submit" 
            className="w-full h-9 sm:h-10" 
            disabled={isSubmitting || isLocked}
          >
            {isLocked 
              ? "Account locked. Try again later" 
              : isSubmitting 
                ? "Logging in..." 
                : "Login"
            }
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center py-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-ecg-blue hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
