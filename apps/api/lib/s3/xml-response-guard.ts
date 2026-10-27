// a full 1,000-key page has under 20,000 elements; a maximum S3 key URL-encodes to 3,072 bytes.
const XML_MAX_NODES = 100_000;
const XML_MAX_DEPTH = 32;
const XML_MAX_VALUE_BYTES = 16 * 1024;
const XML_MAX_NAME_BYTES = 256;
const RESPONSE_TOO_LARGE = "ResponseTooLarge";
const XML_NODE_MEMORY_BYTES = 512;
const XML_CHARACTER_MEMORY_BYTES = 32;
const COMMENT = Buffer.from("<!--");
const CDATA = Buffer.from("<![CDATA[");

const responseLimitExceeded = (message: string): Error =>
   Object.assign(new Error(message), { name: RESPONSE_TOO_LARGE });

const xmlLimitExceeded = (): Error =>
   responseLimitExceeded("Storage response exceeded the XML complexity limit");

const whitespace = (byte: number | undefined): boolean =>
   byte === 32 || byte === 9 || byte === 10 || byte === 13;
const nameDelimiter = (byte: number | undefined): boolean =>
   whitespace(byte) || byte === 47 || byte === 62 || byte === 61 || byte === 63;

const estimateXmlMemory = (input: Uint8Array): number => {
   const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
   let position =
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
   while (whitespace(bytes[position])) position++;
   if (bytes[position] !== 60) return 0;

   const elementTextBytes: number[] = [];
   let nodes = 0;
   let names = 0;
   let longestValue = 0;
   const structure = () => {
      if (++nodes > XML_MAX_NODES) throw xmlLimitExceeded();
   };
   const value = (length: number, elementText = false) => {
      if (length > XML_MAX_VALUE_BYTES) throw xmlLimitExceeded();
      // the SDK joins direct text and CDATA even across comments or children.
      if (elementText && elementTextBytes.length) {
         const frame = elementTextBytes.length - 1;
         const combined = elementTextBytes[frame]! + length;
         if (combined > XML_MAX_VALUE_BYTES) throw xmlLimitExceeded();
         elementTextBytes[frame] = combined;
         longestValue = Math.max(longestValue, combined);
      }
      longestValue = Math.max(longestValue, length);
      structure();
   };
   const name = () => {
      const start = position;
      while (position < bytes.length && !nameDelimiter(bytes[position])) {
         if (++position - start > XML_MAX_NAME_BYTES) throw xmlLimitExceeded();
      }
      if (position === start) throw xmlLimitExceeded();
      names += position - start;
   };
   const skip = (ending: string, offset: number): number => {
      const end = bytes.indexOf(ending, position + offset);
      if (end === -1) throw xmlLimitExceeded();
      const length = end - position - offset;
      position = end + ending.length;
      return length;
   };
   const startsWith = (pattern: Buffer): boolean => {
      for (let offset = 0; offset < pattern.length; offset++) {
         if (bytes[position + offset] !== pattern[offset]) return false;
      }
      return true;
   };

   while (position < bytes.length) {
      if (bytes[position] !== 60) {
         const start = position;
         while (position < bytes.length && bytes[position] !== 60) {
            if (++position - start > XML_MAX_VALUE_BYTES)
               throw xmlLimitExceeded();
         }
         value(position - start, true);
         continue;
      }
      if (startsWith(COMMENT)) {
         skip("-->", 4);
         continue;
      }
      if (startsWith(CDATA)) {
         value(skip("]]>", 9), true);
         continue;
      }
      if (bytes[position + 1] === 63) {
         structure();
         skip("?>", 2);
         continue;
      }
      // repeated DOCTYPE parsing lowercases the whole SDK input and permits quadratic work.
      if (bytes[position + 1] === 33) throw xmlLimitExceeded();
      if (bytes[position + 1] === 47) {
         position += 2;
         name();
         while (whitespace(bytes[position])) position++;
         if (bytes[position++] !== 62 || elementTextBytes.length === 0)
            throw xmlLimitExceeded();
         elementTextBytes.pop();
         continue;
      }
      position++;
      name();
      structure();
      if (elementTextBytes.length >= XML_MAX_DEPTH) throw xmlLimitExceeded();
      elementTextBytes.push(0);
      while (position < bytes.length) {
         while (whitespace(bytes[position])) position++;
         if (bytes[position] === 62) {
            position++;
            break;
         }
         if (bytes[position] === 47 && bytes[position + 1] === 62) {
            position += 2;
            elementTextBytes.pop();
            break;
         }
         name();
         while (whitespace(bytes[position])) position++;
         if (bytes[position++] !== 61) throw xmlLimitExceeded();
         while (whitespace(bytes[position])) position++;
         const quote = bytes[position++];
         if (quote !== 34 && quote !== 39) throw xmlLimitExceeded();
         const start = position;
         while (position < bytes.length && bytes[position] !== quote) {
            if (++position - start > XML_MAX_VALUE_BYTES)
               throw xmlLimitExceeded();
         }
         value(position - start);
         if (bytes[position++] !== quote) throw xmlLimitExceeded();
      }
   }
   if (elementTextBytes.length !== 0) throw xmlLimitExceeded();
   return (
      nodes * XML_NODE_MEMORY_BYTES +
      (names + longestValue) * XML_CHARACTER_MEMORY_BYTES
   );
};

export {
   estimateXmlMemory,
   RESPONSE_TOO_LARGE,
   responseLimitExceeded,
   XML_MAX_DEPTH,
   XML_MAX_NAME_BYTES,
   XML_MAX_NODES,
   XML_MAX_VALUE_BYTES,
};
