import { Role } from "@s3-viewer/types";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";

const ROLES: { value: Role; label: string; description: string }[] = [
   { value: Role.VIEWER, label: "Read", description: "Can view files and folders" },
   { value: Role.EDITOR, label: "Write", description: "Can view, create, edit, and delete files" },
   { value: Role.ADMIN, label: "Admin", description: "Can manage users and settings" },
   { value: Role.OWNER, label: "Owner", description: "Full access and ownership" },
];

type RoleSelectorProps = {
   value: Role;
   onValueChange: (role: Role) => void;
   disabled?: boolean;
   className?: string;
   showDescriptions?: boolean;
};

const RoleSelector = ({
   value,
   onValueChange,
   disabled = false,
   className = "",
   showDescriptions = true,
}: RoleSelectorProps) => {
   const selectedRoleLabel = ROLES.find((role) => role.value === value)?.label || "Read";

   return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
         <SelectTrigger className={`${className} h-full transition-colors`}>
            <SelectValue className="text-sm font-medium">{selectedRoleLabel}</SelectValue>
         </SelectTrigger>
         <SelectContent className="w-fit">
            {ROLES.map((role) => (
               <SelectItem key={role.value} value={role.value}>
                  <div className="flex flex-col">
                     <span className="text-viewerblack">{role.label}</span>
                     {showDescriptions && (
                        <span className="text-xs text-viewerlighttext">{role.description}</span>
                     )}
                  </div>
               </SelectItem>
            ))}
         </SelectContent>
      </Select>
   );
};

export default RoleSelector;
