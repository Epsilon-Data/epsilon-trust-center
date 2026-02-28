import { useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusIcon, type SectionStatus } from "@/components/shared/StatusIcon";
import type { SidebarSection } from "@/lib/types";

interface VerificationStepCardProps {
  id: SidebarSection;
  label: string;
  description: string;
  icon: React.ElementType;
  status: SectionStatus;
  timing?: number;
  expanded: boolean;
  highlighted: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function VerificationStepCard({
  id,
  label,
  description,
  icon: Icon,
  status,
  timing,
  expanded,
  highlighted,
  onToggle,
  children,
}: VerificationStepCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  return (
    <div
      ref={cardRef}
      id={`section-${id}`}
      className={cn(
        "border rounded-lg bg-card transition-all duration-300",
        highlighted && "ring-2 ring-primary/50 ring-offset-2 animate-pulse"
      )}
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-muted/50 transition-colors rounded-lg"
      >
        <Icon className={cn("h-5 w-5 shrink-0", status === "verified" ? "text-green-600" : status === "failed" ? "text-red-600" : "text-muted-foreground")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{label}</span>
            {timing !== undefined && (
              <span className="text-xs text-muted-foreground/60 font-mono">{timing}ms</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <StatusIcon status={status} />
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-5 pb-5 pt-1">{children}</div>
      </div>
    </div>
  );
}
