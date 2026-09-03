import { ReactNode } from "react";

type SectionProps = {
   title: string;
   action?: ReactNode;
   children: ReactNode;
};

/** Small uppercase section label with an optional right-aligned action. */
const Section = ({ title, action, children }: SectionProps) => (
   <section className="flex min-w-0 flex-col gap-2">
      <div className="flex h-5 min-w-0 items-center justify-between gap-2">
         <h3 className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-viewerlighttext">
            {title}
         </h3>
         {action}
      </div>
      {children}
   </section>
);

export default Section;
