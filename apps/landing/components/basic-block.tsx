import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode } from "react";

type BasicBlockProps = {
   children: ReactNode;
   className?: string;
   sectionClassName?: string;
};

const BasicBlock = ({
   children,
   className,
   sectionClassName,
}: BasicBlockProps) => {
   return (
      <section className={cn("w-full py-12 sm:py-20", sectionClassName)}>
         <div className={cn("mx-auto w-full max-w-6xl px-6", className)}>
            {children}
         </div>
      </section>
   );
};

export const Eyebrow = ({ children }: { children: ReactNode }) => (
   <p className="text-xs font-medium tracking-wide text-viewerlighttext uppercase">
      {children}
   </p>
);

export const SectionTitle = ({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) => (
   <h2
      className={cn(
         "text-3xl font-semibold tracking-tight text-viewerblack",
         className
      )}
   >
      {children}
   </h2>
);

export const PageTitle = ({ children }: { children: ReactNode }) => (
   <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
      {children}
   </h1>
);

export const SectionHeading = ({
   eyebrow,
   title,
   description,
}: {
   eyebrow?: string;
   title: string;
   description?: string;
}) => (
   <div className="flex flex-col gap-3">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <SectionTitle className="text-balance">{title}</SectionTitle>
      {description ? (
         <p className="max-w-2xl text-viewertext">{description}</p>
      ) : null}
   </div>
);

export default BasicBlock;
