import { Navbar } from "@/components/layout/Navbar";
import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Lazy load non-critical components
const Sidebar = lazy(() => import("@/components/layout/Sidebar"));
const Footer = lazy(() => import("@/components/layout/Footer"));

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated } = useAuth();
  // Always call the hook, let the hook itself handle the authentication check
  useIdleTimer();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Navbar - Always render as it's critical */}
      <div className="md:hidden">
        <Navbar />
      </div>
      
      {/* Desktop Sidebar - Lazy load */}
      <div className="hidden md:block">
        <Suspense fallback={<div className="w-64 bg-background" />}>
          <Sidebar onCollapseChange={setIsSidebarCollapsed} />
        </Suspense>
      </div>

      {/* Main Content */}
      <main className={cn(
        "flex-grow transition-all duration-300",
        "md:ml-16", // Default margin for collapsed sidebar
        !isSidebarCollapsed && "md:ml-64" // Margin for expanded sidebar
      )}>
        {children}
      </main>
      
      {/* Footer - Lazy load */}
      {location.pathname === "/" && (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      )}
    </div>
  );
}
