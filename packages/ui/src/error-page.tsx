import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/shared/constants";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";

type ErrorPageStatus = 404 | 500;

type ErrorPageProps = {
   code?: ErrorPageStatus;
   href?: string;
   linkLabel?: string;
   embedded?: boolean;
};

const COPY: Record<ErrorPageStatus, { title: string; description: string }> = {
   404: {
      title: "Page not found",
      description: "The page you're looking for doesn't exist or has moved.",
   },
   500: {
      title: "Something went wrong",
      description: "An unexpected error occurred. Try again in a moment.",
   },
};

const goBack = () => {
   window.history.back();
};

const ErrorPage = ({
   code = 404,
   href = SITE_PATHS.dashboard,
   linkLabel = "Go to dashboard",
   embedded = false,
}: ErrorPageProps) => (
   <main
      className={cn(
         "flex w-full flex-col items-center justify-center bg-viewerwhite px-6 py-12 text-center",
         embedded ? "min-h-[70svh]" : "min-h-svh"
      )}
   >
      <img
         src="/icons/viewer.svg"
         alt={PRODUCT_NAME}
         width={150}
         height={32}
         className="h-7 w-[131px]"
      />
      <h1 className="text-title mt-8">{COPY[code].title}</h1>
      <p className="text-body mt-3 max-w-md">{COPY[code].description}</p>
      <div className="mt-8 flex max-w-full flex-wrap items-center justify-center gap-2">
         <Button asChild size="lg">
            <a href={href}>{linkLabel}</a>
         </Button>
         <Button variant="ghost" size="lg" type="button" onClick={goBack}>
            Go back
         </Button>
      </div>
   </main>
);

export default ErrorPage;
