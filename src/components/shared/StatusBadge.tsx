import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "verified" | "failed" | "checking" | "unknown";
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = {
    verified: {
      icon: CheckCircle2,
      bg: "bg-green-100 text-green-800",
      text: label || "Verified",
    },
    failed: {
      icon: XCircle,
      bg: "bg-red-100 text-red-800",
      text: label || "Failed",
    },
    checking: {
      icon: Loader2,
      bg: "bg-yellow-100 text-yellow-800",
      text: label || "Checking...",
    },
    unknown: {
      icon: Loader2,
      bg: "bg-gray-100 text-gray-600",
      text: label || "Unknown",
    },
  };

  const { icon: Icon, bg, text } = config[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", bg, className)}>
      <Icon className={cn("h-3.5 w-3.5", status === "checking" && "animate-spin")} />
      {text}
    </span>
  );
}
