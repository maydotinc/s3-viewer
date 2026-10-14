import Callout from "@/components/callout";
import { MAX_GRANT_FOLDERS } from "@s3-viewer/types";

const TERM = "font-medium text-viewerblack";

const FolderExplainer = ({
   id,
   open,
   adminInviter,
}: {
   id: string;
   open: boolean;
   adminInviter: boolean;
}) =>
   open ? (
      <Callout id={id}>
         <p className={TERM}>Folders are prefixes</p>
         <p>
            S3 has no real folders. A folder here is a key prefix ending in /,
            like landing/, and S3 Viewer treats it as a folder everywhere.
         </p>
         <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>
               <span className={TERM}>Whole bucket</span> shares everything in
               the bucket.
            </li>
            <li>
               <span className={TERM}>Specific folders</span> shares only the
               folders you list. landing/ includes everything under it,
               including folders inside it.
            </li>
            <li>
               A folder doesn&apos;t have to exist yet. The access applies when
               files land there.
            </li>
            <li>
               A parent folder covers its children, so you only need the parent.
               Up to {MAX_GRANT_FOLDERS} folders per bucket.
            </li>
            <li>
               Admins always get whole buckets. Only Viewers and Editors can be
               limited to folders.
            </li>
            {adminInviter && (
               <li>You can only share folders you can open yourself.</li>
            )}
         </ul>
      </Callout>
   ) : null;

export default FolderExplainer;
