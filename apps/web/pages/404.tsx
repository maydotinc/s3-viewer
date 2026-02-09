import ErrorPage from "@s3-viewer/ui/ErrorPage";

const Error404 = () => {
   return <ErrorPage statusCode={404} errorTitle={"Page Not Found"} />;
};

export default Error404;
