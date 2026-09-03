import FormError from "@/components/Modals/form-error";
import { parseServerName } from "@/components/Modals/RenameModal";
import { PROVIDER_NAMES } from "@/lib/constants";
import useCreateServer from "@/lib/hooks/mutations/server/useCreateServer";
import useEstablishConnection from "@/lib/hooks/mutations/server/useEstablishConnection";
import useValidateBuckets from "@/lib/hooks/mutations/server/useValidateBuckets";
import { encryptCredentials } from "@/lib/utils/encryption";
import { pluralize } from "@/lib/utils/format";
import { splitList } from "@/lib/utils/split-list";
import {
   bucketNameSchema,
   type BucketCheck,
   type EstablishResult,
} from "@s3-viewer/types";
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
import { Check, X } from "lucide-react";
import { FormEvent, useState } from "react";
import {
   CredentialsFields,
   EMPTY_CREDENTIALS,
   toServerCredentials,
   validateCredentialFields,
   type CredentialFields,
} from "./credentials-fields";

type ConnectModalProps = { onClose: () => void };

type Fields = CredentialFields & { name: string };

const EMPTY: Fields = { ...EMPTY_CREDENTIALS, name: "" };

const validateFields = (f: Fields): string | null => {
   const name = parseServerName(f.name);
   if (!name.ok) return name.error;
   return validateCredentialFields(f);
};

const parseBucketNames = (raw: string): string[] => splitList(raw, /[\s,]+/);

