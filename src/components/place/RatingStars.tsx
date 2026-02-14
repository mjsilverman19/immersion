"use client";

interface RatingStarsProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export default function RatingStars({
  rating,
  onChange,
  size = "md",
  interactive = false,
}: RatingStarsProps) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={star <= rating ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={star <= rating ? 0 : 1.5}
            className={`${sizeClasses[size]} ${
              star <= rating
                ? "text-yellow-400"
                : "text-gray-300 dark:text-gray-600"
            }`}
          >
            <path
              fillRule="evenodd"
              d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
