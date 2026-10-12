import {
   createServer,
   type RequestListener,
   type Server,
   type ServerOptions,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach } from "vitest";

type Listening = { server: Server; port: number; origin: string };

const listen = async (
   handler: RequestListener,
   options: ServerOptions = {}
): Promise<Listening> => {
   const server = createServer(options, handler);
   await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
   });
   const { port } = server.address() as AddressInfo;
   return { server, port, origin: `http://127.0.0.1:${port}` };
};

const closeServer = (server: Server): Promise<void> =>
   new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
   });

// servers started through the returned function close after each test, or after the suite.
const testServers = (lifetime: "test" | "suite" = "test") => {
   const started: Server[] = [];
   (lifetime === "test" ? afterEach : afterAll)(async () => {
      await Promise.all(started.splice(0).map(closeServer));
   });
   return async (
      handler: RequestListener,
      options?: ServerOptions
   ): Promise<Listening> => {
      const listening = await listen(handler, options);
      started.push(listening.server);
      return listening;
   };
};

export { closeServer, listen, testServers };
