import { auth } from '@s3-viewer/auth';
import { User } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
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
    console.log("Authenticating request");
    
    auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    }).then(session => {
        if (!session) {
            return res.status(401).json({ 
                message: 'Unauthorized, please login to continue' 
            });
        }
        req.user = session.user;
        next();
    }).catch((error) => {
        console.log("Auth error:", error);
        res.status(401).json({ 
            message: 'Invalid session' 
        });
    });
};

export default authGuard;