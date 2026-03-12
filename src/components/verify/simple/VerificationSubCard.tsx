import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface LearnMoreLink {
  label: string;
  href: string;
}

interface DetailField {
  label: string;
  value: string | ReactNode;
  mono?: boolean;
}

interface VerificationSubCardProps {
  title: string;
  vendorLogo?: ReactNode;
  description: string;
  learnMoreLinks?: LearnMoreLink[];
  details?: DetailField[];
  children?: ReactNode;
  defaultExpanded?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export function VerificationSubCard({
  title,
  vendorLogo,
  description,
  learnMoreLinks,
  details,
  children,
  defaultExpanded = false,
  selected = false,
  onSelect,
}: VerificationSubCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasExpandableContent = (details && details.length > 0) || children;

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect) {
      e.stopPropagation();
      onSelect();
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasExpandableContent) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className={cn(
        "w-full rounded-lg border bg-card text-left transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-muted-foreground/30",
        onSelect && "cursor-pointer"
      )}
      onClick={handleClick}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      <div className="p-3">
        {/* Card header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold flex-1">{title}</span>
          {vendorLogo}
        </div>

        {/* Intro text */}
        <p className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>

        {/* Links */}
        {learnMoreLinks && learnMoreLinks.length > 0 && (
          <div className="flex flex-col items-start gap-1 mt-2">
            {learnMoreLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              >
                {link.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        )}

        {/* Expand toggle */}
        {hasExpandableContent && (
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{expanded ? "Hide details" : "Show details"}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
        )}

        {/* Expanded content */}
        {expanded && hasExpandableContent && (
          <div className="mt-3 space-y-2">
            {details && details.length > 0 && (
              <div className="space-y-2">
                {details.map((field) => (
                  <div
                    key={typeof field.label === "string" ? field.label : "field"}
                    className="space-y-1"
                  >
                    <p className="block font-medium text-xs text-muted-foreground">
                      {field.label}
                    </p>
                    <div className="rounded bg-muted/50 px-2 py-1.5 border border-border">
                      <p
                        className={cn(
                          "text-xs break-all",
                          field.mono && "font-mono"
                        )}
                      >
                        {field.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
