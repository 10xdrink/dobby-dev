const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/BlacklistedToken');

exports.protect = (roles = []) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    try {
      // Check if token is blacklisted
      const blacklisted = await BlacklistedToken.findOne({ token });
      if (blacklisted) {
        return res.status(401).json({ message: 'Token is invalid (logged out)' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // const normalizedUser = {
      //   ...decoded,
      //   id: decoded.id || decoded._id || decoded.userId || null,
      //   _id: decoded._id || decoded.id || decoded.userId || null,
      // };

      // if (roles.length && !roles.includes(normalizedUser.role)) {
      //   return res.status(403).json({ message: 'Forbidden' });
      // }

      // req.user = normalizedUser;

      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
};
