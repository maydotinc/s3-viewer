import BrandPanel from "@/components/Auth/brand-panel";
import { LEGAL_LINK } from "@/components/Auth/text-link";
import { publicEnv } from "@/lib/env";
import { PRIVACY_URL, TERMS_URL } from "@/lib/site-config";
import { PRODUCT_NAME } from "@s3-viewer/types";
import Image from "next/image";
import type { ReactNode } from "react";

type AuthLayoutProps = {
   // replaces the form column entirely, e.g. while leaving for github
   busy?: ReactNode;
   children: ReactNode;
};

const AuthLayout = ({ busy, children }: AuthLayoutProps) => (
   <div className="grid min-h-dvh w-full lg:grid-cols-2">
      <main className="relative flex flex-col justify-center px-6 pb-12 pt-24 sm:px-12">
         <a
            href={`${publicEnv.siteOrigin}/`}
            aria-label={`${PRODUCT_NAME} home`}
            className="absolute left-6 top-6 inline-flex rounded-sm border border-transparent outline-none focus-visible:border-viewerblue sm:left-12 sm:top-10"
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
