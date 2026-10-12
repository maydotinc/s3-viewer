import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { AuthLayout, StepHeader } from "./auth-layout";
import PasswordInput from "./password-input";
import { resetPassword } from "@/lib/auth";
import {
   PASSWORD_MIN_LENGTH,
   SITE_PATHS,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";

const ResetPasswordScreen = () => {
   const router = useRouter();
   const [password, setPassword] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [pending, setPending] = useState(false);
   const [token, setToken] = useState<string | null>(null);

   // keep the token out of the address bar and history once it is in memory.
   useEffect(() => {
      if (!router.isReady || token !== null) return;
      const fromUrl =
         typeof router.query.token === "string" ? router.query.token : "";
      setToken(fromUrl);
      if (fromUrl) {
         void router.replace(SITE_PATHS.resetPassword, undefined, {
            shallow: true,
         });
      }
   }, [router, token]);

   const submit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
         setError(parsed.error.issues[0]?.message ?? "Enter a password.");
         return;
      }
      if (!token) return;
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

   if (!router.isReady || token === null)
      return (
         <AuthLayout
            busy={<Spinner size="lg" label="Loading password reset" />}
         >
            {null}
         </AuthLayout>
      );

   if (!token) {
      return (
         <AuthLayout>
            <StepHeader title="This link doesn't work">
               It may have expired or already been used. Request a new one and
               try again.
            </StepHeader>
            <Button asChild className="w-full">
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
            className="flex flex-col gap-5"
         >
            <Field label="New password" htmlFor="new-password">
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
               <FormError
                  id="password-message"
                  size="sm"
                  reserve={false}
                  hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
               >
                  {error}
               </FormError>
            </Field>
            <Button type="submit" className="w-full" loading={pending}>
               Reset password
            </Button>
         </form>
      </AuthLayout>
   );
};

export default ResetPasswordScreen;
