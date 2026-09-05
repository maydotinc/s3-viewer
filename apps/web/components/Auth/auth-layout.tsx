import BrandPanel from "@/components/Auth/brand-panel";
import { LEGAL_LINK, TEXT_LINK } from "@/components/Auth/text-link";
import { afterLoginPath } from "@/lib/auth-redirect";
import { publicEnv } from "@/lib/env";
import { PRIVACY_URL, TERMS_URL } from "@/lib/site-config";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

type Switch = { prompt: string; label: string; href: string };

// the way to the other account screen sits on the logo's line: a prompt and
// one text link. A `?next=` survives the switch
const SWITCHES: Readonly<Record<string, Switch>> = {
   [SITE_PATHS.login]: {
      prompt: "Don\u2019t have an account?",
      label: "Sign up",
      href: SITE_PATHS.signup,
   },
   [SITE_PATHS.signup]: {
      prompt: "Already have an account?",
      label: "Log in",
      href: SITE_PATHS.login,
   },
};

const REMEMBERED: Switch = {
   prompt: "Remembered it?",
   label: "Log in",
   href: SITE_PATHS.login,
};

const AccountSwitch = () => {
   const { pathname, query } = useRouter();
   const destination = afterLoginPath(query.next);
   const next =
      destination === SITE_PATHS.dashboard ? undefined : { next: destination };
   const { prompt, label, href } = SWITCHES[pathname] ?? REMEMBERED;
   return (
      <p className="text-sm text-viewertext">
         <span className="hidden sm:inline">{prompt} </span>
         <Link href={{ pathname: href, query: next }} className={TEXT_LINK}>
            {label}
         </Link>
      </p>
   );
};

type AuthLayoutProps = {
   // replaces the form column entirely, e.g. while leaving for github
   busy?: ReactNode;
   children: ReactNode;
};

const AuthLayout = ({ busy, children }: AuthLayoutProps) => (
   <div className="grid min-h-dvh w-full lg:grid-cols-2">
      <main className="relative flex flex-col justify-center px-6 pb-12 pt-24 sm:px-12">
         <header className="absolute inset-x-6 top-6 flex h-8 items-center justify-between sm:inset-x-12 sm:top-10">
            <a
               href={`${publicEnv.siteOrigin}/`}
               aria-label={`${PRODUCT_NAME} home`}
               className="inline-flex rounded-sm border border-transparent outline-none focus-visible:border-viewerblue"
            >
               <Image
                  src="/icons/viewer.svg"
                  alt=""
                  width={150}
                  height={32}
                  priority
                  draggable={false}
                  className="h-7 w-[131px]"
               />
            </a>
            <AccountSwitch />
         </header>

         {busy ? (
            <div className="flex flex-1 items-center justify-center">
               {busy}
            </div>
         ) : (
            <div className="mx-auto w-full max-w-sm">
               {children}
               <p className="text-meta mt-10">
                  By continuing you agree to the{" "}
                  <a href={TERMS_URL} className={LEGAL_LINK}>
                     Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href={PRIVACY_URL} className={LEGAL_LINK}>
                     Privacy Policy
                  </a>
                  .
               </p>
            </div>
         )}
      </main>
      <BrandPanel />
   </div>
);

type StepHeaderProps = { title: string; children: ReactNode };

const StepHeader = ({ title, children }: StepHeaderProps) => (
   <>
      <h1 className="text-title">{title}</h1>
      <p className="mt-2 text-sm text-viewertext">{children}</p>
   </>
);

export { AuthLayout, StepHeader };
