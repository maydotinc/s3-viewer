import { errorMessage } from "@/lib/api";
import { toast } from "@s3-viewer/ui/components/toast";

const toastError =
   (title: string) =>
   (error: unknown): void => {
      toast.error(title, { description: errorMessage(error) });
   };

const toastFailure = (error: unknown): void => {
   toast.error(errorMessage(error));
};

export { toastError, toastFailure };
