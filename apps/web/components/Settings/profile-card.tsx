import Avatar from "@/components/Avatar";
import { errorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth";
import useUpdateProfile from "@/lib/hooks/mutations/user/useUpdateProfile";
import { resizeAvatar } from "@/lib/utils/resize-image";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { toast } from "@s3-viewer/ui/components/toast";
import { useEffect, useRef, useState, type FormEvent } from "react";
import SettingsCard from "./card";

const NAME_MAX = 80;

const ProfileCard = () => {
   const { data: session } = authClient.useSession();
   const user = session?.user;
   const currentName = user?.name ?? "";

   const [name, setName] = useState(currentName);
   const [nameError, setNameError] = useState<string | null>(null);
   const [reading, setReading] = useState(false);
   const fileInput = useRef<HTMLInputElement>(null);
   const update = useUpdateProfile();

   // Follow the session: first load, and the saved value after an update.
   useEffect(() => setName(currentName), [currentName]);

   if (!user) {
      return (
         <SettingsCard title="Profile">
            <div className="flex flex-col gap-4" aria-busy="true">
               <Skeleton className="size-16 rounded-full" />
               <Skeleton className="h-9 w-full rounded-lg" />
               <Skeleton className="h-9 w-full rounded-lg" />
            </div>
         </SettingsCard>
      );
   }

   const savingName = update.isPending && update.variables?.name !== undefined;
   const changingPhoto =
      reading ||
      (update.isPending && typeof update.variables?.image === "string");
   const removingPhoto = update.isPending && update.variables?.image === null;
   const busy = update.isPending || reading;
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

   const pickPhoto = async (file: File | undefined) => {
      if (!file) return;
      setReading(true);
      try {
         const image = await resizeAvatar(file);
         update.mutate({ image });
      } catch (error) {
         toast.error("Couldn't read that image", {
            description: errorMessage(error),
         });
      } finally {
         setReading(false);
      }
   };

   return (
      <SettingsCard
         title="Profile"
         description="How you appear to the people you share servers with."
      >
         <div className="flex items-center gap-4">
            <Avatar name={user.name} image={user.image} size={64} />
            <div className="flex flex-wrap gap-2">
               <Button
                  variant="outline"
                  size="sm"
                  loading={changingPhoto}
                  disabled={busy && !changingPhoto}
                  onClick={() => fileInput.current?.click()}
               >
                  Change photo
               </Button>
               {user.image && (
                  <Button
                     variant="ghost"
                     size="sm"
                     loading={removingPhoto}
                     disabled={busy && !removingPhoto}
                     onClick={() => update.mutate({ image: null })}
                  >
                     Remove photo
                  </Button>
               )}
               <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Choose a profile photo"
                  onChange={(event) => {
                     const file = event.target.files?.[0];
                     event.target.value = "";
                     void pickPhoto(file);
                  }}
               />
            </div>
         </div>
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
                  loading={savingName}
                  disabled={!dirty || (busy && !savingName)}
               >
                  Save
               </Button>
            </div>
         </form>
      </SettingsCard>
   );
};

export default ProfileCard;
