import { errorMessage } from "@/lib/api";
import { toast } from "@s3-viewer/ui/components/toast";

const toastError =
   (title: string) =>
   (error: unknown): void => {
      toast.error(title, { description: errorMessage(error) });
   };

export { toastError };
