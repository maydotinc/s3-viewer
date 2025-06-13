import { auth } from '@s3-viewer/auth';
import { User } from 'better-auth';
import { NextFunction, Request, Response } from 'express';

// Extend Express Request type to include session
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

const authGuard = (req: Request, res: Response, next: NextFunction) => {
    auth.api.getSession({
        headers: new Headers(req.headers as Record<string, string>),
    }).then(session => {
        if (!session) {
            return res.status(401).json({ 
                message: 'Unauthorized, please login to continue' 
            });
        }
        req.user = session.user;
        next();
    }).catch(() => {
        res.status(401).json({ 
            message: 'Invalid session' 
        });
    });
};

export default authGuard;