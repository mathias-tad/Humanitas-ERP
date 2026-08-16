"use client";

import * as React from "react";
//import { User, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";

import { useAuth } from "@/context/AuthContext";

type HeaderProps = {
  avatar: React.ReactNode;
  name?: string;
  collapsed?: boolean;
};

export function MySidebarHeader({
  avatar,
  name,
  collapsed = false,
}: HeaderProps) {
  const { user } = useAuth();
  // const open = false;
  //const [value, setValue] = React.useState("");

  return (
    <div
      className={cn(
        "flex items-center w-full justify-start gap-4 transition-colors !border-none !outline-none !bg-transparent",
        collapsed && "justify-center"
      )}
    >
      <div className="shrink-0 h-10 w-10">{avatar}</div>
      {!collapsed && (
        <div className="flex flex-col items-center justify-start">
          <p className="font-bold text-foreground truncate self-start">
            {name}
          </p>
          <p className="font-thin text-xs truncate max-w-[150px]" title={user?.email || "Email@example.com"}>{user?.email || "Email@example.com"}</p>
        </div>
      )}
    </div>
  );
}
