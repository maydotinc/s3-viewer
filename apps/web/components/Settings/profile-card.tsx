import { authClient } from "@/lib/auth";
import useUpdateProfile from "@/lib/hooks/mutations/user/useUpdateProfile";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { useEffect, useState, type FormEvent } from "react";
import SettingsCard from "./card";

const NAME_MAX = 80;

// There is no profile picture to manage: the avatar in the top bar is drawn
// from the name, so the name is the only thing to edit here.
const ProfileCard = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;
   const currentName = user?.name ?? "";

   const [name, setName] = useState(currentName);
   const [nameError, setNameError] = useState<string | null>(null);
   const update = useUpdateProfile();

   // Follow the session: first load, and the saved value after an update.
   useEffect(() => setName(currentName), [currentName]);

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
               <p className="min-h-5 text-xs text-viewertextred" role="alert">
                  {nameError}
               </p>
            </div>
            <div className="flex flex-col gap-2">
               <Label htmlFor="profile-email">Email</Label>
               <Input id="profile-email" value={user.email} disabled readOnly />
               <p className="text-xs text-viewertext">
                  Email can&rsquo;t be changed.
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
