"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ success: false, error: 'Unauthorized: User not authenticated.' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                error: `Forbidden: Access denied for role '${req.user.role}'. Required one of: [${allowedRoles.join(', ')}].`,
            });
            return;
        }
        next();
    };
}
