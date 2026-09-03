import BrandPanel from "@/components/Auth/brand-panel";
import CodeStep from "@/components/Auth/code-step";
import EmailStep from "@/components/Auth/email-step";
import { authClient } from "@/lib/auth";
import { afterLoginPath } from "@/lib/auth-redirect";
import { publicEnv } from "@/lib/env";
import { PRIVACY_URL, TERMS_URL } from "@/lib/site-config";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

type AuthScreenProps = {
   mode: "login" | "signup";
   initialEmail?: string;
};

const COPY = {
   login: {
      title: "Welcome back",
      subtitle:
         "Enter your email and we'll send you a code and a sign-in link.",
      switchPrompt: "Don't have an account?",
      switchLabel: "Create one",
      switchHref: SITE_PATHS.signup,
   },
   signup: {
      title: "Create your account",
      subtitle:
         "Enter your email and we'll send you a code and a sign-in link.",
      switchPrompt: "Already have an account?",
      switchLabel: "Sign in",
      switchHref: SITE_PATHS.login,
   },
} as const;

const NOTICES: Readonly<Record<string, string>> = {
   link: "That sign-in link has expired. Enter your email to get a new one.",
};

const STEP_HEIGHT = publicEnv.githubLoginEnabled
   ? "min-h-[27rem]"
   : "min-h-[20.5rem]";

const AuthScreen = ({ mode, initialEmail }: AuthScreenProps) => {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();
   const [email, setEmail] = useState(initialEmail ?? "");
   const [step, setStep] = useState<"email" | "code">(
      initialEmail ? "code" : "email"
   );
   const redirected = useRef(false);

   const destination = afterLoginPath(router.query.next);
   const copy = COPY[mode];
   const reason =
      typeof router.query.reason === "string" ? router.query.reason : "";
   const notice = NOTICES[reason] ?? null;

   useEffect(() => {
      if (isPending || !session || redirected.current) return;
      redirected.current = true;
      void router.replace(destination);
   }, [isPending, session, destination, router]);

   const switchHref = {
      pathname: copy.switchHref,
      query:
         destination === SITE_PATHS.dashboard
            ? undefined
            : { next: destination },
   };

   return (
      <div className="grid min-h-dvh w-full lg:grid-cols-2">
         <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
            <div className="mx-auto w-full max-w-sm">
               <Link
                  href={SITE_PATHS.login}
                  aria-label={PRODUCT_NAME}
                  className="mb-10 inline-flex rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-viewerblue/40"
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
               </Link>

               <div key={step} className={`motion-fade-in ${STEP_HEIGHT}`}>
                  {step === "email" ? (
                     <>
                        <h1 className="text-title">{copy.title}</h1>
                        <p className="mt-2 text-sm text-viewertext">
                           {copy.subtitle}
                        </p>
                        <div className="mt-8">
                           <EmailStep
                              initialEmail={email}
                              notice={notice}
                              onSent={(sent) => {
                                 setEmail(sent);
                                 setStep("code");
                              }}
                           />
                        </div>
                        <p className="mt-8 text-sm text-viewertext">
                           {copy.switchPrompt}{" "}
                           <Link
                              href={switchHref}
                              className="rounded-sm font-medium text-viewerblue underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-viewerblue/40"
                           >
                              {copy.switchLabel}
                           </Link>
                        </p>
                     </>
                  ) : (
                     <>
                        <h1 className="text-title">Check your inbox</h1>
                        <p className="mt-2 text-sm text-viewertext">
                           We sent a code and a sign-in link to{" "}
                           <span className="font-medium text-viewerblack">
                              {email}
                           </span>
                           .{" "}
                           <button
                              type="button"
                              onClick={() => setStep("email")}
                              className="rounded-sm font-medium text-viewerblue underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-viewerblue/40"
                           >
                              Edit
                           </button>
                        </p>
                        <div className="mt-8">
                           <CodeStep
                              email={email}
                              onVerified={async () => {
                                 redirected.current = true;
                                 await router.replace(destination);
                              }}
                           />
                        </div>
                     </>
                  )}
               </div>

               <p className="mt-10 text-meta">
                  By continuing you agree to the{" "}
                  <a
                     href={TERMS_URL}
                     className="rounded-sm underline underline-offset-4 outline-none hover:text-viewertext focus-visible:ring-[3px] focus-visible:ring-viewerblue/40"
                  >
                     terms of service
                  </a>{" "}
                  and{" "}
                  <a
                     href={PRIVACY_URL}
                     className="rounded-sm underline underline-offset-4 outline-none hover:text-viewertext focus-visible:ring-[3px] focus-visible:ring-viewerblue/40"
                  >
                     privacy policy
                  </a>
                  .
               </p>
            </div>
         </main>
         <BrandPanel />
      </div>
   );
};

export default AuthScreen;
