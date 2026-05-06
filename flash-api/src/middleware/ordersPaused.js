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
    const network = req.body?.network;
    const outOfStock = settings?.outOfStockNetworks || [];
    if (network && outOfStock.includes(network)) {
      return res.status(503).json({
        status: 'error',
        code: 'NETWORK_OUT_OF_STOCK',
        message: `${networkLabel(network)} is currently out of stock. Please try another network.`,
      });
    }
    next();
  } catch (err) {
    next();
  }
};

function networkLabel(net) {
  if (net === 'YELLO') return 'MTN';
  if (net === 'TELECEL') return 'Telecel';
  if (net === 'AT_PREMIUM') return 'AirtelTigo';
  return net;
}
