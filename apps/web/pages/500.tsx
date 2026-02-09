import ErrorPage from "@s3-viewer/ui/ErrorPage";

const Error500 = () => {
   return <ErrorPage statusCode={500} errorTitle={"Internal Server Error"} />;
};

export default Error500;
