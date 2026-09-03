import BrandPanel from "@/components/Auth/brand-panel";
import CodeStep from "@/components/Auth/code-step";
import EmailStep from "@/components/Auth/email-step";
import FullPageSpinner from "@/components/Session/full-page-spinner";
import { signInWithGithub } from "@/lib/auth";
import { afterLoginPath } from "@/lib/auth-redirect";
import { publicEnv } from "@/lib/env";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { PRIVACY_URL, TERMS_URL } from "@/lib/site-config";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";
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

const TEXT_LINK =
   "rounded-sm border border-transparent font-medium text-viewerblue underline-offset-4 outline-none hover:underline focus-visible:border-viewerblue";

const LEGAL_LINK =
   "rounded-sm border border-transparent underline underline-offset-4 outline-none hover:text-viewertext focus-visible:border-viewerblue";

const AuthScreen = ({ mode, initialEmail }: AuthScreenProps) => {
   const router = useRouter();
   const sessionState = useSessionState();
   const [email, setEmail] = useState(initialEmail ?? "");
   const [step, setStep] = useState<"email" | "code">(
      initialEmail ? "code" : "email"
   );
   const [leavingForGithub, setLeavingForGithub] = useState(false);
   const [githubError, setGithubError] = useState<string | null>(null);
   const redirected = useRef(false);

   const destination = afterLoginPath(router.query.next);
   const copy = COPY[mode];
   const reason =
      typeof router.query.reason === "string" ? router.query.reason : "";
   const notice = NOTICES[reason] ?? null;

   useEffect(() => {
      if (sessionState !== "signedIn" || redirected.current) return;
      redirected.current = true;
      void router.replace(destination);
   }, [sessionState, destination, router]);

   const github = async () => {
      setGithubError(null);
      setLeavingForGithub(true);
      const { error } = await signInWithGithub();
      if (error) {
         setGithubError(error);
         setLeavingForGithub(false);
      }
   };

   if (sessionState !== "signedOut") return <FullPageSpinner />;

   const switchHref = {
      pathname: copy.switchHref,
      query:
         destination === SITE_PATHS.dashboard
            ? undefined
            : { next: destination },
   };

   return (
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

            {leavingForGithub ? (
               <div className="flex flex-1 items-center justify-center">
                  <Spinner size="lg" label="Opening GitHub sign-in" />
               </div>
            ) : (
               <div className="mx-auto w-full max-w-sm">
                  <div key={step} className={STEP_HEIGHT}>
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
                                 onGithub={() => void github()}
                                 githubError={githubError}
                              />
                           </div>
                           <p className="mt-8 text-sm text-viewertext">
                              {copy.switchPrompt}{" "}
                              <Link href={switchHref} className={TEXT_LINK}>
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
                                 className={TEXT_LINK}
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

                  <p className="text-meta mt-10">
                     By continuing you agree to the{" "}
                     <a href={TERMS_URL} className={LEGAL_LINK}>
                        terms of service
                     </a>{" "}
                     and{" "}
                     <a href={PRIVACY_URL} className={LEGAL_LINK}>
                        privacy policy
                     </a>
                     .
                  </p>
               </div>
            )}
         </main>
         <BrandPanel />
      </div>
   );
};

export default AuthScreen;
