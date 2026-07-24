import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--semantic-neutral-bg)] text-[var(--semantic-neutral-fg)]",
        pending: "bg-[var(--semantic-pending-bg)] text-[var(--semantic-pending-fg)]",
        success: "bg-[var(--semantic-success-bg)] text-[var(--semantic-success-fg)]",
        critical: "bg-[var(--semantic-critical-bg)] text-[var(--semantic-critical-fg)]",
        forms: "bg-[var(--semantic-forms-bg)] text-[var(--semantic-forms-fg)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface SemanticBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function SemanticBadge({ className, variant, ...props }: SemanticBadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
