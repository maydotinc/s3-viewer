import FormError from "@/components/Modals/form-error";
import useRenameServer from "@/lib/hooks/mutations/server/useRenameServer";
import { ServerInfo, serverNameSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { FormEvent, useState } from "react";

type RenameModalProps = {
   server: ServerInfo;
   onClose: () => void;
};

const parseServerName = (
   value: string
): { ok: true; name: string } | { ok: false; error: string } => {
   const result = serverNameSchema.safeParse(value);
   if (result.success) return { ok: true, name: result.data };
   return {
      ok: false,
      error: value.trim()
         ? "Server name must be 64 characters or fewer"
         : "Enter a server name",
   };
};

const RenameModal = ({ server, onClose }: RenameModalProps) => {
   const [value, setValue] = useState(server.name);
   const [error, setError] = useState<string | null>(null);
   const rename = useRenameServer();

   const parsed = parseServerName(value);
   const unchanged = parsed.ok && parsed.name === server.name;

   const submit = (e: FormEvent) => {
      e.preventDefault();
      if (!parsed.ok) {
         setError(parsed.error);
         return;
      }
      if (unchanged) return;
      rename.mutate(
         { serverId: server.id, serverName: parsed.name },
         { onSuccess: onClose, onError: (err) => setError(err.message) }
      );
   };

   return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
         <DialogContent className="sm:max-w-md">
            <form onSubmit={submit} className="flex flex-col gap-4">
               <DialogHeader className="text-left">
                  <DialogTitle>Rename server</DialogTitle>
                  <DialogDescription>
                     Only the name shown in S3 Viewer changes.
                  </DialogDescription>
               </DialogHeader>
               <div className="flex flex-col gap-1.5">
                  <Label htmlFor="server-name">Server name</Label>
                  <Input
                     id="server-name"
                     value={value}
                     maxLength={64}
                     autoFocus
                     aria-invalid={error ? true : undefined}
                     aria-describedby="server-name-error"
                     onChange={(e) => {
                        setValue(e.target.value);
                        setError(null);
                     }}
                  />
                  <FormError id="server-name-error">{error}</FormError>
               </div>
               <DialogFooter className="sm:justify-end">
                  <Button type="button" variant="outline" onClick={onClose}>
                     Cancel
                  </Button>
                  <Button
                     type="submit"
                     loading={rename.isPending}
                     disabled={unchanged || !parsed.ok}
                  >
                     {rename.isPending ? "Renaming…" : "Rename"}
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
};

export default RenameModal;
export { parseServerName };
