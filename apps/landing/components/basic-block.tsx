import { cn } from "@s3-viewer/ui/lib/utils";
import { ReactNode } from "react";

type BasicBlockProps = {
   children: ReactNode;
   /** Classes for the inner `max-w-6xl` container. */
   className?: string;
   /** Classes for the outer full-bleed `<section>` (background, borders). */
   sectionClassName?: string;
   id?: string;
};

/**
 * The one section shell for the landing site: a full-bleed `<section>` with a
 * `py-20` rhythm wrapping a `max-w-6xl mx-auto px-6` container.
 */
const BasicBlock = ({
   children,
   className,
   sectionClassName,
   id,
}: BasicBlockProps) => {
   return (
      <section id={id} className={cn("w-full py-20", sectionClassName)}>
         <div className={cn("mx-auto w-full max-w-6xl px-6", className)}>
            {children}
         </div>
      </section>
   );
};

/** Small uppercase label that sits above a section heading. */
export const Eyebrow = ({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) => (
   <p
      className={cn(
         "text-xs font-medium tracking-wide text-viewerlighttext uppercase",
         className
      )}
   >
      {children}
   </p>
);

/** Eyebrow + h2 + optional subcopy, in the one landing typography scale. */
export const SectionHeading = ({
   eyebrow,
   title,
   description,
   align = "start",
   className,
}: {
   eyebrow?: string;
   title: string;
   description?: string;
   align?: "start" | "center";
   className?: string;
}) => (
   <div
      className={cn(
         "flex flex-col gap-3",
         align === "center" && "items-center text-center",
         className
      )}
   >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="text-3xl font-semibold tracking-tight text-balance text-viewerblack">
         {title}
      </h2>
      {description ? (
         <p
            className={cn(
               "max-w-2xl text-viewertext",
               align === "center" && "mx-auto"
            )}
         >
            {description}
         </p>
      ) : null}
   </div>
);

export default BasicBlock;
