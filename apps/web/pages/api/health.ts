import type { NextApiRequest, NextApiResponse } from "next";

const handler = (_req: NextApiRequest, res: NextApiResponse) => {
   res.setHeader("Cache-Control", "no-store");
   res.status(200).json({ ok: true });
};

export default handler;
