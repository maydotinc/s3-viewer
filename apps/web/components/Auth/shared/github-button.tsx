import { Button } from "@s3-viewer/ui/components/button";
import { GithubIcon } from "./auth-icons";
import { useCallback } from "react";

interface GithubButtonProps {
   onClick: () => Promise<void> | void;
}

const GithubButton = ({ onClick }: GithubButtonProps) => {
   const handleClick = useCallback(async () => {
      await onClick();
   }, [onClick]);

   return (
      <Button
         variant="default"
         size="lg"
         className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white"
         onClick={handleClick}
      >
         <GithubIcon className="size-5" />
         Continue with GitHub
      </Button>
   );
};

export default GithubButton;
