import { TEXT_LINK } from "@/components/Auth/text-link";
import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { authClient } from "@/lib/auth";
import useResendVerification from "@/lib/hooks/mutations/user/useResendVerification";
import useUpdateProfile from "@/lib/hooks/mutations/user/useUpdateProfile";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { INVALID_NAME_MESSAGE } from "@s3-viewer/auth/client";
import { PROFILE_NAME_MAX, profileNameSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { toast } from "@s3-viewer/ui/components/toast";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";
import SettingsCard, { FORM_GRID } from "./card";

const ProfileCard = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;
   const currentName = user?.name ?? "";

   const [name, setName] = useState(currentName);
   const [nameError, setNameError] = useState<string | null>(null);
   const update = useUpdateProfile();
   const resend = useResendVerification();
   const transport = emailState(useInstanceConfig());
   const router = useRouter();

   useEffect(() => setName(currentName), [currentName]);

   const linkError = typeof router.query.error === "string";
   useEffect(() => {
      if (!linkError) return;
      toast.error("That verification link didn't work", {
         description: "It may have expired. Send a new one below.",
      });
      void router.replace(router.pathname, undefined, { shallow: true });
   }, [linkError, router]);

   const dirty = name.trim() !== currentName;

   const submitName = (event: FormEvent) => {
      event.preventDefault();
      const parsed = profileNameSchema.safeParse(name);
      if (!parsed.success) {
         setNameError(INVALID_NAME_MESSAGE);
         return;
      }
      setNameError(null);
      update.mutate({ name: parsed.data });
   };

   return (
      <SettingsCard
         title="Profile"
         description="How you appear to the people you share servers with."
      >
         <form onSubmit={submitName} className="flex flex-col gap-4">
            <div className={FORM_GRID}>
               <Field label="Name" htmlFor="profile-name" className="gap-2">
                  <Input
                     id="profile-name"
                     value={name}
                     disabled={!user}
                     maxLength={PROFILE_NAME_MAX}
                     autoComplete="name"
                     aria-invalid={nameError ? true : undefined}
                     aria-describedby="profile-name-message"
                     onChange={(event) => {
                        setName(event.target.value);
                        if (nameError) setNameError(null);
                     }}
                  />
                  <FormError id="profile-name-message">{nameError}</FormError>
               </Field>
               <Field label="Email" htmlFor="profile-email" className="gap-2">
                  <Input
                     id="profile-email"
                     value={user?.email ?? ""}
                     disabled
                     readOnly
                     aria-describedby="profile-email-message"
                  />
                  <p
                     id="profile-email-message"
                     className={cn(
                        "text-xs leading-5 break-words text-viewertext",
                        user?.emailVerified
                           ? "min-h-5"
                           : "h-20 overflow-y-auto [scrollbar-gutter:stable]"
                     )}
                  >
                     {user?.emailVerified ? (
                        "Email can't be changed."
                     ) : !user || transport === "loading" ? (
                        ""
                     ) : transport === "disabled" ? (
                        "Not verified. Ask the instance operator to verify your account or enable email, then sign in again."
                     ) : (
                        <>
                           Not verified yet.{" "}
                           <button
                              type="button"
                              disabled={resend.isPending}
                              onClick={() => user && resend.mutate(user.email)}
                              className={TEXT_LINK}
                           >
                              Resend verification email
                           </button>
                        </>
                     )}
                  </p>
               </Field>
            </div>
            <div className="flex justify-end">
               <Button
                  type="submit"
                  loading={!user || update.isPending}
                  disabled={!user || !dirty}
               >
                  Save
               </Button>
            </div>
         </form>
      </SettingsCard>
   );
};

export default ProfileCard;
