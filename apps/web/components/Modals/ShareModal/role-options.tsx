import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@s3-viewer/permissions";
import type { Role } from "@s3-viewer/types";
import { SelectItem } from "@s3-viewer/ui/components/select";

const RoleSelectItems = ({ roles }: { roles: readonly Role[] }) => (
   <>
      {roles.map((r) => (
         <SelectItem key={r} value={r}>
            <span className="flex flex-col">
               <span className="text-viewerblack">{ROLE_LABELS[r]}</span>
               <span className="text-xs text-viewerlighttext">
                  {ROLE_DESCRIPTIONS[r]}
               </span>
            </span>
         </SelectItem>
      ))}
   </>
);

export default RoleSelectItems;
