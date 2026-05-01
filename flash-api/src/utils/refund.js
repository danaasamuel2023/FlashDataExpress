const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { generateReference } = require('./helpers');

// Credits the buyer's wallet with the selling price. Agent/sub-agent profit
// credited at purchase time is left intact — profit is earned at the point of
// sale and is not clawed back on refund. Idempotent: skips if already refunded.
async function refundFailedPurchase(purchase, reason) {
  if (!purchase || purchase.status === 'refunded' || purchase.refundedAt) {
    return { refunded: false, skipped: 'already_refunded' };
  }

  const amount = purchase.price || 0;

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
