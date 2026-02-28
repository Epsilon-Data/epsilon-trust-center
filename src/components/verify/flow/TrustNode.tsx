import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustNodeData {
  label: string;
  subtitle: string;
  color: "blue" | "purple" | "green" | "orange" | "yellow" | "gray";
  verified: boolean | null;
  selected: boolean;
  [key: string]: unknown;
}

const colorClasses: Record<string, { bg: string; border: string; selectedBorder: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-200", selectedBorder: "border-blue-500" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", selectedBorder: "border-purple-500" },
  green: { bg: "bg-green-50", border: "border-green-200", selectedBorder: "border-green-500" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", selectedBorder: "border-orange-500" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-200", selectedBorder: "border-yellow-500" },
  gray: { bg: "bg-gray-50", border: "border-gray-200", selectedBorder: "border-gray-500" },
};

function VerifiedIcon({ verified }: { verified: boolean | null }) {
  if (verified === true) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
  }
  if (verified === false) {
    return <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />;
  }
  // null = pending/running — gray pulsing dot
  return (
    <span className="relative flex h-3.5 w-3.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-gray-400"></span>
    </span>
  );
}

export function TrustNode({ data }: NodeProps) {
  const nodeData = data as TrustNodeData;
  const colors = colorClasses[nodeData.color] || colorClasses.gray;

  return (
    <div
      className={cn(
        "rounded-lg border-2 px-3 py-2 shadow-sm min-w-[130px] cursor-pointer transition-all",
        colors.bg,
        nodeData.selected ? colors.selectedBorder : colors.border,
        nodeData.selected && "shadow-md ring-2 ring-offset-1 ring-primary/30"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold leading-tight">{nodeData.label}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{nodeData.subtitle}</p>
        </div>
        <VerifiedIcon verified={nodeData.verified} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}
