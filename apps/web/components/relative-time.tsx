import { useNow } from "@/lib/hooks/useNow";
import { formatDate, formatRelativeDay } from "@/lib/utils/format";
import { cn } from "@s3-viewer/ui/lib/utils";

type RelativeTimeProps = {
   date: Date | string;
   prefix?: string;
   className?: string;
};

const RelativeTime = ({ date, prefix, className }: RelativeTimeProps) => {
   const now = useNow();
   const iso = new Date(date).toISOString();
   const timeClassName = cn(
      "inline-block min-w-[12ch] max-w-full truncate align-bottom tabular-nums",
      className
   );
   if (now === null)
      return (
         <span aria-hidden="true" className={timeClassName}>
            &nbsp;
         </span>
      );
   return (
      <span title={formatDate(iso)} className={timeClassName}>
         {prefix}
         {formatRelativeDay(iso)}
      </span>
   );
};

export default RelativeTime;
