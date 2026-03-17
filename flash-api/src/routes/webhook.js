const router = require('express').Router();
const crypto = require('crypto');
const DataPurchase = require('../models/DataPurchase');
const User = require('../models/User');
const Store = require('../models/Store');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const paystackService = require('../services/paystackService');
const { generateReference } = require('../utils/helpers');

// Verify DataMart webhook signature
async function verifyDatamartSignature(req, res, next) {
  try {
    const settings = await Settings.getSettings();
    const secret = settings?.datamart?.apiKey;

    if (!secret) {
      return res.status(500).json({ status: 'error', message: 'Webhook verification not configured' });
    }

    const signature = req.headers['x-api-key'] || req.headers['x-webhook-signature'];
    if (!signature) {
      return res.status(401).json({ status: 'error', message: 'Missing webhook signature' });
    }

    if (signature !== secret) {
      return res.status(401).json({ status: 'error', message: 'Invalid webhook signature' });
    }

    next();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Webhook verification failed' });
  }
}

// POST /api/webhook/datamart - DataMart order status webhook
router.post('/datamart', verifyDatamartSignature, async (req, res) => {
  try {
    const { reference, orderReference, status, message } = req.body;

    const dmRef = reference || orderReference;
    if (!dmRef || !status) {
      return res.status(400).json({ status: 'error', message: 'Missing reference or status' });
    }

    // Find the purchase by datamart reference
    const purchase = await DataPurchase.findOne({
      $or: [
        { datamartReference: dmRef },
        { reference: dmRef },
      ],
    });

    if (!purchase) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    // Already in a final state
    if (['completed', 'failed', 'refunded'].includes(purchase.status)) {
      return res.json({ status: 'success', message: 'Order already in final state' });
    }

    const newStatus = status.toLowerCase();

    if (newStatus === 'completed' || newStatus === 'success' || newStatus === 'delivered') {
      purchase.status = 'completed';
      await purchase.save();

      // If store purchase, credit agent earnings
      if (purchase.purchaseSource === 'store' && purchase.storeDetails?.storeId) {
        const agentProfit = purchase.storeDetails.agentProfit || 0;
        if (agentProfit > 0) {
          await Store.findOneAndUpdate(
            { _id: purchase.storeDetails.storeId },
            {
              $inc: {
                totalEarnings: agentProfit,
                pendingBalance: agentProfit,
                totalSales: 1,
              },
            }
          );
        }
      }

    } else if (newStatus === 'failed' || newStatus === 'rejected' || newStatus === 'cancelled') {
      purchase.status = 'failed';
      purchase.failureReason = message || 'Order failed via webhook';
      await purchase.save();

      // Refund for direct purchases (wallet users)
      if (purchase.purchaseSource === 'direct') {
        const user = await User.findOneAndUpdate(
          { _id: purchase.userId },
          { $inc: { walletBalance: purchase.price } },
          { new: true }
        );

        if (user) {
          await Transaction.create({
            userId: purchase.userId,
            type: 'refund',
            amount: purchase.price,
            balanceBefore: user.walletBalance - purchase.price,
            balanceAfter: user.walletBalance,
            status: 'completed',
            reference: generateReference('RFD'),
            description: `Auto-refund: failed ${purchase.capacity}GB ${purchase.network} order`,
          });
        }
      }

      // For store purchases where payment was already collected,
      // the admin handles refunds manually since customer paid via Paystack
    } else if (newStatus === 'processing' || newStatus === 'pending') {
      purchase.status = 'processing';
      await purchase.save();
    }

    res.json({ status: 'success', message: 'Webhook processed' });
  } catch (err) {
    console.error('DataMart webhook error:', err.message);
    res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
  }
});

// Verify Paystack webhook signature
async function verifyPaystackSignature(req, res, next) {
  try {
    const settings = await Settings.getSettings();
    const secret = settings?.paystack?.secretKey;

    if (!secret) {
      return res.status(401).json({ status: 'error', message: 'Paystack not configured' });
    }

    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
      return res.status(401).json({ status: 'error', message: 'Missing Paystack signature' });
    }

    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      return res.status(401).json({ status: 'error', message: 'Invalid Paystack signature' });
    }

    next();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Paystack webhook verification failed' });
  }
}

