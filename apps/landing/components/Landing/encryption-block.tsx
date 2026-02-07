import { AsteriskIcon, ChevronsLeftRightIcon, HashIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import BasicBlock from "../basic-block";

const EncryptionBlock = () => {
   return (
      <BasicBlock className="md:flex-row max-md:border-b max-md:border-viewerborder">
         <div className="flex flex-col md:gap-8 gap-4 items-start text-start xl:flex-1 flex-[2]">
            <div className="flex flex-col w-full gap-2">
               <h1 className="md:text-4xl text-3xl text-viewerblack font-semibold">
                  Server Credentials are Encrypted
               </h1>
               <h2 className="md:text-xl text-base text-viewertext">
                  Your server credentials are protected with military-grade
                  encryption. Sleep soundly knowing your data is safe and
                  secure.
               </h2>
            </div>
            <div className="flex flex-col md:gap-16 gap-8">
               <div className="flex flex-col gap-4 text-base md:text-xl text-viewertext">
                  <div className="flex items-center gap-3">
                     <AsteriskIcon className="size-[1.6em] text-viewerblack" />
                     <p>
                        We encrypt all credentials with{" "}
                        <span className="font-bold text-viewerblack">
                           4096-bit RSA encryption
                        </span>
                     </p>
                  </div>
                  <div className="flex items-center gap-3">
                     <ChevronsLeftRightIcon className="size-[1.6em] text-viewerblack" />
                     <p>
                        Code is{" "}
                        <span className="font-bold text-viewerblack">
                           open-source
                        </span>{" "}
                        on GitHub
                     </p>
                  </div>
                  <div className="flex items-center gap-3">
                     <HashIcon className="size-[1.6em] text-viewerblack" />
                     <p>
                        Don't trust us?{" "}
                        <span className="font-bold text-viewerblack">
                           Self-host
                        </span>{" "}
                        if you prefer
                     </p>
                  </div>
               </div>
               <div className="flex items-center">
                  <Link
                     className="h-12 text-md bg-viewerblue text-white rounded-lg px-4 py-2 flex items-center gap-2"
                     href="https://github.com/maydotinc/s3-viewer"
                     target="_blank"
                  >
                     <FaGithub className="size-5" /> View on Github
                  </Link>
               </div>
            </div>
         </div>
         <div className="flex-1 flex items-center justify-center relative max-md:hidden">
            <Image
               src="/landing/encryption.png"
               width={850}
               height={1222}
               alt="Encryption Image"
               draggable={false}
               className="select-none object-contain max-h-[400px] min-h-[300px]"
            />
         </div>
      </BasicBlock>
   );
};

export default EncryptionBlock;
