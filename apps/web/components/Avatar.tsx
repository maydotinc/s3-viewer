import { cn } from "@s3-viewer/ui/lib/utils";
import Image from "next/image";

type AvatarProps = {
   name: string;
   image?: string | null;
   size?: number;
   className?: string;
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
            "flex shrink-0 select-none items-center justify-center rounded-full bg-viewerblue/10 text-[13px] font-semibold text-viewerblue",
            className
         )}
         style={{ width: size, height: size }}
      >
         {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
   );
};

export default Avatar;
