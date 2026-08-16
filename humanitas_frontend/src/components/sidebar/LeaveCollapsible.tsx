import { NavLink } from "react-router-dom";
import {
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  Calculator,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";

interface LeaveCollapsibleProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveCollapsible({
  isOpen,
  onOpenChange,
}: LeaveCollapsibleProps) {
  const { hasAnyPermission, user } = useAuth();

  const canViewLeaveRequests = hasAnyPermission(["view_leave", "approve_leave"]);
  const canViewMyRequests = hasAnyPermission(["view_my_leave", "request_leave"]);
  const canManageBalances = hasAnyPermission(["manage_leave", "view_leave"]);

  // If no items accessible, don't render
  if (!canViewLeaveRequests && !canViewMyRequests && !canManageBalances) {
    return null;
  }

  return (
    <Collapsible
      asChild
      className="group/collapsible-leave"
      open={isOpen}
      onOpenChange={onOpenChange}
    >
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="flex items-center gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <CalendarCheck className="h-4 w-4 text-sidebar-foreground" />
            <span className="text-sidebar-foreground">Leave</span>
            <ChevronRight className="ml-auto h-3 w-3 text-sidebar-foreground transition-transform duration-200 group-data-[state=open]/collapsible-leave:rotate-90" />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-2 border-l-0 overflow-visible">
            {canViewLeaveRequests && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to="/leave/requests">
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <FileText className="h-3 w-3" />
                        <span className="text-sm leading-normal">
                          Leave requests
                        </span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {canViewMyRequests && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to="/leave/my-requests">
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <ClipboardList className="h-3 w-3" />
                        <span className="text-sm leading-normal">
                          My Requests
                        </span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {canManageBalances && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to="/leave/balances">
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <Calculator className="h-3 w-3" />
                        <span className="text-sm leading-normal">
                          Leave Balances
                        </span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {(hasAnyPermission(["manage_leave", "approve_leave"]) || user?.role?.toLowerCase() === 'owner') && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  className="!px-0 !h-auto !overflow-visible"
                >
                  <NavLink to="/leave/workflow">
                    {({ isActive }) => (
                      <div
                        className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 ${isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`}
                      >
                        <CalendarCheck className="h-3 w-3" />
                        <span className="text-sm leading-normal">
                          Workflow Settings
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
    </Collapsible>
  );
}
