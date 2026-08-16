"use client";

import * as React from "react";
import { User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useAuth } from "@/context/AuthContext";
import { getAvatarUrl as generateAvatarUrl, getUploadUrl } from "@/config/api.config";

type FooterComboboxProps = {
  collapsed?: boolean;
};

export function FooterCombobox({ collapsed = false }: FooterComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login");
  };

  const handleProfile = () => {
    setOpen(false);
    navigate("/settings?tab=Account");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      return getUploadUrl(user.avatar_url);
    }
    return generateAvatarUrl(user?.full_name || "User");
  };

  const displayName = user?.full_name || "User";
  const displayEmail = user?.email || "user@example.com";
  const initials = getInitials(displayName);
  const avatarUrl = getAvatarUrl();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className="h-15">
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex items-center w-full justify-start gap-4 rounded-b-md p-2 transition-colors hover:bg-muted",
            collapsed && "justify-center"
          )}
        >
          <div className="shrink-0 h-10 w-10">
            <Avatar>
              <AvatarImage
                src={avatarUrl}
                alt={displayName}
                className="h-10 w-10 rounded-full object-cover"
              />
              <AvatarFallback className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          {!collapsed && (
            <div className="flex flex-col items-start justify-start overflow-hidden">
              <p className="font-bold text-foreground truncate text-sm">
                {displayName}
              </p>
              <p className="font-thin text-xs text-muted-foreground truncate">
                {displayEmail}
              </p>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit px-2 mb-5">
        <Command>
          <CommandList>
            <CommandGroup>
              <div className="flex items-center gap-3 border-b pb-3 mb-3">
                <Avatar>
                  <AvatarImage
                    src={avatarUrl}
                    alt={displayName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <AvatarFallback className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="font-bold text-sm">{displayName}</p>
                  <p className="font-thin text-xs text-muted-foreground">
                    {displayEmail}
                  </p>
                </div>
              </div>
              <CommandItem onSelect={handleProfile} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                My Profile
              </CommandItem>
              <CommandItem
                onSelect={handleLogout}
                className="cursor-pointer text-red-600 hover:text-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
