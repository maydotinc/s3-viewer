import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@s3-viewer/permissions";
import type { Role } from "@s3-viewer/types";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";

type RoleSelectProps = {
   value: Role;
   roles: readonly Role[];
   onChange: (role: Role) => void;
   /** Accessible name for the trigger, e.g. "Role for Ada". */
   label: string;
   /** Width utility for the trigger. Always fixed, never intrinsic. */
   className?: string;
   size?: "sm" | "default";
   disabled?: boolean;
};

/**
 * The trigger shows the role label and nothing else — descriptions only ever
 * live in the dropdown items, so the trigger can never overflow its box.
 */
const RoleSelect = ({
   value,
   roles,
   onChange,
   label,
   className,
   size = "default",
   disabled,
}: RoleSelectProps) => (
   <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as Role)}
   >
      <SelectTrigger size={size} aria-label={label} className={className}>
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
