import PasswordInput from "@/components/Auth/password-input";
import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import QueryStatus from "@/components/query-status";
import Reserve from "@/components/reserve";
import StaleSignIn from "@/components/stale-sign-in";
import { authClient, changePassword, setPassword } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { useHasPassword } from "@/lib/hooks/queries/user/useHasPassword";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import {
   isSessionFresh,
   PASSWORD_MIN_LENGTH,
   passwordSchema,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { toast } from "@s3-viewer/ui/components/toast";
import { useState, type FormEvent } from "react";
import SettingsCard, { FORM_GRID } from "./card";

type Input = { current: string | null; next: string };

const FieldSkeleton = ({ hint = false }: { hint?: boolean }) => (
   <div className="flex min-w-0 flex-col gap-2">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-9 rounded-lg pointer-coarse:h-11" />
      {hint && (
         <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-36" />
         </div>
      )}
   </div>
);

const PasswordSkeleton = () => (
   <div aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading password settings</span>
      <div className={FORM_GRID}>
         <FieldSkeleton />
         <FieldSkeleton hint />
      </div>
      <div className="flex justify-end">
         <Skeleton className="h-9 w-44 max-w-full rounded-lg pointer-coarse:h-11" />
      </div>
   </div>
);

const PasswordForm = ({ hasPassword }: { hasPassword: boolean }) => {
   const [current, setCurrent] = useState("");
   const [next, setNext] = useState("");
   const [error, setError] = useState<string | null>(null);

   const save = useApiMutation<void, Error, Input>({
      request: async (input) => {
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
      success: async ({ variables, scope, queryClient }) => {
         setCurrent("");
         setNext("");
         toast.success(
            variables.current === null ? "Password set" : "Password updated"
         );
         await queryClient.invalidateQueries({
            queryKey: queryKeys.hasPassword(scope.userId),
         });
      },
      invalidates: ({ scope }) => [queryKeys.sessions(scope.userId)],
      failure: ({ error: caught }) => setError(errorMessage(caught)),
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
         <div className={FORM_GRID}>
            <Reserve show={hasPassword} as="div" className="min-w-0">
               <Field
                  label="Current password"
                  htmlFor="current-password"
                  className="gap-2"
               >
                  <PasswordInput
                     id="current-password"
                     autoComplete="current-password"
                     value={current}
                     disabled={!hasPassword || save.isPending}
                     onChange={(event) => {
                        setCurrent(event.target.value);
                        if (error) setError(null);
                     }}
                  />
               </Field>
            </Reserve>
            <Field
               label={hasPassword ? "New password" : "Password"}
               htmlFor="new-password"
               className="gap-2"
            >
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
            </Field>
         </div>
         <div className="flex justify-end">
            <Button
               type="submit"
               className="w-44 max-w-full"
               loading={save.isPending}
               disabled={!ready}
            >
               {hasPassword ? "Change password" : "Set password"}
            </Button>
         </div>
      </form>
   );
};

const PasswordCard = () => {
   const userId = useUserId();
   const query = useHasPassword();
   const { data: hasPassword, error } = query;
   const { data: session } = authClient.useSession();
   const stale =
      hasPassword === false &&
      Boolean(session && !isSessionFresh(session.session.createdAt));
   return (
      <SettingsCard
         title="Password"
         description="Manage the password you use to sign in. Changing it signs out your other devices."
      >
         <div className="flex min-h-64 flex-col @xl:min-h-44">
            <QueryStatus
               error={error}
               loading={hasPassword === undefined}
               skeleton={<PasswordSkeleton />}
               title="Couldn't load your password settings"
               className="py-2"
               retrying={query.isFetching}
               onRetry={() => void query.refetch()}
            >
               {stale ? (
                  <StaleSignIn
                     title="Sign in again to set a password"
                     action="adding a password"
                  />
               ) : (
                  <PasswordForm
                     key={JSON.stringify([userId, hasPassword])}
                     hasPassword={hasPassword ?? false}
                  />
               )}
            </QueryStatus>
         </div>
      </SettingsCard>
   );
};

export default PasswordCard;
