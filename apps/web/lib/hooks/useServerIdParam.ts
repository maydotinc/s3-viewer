import { useRouter } from "next/router";

const useServerIdParam = (): string => {
   const { serverId } = useRouter().query;
   return typeof serverId === "string" ? serverId : "";
};

export { useServerIdParam };
