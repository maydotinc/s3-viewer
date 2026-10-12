import { avatarGradient, avatarInitials } from "@/lib/utils/avatar";

const Avatar = ({ name }: { name: string }) => (
   <span
      role="img"
      aria-label={name}
      title={name}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-viewerwhite select-none"
      style={{ background: avatarGradient(name) }}
   >
      {avatarInitials(name)}
   </span>
);

export default Avatar;
