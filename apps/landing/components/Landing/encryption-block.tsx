import { GITHUB_URL } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
import {
   AsteriskIcon,
   ChevronsLeftRightIcon,
   HashIcon,
   type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import BasicBlock, { SectionHeading } from "../basic-block";

type Point = {
   icon: LucideIcon;
   title: string;
   body: string;
};

const POINTS: Point[] = [
   {
      icon: AsteriskIcon,
      title: "Encrypted at rest",
      body: "Credentials are encrypted with RSA-OAEP using your own key pair, plus AES-256-GCM.",
   },
   {
      icon: ChevronsLeftRightIcon,
      title: "Open source",
      body: "The whole codebase is on GitHub under MIT, so you can read exactly what runs.",
   },
   {
      icon: HashIcon,
      title: "Self-host it",
      body: "Don't want to trust us with anything? Run S3 Viewer on your own infrastructure.",
   },
];

const EncryptionBlock = () => {
   return (
      <BasicBlock>
         <SectionHeading
            eyebrow="Security"
            title="Server credentials are encrypted"
            description="Your server credentials are encrypted at rest, and decrypted only to run the S3 operations you ask for."
         />

         <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POINTS.map(({ icon: Icon, title, body }) => (
               <div
                  key={title}
                  className="flex flex-col gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-6"
               >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-viewergray">
                     <Icon className="size-5 text-viewerblack" />
                  </span>
                  <div className="flex flex-col gap-1.5">
                     <h3 className="font-semibold text-viewerblack">{title}</h3>
                     <p className="text-sm text-viewertext">{body}</p>
                  </div>
               </div>
            ))}
         </div>

         <div className="mt-8">
            <Button asChild variant="outline">
               <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <FaGithub />
                  View on GitHub
               </Link>
            </Button>
         </div>
      </BasicBlock>
   );
};

export default EncryptionBlock;
