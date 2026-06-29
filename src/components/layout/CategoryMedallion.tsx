import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  iconUrl?: string | null;
  alt?: string;
  size?: "sm" | "md";
  className?: string;
}

export default function CategoryMedallion({ iconUrl, alt = "", size = "md", className }: Props) {
  const dims =
    size === "sm"
      ? "w-9 h-9"
      : "w-[42px] h-[42px]";
  const icon = size === "sm" ? "w-4 h-4" : "w-[22px] h-[22px]";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full flex items-center justify-center border transition-shadow",
        "bg-[hsl(var(--header-ivoire))] border-[hsl(var(--header-or-fonce)/0.35)]",
        "group-hover:shadow-[0_4px_14px_-4px_hsl(var(--header-or-fonce)/0.5)]",
        dims,
        className,
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 35% 30%, hsl(var(--header-ivoire)), hsl(var(--header-creme)))",
      }}
      aria-hidden={!alt}
    >
      {iconUrl ? (
        <img src={iconUrl} alt={alt} className={cn("object-contain", icon)} loading="lazy" />
      ) : (
        <Sparkles className={cn("text-[hsl(var(--header-or-fonce))]", icon)} />
      )}
    </span>
  );
}
