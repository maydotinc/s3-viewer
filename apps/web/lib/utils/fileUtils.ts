/**
 * MIME types for file extensions
 */
export const mimeTypes: { [key: string]: string } = {
   // Images
   jpg: "image/jpeg",
   jpeg: "image/jpeg",
   png: "image/png",
   gif: "image/gif",
   webp: "image/webp",
   svg: "image/svg+xml",
   ico: "image/x-icon",
   bmp: "image/bmp",
   tiff: "image/tiff",

   // Documents
   pdf: "application/pdf",
   doc: "application/msword",
   docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
   xls: "application/vnd.ms-excel",
   xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
   ppt: "application/vnd.ms-powerpoint",
   pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
   txt: "text/plain",
   csv: "text/csv",
   rtf: "application/rtf",

   // Archives
   zip: "application/zip",
   rar: "application/x-rar-compressed",
   "7z": "application/x-7z-compressed",
   tar: "application/x-tar",
   gz: "application/gzip",

   // Audio
   mp3: "audio/mpeg",
   wav: "audio/wav",
   ogg: "audio/ogg",
   m4a: "audio/mp4",
   aac: "audio/aac",

   // Video
   mp4: "video/mp4",
   webm: "video/webm",
   avi: "video/x-msvideo",
   mov: "video/quicktime",
   wmv: "video/x-ms-wmv",
   flv: "video/x-flv",
   mkv: "video/x-matroska",

   // Code
   html: "text/html",
   htm: "text/html",
   css: "text/css",
   js: "application/javascript",
   json: "application/json",
   xml: "application/xml",
   ts: "application/typescript",
   tsx: "application/typescript",
   jsx: "application/javascript",
   py: "text/x-python",
   java: "text/x-java-source",
   c: "text/x-c",
   cpp: "text/x-c++",
   h: "text/x-c",
   hpp: "text/x-c++",
   cs: "text/x-csharp",
   php: "text/x-php",
   rb: "text/x-ruby",
   go: "text/x-go",
   rs: "text/x-rust",
   swift: "text/x-swift",

   // Fonts
   ttf: "font/ttf",
   otf: "font/otf",
   woff: "font/woff",
   woff2: "font/woff2",
   eot: "application/vnd.ms-fontobject",

   // Other
   md: "text/markdown",
   yaml: "application/x-yaml",
   yml: "application/x-yaml",
   ini: "text/plain",
   conf: "text/plain",
   log: "text/plain",
   sql: "application/sql",
   sh: "text/x-shellscript",
   bat: "application/x-msdos-program",
   ps1: "application/x-powershell",
};

/**
 * Get the MIME type for a given file extension
 * @param extension The file extension (without the dot)
 * @returns The corresponding MIME type or 'application/octet-stream' if not found
 */
export function getMimeType(extension: string): string {
   const normalizedExtension = extension.toLowerCase().replace(/^\./, "");
   return mimeTypes[normalizedExtension] || "application/octet-stream";
}

/**
 * Get the MIME type for a given filename
 * @param filename The filename to get the MIME type for
 * @returns The corresponding MIME type or 'application/octet-stream' if not found
 */
export function getMimeTypeFromFilename(filename: string): string {
   const extension = getFileExtension(filename);
   return getMimeType(extension);
}

/**
 * Interface representing the properties of a File object
 */
export interface FileProperties {
   name: string; // The name of the file
   size: number; // The size of the file in bytes
   type: string; // The MIME type of the file
   lastModified: number; // The last modified timestamp
   lastModifiedDate: Date; // The last modified date
}

/**
 * Get all properties of a File object
 * @param file The File object to inspect
 * @returns An object containing all File properties
 */
export function getFileProperties(file: File): FileProperties {
   return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      lastModifiedDate: new Date(file.lastModified),
   };
}

/**
 * Format file size in human-readable format
 * @param bytes The size in bytes
 * @returns Object with value and unit (e.g., { value: 1.5, unit: "MB" })
 */
export function formatFileSize(bytes: number): { value: number; unit: string } {
   if (bytes === 0) return { value: 0, unit: "B" };

   const k = 1024;
   const sizes = ["B", "KB", "MB", "GB", "TB"];
   const i = Math.floor(Math.log(bytes) / Math.log(k));
   const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

   return { value, unit: sizes[i] ?? "B" };
}

/**
 * Validate file type against allowed MIME types
 * @param file The File object to validate
 * @returns boolean indicating if file type is allowed
 */
export function isValidFileType(file: File): boolean {
   const extension = getFileExtension(file.name);
   return mimeTypes[extension] !== undefined;
}

/**
 * Validate file size against maximum size
 * @param file The File object to validate
 * @param maxSizeInBytes Maximum allowed size in bytes
 * @returns boolean indicating if file size is within limit
 */
export function isValidFileSize(file: File, maxSizeInBytes: number): boolean {
   return file.size <= maxSizeInBytes;
}

/**
 * Get the file extension from a filename
 * @param filename The filename to extract the extension from
 * @returns The file extension (without the dot) or empty string if no extension
 */
export function getFileExtension(filename: string): string {
   const parts = filename.split(".");
   if (parts.length > 1) {
      const extension = parts.pop();
      return extension ? extension.toLowerCase() : "";
   }
   return "";
}

/**
 * Get file extension from File object
 * @param file The File object
 * @returns The file extension (without the dot)
 */
export function getFileExtensionFromFile(file: File): string {
   return file.name.split(".").pop()?.toLowerCase() || "";
}

/**
 * Example usage of File object properties
 * @param file The File object from form input
 */
export function logFileDetails(file: File): void {
   console.log("File Details:");
   console.log("Name:", file.name);
   const { value, unit } = formatFileSize(file.size);
   console.log("Size:", `${value} ${unit}`);
   console.log("Type:", file.type);
   console.log("Last Modified:", new Date(file.lastModified).toLocaleString());
   console.log("Extension:", getFileExtensionFromFile(file));
}
