const splitList = (raw: string, separator: RegExp): string[] => [
   ...new Set(
      raw
         .split(separator)
         .map((s) => s.trim())
         .filter(Boolean)
   ),
];

export { splitList };
