import { toastError } from "@/lib/utils/toast";
import { toast } from "@s3-viewer/ui/components/toast";

type CopyNotices = { success?: string; failure: string };

const copyToClipboard = async (
   text: string,
   { success, failure }: CopyNotices
): Promise<boolean> => {
   try {
      await navigator.clipboard.writeText(text);
      if (success) toast.success(success);
      return true;
   } catch (error) {
      toastError(failure)(error);
      return false;
   }
};

export { copyToClipboard };
