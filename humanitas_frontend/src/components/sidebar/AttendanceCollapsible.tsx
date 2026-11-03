import { NavLink } from "react-router-dom";
import { Clock, ChevronRight, Eye, UserCheck, CalendarClock } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../ui/sidebar";
import { useAuth } from "@/context/AuthContext";

interface AttendanceCollapsibleProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

import { useModules } from "@/context/ModuleContext";

export function AttendanceCollapsible({
  isOpen,
  onOpenChange,
}: AttendanceCollapsibleProps) {
  const { hasAnyPermission } = useAuth();
  const { isModuleSubscribed } = useModules();

  if (!isModuleSubscribed("attendance")) {
    return null;
  }

  const canViewAttendance = hasAnyPermission(["view_attendance", "edit_attendance", "correct_attendance"]);
  const canViewMyAttendance = hasAnyPermission(["view_my_attendance", "view_attendance"]);
  const canViewOTMonitor = hasAnyPermission(["view_overtime_workers", "force_clockout"]);

  // If no items accessible, don't render
  if (!canViewAttendance && !canViewMyAttendance && !canViewOTMonitor) {
    return null;
  }

  return (
    <Collapsible
      asChild
      className="group/collapsible-attendance"
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="flex items-center gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Clock className="h-4 w-4 text-sidebar-foreground" />
            <span className="text-sidebar-foreground">Attendance</span>
            <ChevronRight className="ml-auto text-sidebar-foreground h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible-attendance:rotate-90" />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-2 border-l-0 overflow-visible">
            {canViewAttendance && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to={"/attendance/view"}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="text-sm leading-normal">Attendance</span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {canViewMyAttendance && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to={"/attendance/schedule"}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <CalendarClock className="h-4 w-4" />
                        <span className="text-sm leading-normal">
                          My Schedule
                        </span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {canViewMyAttendance && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to={"/attendance/schedule?tab=timecard"}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <UserCheck className="h-4 w-4" />
                        <span className="text-sm leading-normal">
                          Timecard
                        </span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {canViewOTMonitor && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to={"/attendance/overtime-monitor"}>
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <Clock className="h-4 w-4" />
                        <span className="text-sm leading-normal">
                          OT Monitor
                        </span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible >
  );
}
