import { Calendar, Home, Settings, Computer, Key, CalendarClock, Megaphone, CalendarDays, Users, FileText, GitBranch } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import humanitas_logo from "../assets/humanitas_logo.png";
import { MySidebarHeader } from "./sidebar-header";
import { NavLink, useLocation } from "react-router-dom";
// import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { PMSCollapsible } from "./sidebar/PMSCollapsible";
import { HRCollapsible } from "./sidebar/HRCollapsible";
import { useAuth } from "@/context/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";
import { FooterCombobox } from "./sidebar-footer-combo";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { ModeToggle } from "@/components/mode-toggle";

import { useModules } from "@/context/ModuleContext";

// Menu items with permission requirements (matching backend permission names)
const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    id: 1,
    permissions: ["view_dashboard"], // Everyone should have this
  },
  {
    title: "Accounts",
    url: "/accounts",
    icon: Users,
    id: 2,
    module: "hrms",
    permissions: ["view_users", "edit_users", "create_users", "delete_users"],
  },
  {
    title: "Org Chart",
    url: "/hrms/org-chart",
    icon: GitBranch,
    id: 201,
    module: "hrms",
    permissions: ["view_users"],
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    id: 3,
    module: "attendance",
    permissions: [], // Requires attendance module
  },
  {
    title: "Scheduling",
    url: "/scheduling",
    icon: CalendarClock,
    id: 99,
    module: "scheduling",
    permissions: ["manage_schedules", "view_roster", "manage_roster"],
  },
  {
    title: "Announcements",
    url: "/announcements",
    icon: Megaphone,
    id: 10,
    permissions: ["view_announcements"],
  },
  {
    title: "Events",
    url: "/events",
    icon: CalendarDays,
    id: 11,
    permissions: ["view_events"],
  },
  {
    title: "Devices",
    url: "/devices",
    icon: Computer,
    id: 4,
    module: "attendance",
    permissions: ["view_devices", "manage_devices"],
  },
  {
    title: "Access Control",
    url: "/accesscontrol",
    icon: Key,
    id: 5,
    permissions: ["view_roles", "edit_roles", "create_roles", "delete_roles"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    id: 9,
    permissions: ["view_general_settings", "edit_general_settings"],
  },
  {
    title: "System Logs",
    url: "/system-logs",
    icon: FileText,
    id: 12,
    permissions: ["view_logs"],
  },
];

export function AppSidebar() {
  // const navigate = useNavigate(); // Removed unused

  const location = useLocation();
  const { hasAnyPermission } = useAuth();
  const { isModuleSubscribed } = useModules();
  const { state, isMobile, openMobile } = useSidebar();
  const [isPMSOpen, setIsPMSOpen] = useState(false);
  const [isHROpen, setIsHROpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);

  // Filter menu items based on permissions and module subscription
  const canAccessItem = (item: typeof items[0]) => {
    if ((item as any).module && !isModuleSubscribed((item as any).module)) {
      return false;
    }
    if (item.permissions.length === 0) return true;
    return hasAnyPermission(item.permissions);
  };

  useEffect(() => {
    if (location.pathname.startsWith("/pms")) setIsPMSOpen(true);
    if (
      location.pathname.startsWith("/attendance") ||
      location.pathname.startsWith("/leave") ||
      location.pathname.startsWith("/payroll")
    )
      setIsHROpen(true);
    if (location.pathname.startsWith("/attendance")) setIsAttendanceOpen(true);
    if (location.pathname.startsWith("/leave")) setIsLeaveOpen(true);
  }, [location.pathname]);

  const isCollapsed = state === "collapsed" && !(isMobile && openMobile);

  return (
    <Sidebar
      collapsible="icon"
      className="bg-sidebar border-r border-sidebar-border"
    >
      <SidebarHeader
        className="px-3 py-4 !hover:border-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md cursor-pointer transition flex flex-row items-center justify-between group-data-[collapsible=icon]:justify-center"
      >
        <div className="flex items-center gap-2 w-full justify-center lg:justify-start text-sidebar-foreground">
          <MySidebarHeader
            avatar={
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={humanitas_logo}
                  alt="logo"
                  className="w-8 h-8"
                />
                <AvatarFallback>L</AvatarFallback>
              </Avatar>
            }
            name="Humanitas"
            collapsed={isCollapsed}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] group-data-[collapsible=icon]:!overflow-y-auto group-data-[collapsible=icon]:!overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="pl-4 group-data-[collapsible=icon]:!pl-0">
              {items.map(
                (item) =>
                  item.id != 5 &&
                  item.id != 9 &&
                  item.id != 12 &&
                  canAccessItem(item) && (
                    <SidebarMenuItem key={item.url}>
                      <NavLink to={item.url} end>
                        {({ isActive }) => (
                          <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            className={`flex items-center gap-3 rounded-md transition-all duration-200 group-data-[collapsible=icon]:justify-center ${isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                          >
                            <div
                              className={`${isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                }`}
                              style={{
                                fontFamily: "Roboto",
                              }}
                            >
                              <item.icon
                                style={{
                                  width: "17px",
                                  height: "17px",
                                  fontWeight: "bold",
                                  color: isActive ? "currentColor" : "currentColor",
                                }}
                              />
                              <span className="group-data-[collapsible=icon]:hidden">
                                {item.title}
                              </span>
                            </div>
                          </SidebarMenuButton>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  )
              )}

              <HRCollapsible
                isOpen={isHROpen}
                onOpenChange={setIsHROpen}
                isAttendanceOpen={isAttendanceOpen}
                onAttendanceOpenChange={setIsAttendanceOpen}
                isLeaveOpen={isLeaveOpen}
                onLeaveOpenChange={setIsLeaveOpen}
              />

              <PMSCollapsible isOpen={isPMSOpen} onOpenChange={setIsPMSOpen} />
            </SidebarMenu>
          </SidebarGroupContent >
        </SidebarGroup >
        <SidebarGroup>
          <SidebarGroupLabel className="border-t text-gray-500 text-xs">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="pl-4 group-data-[collapsible=icon]:!pl-0">
              {items.map(
                (item) =>
                  (item.id == 5 || item.id == 9 || item.id == 12) &&
                  canAccessItem(item) && (
                    <SidebarMenuItem key={item.url}>
                      <NavLink to={item.url} end>
                        {({ isActive }) => (
                          <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            className={`flex items-center gap-3 rounded-md transition-all duration-200 group-data-[collapsible=icon]:justify-center ${isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                          >
                            <div
                              className={`${isActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                }`}
                            >
                              <item.icon
                                size={20}
                                className="shrink-0"
                                style={{
                                  color: isActive ? "currentColor" : undefined,
                                }}
                              />
                              <span className="group-data-[collapsible=icon]:hidden">
                                {item.title}
                              </span>
                            </div>
                          </SidebarMenuButton>
                        )}
                      </NavLink>
                    </SidebarMenuItem>
                  )
              )}
            </SidebarMenu>
          </SidebarGroupContent >
        </SidebarGroup >
      </SidebarContent >
      <SidebarFooter className="px-2 gap-2">
        <div className="flex justify-end pr-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pr-0">
          <ModeToggle />
        </div>
        <FooterCombobox
          collapsed={useSidebar().state === "collapsed"}
        />
      </SidebarFooter>
      <SidebarRail />
      {/* Custom Edge Trigger */}
      <div className="absolute -right-3 top-6 z-50 hidden lg:flex">
        <SidebarTrigger className="h-6 w-6 rounded-full border bg-background shadow-md hover:bg-accent text-foreground" />
      </div>
    </Sidebar >
  );
}
