import { PRODUCT_NAME } from "@s3-viewer/types/constants";
import Image from "next/image";

type WordmarkProps = {
   className: string;
   priority?: boolean;
   alt?: string;
};

const Wordmark = ({
   className,
   priority,
   alt = PRODUCT_NAME,
}: WordmarkProps) => (
   <Image
      src="/icons/viewer.svg"
      alt={alt}
      width={150}
      height={32}
      className={className}
      priority={priority}
      draggable={false}
   />
);

export { Wordmark };
