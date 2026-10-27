import { Input } from "@s3-viewer/ui/components/input";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Search } from "lucide-react";
import { useId, type ComponentProps } from "react";

const FILTER_PADDING = "px-9";

type FilterDecorProps = {
   inputId: string;
   label: string;
   shortcut?: boolean;
};

// render after the input: the input is the `peer`, so the hint hides while it has focus or text
const FilterDecor = ({
   inputId,
   label,
   shortcut = false,
}: FilterDecorProps) => (
   <>
      <label htmlFor={inputId} className="sr-only">
         {label}
      </label>
      <Search
         aria-hidden="true"
         className="pointer-events-none absolute left-3 z-10 size-4 shrink-0 text-viewerlighttext"
      />
      {shortcut && (
         <Kbd
            keys="/"
            aria-hidden="true"
            className="pointer-events-none absolute right-3 peer-focus:hidden peer-[:not(:placeholder-shown)]:hidden"
         />
      )}
   </>
);

type FilterInputProps = Omit<
   ComponentProps<typeof Input>,
   "id" | "type" | "children"
> & {
   label: string;
   shortcut?: boolean;
};

const FilterInput = ({
   label,
   shortcut,
   className,
   ...input
}: FilterInputProps) => {
   const inputId = useId();
   return (
      <div
         className={cn(
            "relative flex h-9 w-full min-w-0 items-center pointer-coarse:h-11",
            className
         )}
      >
         <Input
            id={inputId}
            type="text"
            autoComplete="off"
            spellCheck={false}
            className={`peer ${FILTER_PADDING}`}
            {...input}
         />
         <FilterDecor inputId={inputId} label={label} shortcut={shortcut} />
      </div>
   );
};

export default FilterInput;
export { FILTER_PADDING, FilterDecor };
