import useServers from "@/lib/hooks/queries/useServers";
import {
   getManagePermissionForRole,
   hasPermissions,
   Permission,
} from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Separator } from "@s3-viewer/ui/components/separator";
import { LogOut } from "lucide-react";
import { useShareContext } from "../context/ShareContext";

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
   onRemove?: () => void;
   disabled?: boolean;
   className?: string;
   mode: "invite" | "manage";
   roles?: { value: Role; label: string; description: string }[];
};

const RoleSelector = ({
   value,
   onValueChange,
   onRemove,
   disabled = false,
   className = "",
   mode = "invite",
   roles = ROLES,
}: RoleSelectorProps) => {
   const { serverId } = useShareContext();
   const selectedRoleLabel =
      roles.find((role) => role.value === value)?.label || "Read";
   const userRole = useServers(serverId).currentServer?.userRole;

   const isDisabled = (selectedRole: Role, userRole: Role | undefined) => {
      if (selectedRole === Role.OWNER || !userRole) return true;
      return !hasPermissions(userRole, [
         getManagePermissionForRole(selectedRole) ?? Permission.MANAGE_VIEWER,
      ]);
   };

   return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
         <SelectTrigger className={`${className} h-full hover:bg-transparent`}>
            <SelectValue className="text-sm font-medium">
               {selectedRoleLabel}
            </SelectValue>
         </SelectTrigger>
         <SelectContent
            className="w-fit rounded-lg p-1"
            position="popper"
            align="end"
         >
            {roles.map((role) => (
               <SelectItem
                  key={role.value}
                  value={role.value}
                  disabled={isDisabled(role.value, userRole)}
                  hidden={role.value === Role.OWNER}
               >
                  <div className="flex flex-col">
                     <span className="text-viewerblack">{role.label}</span>
                     {mode === "invite" && (
                        <span className="text-xs text-viewerlighttext">
                           {role.description}
                        </span>
                     )}
                  </div>
               </SelectItem>
            ))}
            {mode === "manage" && (
               <div className="flex flex-col gap-2">
                  <Separator className="bg-viewerborder" />
                  <Button
                     variant="destructive"
                     className="w-full justify-start rounded-lg"
                     onClick={onRemove}
                     size="sm"
                  >
                     <LogOut className="size-4" />
                     <span>Remove</span>
                  </Button>
               </div>
            )}
         </SelectContent>
      </Select>
   );
};

export default RoleSelector;
