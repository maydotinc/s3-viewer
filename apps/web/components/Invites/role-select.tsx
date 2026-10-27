import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@s3-viewer/permissions";
import type { Role } from "@s3-viewer/shared";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";

type RoleSelectProps<T extends Role> = {
   value: T;
   roles: readonly T[];
   onChange: (role: T) => void;
   label: string;
   id?: string;
   className?: string;
   size?: "sm" | "default";
   disabled?: boolean;
};

const RoleSelect = <T extends Role>({
   value,
   roles,
   onChange,
   label,
   id,
   className,
   size = "default",
   disabled,
}: RoleSelectProps<T>) => (
   <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as T)}
   >
      <SelectTrigger
         id={id}
         size={size}
         aria-label={label}
         className={className}
      >
         <SelectValue>{ROLE_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="w-64">
         {roles.map((role) => (
            <SelectItem
               key={role}
               value={role}
               description={ROLE_DESCRIPTIONS[role]}
            >
               {ROLE_LABELS[role]}
            </SelectItem>
         ))}
      </SelectContent>
   </Select>
);

export default RoleSelect;