const ConnectModal = ({ onClose }: ConnectModalProps) => {
   const [fields, setFields] = useState<Fields>(EMPTY);
   const [error, setError] = useState<string | null>(null);
   const [encrypted, setEncrypted] = useState<string | null>(null);
   const [detected, setDetected] = useState<EstablishResult | null>(null);
   const [bucketInput, setBucketInput] = useState("");
   const [checks, setChecks] = useState<BucketCheck[] | null>(null);

   const establish = useEstablishConnection();
   const validateBuckets = useValidateBuckets();
   const createServer = useCreateServer();
   const busy =
      establish.isPending ||
      validateBuckets.isPending ||
      createServer.isPending;

   const set = (key: keyof Fields, value: string) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      setError(null);
   };

   const detect = async (e: FormEvent) => {
      e.preventDefault();
      const message = validateFields(fields);
      if (message) {
         setError(message);
         return;
      }
      let payload: string;
      try {
         payload = await encryptCredentials(toServerCredentials(fields));
      } catch {
         setError("Couldn't encrypt the credentials in this browser");
         return;
      }
      establish.mutate(
         { encryptedCredentials: payload },
         {
            onSuccess: (result) => {
               setEncrypted(payload);
               setDetected(result);
               setError(null);
            },
            onError: (err) => setError(err.message),
         }
      );
   };

   const checkBuckets = async (): Promise<string[] | null> => {
      if (!encrypted) return null;
      const names = parseBucketNames(bucketInput);
      if (names.length === 0) {
         setError("Enter at least one bucket name");
         return null;
      }
      const invalid = names.filter(
         (n) => !bucketNameSchema.safeParse(n).success
      );
      if (invalid.length > 0) {
         setError(`Not a valid bucket name: ${invalid.join(", ")}`);
         return null;
      }
      try {
         const results = await validateBuckets.mutateAsync({
            encryptedCredentials: encrypted,
            bucketNames: names,
         });
         setChecks(results);
         if (results.some((r) => !r.accessible)) {
            setError("Remove the buckets this token can't access");
            return null;
         }
         setError(null);
         return names;
      } catch (err) {
         setError(
            err instanceof Error ? err.message : "Couldn't check buckets"
         );
         return null;
      }
   };

   const connect = async (e: FormEvent) => {
      e.preventDefault();
      if (!encrypted || !detected) return;
      let bucketNames: string[] | undefined;
      if (!detected.listBucketsAllowed) {
         const names = await checkBuckets();
         if (!names) return;
         bucketNames = names;
      }
      const name = parseServerName(fields.name);
      if (!name.ok) {
         setError(name.error);
         return;
      }
      createServer.mutate(
         {
            encryptedCredentials: encrypted,
            serverName: name.name,
            bucketNames,
         },
         { onSuccess: onClose, onError: (err) => setError(err.message) }
      );
   };

   const back = () => {
      setDetected(null);
      setEncrypted(null);
      setChecks(null);
      setError(null);
   };

   return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
         <DialogContent className="sm:max-w-md">
            {detected ? (
               <>
                  <DialogHeader className="text-left">
                     <DialogTitle>Server found</DialogTitle>
                     <DialogDescription>
                        {PROVIDER_NAMES[detected.provider]}
                        {detected.listBucketsAllowed &&
                           ` · ${pluralize(detected.bucketCount, "bucket")}`}
                     </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={connect} className="flex min-h-0 flex-col">
                     <DialogBody className="flex flex-col gap-4">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                           <dt className="text-viewerlighttext">Name</dt>
                           <dd className="min-w-0 truncate text-viewerblack">
                              {fields.name.trim()}
                           </dd>
                           <dt className="text-viewerlighttext">Endpoint</dt>
                           <dd className="min-w-0 truncate text-viewerblack">
                              {fields.endpoint.trim()}
                           </dd>
                        </dl>
                        {!detected.listBucketsAllowed && (
                           <div className="flex flex-col gap-1.5">
                              <Label htmlFor="bucket-names">Bucket names</Label>
                              <Input
                                 id="bucket-names"
                                 placeholder="my-bucket, another-bucket"
                                 value={bucketInput}
                                 autoFocus
                                 onChange={(e) => {
                                    setBucketInput(e.target.value);
                                    setChecks(null);
                                    setError(null);
                                 }}
                              />
                              <p className="text-xs text-viewerlighttext">
                                 This token can&apos;t list buckets, so name the
                                 ones it can access.
                              </p>
                              {checks && (
                                 <ul className="flex flex-col gap-1 text-sm">
                                    {checks.map((c) => (
                                       <li
                                          key={c.bucketName}
                                          className="flex items-center gap-2"
                                       >
                                          {c.accessible ? (
                                             <Check
                                                className="size-4 shrink-0 text-viewerblue"
                                                aria-label="Accessible"
                                             />
                                          ) : (
                                             <X
                                                className="size-4 shrink-0 text-viewertextred"
                                                aria-label="Not accessible"
                                             />
                                          )}
                                          <span className="min-w-0 truncate text-viewerblack">
                                             {c.bucketName}
                                          </span>
                                       </li>
                                    ))}
                                 </ul>
                              )}
                              <Button
                                 type="button"
                                 variant="link"
                                 size="sm"
                                 className="w-fit px-0"
                                 onClick={checkBuckets}
                                 loading={validateBuckets.isPending}
                              >
                                 Check access
                              </Button>
                           </div>
                        )}
                        <FormError>{error}</FormError>
                     </DialogBody>
                     <DialogFooter className="justify-between">
                        <Button
                           type="button"
                           variant="ghost"
                           onClick={back}
                           disabled={busy}
                        >
                           Back
                        </Button>
                        <Button
                           type="submit"
                           loading={createServer.isPending}
                           disabled={busy}
                        >
                           Connect
                        </Button>
                     </DialogFooter>
                  </form>
               </>
            ) : (
               <>
                  <DialogHeader className="text-left">
                     <DialogTitle>Connect a server</DialogTitle>
                     <DialogDescription>
                        Works with Amazon S3, Cloudflare R2 and anything
                        S3-compatible. Credentials are encrypted before they
                        leave your browser.
                     </DialogDescription>
                  </DialogHeader>
                  <form
                     onSubmit={detect}
                     className="flex min-h-0 flex-col"
                     autoComplete="off"
                  >
                     <DialogBody className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                           <Label htmlFor="connect-name">Name</Label>
                           <Input
                              id="connect-name"
                              placeholder="Production"
                              maxLength={64}
                              value={fields.name}
                              autoFocus
                              onChange={(e) => set("name", e.target.value)}
                           />
                        </div>
                        <CredentialsFields
                           fields={fields}
                           onChange={set}
                           idPrefix="connect"
                        />
                        <FormError>{error}</FormError>
                     </DialogBody>
                     <DialogFooter>
                        <Button type="submit" loading={establish.isPending}>
                           Continue
                        </Button>
                     </DialogFooter>
                  </form>
               </>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default ConnectModal;
