import { C, Field, Icon, Txt } from "../shared";

export const SearchBox = ({
   x,
   y,
   w,
   h = 28,
}: {
   x: number;
   y: number;
   w: number;
   h?: number;
}) => (
   <Field x={x} y={y} w={w} h={h}>
      <Icon name="search" x={9} y={h / 2 - 7} size={14} color={C.light} />
      <Txt x={28} y={h / 2 + 4} size={11.5} fill={C.light}>
         Search…
      </Txt>
   </Field>
);
