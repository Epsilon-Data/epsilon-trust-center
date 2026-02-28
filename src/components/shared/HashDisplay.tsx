import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn, truncateHash } from "@/lib/utils";

interface HashDisplayProps {
  hash: string;
  label?: string;
  truncate?: boolean;
  className?: string;
}

export function HashDisplay({ hash, label, truncate = true, className }: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
      const el = document.querySelector(`[data-hash="${hash.slice(0, 16)}"]`) as HTMLElement;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 border">
        <code className="text-xs font-mono text-foreground flex-1 break-all">
          {truncate ? truncateHash(hash) : hash}
        </code>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
