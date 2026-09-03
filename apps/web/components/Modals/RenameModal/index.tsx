import FormError from "@/components/Modals/form-error";
import useRenameServer from "@/lib/hooks/mutations/server/useRenameServer";
import { ServerInfo, serverNameSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Dialog,
   DialogBody,
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
   const [touched, setTouched] = useState(false);
   const [requestError, setRequestError] = useState<string | null>(null);
   const rename = useRenameServer();

   const parsed = parseServerName(value);
   const unchanged = parsed.ok && parsed.name === server.name;
   // The submit button is disabled while invalid, so the validation message has
   // to appear on its own once the field has been touched.
   const error = requestError ?? (touched && !parsed.ok ? parsed.error : null);

   const submit = (e: FormEvent) => {
      e.preventDefault();
      if (rename.isPending || !parsed.ok || unchanged) return;
      setRequestError(null);
      rename.mutate(
         { serverId: server.id, serverName: parsed.name },
         { onSuccess: onClose, onError: (err) => setRequestError(err.message) }
      );
   };

   return (
      <Dialog open onOpenChange={rename.isPending ? undefined : onClose}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>Rename server</DialogTitle>
               <DialogDescription>
                  Only the name shown in S3 Viewer changes.
               </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="flex min-h-0 flex-col">
               <DialogBody className="flex flex-col gap-1.5">
                  <Label htmlFor="server-name">Server name</Label>
                  <Input
                     id="server-name"
                     value={value}
                     maxLength={64}
                     autoFocus
                     autoComplete="off"
                     aria-invalid={error ? true : undefined}
                     aria-describedby="server-name-error"
                     onChange={(e) => {
                        setValue(e.target.value);
                        setTouched(true);
                        setRequestError(null);
                     }}
                     onBlur={() => setTouched(true)}
                  />
                  <FormError id="server-name-error">{error}</FormError>
               </DialogBody>
               <DialogFooter>
                  <Button
                     type="submit"
                     loading={rename.isPending}
                     disabled={unchanged || !parsed.ok}
                  >
                     Rename
                  </Button>
               </DialogFooter>
            </form>
         </DialogContent>
      </Dialog>
   );
};

export default RenameModal;
export { parseServerName };
