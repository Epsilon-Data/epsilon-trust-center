import type { ReactNode } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionStatus } from "@/components/shared/StatusIcon";

interface VerificationSectionProps {
  title: string;
  status: SectionStatus;
  onClick: () => void;
  children: ReactNode;
}

const statusConfig: Record<
  SectionStatus,
  { iconBg: string; icon: ReactNode }
> = {
  verified: {
    iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    icon: <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
  },
  failed: {
    iconBg: "bg-red-100 dark:bg-red-900/50",
    icon: <X className="h-4 w-4 text-red-600 dark:text-red-400" />,
  },
  checking: {
    iconBg: "bg-yellow-100 dark:bg-yellow-900/50",
    icon: <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />,
  },
  na: {
    iconBg: "bg-muted",
    icon: <span className="text-xs text-muted-foreground">?</span>,
  },
};

export function VerificationSection({
  title,
  status,
  onClick,
  children,
}: VerificationSectionProps) {
  const config = statusConfig[status] || statusConfig.na;

  return (
    <div className="mb-6">
      {/* Section header — Phala-style standalone row */}
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 px-1 mb-3 w-full text-left"
      >
        <div
          className={cn(
            "flex-shrink-0 rounded-full p-1",
            config.iconBg
          )}
        >
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
      </button>

      {/* Cards below */}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
