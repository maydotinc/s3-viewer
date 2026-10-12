export const stripJsx = (node: unknown): string => {
   if (typeof node === "string" || typeof node === "number") {
      return String(node);
   }
   if (Array.isArray(node)) {
      return node.map(stripJsx).join("");
   }
   if (
      node &&
      typeof node === "object" &&
      "props" in (node as Record<string, unknown>)
   ) {
      const props = (node as { props?: { children?: unknown } }).props;
      return stripJsx(props?.children);
   }
   return "";
};
