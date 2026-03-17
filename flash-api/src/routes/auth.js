const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { Referral } = require('../models/Referral');
const auth = require('../middleware/auth');
const { formatPhone } = require('../utils/helpers');

// Register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: errors.array()[0].msg });
    }

    const { name, email, password, phoneNumber, referralCode } = req.body;
    const formattedPhone = formatPhone(phoneNumber);

    // Check existing
    const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber: formattedPhone }] });
    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'phone number';
      return res.status(400).json({ status: 'error', message: `An account with this ${field} already exists` });
    }

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (!referrer) {
        return res.status(400).json({ status: 'error', message: 'Invalid referral code' });
      }
    }

    const user = new User({
      name: name.trim(),
      email,
      password,
      phoneNumber: formattedPhone,
      referredBy: referralCode ? referralCode.toUpperCase() : null
    });
    await user.save();

    // Create referral record
    if (referrer) {
      await Referral.create({
        referrerId: referrer._id,
        referredUserId: user._id,
        referralCode: referralCode.toUpperCase()
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          referralCode: user.referralCode,
          walletBalance: user.walletBalance
        }
      }
    });
  } catch (error) {
    console.error('Register error:', error);

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const messages = {
        email: 'An account with this email already exists',
        phoneNumber: 'An account with this phone number already exists',
        referralCode: 'Registration failed due to a conflict. Please try again.'
      };
      return res.status(400).json({
        status: 'error',
        message: messages[field] || 'An account with these details already exists'
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0];
      return res.status(400).json({
        status: 'error',
        message: firstError.message
      });
    }

    res.status(500).json({ status: 'error', message: 'Something went wrong on our end. Please try again later.' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'error', message: 'Valid email and password required' });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ status: 'error', message: 'Your account has been deactivated. Contact support.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      status: 'success',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          referralCode: user.referralCode,
          walletBalance: user.walletBalance
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'error', message: 'Login failed. Please try again.' });
  }
});

// Forgot Password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.json({ status: 'success', message: 'If an account exists, a reset code has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // TODO: Send OTP via SMS/email using smsService

    res.json({ status: 'success', message: 'If an account exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to process request' });
  }
});

// Reset Password
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail(),
  body('otp').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email }).select('+resetPasswordOTP +resetPasswordOTPExpiry');

    if (!user || user.resetPasswordOTP !== otp || user.resetPasswordOTPExpiry < new Date()) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired reset code' });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpiry = undefined;
    await user.save();

    res.json({ status: 'success', message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to reset password' });
  }
});

// POST /api/auth/setup-admin — one-time: promote yourself to admin if no admin exists
router.post('/setup-admin', auth, async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(403).json({ status: 'error', message: 'An admin already exists. Ask an existing admin to promote you.' });
    }

    await User.findByIdAndUpdate(req.user._id, { role: 'admin' });

    res.json({ status: 'success', message: 'You are now an admin. Please log in again.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber,
        role: req.user.role,
        referralCode: req.user.referralCode,
        walletBalance: req.user.walletBalance,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt
      }
    }
  });
});

module.exports = router;
