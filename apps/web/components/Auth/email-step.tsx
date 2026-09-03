import GithubIcon from "@/components/Auth/github-icon";
import { errorMessage } from "@/lib/api";
import { startAuthFlow } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { emailSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { useState, type FormEvent } from "react";

type EmailStepProps = {
   initialEmail: string;
   notice: string | null;
   onSent: (email: string) => void;
   onGithub: () => void;
   githubError: string | null;
};

const EmailStep = ({
   initialEmail,
   notice,
   onSent,
   onGithub,
   githubError,
}: EmailStepProps) => {
   const [email, setEmail] = useState(initialEmail);
   const [error, setError] = useState<string | null>(null);
   const [sending, setSending] = useState(false);
   const shownError = error ?? githubError;

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) {
         setError("Enter a valid email address.");
         return;
      }
      setError(null);
      setSending(true);
      try {
         await startAuthFlow(parsed.data);
         onSent(parsed.data);
      } catch (caught) {
         setError(errorMessage(caught));
         setSending(false);
      }
   };

   return (
      <div className="flex flex-col gap-6">
         {notice && (
            <p
               role="status"
               className="rounded-lg border border-viewerborder bg-viewergray px-3 py-2 text-sm text-viewertext"
            >
               {notice}
            </p>
         )}

         {publicEnv.githubLoginEnabled && (
            <>
               <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={sending}
                  onClick={onGithub}
               >
                  <GithubIcon className="size-4" />
                  Continue with GitHub
               </Button>
               <div
                  className="text-meta flex items-center gap-3"
                  aria-hidden="true"
               >
                  <span className="h-px flex-1 bg-viewerborder" />
                  or
                  <span className="h-px flex-1 bg-viewerborder" />
               </div>
            </>
         )}

         <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
               <Label htmlFor="email">Email</Label>
               <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="you@example.com"
                  value={email}
                  disabled={sending}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="email-error"
                  onChange={(event) => {
                     setEmail(event.target.value);
                     if (error) setError(null);
                  }}
               />
               <p
                  id="email-error"
                  role="alert"
                  className="min-h-5 text-sm leading-5 text-viewertextred"
               >
                  {shownError}
               </p>
            </div>
            <Button
               type="submit"
               size="lg"
               className="w-full"
               loading={sending}
            >
               Continue
            </Button>
         </form>
      </div>
   );
};

export default EmailStep;
