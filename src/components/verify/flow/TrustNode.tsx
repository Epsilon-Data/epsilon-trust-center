import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface TrustNodeData {
  label: string;
  subtitle: string;
  kind: "cert" | "signature" | "attestation" | "pcr" | "proof" | "output";
  verified: boolean | null;
  isHighlighted: boolean;
  isDimmed: boolean;
  fields?: string[];
  [key: string]: unknown;
}

const kindBorder: Record<string, string> = {
  cert: "border-blue-300",
  signature: "border-purple-300",
  attestation: "border-green-300",
  pcr: "border-orange-300",
  proof: "border-yellow-300",
  output: "border-emerald-300",
};

function VerifiedDot({ verified }: { verified: boolean | null }) {
  if (verified === true) {
    return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />;
  }
  if (verified === false) {
    return <span className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />;
  }
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-300" />
    </span>
  );
}

export function TrustNode({ data }: NodeProps) {
  const d = data as TrustNodeData;
  const border = kindBorder[d.kind] || "border-gray-200";

  return (
    <div
      className={cn(
        "relative min-w-[120px] max-w-[220px] select-none rounded-md bg-background p-2 text-left text-xs transition-all duration-200",
        d.isHighlighted
          ? "border-2 border-yellow-300 shadow-lg ring-2 ring-yellow-300"
          : `border-2 ${border}`,
        d.isDimmed && "opacity-30"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-2 !border-gray-300 !w-2 !h-2" />

      {/* Header */}
      <div className="flex items-center gap-1.5">
        <VerifiedDot verified={d.verified} />
        <span className="font-medium text-sm leading-tight truncate">{d.label}</span>
      </div>
      <p className="text-muted-foreground text-[10px] leading-tight mt-0.5 ml-3.5">{d.subtitle}</p>

      {/* Fields */}
      {d.fields && d.fields.length > 0 && (
        <>
          <Separator className="my-1.5" />
          <ul className="space-y-0">
            {d.fields.map((field) => (
              <li key={field} className="text-[10px] text-muted-foreground truncate px-0.5">
                {field}
              </li>
            ))}
          </ul>
        </>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !w-2 !h-2 !border-0" />
    </div>
  );
}
