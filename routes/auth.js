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
  standardHeaders: true,
  legacyHeaders: false,
});

// Email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});

// Test email configuration
router.get('/test-email', async (req, res) => {
  try {
    await transporter.verify();
    res.json({ message: 'Email configuration is valid' });
  } catch (error) {
    console.error('Email config error:', error.message, error.stack);
    res.status(500).json({ error: `Email config error: ${error.message}` });
  }
});

// Register endpoint
router.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password, referralLink } = req.body;
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is missing');
    }
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword,
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

    try {
      const verificationUrl = `${process.env.BASE_URL}/api/auth/verify/${user.verificationToken}`;
      await transporter.sendMail({
        from: `"AffiliateNest" <jonercoolus@gmail.com>`, // Must match verified SendGrid sender
        to: email,
        subject: 'Verify Your AffiliateNest Account',
        html: `<p>Thank you for signing up! Please verify your email by clicking <a href="${verificationUrl}">here</a>.</p>`,
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError.message, emailError.stack);
      return res.status(500).json({ error: `Failed to send verification email: ${emailError.message}` });
    }

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
    const isMatch = await bcrypt.compare(password, user.password);
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