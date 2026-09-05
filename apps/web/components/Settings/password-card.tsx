import PasswordInput from "@/components/Auth/password-input";
import FormError from "@/components/Modals/form-error";
import { authClient, changePassword, setPassword, signOut } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { useHasPassword } from "@/lib/hooks/queries/user/useHasPassword";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import {
   HOUR_MS,
   PASSWORD_MIN_LENGTH,
   SESSION_FRESH_HOURS,
   SITE_PATHS,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Label } from "@s3-viewer/ui/components/label";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import SettingsCard from "./card";

type Input = { current: string | null; next: string };

const FRESH_SESSION_MS = SESSION_FRESH_HOURS * HOUR_MS;

// the same two-column field row as the profile card above it
const FIELDS = "grid gap-4 sm:grid-cols-2";

// a first password claims the account outright, so like account deletion
// it needs a session younger than 24 hours; the api enforces the same
const isStale = (createdAt: Date | string): boolean =>
   Date.now() - new Date(createdAt).getTime() >= FRESH_SESSION_MS;

const StaleSession = () => (
   <div className="flex flex-col items-start gap-2 rounded-lg bg-viewergray px-4 py-3 text-sm text-viewertext">
      <p>
         For your security, setting a password needs a sign-in from the last 24
         hours.
      </p>
      <Button
         variant="outline"
         size="sm"
         onClick={() =>
            void signOut(
               `${SITE_PATHS.login}?${new URLSearchParams({ next: SITE_PATHS.settingsProfile })}`
            )
         }
      >
         Sign in again
      </Button>
   </div>
);

const PasswordForm = ({ hasPassword }: { hasPassword: boolean }) => {
   const userId = useUserId();
   const queryClient = useQueryClient();
   const [current, setCurrent] = useState("");
   const [next, setNext] = useState("");
   const [error, setError] = useState<string | null>(null);

   const save = useMutation<void, Error, Input>({
      mutationFn: async (input) => {
         if (input.current === null) {
            await setPassword(input.next);
            return;
         }
         const { error: changeError } = await changePassword(
            input.current,
            input.next
         );
         if (changeError) throw new Error(changeError);
      },
      onSuccess: async () => {
         setCurrent("");
         setNext("");
         toast.success(hasPassword ? "Password updated" : "Password set");
         await queryClient.invalidateQueries({
            queryKey: queryKeys.hasPassword(userId),
         });
      },
      onError: (caught) => setError(errorMessage(caught)),
   });

   const submit = (event: FormEvent) => {
      event.preventDefault();
      const parsed = passwordSchema.safeParse(next);
      if (!parsed.success) {
         setError(parsed.error.issues[0]?.message ?? "Enter a password.");
         return;
      }
      setError(null);
      save.mutate({ current: hasPassword ? current : null, next: parsed.data });
   };

   const ready = next.length > 0 && (!hasPassword || current.length > 0);

   return (
      <form onSubmit={submit} className="flex flex-col gap-4">
         <div className={FIELDS}>
            {hasPassword && (
               <div className="flex flex-col gap-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <PasswordInput
                     id="current-password"
                     autoComplete="current-password"
                     value={current}
                     disabled={save.isPending}
                     onChange={(event) => {
                        setCurrent(event.target.value);
                        if (error) setError(null);
                     }}
                  />
               </div>
            )}
            <div className="flex flex-col gap-2">
               <Label htmlFor="new-password">
                  {hasPassword ? "New password" : "Password"}
               </Label>
               <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  value={next}
                  disabled={save.isPending}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="new-password-message"
                  onChange={(event) => {
                     setNext(event.target.value);
                     if (error) setError(null);
                  }}
               />
               <FormError
                  id="new-password-message"
                  hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
               >
                  {error}
               </FormError>
            </div>
         </div>
         <div className="flex justify-end">
            <Button type="submit" loading={save.isPending} disabled={!ready}>
               {hasPassword ? "Change password" : "Set password"}
            </Button>
         </div>
      </form>
   );
};

const PasswordCard = () => {
   const { data: hasPassword, isLoading, error } = useHasPassword();
   const { data: session } = authClient.useSession();
   const stale =
      hasPassword === false &&
      Boolean(session && isStale(session.session.createdAt));
   const description = hasPassword
      ? "Change the password you sign in with. Other devices are signed out when it changes."
      : "Add a password to sign in without waiting for an email.";

   if (isLoading || error) {
      return (
         <SettingsCard title="Password" description={description}>
            {error ? (
               <p className="text-sm text-viewertextred">{error.message}</p>
            ) : (
               <div className="flex flex-col gap-4" aria-busy="true">
                  <div className={FIELDS}>
                     <div className="flex flex-col gap-2">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="h-9 w-full rounded-lg" />
                        <Skeleton className="h-5 w-40" />
                     </div>
                  </div>
                  <div className="flex justify-end">
                     <Skeleton className="h-9 w-28 rounded-lg" />
                  </div>
               </div>
            )}
         </SettingsCard>
      );
   }

   return (
      <SettingsCard title="Password" description={description}>
         {stale ? (
            <StaleSession />
         ) : (
            <PasswordForm
               key={String(hasPassword)}
               hasPassword={Boolean(hasPassword)}
            />
         )}
      </SettingsCard>
   );
};

export default PasswordCard;
