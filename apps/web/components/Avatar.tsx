import { stringToColor } from "@s3-viewer/ui/lib/utils";
import Image from "next/image";

type AvatarProps = {
   name: string;
   image?: string | null;
   size?: number;
   className?: string;
};

const Avatar = ({ name, image, size = 32, className = "" }: AvatarProps) => {
   if (image) {
      return (
         <Image
            src={image}
            alt=""
            width={size}
            height={size}
            unoptimized
            className={`shrink-0 rounded-full object-cover ${className}`}
            style={{ width: size, height: size }}
         />
      );
   }
   return (
      <span
         aria-hidden="true"
         className={`flex shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold text-viewerwhite ${className}`}
         style={{
            width: size,
            height: size,
            backgroundColor: stringToColor(name),
         }}
      >
         {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
   );
};

export default Avatar;
