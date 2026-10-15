import Field, { FieldSkeleton } from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { ModalShell } from "@/components/Modals/modal-shell";
import { errorMessage } from "@/lib/api";
import type { ModalProps } from "@/lib/contexts/modal-props";
import { parseServerName } from "@/lib/utils/server-name";
import { PROVIDER_NAMES } from "@/lib/constants";
import useCreateServer from "@/lib/hooks/mutations/server/useCreateServer";
import useEstablishConnection from "@/lib/hooks/mutations/server/useEstablishConnection";
import useValidateBuckets from "@/lib/hooks/mutations/server/useValidateBuckets";
import useInstanceConfig, {
   encryptionState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { useUserId } from "@/lib/stores/session-store";
import { pluralize } from "@/lib/utils/format";
import { splitList } from "@/lib/utils/split-list";
import {
   existingBucketNameSchema,
   MAX_BUCKET_NAMES,
   SERVER_NAME_MAX,
   type BucketCheck,
   type EstablishResult,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { DialogBody, DialogFooter } from "@s3-viewer/ui/components/dialog";
import { Input } from "@s3-viewer/ui/components/input";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
   CredentialsFields,
   CredentialsFieldsSkeleton,
   EMPTY_CREDENTIALS,
   withoutSecrets,
   type CredentialFields,
} from "./credentials-fields";
import { EncryptionStatus } from "./encryption-status";
import { sealCredentialFields } from "./seal-credentials";

type ConnectModalProps = ModalProps<"connect">;

type Fields = CredentialFields & { name: string };

const EMPTY: Fields = { ...EMPTY_CREDENTIALS, name: "" };

const parseBucketNames = (raw: string): string[] => splitList(raw, /[\s,]+/);

const ConnectModal = ({ onClose }: ConnectModalProps) => {
   const config = useInstanceConfig();
   const userId = useUserId();
   const keyState = encryptionState(config);
   const [fields, setFields] = useState<Fields>(EMPTY);
   const [error, setError] = useState<string | null>(null);
   const [connection, setConnection] = useState<{
      encrypted: string;
      detected: EstablishResult;
      name: string;
      endpoint: string;
      userId: string;
   } | null>(null);
   const [bucketInput, setBucketInput] = useState("");
   const [checks, setChecks] = useState<BucketCheck[] | null>(null);
   const [busy, setBusy] = useState(false);
   const pending = useRef(false);
   const revision = useRef(0);
   useEffect(() => {
      pending.current = false;
      setBusy(false);
      setFields(EMPTY);
      setConnection(null);
      setBucketInput("");
      setChecks(null);
      setError(null);
      return () => {
         revision.current += 1;
      };
   }, [userId]);

   const establish = useEstablishConnection();
   const validateBuckets = useValidateBuckets();
   const createServer = useCreateServer();
   const detected = connection?.detected;

   const run = async (work: (current: () => boolean) => Promise<void>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      const started = revision.current;
      const current = () => revision.current === started;
      try {
         await work(current);
      } finally {
         if (current()) {
            pending.current = false;
            setBusy(false);
         }
      }
   };

   const set = (key: keyof Fields, value: string) => {
      if (pending.current) return;
      setFields((prev) => ({ ...prev, [key]: value }));
      setError(null);
   };

   const detect = async (e: FormEvent) => {
      e.preventDefault();
      await run(async (current) => {
         const submitted = { ...fields };
         const name = parseServerName(submitted.name);
         if (!name.ok) {
            setError(name.error);
            return;
         }
         const sealed = await sealCredentialFields(
            submitted,
            config.data,
            userId
         );
         if (!current()) return;
         if ("error" in sealed) {
            setError(sealed.error);
            return;
         }
         try {
            const detected = await establish.mutateAsync({
               encryptedCredentials: sealed.encrypted,
            });
            if (!current()) return;
            setConnection({
               encrypted: sealed.encrypted,
               detected,
               name: name.name,
               endpoint: submitted.endpoint.trim(),
               userId,
            });
            setFields(withoutSecrets);
            setError(null);
         } catch (err) {
            if (current()) setError(errorMessage(err));
         }
      });
   };

   const checkBuckets = async (
      current: () => boolean
   ): Promise<string[] | null> => {
      if (!connection || connection.userId !== userId) return null;
      const names = parseBucketNames(bucketInput);
      if (names.length === 0) {
         setError("Enter at least one bucket name");
         return null;
      }
      if (names.length > MAX_BUCKET_NAMES) {
         setError(`Use at most ${MAX_BUCKET_NAMES} bucket names`);
         return null;
      }
      const invalid = names.filter(
         (n) => !existingBucketNameSchema.safeParse(n).success
      );
      if (invalid.length > 0) {
         setError(`Not a valid bucket name: ${invalid.join(", ")}`);
         return null;
      }
      try {
         const results = await validateBuckets.mutateAsync({
            encryptedCredentials: connection.encrypted,
            bucketNames: names,
         });
         if (!current()) return null;
         setChecks(results);
         if (
            names.some(
               (name) =>
                  !results.some(
                     (result) => result.bucketName === name && result.accessible
                  )
            )
         ) {
            setError("Remove the buckets this token can't access");
            return null;
         }
         setError(null);
         return names;
      } catch (err) {
         if (current()) setError(errorMessage(err));
         return null;
      }
   };

   const connect = async (e: FormEvent) => {
      e.preventDefault();
      await run(async (current) => {
         if (!connection || connection.userId !== userId) return;
         let bucketNames: string[] | undefined;
         if (!connection.detected.listBucketsAllowed) {
            const names = await checkBuckets(current);
            if (!names) return;
            bucketNames = names;
         }
         if (!current()) return;
         try {
            await createServer.mutateAsync({
               encryptedCredentials: connection.encrypted,
               serverName: connection.name,
               bucketNames,
            });
            if (current()) close();
         } catch (err) {
            if (current()) setError(errorMessage(err));
         }
      });
   };

   const close = () => {
      setFields(withoutSecrets);
      onClose();
   };

   const back = () => {
      if (pending.current) return;
      setConnection(null);
      setChecks(null);
      setError(null);
   };

   const found = keyState === "ready" ? detected : undefined;
   const title = found ? "Server found" : "Connect a server";
   const description = found
      ? `${PROVIDER_NAMES[found.provider]}${found.listBucketsAllowed ? ` · ${pluralize(found.bucketCount, "bucket")}` : ""}`
      : "Works with Amazon S3, Cloudflare R2 and anything S3-compatible. Credentials are encrypted before they leave your browser.";

   return (
      <ModalShell
         closable={!createServer.isPending}
         onClose={close}
         title={title}
         description={description}
         className="sm:max-w-md"
         headerClassName="text-left"
      >
         {keyState !== "ready" ? (
            <>
               {keyState === "loading" ? (
                  <DialogBody
                     aria-busy="true"
                     className="flex flex-1 flex-col gap-4"
                  >
                     <FieldSkeleton className="gap-1.5" />
                     <CredentialsFieldsSkeleton />
                     <span className="sr-only">Loading instance settings</span>
                  </DialogBody>
               ) : (
                  <DialogBody className="flex min-h-80 items-center justify-center pb-6">
                     <EncryptionStatus state={keyState} />
                  </DialogBody>
               )}
               <DialogFooter>
                  <Button type="button" disabled>
                     Continue
                  </Button>
               </DialogFooter>
            </>
         ) : connection && detected ? (
            <form onSubmit={connect} className="flex min-h-0 flex-1 flex-col">
               <DialogBody className="flex flex-1 flex-col gap-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                     <dt className="text-viewerlighttext">Name</dt>
                     <dd className="min-w-0 text-viewerblack [overflow-wrap:anywhere]">
                        {connection.name}
                     </dd>
                     <dt className="text-viewerlighttext">Endpoint</dt>
                     <dd className="min-w-0 text-viewerblack [overflow-wrap:anywhere]">
                        {connection.endpoint}
                     </dd>
                  </dl>
                  {!detected.listBucketsAllowed && (
                     <Field label="Bucket names" htmlFor="bucket-names">
                        <Input
                           id="bucket-names"
                           placeholder="my-bucket, another-bucket"
                           value={bucketInput}
                           disabled={busy}
                           autoFocus
                           onChange={(e) => {
                              if (pending.current) return;
                              setBucketInput(e.target.value);
                              setChecks(null);
                              setError(null);
                           }}
                        />
                        <p className="text-xs text-viewerlighttext">
                           This token can&apos;t list buckets, so name the ones
                           it can access.
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
                                          role="img"
                                          aria-label="Accessible"
                                       />
                                    ) : (
                                       <X
                                          className="size-4 shrink-0 text-viewertextred"
                                          role="img"
                                          aria-label="Not accessible"
                                       />
                                    )}
                                    <span className="min-w-0 text-viewerblack [overflow-wrap:anywhere]">
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
                           onClick={() =>
                              void run(async (current) => {
                                 await checkBuckets(current);
                              })
                           }
                           disabled={busy}
                           loading={validateBuckets.isPending}
                        >
                           Check access
                        </Button>
                     </Field>
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
         ) : (
            <form
               onSubmit={detect}
               className="flex min-h-0 flex-1 flex-col"
               autoComplete="off"
            >
               <DialogBody className="flex flex-1 flex-col gap-4">
                  <Field label="Name" htmlFor="connect-name">
                     <Input
                        id="connect-name"
                        placeholder="Production"
                        maxLength={SERVER_NAME_MAX}
                        disabled={busy}
                        value={fields.name}
                        autoFocus
                        onChange={(e) => set("name", e.target.value)}
                     />
                  </Field>
                  <CredentialsFields
                     fields={fields}
                     onChange={set}
                     idPrefix="connect"
                     disabled={busy}
                  />
                  <FormError>{error}</FormError>
               </DialogBody>
               <DialogFooter>
                  <Button type="submit" loading={busy} disabled={busy}>
                     Continue
                  </Button>
               </DialogFooter>
            </form>
         )}
      </ModalShell>
   );
};

export default ConnectModal;
