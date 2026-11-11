type LineEnding = "\n" | "\r\n";

type SaveShortcut = {
   key: string;
   metaKey: boolean;
   ctrlKey: boolean;
};

const dominantLineEnding = (text: string): LineEnding => {
   const crlf = text.split("\r\n").length - 1;
   const lf = text.split("\n").length - 1 - crlf;
   return crlf > lf ? "\r\n" : "\n";
};

const toEditorText = (text: string): string => text.replace(/\r\n/g, "\n");

const applyLineEnding = (text: string, ending: LineEnding): string =>
   ending === "\r\n" ? toEditorText(text).replace(/\n/g, "\r\n") : text;

const isSaveShortcut = (event: SaveShortcut): boolean =>
   (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";

export { applyLineEnding, dominantLineEnding, isSaveShortcut, toEditorText };
export type { LineEnding };
