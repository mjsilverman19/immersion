import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

const pixelMap = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export default function Avatar({ src, alt, size = "md", className = "" }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={pixelMap[size]}
        height={pixelMap[size]}
        className={`${sizeMap[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeMap[size]} flex items-center justify-center rounded-full bg-gray-200 text-gray-500 ${className}`}
    >
      <span className="text-xs font-medium uppercase">
        {alt.charAt(0)}
      </span>
    </div>
  );
}
