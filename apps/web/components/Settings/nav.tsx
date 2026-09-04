import { SITE_PATHS } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";

const ITEMS = [
   { href: SITE_PATHS.settingsProfile, label: "Profile", icon: UserRound },
   { href: SITE_PATHS.settingsInvites, label: "Invites", icon: Mail },
] as const;

const SettingsNav = () => {
   const { pathname } = useRouter();
   return (
      <nav aria-label="Settings" className="shrink-0 md:w-48">
         <ul className="flex gap-1 md:flex-col">
            {ITEMS.map(({ href, label, icon: Icon }) => {
               const active = pathname === href;
               return (
                  <li key={href}>
                     <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                           "flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm text-viewertext transition-colors duration-150 hover:bg-viewergray/70",
                           active &&
                              "bg-viewergray font-medium text-viewerblack hover:bg-viewergray"
                        )}
                     >
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        {label}
                     </Link>
                  </li>
               );
            })}
         </ul>
      </nav>
   );
};

export default SettingsNav;
