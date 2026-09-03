import { cn } from "@s3-viewer/ui/lib/utils";
import Image from "next/image";

type AvatarProps = {
   name: string;
   image?: string | null;
   size?: number;
   className?: string;
};

/** First letter of the first and last word: "Ada Lovelace" → "AL". */
const initials = (name: string): string => {
   const words = name.trim().split(/\s+/).filter(Boolean);
   const first = words[0]?.charAt(0) ?? "";
   const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
   return (first + last).toUpperCase() || "?";
};

const Avatar = ({ name, image, size = 32, className }: AvatarProps) => {
   if (image) {
      return (
         <Image
            src={image}
            alt=""
            width={size}
            height={size}
            unoptimized
            className={cn("shrink-0 rounded-full object-cover", className)}
            style={{ width: size, height: size }}
         />
      );
   }
   return (
      <span
         aria-hidden="true"
         className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-viewerblue/10 font-semibold text-viewerblue select-none",
            className
         )}
         style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      >
         {initials(name)}
      </span>
   );
};

export default Avatar;
export { initials };
