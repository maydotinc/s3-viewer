const LOSSY_SEGMENTS = new Set(["", ".", ".."]);

const isLossyKeySegment = (segment: string): boolean =>
   LOSSY_SEGMENTS.has(segment);

export { isLossyKeySegment };
