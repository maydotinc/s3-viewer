import {
   C,
   Card,
   Chip,
   Glide,
   HR,
   HeaderRow,
   Icon,
   IllustrationFrame,
   ObjectRow,
   ProviderTile,
   SVGRoot,
   Txt,
   type Provider,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const PANE_ROWS: [string, string, "file" | "folder"][] = [
   ["2026-09/", "", "folder"],
   ["hero.mp4", "80.25 MB", "file"],
   ["logo.png", "93 KB", "file"],
   ["notes.md", "4.1 KB", "file"],
];

const Pane = ({
   x,
   provider,
   name,
   region,
}: {
   x: number;
   provider: Provider;
   name: string;
   region: string;
}) => (
   <Card x={x} y={34} w={204} h={264}>
      <ProviderTile x={12} y={10} provider={provider} />
      <Txt x={44} y={27} weight={600} fill={C.black}>
         {name}
      </Txt>
      <Chip x={120} y={12} w={72} label={region} mono size={10} />
      <HR x={0} y={44} w={204} />
      <Icon name="bucket" x={12} y={52} size={14} color={C.light} sw={1.3} />
      <Txt x={32} y={63} size={11} fill={C.black} mono>
         media-archive
      </Txt>
      <HeaderRow
         x={0}
         y={72}
         w={204}
         h={22}
         cols={[
            { label: "Name", x: 34 },
            { label: "Size", x: 132 },
         ]}
      />
      {PANE_ROWS.map(([n, s, k], i) => (
         <ObjectRow
            key={n}
            x={0}
            y={94 + i * 32}
            w={204}
            name={n}
            size={s || undefined}
            kind={k}
            sizeX={132}
         />
      ))}
      <Txt x={12} y={246} size={10} fill={C.light}>
         4 objects · 80.3 MB
      </Txt>
   </Card>
);

export const SideBySideIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.sideBySide}>
      <SVGRoot>
         <Pane x={16} provider="aws" name="Backup S3" region="us-east-1" />
         <Pane x={260} provider="cloudflare" name="May Inc." region="auto" />
         <circle
            cx={240}
            cy={166}
            r={18}
            fill={C.white}
            stroke={C.border}
            strokeWidth={1.25}
         />
         <g>
            <Glide
               type="rotate"
               values="0 240 166;0 240 166;180 240 166;180 240 166"
               keyTimes="0;.4;.55;1"
               dur="4s"
            />
            <Icon name="switch" x={232} y={158} color={C.blue} sw={1.6} />
         </g>

         <Txt x={240} y={324} size={10.5} fill={C.light} anchor="middle">
            One credential per provider, one click apart
         </Txt>
      </SVGRoot>
   </IllustrationFrame>
);
