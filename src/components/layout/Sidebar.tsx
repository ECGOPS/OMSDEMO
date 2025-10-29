import { useState } from "react";
import { Link, useLocation, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Home,
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  Building2,
  Users,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Music,
  Database,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";
import { PermissionService } from "@/services/PermissionService";
import { useAudio } from "@/contexts/AudioContext";

interface SidebarProps {
  onCollapseChange?: (collapsed: boolean) => void;
}

export default function Sidebar({ onCollapseChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const { audioRef } = useAudio();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const permissionService = PermissionService.getInstance();

  const handleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapseChange?.(newState);
  };

  const handleLogout = () => {
    // Stop music playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    logout();
    navigate("/");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Check if the current path starts with a specific route
  const isActiveRoute = (route: string) => {
    return location.pathname.startsWith(route);
  };

  const showMenuItem = (requiredRole: string) => {
    if (!user?.role) return false;
    if (user.role === "system_admin") return true;
    if (user.role === "technician") {
      return requiredRole === "district_engineer" && !location.pathname.startsWith("/analytics");
    }
    if (user.role === "district_engineer" || user.role === "district_manager") {
      return (
        requiredRole === "district_engineer" ||
        requiredRole === "district_manager" ||
        requiredRole === "global_engineer"
      );
    }
    if (user.role === "regional_engineer" || user.role === "project_engineer" || user.role === "regional_general_manager") {
      return (
        requiredRole === "district_engineer" ||
        requiredRole === "district_manager" ||
        requiredRole === "regional_engineer" ||
        requiredRole === "project_engineer" ||
        requiredRole === "regional_general_manager" ||
        requiredRole === "global_engineer"
      );
    }
    if (user.role === "global_engineer" || user.role === "ashsub_t" || user.role === "accsub_t") {
      return true;
    }
    return false;
  };

  const navItems = [
    {
      group: "Main",
      items: [
        {
          title: "Home",
          icon: Home,
          href: "/",
          show: true,
        },
        {
          title: "Dashboard",
          icon: LayoutDashboard,
          href: "/dashboard",
          show: isAuthenticated,
        },
        {
          title: "Report Fault",
          icon: AlertTriangle,
          href: "/report-fault",
          show: isAuthenticated,
        },
      ]
    },
    {
      group: "Analytics",
      items: [
        {
          title: "Fault Analytics",
          icon: BarChart3,
          href: "/analytics",
          show: (
            showMenuItem("district_engineer") ||
            showMenuItem("district_manager") ||
            showMenuItem("regional_engineer") ||
            showMenuItem("regional_general_manager")
          ),
        },
        {
          title: "Control System Analytics",
          icon: BarChart3,
          href: "/control-system-analytics",
          show: (
            showMenuItem("district_engineer") ||
            showMenuItem("district_manager") ||
            showMenuItem("regional_engineer") ||
            showMenuItem("regional_general_manager")
          ),
        },
      ]
    },
    {
      group: "Asset Management",
      items: [
        {
          title: "Load Monitoring",
          icon: Building2,
          href: "/asset-management/load-monitoring",
          show: showMenuItem("district_engineer"),
        },
        {
          title: "Substation Inspection",
          icon: Building2,
          href: "/asset-management/inspection-management",
          show: showMenuItem("district_engineer"),
        },
        {
          title: "VITs Inspection",
          icon: Building2,
          href: "/asset-management/vit-inspection",
          show: showMenuItem("district_engineer"),
        },
        {
          title: "Network Inspection",
          icon: Building2,
          href: "/asset-management/overhead-line",
          show: showMenuItem("district_engineer"),
        },
      ]
    },
    {
      group: "Administration",
      items: [
        {
          title: "District Population",
          icon: Users,
          href: "/district-population",
          show: showMenuItem("district_engineer"),
        },
        {
          title: "User Management",
          icon: Users,
          href: "/user-management",
          show: user?.role === "system_admin" || user?.role === "global_engineer" || user?.role === "ict",
        },
        {
          title: "User Logs",
          icon: LogOut,
          href: "/user-logs",
          show: user?.role === "system_admin" || user?.role === "global_engineer",
        },
        {
          title: "Permission Management",
          icon: Shield,
          href: "/system-admin/permissions",
          show: user?.role === "system_admin",
        },
        {
          title: "Security Monitoring",
          icon: Shield,
          href: "/system-admin/security",
          show: user?.role === "system_admin",
        },
        {
          title: "Security Testing",
          icon: Shield,
          href: "/test/security",
          show: user?.role === "system_admin",
        },
        {
          title: "Music Management",
          icon: Music,
          href: "/admin/music",
          show: user?.role === "system_admin",
        },
        {
          title: "Image Migration",
          icon: Upload,
          href: "/admin/image-migration",
          show: user?.role === "system_admin",
        },
        {
          title: "Substation Migration",
          icon: Upload,
          href: "/admin/substation-migration",
          show: user?.role === "system_admin",
        },
        {
          title: "Feeder Offline Test",
          icon: Database,
          href: "/test/feeder-offline",
          show: user?.role === "system_admin",
        },
      ]
    },
  ];

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-background border-r border-border transition-all duration-300 flex flex-col",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <img src="/ecg-images/ecg-logo.png" alt="ECG Logo" className="h-8 w-auto" />
          {!isCollapsed && (
            <span className="font-bold text-sm">ECG NMS</span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCollapse}
          className="h-8 w-8"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((group) => {
          const visibleItems = group.items.filter(item => item.show);
          if (visibleItems.length === 0) return null;
          
          return (
            <div key={group.group} className="mb-4">
              {!isCollapsed && (
                <h3 className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.group}
                </h3>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-primary/5 hover:text-primary",
                          isCollapsed && "justify-center"
                        )
                      }
                    >
                      <Icon size={18} />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        {isAuthenticated ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "justify-start",
                isCollapsed && "justify-center"
              )}
            >
              <Link to="/profile">
                <User size={16} className="mr-2" />
                {!isCollapsed && <span>{user?.name || "User"}</span>}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className={cn(
                "justify-start",
                isCollapsed && "justify-center"
              )}
            >
              <LogOut size={16} className="mr-2" />
              {!isCollapsed && <span>Log Out</span>}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "justify-start",
                isCollapsed && "justify-center"
              )}
            >
              <Link to="/login">
                {!isCollapsed && <span>Log In</span>}
              </Link>
            </Button>
            <Button
              size="sm"
              asChild
              className={cn(
                "justify-start",
                isCollapsed && "justify-center"
              )}
            >
              <Link to="/signup">
                {!isCollapsed && <span>Sign Up</span>}
              </Link>
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className={cn(
            "mt-2 justify-start",
            isCollapsed && "justify-center"
          )}
        >
          {!isCollapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </Button>
      </div>
    </div>
  );
} 