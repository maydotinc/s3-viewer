import {
   Btn,
   C,
   Card,
   Caret,
   Chip,
   Field,
   HeaderRow,
   Icon,
   IllustrationFrame,
   MatchText,
   ObjectRow,
   SVGRoot,
   Txt,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const SEARCH_ROWS: [string, string, boolean][] = [
   ["invoice-2026-01.pdf", "212 KB", true],
   ["invoice-2026-02.pdf", "198 KB", true],
   ["invoice-2026-03.pdf", "240 KB", true],
   ["invoice-2025-12.pdf", "231 KB", false],
   ["receipt-0918.pdf", "88 KB", false],
   ["statement.csv", "12 KB", false],
];

export const SearchIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.search}>
      <SVGRoot>
         <Card x={24} y={32} w={432} h={296}>
            <Field x={12} y={12} w={200} active>
               <Icon name="search" x={9} y={7} size={14} color={C.blue} />
               <Txt x={30} y={18} fill={C.black} mono>
                  invoice-2026
               </Txt>
               <Caret x={118} y={7} />
            </Field>
            <Chip x={220} y={16} w={84} label="Prefix filter" />
            <Btn x={328} y={12} w={92} label="Rows (100)" kind="ghost" />
            <HeaderRow
               x={0}
               y={52}
               w={432}
               check="none"
               cols={[
                  { label: "Name", x: 56 },
                  { label: "Size", x: 232 },
                  { label: "Modified", x: 312 },
               ]}
            />
            {SEARCH_ROWS.map(([n, s, hit], i) => (
               <ObjectRow
                  key={n}
                  x={0}
                  y={76 + i * 32}
                  w={432}
                  check={false}
                  size={s}
                  date="2026-09-05"
                  sizeX={232}
                  dateX={312}
                  faded={!hit}
                  menu
                  name={hit ? <MatchText text={n} match="invoice-2026" /> : n}
               />
            ))}
            <Txt x={12} y={284} size={11}>
               3 of 6 objects match
            </Txt>
            <Chip
               x={284}
               y={270}
               w={136}
               label="prefix=invoice-2026"
               mono
               size={10}
            />
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
