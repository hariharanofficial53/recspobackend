const jwt = require('jsonwebtoken');
const Team = require('../models/Team');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      req.team = { isAdmin: true, _id: 'admin', teamName: 'Admin' };
      return next();
    }

    const team = await Team.findById(decoded.id);
    if (!team) {
      return res.status(401).json({ error: 'Team not found. Token invalid.' });
    }

    req.team = team;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = protect;
