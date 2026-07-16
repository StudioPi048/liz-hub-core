import { cn } from "@/lib/utils";

interface AvatarProps {
  name?: string;
  email?: string;
  className?: string;
  variant?: "lavender" | "peach" | "mint";
}

const bgColors = {
  lavender: "bg-[#E4DEF9] text-[#332A5C]",
  peach: "bg-[#FBE9DD] text-[#5C3417]",
  mint: "bg-[#DBEEDD] text-[#20431F]",
};

export function AvatarProfile({ name, email, className, variant = "lavender" }: AvatarProps) {
  const displayString = name || email || "?";

  // Get up to 2 initials
  const initials = displayString
    .split(" ")
    .map((n) => n[0])
    .filter((_, i, arr) => i === 0 || i === arr.length - 1)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-medium shadow-sm",
        bgColors[variant],
        className,
      )}
    >
      {initials}
    </div>
  );
}
