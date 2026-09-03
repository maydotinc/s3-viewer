import { avatarGradient, avatarInitials } from "@/lib/utils/avatar";
import { cn } from "@s3-viewer/ui/lib/utils";

type AvatarProps = {
   name: string;
   size?: number;
   className?: string;
};

/**
 * Initials on a gradient derived from the name — the only avatar there is.
 * Profile pictures do not exist in the product, so there is nothing to pass
 * in and nothing to edit: change your name and the avatar changes with it.
 */
const Avatar = ({ name, size = 32, className }: AvatarProps) => (
   <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
         "flex shrink-0 items-center justify-center rounded-full font-semibold text-viewerwhite select-none",
         className
      )}
      style={{
         width: size,
         height: size,
         fontSize: Math.round(size * 0.4),
         background: avatarGradient(name),
      }}
   >
      {avatarInitials(name)}
   </span>
);

export default Avatar;
