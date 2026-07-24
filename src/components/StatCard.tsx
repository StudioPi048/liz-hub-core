import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SemanticVariant = "neutral" | "pending" | "success" | "critical";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: SemanticVariant;
  className?: string;
}

const variantText: Record<SemanticVariant, string> = {
  neutral: "text-[var(--semantic-neutral-fg)]",
  pending: "text-[var(--semantic-pending-fg)]",
  success: "text-[var(--semantic-success-fg)]",
  critical: "text-[var(--semantic-critical-fg)]",
};

const variantIcon: Record<SemanticVariant, string> = {
  neutral: "text-muted-foreground",
  pending: "text-[var(--semantic-pending-fg)]",
  success: "text-[var(--semantic-success-fg)]",
  critical: "text-[var(--semantic-critical-fg)]",
};

/**
 * Fileira única de estatísticas ligadas (estilo registro/ficha), não cartões
 * repetidos: divisórias finas entre células em vez de N caixas idênticas.
 */
export function StatCardRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-bg-canvas sm:divide-x sm:divide-y-0">
      {children}
    </div>
  );
}

export function StatCard({
  title,
  value,
  icon: Icon,
  variant = "neutral",
  className,
}: StatCardProps) {
  return (
    <div className={cn("flex flex-1 basis-48 items-start gap-3 px-5 py-4", className)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", variantIcon[variant])} />
      <div className="min-w-0">
        <div className="mb-1 truncate text-[13px] text-muted-foreground">{title}</div>
        <div className={cn("font-editorial text-[26px] leading-none", variantText[variant])}>
          {value}
        </div>
      </div>
    </div>
  );
}
