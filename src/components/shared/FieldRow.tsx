interface FieldRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function FieldRow({ label, value, mono = false }: FieldRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2.5 border-b last:border-0">
      <span className="text-sm font-medium text-muted-foreground w-48 shrink-0">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""} break-all`}>{value || "N/A"}</span>
    </div>
  );
}
