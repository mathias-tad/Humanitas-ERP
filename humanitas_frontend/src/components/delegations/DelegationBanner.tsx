import React, { useState } from "react";
import { useActiveDelegations } from "@/hooks/useDelegations";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, UserCheck, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DelegationModal } from "./DelegationModal";

export const DelegationBanner: React.FC = () => {
  const { user } = useAuth();
  const { data: activeDelegations = [] } = useActiveDelegations();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // An active delegation where the current user is the delegatee
  const currentDelegation = activeDelegations.find(
    (d) => d.delegatee_id === user?.id && d.status === "active"
  );

  if (!currentDelegation) {
    return (
      <DelegationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    );
  }

  const formatShortDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const isActing = currentDelegation.is_acting_assignment;
  const delegatorDisplayName =
    [currentDelegation.delegator_first_name, currentDelegation.delegator_last_name].filter(Boolean).join(" ") ||
    currentDelegation.delegator_name ||
    "Delegator";

  return (
    <>
      <div
        className={`border-b px-4 py-2 flex items-center justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-top-1 duration-200 ${
          isActing
            ? "bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-primary/5 border-indigo-500/30 text-indigo-950 dark:text-indigo-200"
            : "bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-primary/5 border-amber-500/30 text-amber-950 dark:text-amber-200"
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
              isActing
                ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300"
                : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
            }`}
          >
            {isActing ? <Briefcase className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          </div>
          <div className="truncate">
            <span className="font-semibold">
              {isActing ? "Acting Assignment Active:" : "Authority Delegation Active:"}
            </span>{" "}
            {isActing ? (
              <span>
                Acting as <strong>{currentDelegation.acting_position_title || "Covering Role"}</strong> on behalf of{" "}
                <strong>{delegatorDisplayName}</strong> ({currentDelegation.scope} Scope, valid{" "}
                {formatShortDate(currentDelegation.start_date)} - {formatShortDate(currentDelegation.end_date)}). All actions audited.
              </span>
            ) : (
              <span>
                Acting on behalf of <strong>{delegatorDisplayName}</strong> ({currentDelegation.scope} Scope, valid{" "}
                {formatShortDate(currentDelegation.start_date)} - {formatShortDate(currentDelegation.end_date)}). All actions audited.
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <Button
            size="sm"
            variant="outline"
            className={`h-6 px-2.5 text-xs ${
              isActing
                ? "border-indigo-500/40 text-indigo-950 dark:text-indigo-200 hover:bg-indigo-500/15"
                : "border-amber-500/40 text-amber-950 dark:text-amber-200 hover:bg-amber-500/15"
            }`}
            onClick={() => setIsModalOpen(true)}
          >
            <UserCheck className="h-3 w-3 mr-1" />
            Manage
          </Button>
        </div>
      </div>

      <DelegationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