// POST /api/webhook/paystack - Paystack payment webhook
// Handles wallet deposits and store purchases
router.post('/paystack', verifyPaystackSignature, async (req, res) => {
  try {
    const { event, data } = req.body;

    // Only handle successful charges
    if (event !== 'charge.success') {
      return res.json({ status: 'success', message: 'Event ignored' });
    }

    const reference = data.reference;
    const metadata = data.metadata || {};

    // Handle wallet deposit
    if (metadata.type === 'deposit') {
      const transaction = await Transaction.findOne({ reference });
      if (!transaction) {
        return res.status(404).json({ status: 'error', message: 'Transaction not found' });
      }

      // Already processed
      if (transaction.status === 'completed') {
        return res.json({ status: 'success', message: 'Already processed' });
      }

      // Credit wallet atomically
      const user = await User.findOneAndUpdate(
        { _id: transaction.userId },
        { $inc: { walletBalance: transaction.amount } },
        { new: true }
      );

      if (user) {
        await Transaction.updateOne(
          { _id: transaction._id },
          {
            status: 'completed',
            balanceBefore: user.walletBalance - transaction.amount,
            balanceAfter: user.walletBalance,
          }
        );
      }

      return res.json({ status: 'success', message: 'Deposit credited' });
    }

    // Handle direct MoMo purchase (logged-in user paying with MoMo)
    if (metadata.type === 'direct_purchase') {
      // Mark transaction as completed
      const transaction = await Transaction.findOne({ reference });
      if (transaction && transaction.status !== 'completed') {
        await Transaction.updateOne(
          { _id: transaction._id },
          { status: 'completed' }
        );
      }

      // Check if already processed
      const existing = await DataPurchase.findOne({ reference });
      if (existing) {
        return res.json({ status: 'success', message: 'Already processed' });
      }

      // Re-fetch prices from backend settings (never trust metadata prices)
      const settings = await Settings.getSettings();
      const sellingPrices = settings?.pricing?.sellingPrices || {};
      const basePrices = settings?.pricing?.basePrices || {};
      const verifiedPrice = (sellingPrices[metadata.network] || {})[String(metadata.capacity)] || 0;
      const costPrice = (basePrices[metadata.network] || {})[String(metadata.capacity)] || 0;

      // Verify the amount paid matches the current price
      const paidAmount = data.amount / 100; // Paystack sends amount in kobo/pesewas
      if (verifiedPrice <= 0 || paidAmount < verifiedPrice) {
        console.error(`Price mismatch: paid ${paidAmount}, expected ${verifiedPrice} for ${metadata.network} ${metadata.capacity}GB`);
        return res.status(400).json({ status: 'error', message: 'Payment amount does not match current price' });
      }

      // Create purchase record
      const purchase = await DataPurchase.create({
        userId: metadata.userId,
        phoneNumber: metadata.phoneNumber,
        network: metadata.network,
        capacity: metadata.capacity,
        price: verifiedPrice,
        costPrice,
        reference,
        provider: 'datamart',
        status: 'pending',
        purchaseSource: 'direct',
      });

      // Send to DataMart
      try {
        const datamartService = require('../services/datamartService');
        const result = await datamartService.purchaseData({
          network: metadata.network,
          capacity: metadata.capacity,
          phoneNumber: metadata.phoneNumber,
        });
        purchase.datamartReference = result?.reference || result?.orderReference;
        purchase.status = 'processing';
        await purchase.save();
      } catch (err) {
        purchase.status = 'failed';
        purchase.failureReason = err.message;
        await purchase.save();
        // No wallet refund needed — money was paid via MoMo, admin handles refund
      }

      // Process referral commission
      const referralService = require('../services/referralService');
      referralService.processCommission(metadata.userId, verifiedPrice, purchase._id);

      return res.json({ status: 'success', message: 'Direct purchase processed' });
    }

    // Handle guest purchase (no account, MoMo only)
    if (metadata.type === 'guest_purchase') {
      const existing = await DataPurchase.findOne({ reference });
      if (existing) {
        return res.json({ status: 'success', message: 'Already processed' });
      }

      // Re-fetch prices from backend settings (never trust metadata prices)
      const guestSettings = await Settings.getSettings();
      const guestSellingPrices = guestSettings?.pricing?.sellingPrices || {};
      const guestBasePrices = guestSettings?.pricing?.basePrices || {};
      const guestVerifiedPrice = (guestSellingPrices[metadata.network] || {})[String(metadata.capacity)] || 0;
      const guestCostPrice = (guestBasePrices[metadata.network] || {})[String(metadata.capacity)] || 0;

      // Verify the amount paid matches the current price
      const guestPaidAmount = data.amount / 100;
      if (guestVerifiedPrice <= 0 || guestPaidAmount < guestVerifiedPrice) {
        console.error(`Guest price mismatch: paid ${guestPaidAmount}, expected ${guestVerifiedPrice}`);
        return res.status(400).json({ status: 'error', message: 'Payment amount does not match current price' });
      }

      const purchase = await DataPurchase.create({
        userId: null,
        phoneNumber: metadata.phoneNumber,
        network: metadata.network,
        capacity: metadata.capacity,
        price: guestVerifiedPrice,
        costPrice: guestCostPrice,
        reference,
        provider: 'datamart',
        status: 'pending',
        purchaseSource: 'guest',
        guestEmail: metadata.email,
        guestPhone: metadata.phoneNumber,
      });

      try {
        const datamartService = require('../services/datamartService');
        const result = await datamartService.purchaseData({
          network: metadata.network,
          capacity: metadata.capacity,
          phoneNumber: metadata.phoneNumber,
        });
        purchase.datamartReference = result?.reference || result?.orderReference;
        purchase.status = 'processing';
        await purchase.save();
      } catch (err) {
        purchase.status = 'failed';
        purchase.failureReason = err.message;
        await purchase.save();
      }

      return res.json({ status: 'success', message: 'Guest purchase processed' });
    }

    // Handle store purchase
    if (metadata.type === 'store_purchase') {
      // Check if already processed
      const existing = await DataPurchase.findOne({ reference });
      if (existing) {
        return res.json({ status: 'success', message: 'Already processed' });
      }

      const store = await Store.findById(metadata.storeId);
      if (!store) {
        return res.status(404).json({ status: 'error', message: 'Store not found' });
      }

      // Re-fetch prices from store products and backend settings (never trust metadata)
      const StoreProduct = require('../models/StoreProduct');
      const storeProduct = await StoreProduct.findOne({
        storeId: store._id,
        network: metadata.network,
        capacity: metadata.capacity,
        isActive: true,
      });
      const storeSettings = await Settings.getSettings();
      const storeBasePrices = storeSettings?.pricing?.basePrices || {};
      const verifiedSellingPrice = storeProduct?.sellingPrice || metadata.sellingPrice;
      const verifiedBasePrice = (storeBasePrices[metadata.network] || {})[String(metadata.capacity)] || storeProduct?.basePrice || 0;
      const agentProfit = verifiedSellingPrice - verifiedBasePrice;

      // Create purchase record
      const purchase = await DataPurchase.create({
        userId: store.agentId,
        phoneNumber: metadata.phoneNumber,
        network: metadata.network,
        capacity: metadata.capacity,
        price: verifiedSellingPrice,
        costPrice: verifiedBasePrice,
        reference,
        provider: 'datamart',
        status: 'pending',
        purchaseSource: 'store',
        storeDetails: {
          storeId: store._id,
          storeName: store.storeName,
          agentId: store.agentId,
          agentProfit,
          sellingPrice: verifiedSellingPrice,
        },
      });

      // Send to DataMart
      try {
        const datamartService = require('../services/datamartService');
        const result = await datamartService.purchaseData({
          network: metadata.network,
          capacity: metadata.capacity,
          phoneNumber: metadata.phoneNumber,
        });
        purchase.datamartReference = result?.reference || result?.orderReference;
        purchase.status = 'processing';
        await purchase.save();
      } catch (err) {
        purchase.status = 'failed';
        purchase.failureReason = err.message;
        await purchase.save();
      }

      return res.json({ status: 'success', message: 'Store purchase processed' });
    }

    res.json({ status: 'success', message: 'Event processed' });
  } catch (err) {
    console.error('Paystack webhook error:', err.message);
    res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
  }
});

module.exports = router;
