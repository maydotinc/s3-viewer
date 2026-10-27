import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { authClient } from "@/lib/auth";
import useUpdateProfile from "@/lib/hooks/mutations/user/useUpdateProfile";
import { INVALID_NAME_MESSAGE } from "@s3-viewer/auth/client";
import { PROFILE_NAME_MAX, profileNameSchema } from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { useEffect, useState, type FormEvent } from "react";
import SettingsCard, { FORM_GRID } from "./card";

const ProfileCard = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;
   const currentName = user?.name ?? "";

   const [name, setName] = useState(currentName);
   const [nameError, setNameError] = useState<string | null>(null);
   const update = useUpdateProfile();

   useEffect(() => setName(currentName), [currentName]);

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
                     className="min-h-5 text-xs leading-5 break-words text-viewertext"
                  >
                     Email can&apos;t be changed.
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
