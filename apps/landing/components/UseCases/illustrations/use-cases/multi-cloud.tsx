import {
   BucketRows,
   C,
   Card,
   FlowLine,
   HeaderRow,
   IllustrationFrame,
   ProviderTile,
   SVGRoot,
   ServerHeader,
   Txt,
   type Provider,
} from "../shared";
import { ILLUSTRATION_LABELS } from "../labels";

const SERVERS: { name: string; sub: string; provider: Provider }[] = [
   { name: "May Inc.", sub: "Cloudflare R2 · auto", provider: "cloudflare" },
   { name: "Backup S3", sub: "Amazon S3 · us-east-1", provider: "aws" },
   { name: "Lab MinIO", sub: "MinIO · self-hosted", provider: "server" },
];

export const MultiCloudIllustration = () => (
   <IllustrationFrame label={ILLUSTRATION_LABELS.multiCloud}>
      <SVGRoot>
         <Txt x={24} y={70} size={10} fill={C.light} caps>
            SERVERS
         </Txt>
         <path
            d="M184 252C220 252 220 180 256 180"
            stroke={C.border}
            strokeWidth={1.5}
            strokeDasharray="4 4"
         />
         <path
            d="M184 180H256"
            stroke={C.border}
            strokeWidth={1.5}
            strokeDasharray="4 4"
         />
         <FlowLine d="M184 108C220 108 220 180 256 180" />
         {SERVERS.map((s, i) => {
            const active = i === 0;
            return (
               <Card
                  key={s.name}
                  x={24}
                  y={84 + i * 72}
                  w={160}
                  h={48}
                  stroke={active ? C.blue : C.border}
               >
                  <ProviderTile x={12} y={12} provider={s.provider} />
                  <Txt x={44} y={22} weight={600} fill={C.black}>
                     {s.name}
                  </Txt>
                  <Txt x={44} y={36} size={10} fill={C.light}>
                     {s.sub}
                  </Txt>
                  <circle
                     cx={146}
                     cy={24}
                     r={3.5}
                     fill={active ? C.blue : C.white}
                     stroke={active ? C.blue : C.border}
                     strokeWidth={1.25}
                  />
               </Card>
            );
         })}
         <Card x={256} y={56} w={200} h={248}>
            <ServerHeader w={200} name="May Inc." provider="cloudflare" />
            <HeaderRow
               x={0}
               y={40}
               w={200}
               cols={[{ label: "Bucket", x: 12 }]}
            />
            <BucketRows y={64} w={200} rowH={36} />
            <Txt x={12} y={232} size={10.5} fill={C.light}>
               4 buckets · one server at a time
            </Txt>
         </Card>
      </SVGRoot>
   </IllustrationFrame>
);
