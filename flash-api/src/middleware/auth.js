const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SubAgent = require('../models/SubAgent');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Sub-agent tokens may not be used to access main-portal endpoints
    if (decoded.scope === 'subagent') {
      return res.status(403).json({ status: 'error', message: 'Sub-agent accounts cannot access the main portal' });
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ status: 'error', message: 'Account has been deactivated' });
    }

    // Defense in depth: even with a legacy un-scoped token, if the underlying
    // user is a registered sub-agent they cannot use the main portal.
    const subAgentRecord = await SubAgent.findOne({ userId: user._id, status: 'registered' }).select('_id');
    if (subAgentRecord) {
      return res.status(403).json({ status: 'error', message: 'Sub-agent accounts cannot access the main portal' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Token expired' });
    }
    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
};

module.exports = auth;
