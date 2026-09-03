import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";

type ErrorCode = 404 | 500;

type ErrorPageProps = {
   code?: ErrorCode;
   title?: string;
   description?: string;
   href?: string;
   linkLabel?: string;
};

const COPY: Record<ErrorCode, { title: string; description: string }> = {
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
   title = COPY[code].title,
   description = COPY[code].description,
   href = SITE_PATHS.dashboard,
   linkLabel = "Go to dashboard",
}: ErrorPageProps) => (
   <main className="flex min-h-svh w-full flex-col items-center justify-center bg-viewerwhite px-6 py-12 text-center">
      <img
         src="/icons/viewer.svg"
         alt={PRODUCT_NAME}
         width={150}
         height={32}
         className="h-7 w-[131px]"
      />
      <h1 className="text-title mt-8">{title}</h1>
      <p className="text-body mt-3 max-w-md">{description}</p>
      <div className="mt-8 flex items-center gap-2">
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
