import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);
  
  return (
    <div className="relative min-h-screen">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: "url('/images/ops.png')",
          zIndex: -1
        }}
      />
      <Layout>
        <div className="container mx-auto py-4 sm:py-10 px-4">
          <div className="max-w-[90%] sm:max-w-md mx-auto">
            <LoginForm />
          </div>
        </div>
      </Layout>
    </div>
  );
}
