type Props = Record<string, unknown>;
type Element = { type: unknown; props: Props };

const isElement = (node: unknown): node is Element =>
   typeof node === "object" &&
   node !== null &&
   "props" in node &&
   "type" in node &&
   typeof (node as Element).props === "object";

const walk = (node: unknown, visit: (element: Element) => void): void => {
   if (Array.isArray(node)) {
      for (const child of node) walk(child, visit);
      return;
   }
   if (!isElement(node)) return;
   visit(node);
   walk(node.props.children, visit);
};

const all = (root: unknown, match: (element: Element) => boolean) => {
   const found: Element[] = [];
   walk(root, (element) => {
      if (match(element)) found.push(element);
   });
   return found;
};

const one = (
   root: unknown,
   match: (element: Element) => boolean,
   what: string
): Element => {
   const [found] = all(root, match);
   if (!found) throw new Error(`No ${what} in the rendered tree.`);
   return found;
};

const strings = (children: unknown): string[] =>
   (Array.isArray(children) ? children : [children]).filter(
      (child): child is string => typeof child === "string"
   );

const text = (root: unknown): string => {
   const parts: string[] = [];
   walk(root, (element) => parts.push(...strings(element.props.children)));
   return parts.join(" ");
};

const button = (root: unknown, label: string): Element =>
   one(
      root,
      (element) =>
         typeof element.props.onClick === "function" &&
         strings(element.props.children).some((child) => child.includes(label)),
      `button labelled ${label}`
   );

const click = (element: Element): void =>
   (element.props.onClick as () => void)();

export { all, button, click, one, text };
export type { Element };
