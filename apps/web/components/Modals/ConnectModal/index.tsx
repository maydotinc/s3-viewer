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
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Check, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { REGIONS, Region } from "./regions";

type ConnectModalProps = { onClose: () => void };

type Fields = {
   name: string;
   endpoint: string;
   region: Region;
   accessKey: string;
   secretKey: string;
};

const EMPTY: Fields = {
   name: "",
   endpoint: "",
   region: "us-east-1",
   accessKey: "",
   secretKey: "",
};

const validateFields = (f: Fields): string | null => {
   const name = parseServerName(f.name);
   if (!name.ok) return name.error;
   if (!f.endpoint.trim()) return "Enter an endpoint URL";
   let url: URL;
   try {
      url = new URL(f.endpoint.trim());
   } catch {
      return "Endpoint must be a full URL, like https://s3.amazonaws.com";
   }
   if (url.protocol !== "https:") return "Endpoint must start with https://";
   if (!f.accessKey.trim()) return "Enter an access key";
   if (!f.secretKey) return "Enter a secret key";
   return null;
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

   const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
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
         payload = await encryptCredentials({
            endpoint: fields.endpoint.trim(),
            region: fields.region,
            accessKey: fields.accessKey.trim(),
            secretKey: fields.secretKey,
         });
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
               <form onSubmit={connect} className="flex flex-col gap-4">
                  <DialogHeader className="text-left">
                     <DialogTitle>Server found</DialogTitle>
                     <DialogDescription>
                        {PROVIDER_NAMES[detected.provider]}
                        {detected.listBucketsAllowed &&
                           ` · ${pluralize(detected.bucketCount, "bucket")}`}
                     </DialogDescription>
                  </DialogHeader>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                     <dt className="text-viewerlighttext">Name</dt>
                     <dd className="truncate text-viewerblack">
                        {fields.name.trim()}
                     </dd>
                     <dt className="text-viewerlighttext">Endpoint</dt>
                     <dd className="truncate text-viewerblack">
                        {fields.endpoint.trim()}
                     </dd>
                  </dl>
                  {!detected.listBucketsAllowed && (
                     <div className="flex flex-col gap-1.5">
                        <Label htmlFor="bucket-names">Bucket names</Label>
                        <p className="text-sm text-viewertext">
                           This token can&apos;t list buckets. Enter the bucket
                           names it can access, separated by commas.
                        </p>
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
                        {checks && (
                           <ul className="mt-1 flex flex-col gap-1 text-sm">
                              {checks.map((c) => (
                                 <li
                                    key={c.bucketName}
                                    className="flex items-center gap-2"
                                 >
                                    {c.accessible ? (
                                       <Check
                                          className="size-4 text-viewerblue"
                                          aria-label="Accessible"
                                       />
                                    ) : (
                                       <X
                                          className="size-4 text-viewertextred"
                                          aria-label="Not accessible"
                                       />
                                    )}
                                    <span className="truncate text-viewerblack">
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
                           {validateBuckets.isPending
                              ? "Checking…"
                              : "Check access"}
                        </Button>
                     </div>
                  )}
                  <FormError>{error}</FormError>
                  <DialogFooter className="sm:justify-between">
                     <Button
                        type="button"
                        variant="ghost"
                        onClick={back}
                        disabled={busy}
                     >
                        Edit credentials
                     </Button>
                     <Button
                        type="submit"
                        loading={createServer.isPending}
                        disabled={busy}
                     >
                        {createServer.isPending ? "Connecting…" : "Connect"}
                     </Button>
                  </DialogFooter>
               </form>
            ) : (
               <form
                  onSubmit={detect}
                  className="flex flex-col gap-4"
                  autoComplete="off"
               >
                  <DialogHeader className="text-left">
                     <DialogTitle>Connect a server</DialogTitle>
                     <DialogDescription>
                        Works with Amazon S3, Cloudflare R2 and anything
                        S3-compatible. Credentials are encrypted before they
                        leave your browser.
                     </DialogDescription>
                  </DialogHeader>
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
                  <div className="flex flex-col gap-1.5">
                     <Label htmlFor="connect-endpoint">Endpoint</Label>
                     <Input
                        id="connect-endpoint"
                        type="url"
                        inputMode="url"
                        placeholder="https://<account>.r2.cloudflarestorage.com"
                        value={fields.endpoint}
                        onChange={(e) => set("endpoint", e.target.value)}
                     />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <Label htmlFor="connect-region">Region</Label>
                     <Select
                        value={fields.region}
                        onValueChange={(v) => set("region", v as Region)}
                     >
                        <SelectTrigger id="connect-region" className="w-full">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                           {REGIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                 {r === "auto" ? "auto (Cloudflare R2)" : r}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <Label htmlFor="connect-access-key">Access key</Label>
                     <Input
                        id="connect-access-key"
                        autoComplete="off"
                        spellCheck={false}
                        value={fields.accessKey}
                        onChange={(e) => set("accessKey", e.target.value)}
                     />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <Label htmlFor="connect-secret-key">Secret key</Label>
                     <Input
                        id="connect-secret-key"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={fields.secretKey}
                        onChange={(e) => set("secretKey", e.target.value)}
                     />
                  </div>
                  <FormError>{error}</FormError>
                  <DialogFooter className="sm:justify-end">
                     <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                     </Button>
                     <Button type="submit" loading={establish.isPending}>
                        {establish.isPending ? "Detecting…" : "Detect"}
                     </Button>
                  </DialogFooter>
               </form>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default ConnectModal;
