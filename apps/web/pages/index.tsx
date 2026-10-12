import { SITE_PATHS } from "@s3-viewer/types";
import type { GetServerSideProps } from "next";

// not a next.config redirect: those run before middleware, which proxies / to the landing site when it is configured
const getServerSideProps: GetServerSideProps = async () => ({
   redirect: { destination: SITE_PATHS.dashboard, permanent: false },
});

const IndexPage = () => null;

export default IndexPage;
export { getServerSideProps };
