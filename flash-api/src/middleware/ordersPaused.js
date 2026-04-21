const Settings = require('../models/Settings');

module.exports = async function ordersPaused(req, res, next) {
  try {
    const settings = await Settings.getSettings();
    if (settings?.ordersPaused) {
      return res.status(503).json({
        status: 'error',
        code: 'ORDERS_PAUSED',
        message: settings.ordersPausedMessage || 'Orders are temporarily paused by admin. Please try again shortly.',
      });
    }
    next();
  } catch (err) {
    next();
  }
};
