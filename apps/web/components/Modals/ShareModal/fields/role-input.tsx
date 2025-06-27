import { Role } from "@s3-viewer/types";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";

const ROLES: { value: Role; label: string; description: string }[] = [
   {
      value: Role.OWNER,
      label: "Owner",
      description: "Can manage users and settings",
   },
   {
      value: Role.VIEWER,
      label: "Read",
      description: "Can view files and folders",
   },
   {
      value: Role.EDITOR,
      label: "Write",
      description: "Can view, create, edit, and delete files",
   },
   {
      value: Role.ADMIN,
      label: "Admin",
      description: "Can manage users and settings",
   },
];

type RoleSelectorProps = {
   value: Role;
   onValueChange: (role: Role) => void;
   disabled?: boolean;
   className?: string;
   showDescriptions?: boolean;
   roles?: { value: Role; label: string; description: string }[];
};

const RoleSelector = ({
   value,
   onValueChange,
   disabled = false,
   className = "",
   showDescriptions = true,
   roles = ROLES,
}: RoleSelectorProps) => {
   const selectedRoleLabel =
      roles.find((role) => role.value === value)?.label || "Read";

   return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
         <SelectTrigger className={`${className} h-full hover:bg-transparent`}>
            <SelectValue className="text-sm font-medium">
               {selectedRoleLabel}
            </SelectValue>
         </SelectTrigger>
         <SelectContent className="w-fit" position="popper" align="end">
            {roles.map((role) => (
               <SelectItem
                  key={role.value}
                  value={role.value}
                  disabled={role.value === Role.OWNER}
                  hidden={role.value === Role.OWNER}
               >
                  <div className="flex flex-col">
                     <span className="text-viewerblack">{role.label}</span>
                     {showDescriptions && (
                        <span className="text-xs text-viewerlighttext">
                           {role.description}
                        </span>
                     )}
                  </div>
               </SelectItem>
            ))}
         </SelectContent>
      </Select>
   );
};

export default RoleSelector;
