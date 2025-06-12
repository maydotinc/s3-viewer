import { auth } from "@s3-viewer/auth";
import { Request } from "express";

const getUserId = async (req: Request) => {
    const session = await auth.api.getSession({
        headers: new Headers(req.headers as Record<string, string>),
    });
    if (!session) return undefined;
    return session.user.id;
};

const getUserEmail = async (req: Request) => {
    const session = await auth.api.getSession({
        headers: new Headers(req.headers as Record<string, string>),
    });
    if (!session) return undefined;
    return session.user.email;
};

const getUser = async (req: Request) => {
    const session = await auth.api.getSession({
        headers: new Headers(req.headers as Record<string, string>),
    });
    if (!session) return undefined;
    return session.user;
};

export { getUser, getUserEmail, getUserId };
