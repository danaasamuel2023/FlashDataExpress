const User = require('../models/User');
const Store = require('../models/Store');
const SubAgent = require('../models/SubAgent');
const Transaction = require('../models/Transaction');
const { generateReference } = require('./helpers');

// Credits the buyer's wallet and reverses any agent/sub-agent profit credits
// that were applied at purchase time. Idempotent: skips if already refunded.
async function refundFailedPurchase(purchase, reason) {
  if (!purchase || purchase.status === 'refunded' || purchase.refundedAt) {
    return { refunded: false, skipped: 'already_refunded' };
  }

  const amount = purchase.price || 0;

  if (purchase.purchaseSource === 'store' && purchase.storeDetails?.profitCredited) {
    const agentProfit = purchase.storeDetails.agentProfit || 0;
    const subAgentProfit = purchase.storeDetails.subAgentProfit || 0;
    const storeId = purchase.storeDetails.storeId;
    const subAgentId = purchase.storeDetails.subAgentId;

    if (storeId && agentProfit > 0) {
      await Store.findOneAndUpdate(
        { _id: storeId },
        { $inc: { totalEarnings: -agentProfit, pendingBalance: -agentProfit, totalSales: -1 } }
      );
    }
    if (subAgentId && subAgentProfit > 0) {
      await SubAgent.findOneAndUpdate(
        { _id: subAgentId },
        { $inc: { totalEarnings: -subAgentProfit, pendingBalance: -subAgentProfit, totalSales: -1 } }
      );
    }
    purchase.storeDetails.profitCredited = false;
  }

  let creditedTo = null;
  if (purchase.userId && amount > 0) {
    const user = await User.findOneAndUpdate(
      { _id: purchase.userId },
      { $inc: { walletBalance: amount } },
      { new: true }
    );
    if (user) {
      creditedTo = user._id;
      await Transaction.create({
        userId: purchase.userId,
        type: 'refund',
        amount,
        balanceBefore: user.walletBalance - amount,
        balanceAfter: user.walletBalance,
        status: 'completed',
        reference: generateReference('RFD'),
        gateway: 'system',
        description: `Refund for failed ${purchase.capacity}GB ${purchase.network} to ${purchase.phoneNumber}`,
        metadata: {
          source: 'auto_refund',
          originalPurchaseId: purchase._id,
          originalReference: purchase.reference,
          purchaseSource: purchase.purchaseSource,
          datamartReference: purchase.datamartReference || null,
          failureReason: reason || purchase.failureReason || null,
        },
      });
    }
  }

  purchase.status = 'refunded';
  purchase.refundedAt = new Date();
  if (reason) purchase.failureReason = reason;
  await purchase.save();

  return { refunded: true, amount, creditedTo };
}

module.exports = { refundFailedPurchase };
