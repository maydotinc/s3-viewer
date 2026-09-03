import { Button } from "@s3-viewer/ui/components/button";
import { Spinner } from "@s3-viewer/ui/components/spinner";

const EmptyState = ({
   title,
   description,
}: {
   title: string;
   description: string;
}) => (
   <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <p className="text-heading">{title}</p>
      <p className="text-sm text-viewertext">{description}</p>
   </div>
);

const LoadingOverlay = () => (
   <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
   </div>
);

type LoadErrorProps = {
   title: string;
   message: string;
   onRetry: () => void;
   retrying?: boolean;
};

const LoadError = ({ title, message, onRetry, retrying }: LoadErrorProps) => (
   <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="text-heading">{title}</p>
      <p className="max-w-md text-sm text-viewertext">{message}</p>
      <Button variant="outline" size="sm" loading={retrying} onClick={onRetry}>
         Try again
      </Button>
   </div>
);

export { EmptyState, LoadError, LoadingOverlay };
