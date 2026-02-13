import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  variant?: "default" | "primary" | "secondary" | "jammer";
  className?: string;
  tooltip?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  variant = "default",
  className,
  tooltip,
}: MetricCardProps) {
  const variantStyles = {
    default: "bg-card border-border",
    primary: "bg-primary/5 border-primary/20",
    secondary: "bg-secondary/5 border-secondary/20",
    jammer: "bg-destructive/5 border-destructive/20",
  };

  const valueStyles = {
    default: "text-foreground",
    primary: "text-primary",
    secondary: "text-secondary",
    jammer: "text-destructive",
  };

  const displayValue = typeof value === "number" ? value.toFixed(3) : value;

  const card = (
    <div
      className={cn(
        "panel p-4 border rounded-lg transition-all duration-300",
        variantStyles[variant],
        className
      )}
    >
      <p className="data-label mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={cn("data-value", valueStyles[variant])}>
          {displayValue}
        </span>
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return card;
}