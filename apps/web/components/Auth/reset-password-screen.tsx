import { AuthLayout, StepHeader } from "@/components/Auth/auth-layout";
import FieldMessage from "@/components/Auth/field-message";
import PasswordInput from "@/components/Auth/password-input";
import { resetPassword } from "@/lib/auth";
import {
   PASSWORD_MIN_LENGTH,
   SITE_PATHS,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Label } from "@s3-viewer/ui/components/label";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";

// better auth's callback lands here with ?token=… when the emailed link is
// good and ?error=INVALID_TOKEN when it is not
const ResetPasswordScreen = () => {
   const router = useRouter();
   const [password, setPassword] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   const token =
      typeof router.query.token === "string" ? router.query.token : "";

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
         setError(parsed.error.issues[0]?.message ?? "Enter a password.");
         return;
      }
      setPending(true);
      const result = await resetPassword(token, parsed.data);
      if (result.error) {
         setError(result.error);
         setPending(false);
         return;
      }
      await router.replace({
         pathname: SITE_PATHS.login,
         query: { reason: "reset" },
      });
   };

   if (!router.isReady) return null;

   if (!token) {
      return (
         <AuthLayout>
            <StepHeader title="This link doesn't work">
               It may have expired or already been used. Request a new one and
               try again.
            </StepHeader>
            <Button asChild size="lg" className="mt-8 w-full">
               <Link href={SITE_PATHS.forgotPassword}>Request a new link</Link>
            </Button>
         </AuthLayout>
      );
   }

   return (
      <AuthLayout>
         <StepHeader title="Choose a new password">
            You&apos;ll be signed out everywhere else once it changes.
         </StepHeader>
         <form
            onSubmit={(event) => void submit(event)}
            noValidate
            className="mt-8 flex flex-col gap-4"
         >
            <div className="flex flex-col gap-1.5">
               <Label htmlFor="new-password">New password</Label>
               <PasswordInput
                  id="new-password"
                  name="new-password"
                  autoComplete="new-password"
                  autoFocus
                  required
                  value={password}
                  disabled={pending}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="password-message"
                  onChange={(event) => {
                     setPassword(event.target.value);
                     if (error) setError(null);
                  }}
               />
               <FieldMessage
                  id="password-message"
                  error={error}
                  hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
                  reserve
               />
            </div>
            <Button
               type="submit"
               size="lg"
               className="w-full"
               loading={pending}
            >
               Reset password
            </Button>
         </form>
      </AuthLayout>
   );
};

export default ResetPasswordScreen;
