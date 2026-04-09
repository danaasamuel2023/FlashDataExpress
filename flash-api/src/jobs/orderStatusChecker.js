const DataPurchase = require('../models/DataPurchase');
const Store = require('../models/Store');
const SubAgent = require('../models/SubAgent');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const datamartService = require('../services/datamartService');
// All purchases go through DataMart
const { generateReference } = require('../utils/helpers');

async function checkPendingOrders() {
  try {
    const pending = await DataPurchase.find({
      status: { $in: ['pending', 'processing'] },
      $or: [
        { datamartReference: { $exists: true, $ne: null } },
        { ghustReference: { $exists: true, $ne: null } },
      ],
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }).limit(50);

    for (const order of pending) {
      try {
        let result;

        if (order.datamartReference) {
          result = await datamartService.checkOrderStatus(order.datamartReference);
        }

        if (!result) continue;

        const newStatus = result.status?.toLowerCase();
        if (newStatus === 'completed' || newStatus === 'success' || newStatus === 'delivered') {
          order.status = 'completed';
          await order.save();

          // Credit agent & sub-agent for store purchases (if not already credited)
          if (order.purchaseSource === 'store' && order.storeDetails?.storeId && !order.storeDetails.profitCredited) {
            const agentProfit = order.storeDetails.agentProfit || 0;
            if (agentProfit > 0) {
              await Store.findOneAndUpdate(
                { _id: order.storeDetails.storeId },
                {
                  $inc: {
                    totalEarnings: agentProfit,
                    pendingBalance: agentProfit,
                    totalSales: 1,
                  },
                }
              );
            }

            const subAgentProfit = order.storeDetails.subAgentProfit || 0;
            const subAgentId = order.storeDetails.subAgentId;
            if (subAgentId && subAgentProfit > 0) {
              await SubAgent.findOneAndUpdate(
                { _id: subAgentId },
                {
                  $inc: {
                    totalEarnings: subAgentProfit,
                    pendingBalance: subAgentProfit,
                    totalSales: 1,
                  },
                }
              );
            }

            order.storeDetails.profitCredited = true;
            await order.save();
          }
        } else if (newStatus === 'failed' || newStatus === 'rejected') {
          order.status = 'failed';
          await order.save();

          // Refund for direct purchases
          if (order.purchaseSource === 'direct') {
            const user = await User.findOneAndUpdate(
              { _id: order.userId },
              { $inc: { walletBalance: order.price } },
              { new: true }
            );
            if (user) {
              await Transaction.create({
                userId: order.userId,
                type: 'refund',
                amount: order.price,
                balanceBefore: user.walletBalance - order.price,
                balanceAfter: user.walletBalance,
                status: 'completed',
                reference: generateReference('RFD'),
                description: `Auto-refund: failed ${order.capacity}GB ${order.network} order`,
              });
            }
          }
        }
      } catch (err) {
        // Skip individual order errors
      }
    }
  } catch (err) {
    console.error('Order status checker error:', err.message);
  }
}

// Run every 2 minutes
function startOrderStatusChecker() {
  console.log('Order status checker started');
  setInterval(checkPendingOrders, 2 * 60 * 1000);
  // Run immediately on startup
  setTimeout(checkPendingOrders, 10000);
}

module.exports = { startOrderStatusChecker };
