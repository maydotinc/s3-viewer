import { TEXT_LINK } from "@/components/Auth/text-link";
import FormError from "@/components/Modals/form-error";
import { authClient } from "@/lib/auth";
import useResendVerification from "@/lib/hooks/mutations/user/useResendVerification";
import useUpdateProfile from "@/lib/hooks/mutations/user/useUpdateProfile";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { toast } from "@s3-viewer/ui/components/toast";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";
import SettingsCard from "./card";

const NAME_MAX = 80;

const ProfileCard = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;
   const currentName = user?.name ?? "";

   const [name, setName] = useState(currentName);
   const [nameError, setNameError] = useState<string | null>(null);
   const update = useUpdateProfile();
   const resend = useResendVerification();
   const router = useRouter();

   useEffect(() => setName(currentName), [currentName]);

   // the emailed verification link lands here; a bad one arrives as ?error=
   const linkError = typeof router.query.error === "string";
   useEffect(() => {
      if (!linkError) return;
      toast.error("That verification link didn't work", {
         description: "It may have expired. Send a new one below.",
      });
      void router.replace(router.pathname, undefined, { shallow: true });
   }, [linkError, router]);

   if (!user) {
      return (
         <SettingsCard title="Profile">
            <div className="flex flex-col gap-4" aria-busy="true">
               <Skeleton className="h-9 w-full rounded-lg" />
               <Skeleton className="h-9 w-full rounded-lg" />
            </div>
         </SettingsCard>
      );
   }

   const dirty = name.trim() !== currentName;

   const submitName = (event: FormEvent) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (trimmed.length === 0 || trimmed.length > NAME_MAX) {
         setNameError(`Enter a name of up to ${NAME_MAX} characters.`);
         return;
      }
      setNameError(null);
      update.mutate({ name: trimmed });
   };

   return (
      <SettingsCard
         title="Profile"
         description="How you appear to the people you share servers with."
      >
         <form onSubmit={submitName} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
               <Label htmlFor="profile-name">Name</Label>
               <Input
                  id="profile-name"
                  value={name}
                  maxLength={NAME_MAX}
                  autoComplete="name"
                  aria-invalid={nameError ? true : undefined}
                  onChange={(event) => {
                     setName(event.target.value);
                     if (nameError) setNameError(null);
                  }}
               />
               <FormError>{nameError}</FormError>
            </div>
            <div className="flex flex-col gap-2">
               <Label htmlFor="profile-email">Email</Label>
               <Input id="profile-email" value={user.email} disabled readOnly />
               <p className="text-xs text-viewertext">
                  Email can&rsquo;t be changed.
                  {!user.emailVerified && (
                     <>
                        {" "}
                        Not verified yet.{" "}
                        <button
                           type="button"
                           disabled={resend.isPending}
                           onClick={() => resend.mutate(user.email)}
                           className={TEXT_LINK}
                        >
                           Resend verification email
                        </button>
                     </>
                  )}
               </p>
            </div>
            <div className="flex justify-end">
               <Button
                  type="submit"
                  loading={update.isPending}
                  disabled={!dirty}
               >
                  Save
               </Button>
            </div>
         </form>
      </SettingsCard>
   );
};

export default ProfileCard;
