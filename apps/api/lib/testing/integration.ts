import { prisma } from "@s3-viewer/db";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const SMOKE_DATABASE = "/s3viewer_smoke";

const integrationUrl = process.env.DATABASE_INTEGRATION_URL;

// suites write and delete rows, so they only ever run against the disposable database.
const isDisposableDatabase = (url = integrationUrl): boolean =>
   url !== undefined && new URL(url).pathname === SMOKE_DATABASE;

const assertDisposableDatabase = (suite: string): void => {
   if (!isDisposableDatabase())
      throw new Error(
         `${suite} require the disposable s3viewer_smoke database`
      );
};

const seedUsers = (ids: readonly string[]) =>
   prisma.user.createMany({
      data: ids.map((id) => ({
         id,
         name: id,
         email: `${id}@example.com`,
         emailVerified: true,
      })),
   });

type Worker = { child: ChildProcess; output: () => string };

const forkWorker = (
   script: URL,
   args: string[],
   { env = process.env, timeout }: { env?: NodeJS.ProcessEnv; timeout: number }
): Worker => {
   const child = fork(fileURLToPath(script), args, {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      execArgv: ["--import", "tsx"],
      timeout,
      env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
   });
   let output = "";
   const capture = (chunk: Buffer) => {
      output += chunk;
   };
   child.stdout?.on("data", capture);
   child.stderr?.on("data", capture);
   return { child, output: () => output };
};

export {
   assertDisposableDatabase,
   forkWorker,
   integrationUrl,
   isDisposableDatabase,
   seedUsers,
};
