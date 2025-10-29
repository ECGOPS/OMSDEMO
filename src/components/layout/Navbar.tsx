import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation, NavLink } from "react-router-dom";
import { Menu, User, LogOut, FileText, History, Music, Database, Upload } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { PermissionService } from "@/services/PermissionService";
import { AudioPlayer } from "@/components/dashboard/AudioPlayer";
import { Separator } from "@/components/ui/separator";
import { useAudio } from "@/contexts/AudioContext";

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { audioRef } = useAudio();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const permissionService = PermissionService.getInstance();

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

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <img src="/ecg-images/ecg-logo.png" alt="ECG Logo" className="h-10 w-auto" />
            <span className="font-bold text-base">ECG Network Management System</span>
          </Link>
        </div>
        
        <div className="flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col overflow-y-auto">
              {/* User Profile and Logout */}
              {isAuthenticated && (
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/profile" className="flex items-center gap-2">
                        <User size={16} />
                        <span>{user?.name || "User"}</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                      <LogOut size={18} />
                    </Button>
                  </div>
                  <Separator />
                  <div className="w-full">
                    <AudioPlayer />
                  </div>
                </div>
              )}
              
              <nav className="flex flex-col gap-2">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-2 rounded-md transition-colors",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-foreground hover:text-primary hover:bg-primary/5"
                    )
                  }
                >
                  Home
                </NavLink>
                
                {isAuthenticated && (
                  <>
                    <NavLink 
                      to="/dashboard"
                      end
                      className={({ isActive }) =>
                        cn(
                          "px-3 py-2 rounded-md transition-colors",
                          isActive 
                            ? "bg-primary/20 text-primary font-medium border border-primary/30" 
                            : "text-foreground hover:text-primary hover:bg-primary/5"
                        )
                      }
                    >
                      Dashboard
                    </NavLink>
                    
                    <NavLink 
                      to="/report-fault" 
                      className={({ isActive }) =>
                        cn(
                          "px-3 py-2 rounded-md transition-colors",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-foreground hover:text-primary hover:bg-primary/5"
                        )
                      }
                    >
                      Report Fault
                    </NavLink>
                    
                    {/* Analytics Links */}
                    {(showMenuItem("district_engineer") || showMenuItem("district_manager") || showMenuItem("regional_engineer") || showMenuItem("project_engineer") || showMenuItem("regional_general_manager")) && (
                      <>
                        <NavLink 
                          to="/analytics" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Fault Analytics
                        </NavLink>
                        <NavLink 
                          to="/control-system-analytics" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Control System Analytics
                        </NavLink>
                      </>
                    )}
                    
                    {/* Asset Management Links */}
                    {showMenuItem("district_engineer") && (
                      <>
                        <NavLink 
                          to="/asset-management/load-monitoring" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Load Monitoring
                        </NavLink>
                        <NavLink 
                          to="/asset-management/inspection-management" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Substation Inspection
                        </NavLink>
                        <NavLink 
                          to="/asset-management/vit-inspection" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          VITs Inspection
                        </NavLink>
                        <NavLink 
                          to="/asset-management/overhead-line" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Network Inspection
                        </NavLink>
                      </>
                    )}
                    
                    {/* District Population Link */}
                    {showMenuItem("district_engineer") && (
                      <NavLink 
                        to="/district-population" 
                        className={({ isActive }) =>
                          cn(
                            "px-3 py-2 rounded-md transition-colors",
                            isActive 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-foreground hover:text-primary hover:bg-primary/5"
                          )
                        }
                      >
                        District Population
                      </NavLink>
                    )}
                    
                    {/* Admin Menu Items */}
                    {user?.role === "system_admin" && (
                      <>
                        <NavLink 
                          to="/user-management" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          User Management
                        </NavLink>
                        <NavLink 
                          to="/system-admin/permissions" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Permission Management
                        </NavLink>
                        <NavLink 
                          to="/system-admin/security" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          Security Monitoring
                        </NavLink>
                        <NavLink 
                          to="/user-logs"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            <span>User Logs</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/admin/music"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4" />
                            <span>Music Management</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/admin/image-migration"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            <span>Image Migration</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/admin/substation-migration"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            <span>Substation Migration</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/test/feeder-offline"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span>Feeder Offline Test</span>
                          </div>
                        </NavLink>
                      </>
                    )}
                    {user?.role === "global_engineer" && (
                      <>
                        <NavLink 
                          to="/user-management" 
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          User Management
                        </NavLink>
                        <NavLink 
                          to="/user-logs"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            <span>User Logs</span>
                          </div>
                        </NavLink>
                        <NavLink 
                          to="/test/feeder-offline"
                          className={({ isActive }) =>
                            cn(
                              "px-3 py-2 rounded-md transition-colors",
                              isActive 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "text-foreground hover:text-primary hover:bg-primary/5"
                            )
                          }
                        >
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span>Feeder Offline Test</span>
                          </div>
                        </NavLink>
                      </>
                    )}
                  </>
                )}
              </nav>
              
              {/* Mobile Dark Mode Toggle */}
              <div className="mt-auto pt-4 border-t">
                <Button variant="ghost" onClick={toggleTheme} className="w-full justify-start">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
