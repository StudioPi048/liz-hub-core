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

const variantStyles: Record<SemanticVariant, string> = {
  neutral: "bg-[var(--semantic-neutral-bg)] text-[var(--semantic-neutral-fg)]",
  pending: "bg-[var(--semantic-pending-bg)] text-[var(--semantic-pending-fg)]",
  success: "bg-[var(--semantic-success-bg)] text-[var(--semantic-success-fg)]",
  critical: "bg-[var(--semantic-critical-bg)] text-[var(--semantic-critical-fg)]",
};

export function StatCard({ title, value, icon: Icon, variant = "neutral", className }: StatCardProps) {
  return (
    <div className={cn("rounded-[14px] p-4 flex flex-col gap-3", variantStyles[variant], className)}>
      <div className="w-[30px] h-[30px] rounded-[9px] bg-white flex items-center justify-center shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs md:text-[13px] font-medium opacity-80 mb-1">{title}</div>
        <div className="text-[22px] font-medium leading-none">{value}</div>
      </div>
    </div>
  );
}
