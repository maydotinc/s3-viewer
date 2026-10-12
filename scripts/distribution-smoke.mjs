import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isWindows, root } from "./env.mjs";

const project = `s3-viewer-smoke-${randomUUID().slice(0, 8)}`;
// an empty --env-file keeps compose from reading the root .env (/dev/null has no Windows equivalent).
const scratch = mkdtempSync(join(tmpdir(), "s3-viewer-smoke-"));
const emptyEnvFile = join(scratch, "empty.env");
writeFileSync(emptyEnvFile, "");
process.once("exit", () => rmSync(scratch, { recursive: true, force: true }));
const composeArgs = [
   "compose",
   "--env-file",
   emptyEnvFile,
   "-f",
   "docker-compose.smoke.yml",
   "-p",
   project,
];

// long arguments (inline node scripts) collapse to one short line in failure messages.
const describe = (command, args) =>
   [command, ...args]
      .map((arg) => arg.replace(/\s+/g, " ").trim())
      .map((arg) => (arg.length > 60 ? `${arg.slice(0, 57)}...` : arg))
      .join(" ");

function run(
   command,
   args,
   { env = {}, capture = false, input, shell = false } = {}
) {
   return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
         cwd: root,
         env: { ...process.env, ...env },
         stdio: ["pipe", capture ? "pipe" : "inherit", "inherit"],
         shell,
      });
      let output = "";
      child.stdout?.on("data", (chunk) => (output += chunk));
      child.once("error", reject);
      child.once("exit", (code, signal) => {
         if (code === 0) resolve(output.trim());
         else
            reject(
               new Error(
                  `${describe(command, args)} failed (${signal ?? code})`
               )
            );
      });
      child.stdin.end(input);
   });
}

const compose = (args, options) =>
   run("docker", [...composeArgs, ...args], options);
const address = async (service, port) =>
   `http://${await compose(["port", service, String(port)], { capture: true })}`;
const apiNode = (code, input) =>
   compose(["exec", "-T", "api", "node", "-e", code], { capture: true, input });
// pnpm is a .cmd shim on Windows, which spawn only finds through a shell.
const apiSuite = (file, env) =>
   run("pnpm", ["exec", "vitest", "run", "--project", "api", file], {
      env,
      shell: isWindows(),
   });

const get = (url) => fetch(url, { signal: AbortSignal.timeout(10_000) });

async function json(url) {
   const response = await get(url);
   assert.equal(response.status, 200, url);
   return response.json();
}

async function checkPages() {
   const api = await address("api", 5001);
   const web = await address("web", 3000);
   assert.equal((await json(`${api}/health`)).ok, true);
   assert.equal((await json(`${web}/api/health`)).ok, true);
   const config = await json(`${api}/config`);
   assert.match(config.encryptionPublicKey, /BEGIN PUBLIC KEY/);
   assert.equal(config.emailEnabled, false);
   const page = await get(`${web}/login`);
   assert.equal(page.status, 200);
   assert.match(page.headers.get("content-type"), /text\/html/);
   assert.match(await page.text(), /__NEXT_DATA__/);
   return config.encryptionPublicKey;
}

const proofPrelude = `
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const secret = (name) => fs.readFileSync('/data/' + name, 'utf8').trim();
const challenge = 's3-viewer distribution restart challenge';
const sign = (name) => crypto.createHmac('sha256', secret(name)).update(challenge).digest('hex');
const privateKey = secret('encryption-private-key.pem');
const rsaOptions = { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };
`;

const fingerprintCode = `
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
   const secrets = await db.instanceSecret.findMany({ orderBy: { name: 'asc' }, select: { name: true, fingerprint: true } });
   require('node:assert/strict').equal(secrets.length, 3);
   console.log(JSON.stringify(secrets));
})().finally(() => db.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
`;

async function main() {
   console.log(`Disposable distribution smoke: ${project}`);
   try {
      await compose(["build", "api", "web"]);
      await compose(["up", "-d", "--wait", "--wait-timeout", "240"]);
      const publicKey = await checkPages();
      await compose([
         "exec",
         "-T",
         "api",
         "node",
         "/app/node_modules/prisma/build/index.js",
         "migrate",
         "status",
         "--schema=/app/prisma/schema.prisma",
      ]);
      const fingerprints = await apiNode(fingerprintCode);
      const proof = await apiNode(`${proofPrelude}
console.log(JSON.stringify({
   auth: sign('auth-secret'), audit: sign('audit-chain-key'),
   ciphertext: crypto.publicEncrypt({ ...rsaOptions, key: crypto.createPublicKey(privateKey) }, Buffer.from(challenge)).toString('base64'),
}));`);

      const databaseAddress = await compose(["port", "postgres", "5432"], {
         capture: true,
      });
      await apiSuite("apps/api/lib/testing/database.integration.test.ts", {
         DATABASE_INTEGRATION_URL: `postgresql://smoke:smoke@${databaseAddress}/s3viewer_smoke?connection_limit=4`,
      });

      const endpoint = await address("rustfs", 9000);
      assert.equal((await get(`${endpoint}/health`)).status, 200);
      await apiSuite("apps/api/lib/s3/provider.integration.test.ts", {
         S3_INTEGRATION_ENDPOINT: endpoint,
         S3_INTEGRATION_ACCESS_KEY: "smoke-access-key",
         S3_INTEGRATION_SECRET_KEY: "smoke-secret-key",
         S3_INTEGRATION_REGION: "us-east-1",
         S3_INTEGRATION_SESSION_TOKEN: "",
      });

      await compose(["restart", "postgres", "api", "web"]);
      await compose(["up", "-d", "--wait", "--wait-timeout", "240"]);
      assert.equal(await checkPages(), publicKey);
      assert.equal(await apiNode(fingerprintCode), fingerprints);
      await apiNode(
         `${proofPrelude}
const proof = JSON.parse(fs.readFileSync(0, 'utf8'));
assert.equal(sign('auth-secret'), proof.auth);
assert.equal(sign('audit-chain-key'), proof.audit);
assert.equal(crypto.privateDecrypt({ ...rsaOptions, key: privateKey }, Buffer.from(proof.ciphertext, 'base64')).toString(), challenge);
console.log('Persisted auth, encryption, and audit secrets verified after restart.');`,
         proof
      );
      console.log(
         "PASS: image startup, migrations, health/config/page, PostgreSQL concurrency, RustFS, and persisted secrets after restart."
      );
   } catch (error) {
      await compose(["logs", "--no-color", "--tail", "100"]).catch(() => {});
      throw error;
   } finally {
      // a failed teardown must not replace the error that ended the run.
      await compose([
         "down",
         "--volumes",
         "--remove-orphans",
         "--rmi",
         "local",
      ]).catch((error) => console.error(`Teardown failed: ${error.message}`));
   }
}

await main();
