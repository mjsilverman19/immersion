import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeartRatingProps {
  rating: number; // 1-5
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };

export const HeartRating = ({ rating, onChange, size = "md" }: HeartRatingProps) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <button
        key={i}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(i)}
        className={cn("transition-transform", onChange && "cursor-pointer hover:scale-110")}
        aria-label={`${i} heart${i > 1 ? "s" : ""}`}
      >
        <Heart className={cn(sizes[size], i <= rating ? "fill-primary text-primary" : "text-muted-foreground/30")} />
      </button>
    ))}
  </div>
);
