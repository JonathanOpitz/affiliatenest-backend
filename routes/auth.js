// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');
const AffiliateLink = require('../models/AffiliateLink');
const Referral = require('../models/Referral');
const router = express.Router();

// Rate limiter
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again later.',
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Register endpoint
router.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password, referralLink } = req.body;
  try {
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already registered' });
    }

    const user = new User({
      username,
      email,
      password,
      verificationToken: crypto.randomBytes(32).toString('hex'),
    });
    await user.save();

    if (referralLink) {
      const affiliateLink = await AffiliateLink.findOne({ link: referralLink });
      if (affiliateLink) {
        const referral = new Referral({
          affiliateLinkId: affiliateLink._id,
          userId: affiliateLink.userId,
          programId: affiliateLink.programId,
          referredUserId: user._id,
        });
        await referral.save();
      }
    }

    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify/${user.verificationToken}`;
    await transporter.sendMail({
      from: '"AffiliateNest" <your-email@gmail.com>',
      to: email,
      subject: 'Verify Your AffiliateNest Account',
      html: `<p>Thank you for signing up! Please verify your email by clicking <a href="${verificationUrl}">here</a>.</p>`,
    });

    res.status(201).json({ message: 'Account created. Please verify your email.' });
  } catch (error) {
    console.error('Registration error:', error.message, error.stack);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Verify email
router.get('/verify/:token', async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    user.verified = true;
    user.verificationToken = undefined;
    await user.save();
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error('Verification error:', error.message, error.stack);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    if (!user.verified) {
      return res.status(400).json({ error: 'Please verify your email' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

module.exports = router;