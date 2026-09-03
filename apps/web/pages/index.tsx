import { SITE_PATHS } from "@s3-viewer/types";
import type { GetServerSideProps } from "next";

const getServerSideProps: GetServerSideProps = async () => ({
   redirect: { destination: SITE_PATHS.dashboard, permanent: false },
});

const IndexPage = () => null;

export default IndexPage;
export { getServerSideProps };
