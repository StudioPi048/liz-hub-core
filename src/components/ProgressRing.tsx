import { cn } from "@/lib/utils";
import type { SemanticVariant } from "./StatCard";

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  variant?: SemanticVariant;
  className?: string;
  label?: string;
}

const variantStyles: Record<SemanticVariant, { bg: string; fg: string; text: string }> = {
  neutral: {
    bg: "text-[var(--semantic-neutral-bg)]",
    fg: "text-[var(--semantic-neutral-fg)]",
    text: "text-[var(--semantic-neutral-fg)]",
  },
  pending: {
    bg: "text-[var(--semantic-pending-bg)]",
    fg: "text-[var(--semantic-pending-fg)]",
    text: "text-[var(--semantic-pending-fg)]",
  },
  success: {
    bg: "text-[var(--semantic-success-bg)]",
    fg: "text-[var(--semantic-success-fg)]",
    text: "text-[var(--semantic-success-fg)]",
  },
  critical: {
    bg: "text-[var(--semantic-critical-bg)]",
    fg: "text-[var(--semantic-critical-fg)]",
    text: "text-[var(--semantic-critical-fg)]",
  },
};

export function ProgressRing({
  progress,
  size = 60,
  strokeWidth = 6,
  variant = "success",
  className,
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const colors = variantStyles[variant];

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Track */}
        <circle
          className={colors.bg}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress */}
        <circle
          className={cn(colors.fg, "transition-all duration-1000 ease-in-out")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div
        className={cn(
          "absolute flex flex-col items-center justify-center text-center",
          colors.text,
        )}
      >
        <span className="text-sm font-medium leading-none">{Math.round(progress)}%</span>
        {label && <span className="text-[9px] opacity-70 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
