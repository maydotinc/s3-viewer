import Reserve from "@/components/reserve";
import BrandPanel from "./brand-panel";
import { COMPANY_LINK, LEGAL_LINK, TEXT_LINK } from "./text-link";
import { afterLoginPath } from "@/lib/auth-redirect";
import { publicEnv } from "@/lib/env";
import useInstanceConfig, {
   signUpPolicyState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { PRIVACY_URL, TERMS_URL } from "@/lib/site-config";
import {
   COMPANY_NAME,
   COMPANY_URL,
   PRODUCT_NAME,
   SITE_PATHS,
} from "@s3-viewer/types";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

type Switch = { prompt: string; label: string; href: string };

const SWITCHES: Readonly<Record<string, Switch>> = {
   [SITE_PATHS.login]: {
      prompt: "Don't have an account?",
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
   const { data: config, isPending } = useInstanceConfig();
   const destination = afterLoginPath(query.next);
   const next =
      destination === SITE_PATHS.dashboard ? undefined : { next: destination };
   const { prompt, label, href } = SWITCHES[pathname] ?? REMEMBERED;
   const hidden =
      href === SITE_PATHS.signup &&
      (isPending || signUpPolicyState(config).mode === "closed");
   return (
      <Reserve
         show={!hidden}
         as="span"
         className="flex items-center gap-1 whitespace-nowrap"
      >
         <span className="hidden sm:inline">{prompt}</span>
         <Link href={{ pathname: href, query: next }} className={TEXT_LINK}>
            {label}
         </Link>
      </Reserve>
   );
};

type AuthLayoutProps = {
   busy?: ReactNode;
   children: ReactNode;
};

const AuthLayout = ({ busy, children }: AuthLayoutProps) => (
   <div className="flex min-h-dvh w-full min-w-0 flex-col lg:flex-row">
      <main className="flex min-w-0 flex-1 flex-col px-6 py-8 sm:px-10 lg:w-[46%] lg:flex-none xl:w-[42%]">
         <header className="flex items-center pb-6">
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
         </header>
         <div className="flex flex-1 flex-col items-center justify-center py-8">
            <div className="flex w-full max-w-[360px] flex-col gap-6 [overflow-wrap:anywhere]">
               {busy ? (
                  <div className="flex h-56 items-center justify-center">
                     {busy}
                  </div>
               ) : (
                  <div className="animate-fade-in flex flex-col gap-6">
                     {children}
                  </div>
               )}
               <p className="text-meta text-balance text-center">
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
         </div>
         <footer className="flex items-center justify-between gap-3 pt-6 text-sm text-viewertext">
            <span className="whitespace-nowrap">
               © {new Date().getFullYear()}{" "}
               <a
                  href={COMPANY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={COMPANY_LINK}
               >
                  {COMPANY_NAME}
               </a>
            </span>
            <AccountSwitch />
         </footer>
      </main>
      <BrandPanel />
   </div>
);

type StepHeaderProps = { title: string; children: ReactNode };

const StepHeader = ({ title, children }: StepHeaderProps) => (
   <div className="flex flex-col gap-2 text-center">
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-viewerblack">
         {title}
      </h1>
      <p className="text-balance text-sm text-viewertext">{children}</p>
   </div>
);

export { AuthLayout, StepHeader };
