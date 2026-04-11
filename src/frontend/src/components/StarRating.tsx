import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
}

const STAR_KEYS = ["s1", "s2", "s3", "s4", "s5"];

export function StarRating({ rating, max = 5, size = 14 }: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {STAR_KEYS.slice(0, max).map((key, i) => (
        <Star
          key={key}
          size={size}
          className={
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-gray-300"
          }
        />
      ))}
    </div>
  );
}
