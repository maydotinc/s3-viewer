import { C } from "../shared";

export const Crumb = ({
   x,
   y,
   path,
   current,
}: {
   x: number;
   y: number;
   path: string;
   current: string;
}) => (
   <text x={x} y={y} fontSize={11} fontWeight={500} fill={C.light}>
      {path}
      <tspan fill={C.black}>{current}</tspan>
   </text>
);
