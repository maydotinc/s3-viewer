type ProgressHandler = (event: {
   loaded: number;
   lengthComputable: boolean;
}) => void;

class FakeXHR {
   static readonly DONE = 4;
   static instances: FakeXHR[] = [];

   readyState = 0;
   status = 0;
   responseText = "";
   timeout = 0;
   upload: { onprogress: ProgressHandler | null } = { onprogress: null };
   onload: (() => void) | null = null;
   onerror: (() => void) | null = null;
   onabort: (() => void) | null = null;
   ontimeout: (() => void) | null = null;
   url = "";
   headers: Record<string, string> = {};
   body: Blob | null = null;
   responseHeaders: Record<string, string> = {};

   constructor() {
      FakeXHR.instances.push(this);
   }

   open(_method: string, url: string) {
      this.url = url;
   }

   setRequestHeader(key: string, value: string) {
      this.headers[key] = value;
   }

   send(body?: Blob) {
      this.body = body ?? null;
      this.readyState = 1;
   }

   getResponseHeader(name: string) {
      return this.responseHeaders[name] ?? null;
   }

   abort() {
      this.readyState = FakeXHR.DONE;
      this.onabort?.();
   }

   progress(loaded: number) {
      this.upload.onprogress?.({ loaded, lengthComputable: true });
   }

   respond(
      status: number,
      body: unknown,
      responseHeaders: Record<string, string> = {}
   ) {
      this.status = status;
      this.responseHeaders = responseHeaders;
      this.responseText = JSON.stringify(body);
      this.readyState = FakeXHR.DONE;
      this.onload?.();
   }

   fail() {
      this.readyState = FakeXHR.DONE;
      this.onerror?.();
   }

   timeoutOut() {
      this.readyState = FakeXHR.DONE;
      this.ontimeout?.();
   }

   get partNumber(): number {
      return Number(
         new URL(this.url, "http://localhost").searchParams.get("partNumber")
      );
   }
}

export { FakeXHR };
