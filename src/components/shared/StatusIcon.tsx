import { CheckCircle2, XCircle, MinusCircle, Loader2 } from "lucide-react";

export type SectionStatus = "verified" | "failed" | "checking" | "na";

export function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === "verified")
    return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
  if (status === "failed")
    return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
  if (status === "checking")
    return <Loader2 className="h-4 w-4 text-yellow-600 shrink-0 animate-spin" />;
  return <MinusCircle className="h-4 w-4 text-gray-400 shrink-0" />;
}
