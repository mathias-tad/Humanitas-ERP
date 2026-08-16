import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
    queryKey?: string[] | string[][];
    onRefresh?: () => Promise<void> | void;
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
}

export function RefreshButton({ queryKey, onRefresh, className, variant = "outline", size = "sm" }: RefreshButtonProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const queryClient = useQueryClient();

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            if (queryKey) {
                const keys = Array.isArray(queryKey[0]) ? queryKey as string[][] : [queryKey as string[]];
                await Promise.all(keys.map(key => queryClient.invalidateQueries({ queryKey: key })));
                // Also explicitly refetch to ensure fresh data immediately
                await Promise.all(keys.map(key => queryClient.refetchQueries({ queryKey: key })));
            }
            if (onRefresh) {
                await onRefresh();
            }
        } finally {
            // Minimum spin time for better UX
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={cn("gap-2", className)}
            onClick={handleRefresh}
            disabled={isRefreshing}
        >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            {size !== "icon" && "Refresh"}
        </Button>
    );
}
