import { PROVIDER_PATHS } from "@/lib/provider-paths";

export const CloudflarePaths = () => (
   <>
      {PROVIDER_PATHS.cloudflare.map((p) => (
         <path key={p.fill} d={p.d} fill={p.fill} />
      ))}
   </>
);

export const AwsArtwork = () => {
   const { wordmark, stroke, strokeWidth, swoosh, arrow } = PROVIDER_PATHS.aws;
   return (
      <>
         <text
            x={wordmark.x}
            y={wordmark.y}
            textAnchor="middle"
            fontFamily="inherit"
            fontSize={wordmark.size}
            fontWeight={700}
            fill={wordmark.fill}
         >
            aws
         </text>
         <path
            d={swoosh}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
         />
         <path
            d={arrow}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
         />
      </>
   );
};
