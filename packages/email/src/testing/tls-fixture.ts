import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type TlsFixture = { key: Buffer; cert: Buffer; certPath: string };

// generated when a test file first imports this module, so no private key is ever
// committed. the certificate stays on disk until exit so child processes can trust it
// through NODE_EXTRA_CA_CERTS.
const generateLocalhostFixture = (): TlsFixture => {
   const dir = mkdtempSync(join(tmpdir(), "s3-viewer-tls-"));
   const keyPath = join(dir, "key.pem");
   const certPath = join(dir, "cert.pem");
   process.once("exit", () => rmSync(dir, { recursive: true, force: true }));
   try {
      execFileSync(
         "openssl",
         [
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-days",
            "1",
            "-subj",
            "/CN=localhost",
            "-addext",
            "subjectAltName=DNS:localhost,IP:127.0.0.1",
            "-keyout",
            keyPath,
            "-out",
            certPath,
         ],
         { stdio: ["ignore", "ignore", "pipe"] }
      );
   } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      throw new Error(
         code === "ENOENT"
            ? "The email TLS tests generate a self-signed localhost certificate with `openssl`, which isn't on PATH. Install OpenSSL and run them again."
            : `openssl failed to generate the localhost test certificate: ${(error as Error).message}`
      );
   }
   const key = readFileSync(keyPath);
   rmSync(keyPath, { force: true });
   return { key, cert: readFileSync(certPath), certPath };
};

const fixture = generateLocalhostFixture();

export const tlsOptions = { key: fixture.key, cert: fixture.cert };
export const tlsCertPath = fixture.certPath;
