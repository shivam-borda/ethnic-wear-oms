import { cn } from "@/lib/utils";

interface Props {
  text?: string | null;
  className?: string;
  emptyText?: string;
}

export function BulletPointsList({ text, className, emptyText }: Props) {
  if (!text || !text.trim()) {
    return emptyText ? <p className="text-xs text-muted-foreground italic">{emptyText}</p> : null;
  }

  const lines = text
    .split("\n")
    .map((line) => line.replace(/^[•\-\*d+\.]\s*/, "").trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return null;

  return (
    <ul className={cn("list-disc pl-5 space-y-1.5 text-sm text-foreground font-normal", className)}>
      {lines.map((line, idx) => (
        <li key={idx} className="leading-relaxed">
          {line}
        </li>
      ))}
    </ul>
  );
}
