import { NavLink } from "react-router-dom";
import {
  Briefcase,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  Users,
  FileText,
  Settings,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/context/AuthContext";

interface PMSCollapsibleProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

import { useModules } from "@/context/ModuleContext";

export function PMSCollapsible({ isOpen, onOpenChange }: PMSCollapsibleProps) {
  const { state, isMobile, openMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !(isMobile && openMobile);
  const { hasAnyPermission } = useAuth();
  const { isModuleSubscribed } = useModules();

  if (!isModuleSubscribed("pms")) {
    return null;
  }

  const allMenuItems = [
    { to: "/pms/dashboard", icon: LayoutDashboard, label: "Dashboard", permissions: ["view_pms_dashboard", "view_pms"] },
    { to: "/pms/my-tasks", icon: ListTodo, label: "My Tasks", permissions: ["view_my_tasks", "view_pms"] },
    { to: "/pms/all-tasks", icon: ListTodo, label: "All Tasks", permissions: ["view_all_tasks", "view_pms"] },
    { to: "/pms/projects", icon: Briefcase, label: "Projects", permissions: ["view_projects", "view_pms"] },
    { to: "/pms/teams", icon: Users, label: "Teams", permissions: ["view_teams", "view_pms"] },
    { to: "/pms/reports", icon: FileText, label: "Reports", permissions: ["view_pms_reports", "view_pms"] },
    { to: "/pms/settings", icon: Settings, label: "Settings", permissions: ["manage_pms_settings"] },
  ];

  // Filter items based on permissions
  const menuItems = allMenuItems.filter(item => hasAnyPermission(item.permissions));

  // If no items are accessible, don't render the component
  if (menuItems.length === 0) {
    return null;
  }

  // Render popover menu when collapsed
  if (isCollapsed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="PMS"
              className="justify-center flex items-center rounded-md transition-all duration-200 font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Briefcase
                size={20}
                className="shrink-0"
                style={{
                  color: "currentColor",
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          className="w-56 p-2 !pl-0"
          sideOffset={8}
        >
          <div className="flex flex-col gap-1">
            <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
              PMS
            </div>
            {menuItems.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {({ isActive }) => (
                  <div
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Render normal collapsible when expanded
  return (
    <Collapsible
      asChild
      className="group/collapsible"
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip="PMS"
            className="!pl-2 flex items-center gap-3 rounded-md transition-all duration-200 font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <div
              className="flex items-center gap-3 w-full text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
              style={{ fontFamily: "Roboto" }}
            >
              <Briefcase
                style={{
                  width: "17px",
                  height: "17px",
                  fontWeight: "bold",
                  color: "currentColor",
                }}
              />
              <span>PMS</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </div>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {menuItems.map((item) => (
              <SidebarMenuSubItem key={item.to}>
                <SidebarMenuSubButton asChild className="!px-0">
                  <NavLink to={item.to}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
