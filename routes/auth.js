const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const AffiliateLink = require('../models/AffiliateLink');
const Referral = require('../models/Referral');
const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});

router.get('/test-email', async (req, res) => {
  try {
    await transporter.verify();
    res.json({ message: 'Email configuration is valid' });
  } catch (error) {
    console.error('Email config error:', error.message, error.stack);
    res.status(500).json({ error: `Email config error: ${error.message}` });
  }
});

router.get('/test-db', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  try {
    console.log('Test DB endpoint hit');
    console.log('MongoDB connected:', mongoose.connection.readyState);
    console.log('Database:', mongoose.connection.db ? mongoose.connection.db.databaseName : 'not connected');
    const users = await User.find();
    console.log('All users:', users.map(u => ({ email: u.email, username: u.username })));
    res.json({ database: mongoose.connection.db ? mongoose.connection.db.databaseName : 'not connected', users });
  } catch (error) {
    console.error('Test DB error:', error.message, error.stack);
    res.status(500).json({ error: `Test DB error: ${error.message}` });
  }
});

router.get('/test-bcrypt', async (req, res) => {
  try {
    const password = 'secure123456';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const isMatch = await bcrypt.compare(password, hashedPassword);
    console.log('Bcrypt test:', { password, hashedPassword, isMatch });
    res.json({ password, hashedPassword, isMatch });
  } catch (error) {
    console.error('Bcrypt test error:', error.message, error.stack);
    res.status(500).json({ error: `Bcrypt test error: ${error.message}` });
  }
});

router.post('/register', registerLimiter, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  console.log('Register endpoint hit:', req.body);
  try {
    console.log('MongoDB connected:', mongoose.connection.readyState);
    console.log('Database:', mongoose.connection.db ? mongoose.connection.db.databaseName : 'not connected');
    const { username, email, password, referralLink } = req.body;
    if (typeof password !== 'string' || password.length < 6) {
      console.log('Invalid password:', { password, type: typeof password, length: password ? password.length : 'undefined' });
      return res.status(400).json({ error: 'Password must be a string with at least 6 characters' });
    }
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.toLowerCase();
    console.log('Input validation:', { rawPassword: password, email: normalizedEmail, username: normalizedUsername });
    console.log('Environment:', {
      MONGODB_URI: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/:.*@/, ':****@') : 'undefined',
      JWT_SECRET: !!process.env.JWT_SECRET,
      SENDGRID_API_KEY: !!process.env.SENDGRID_API_KEY,
      BASE_URL: process.env.BASE_URL,
    });
    console.log('Checking for existing user:', { email: normalizedEmail, username: normalizedUsername });
    const allUsers = await User.find();
    console.log('All users:', allUsers.map(u => ({ email: u.email, username: u.username })));
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    const existingUsernameUser = await User.findOne({ username: normalizedUsername });
    if (existingEmailUser || existingUsernameUser) {
      console.log('Found existing user:', {
        email: existingEmailUser ? existingEmailUser.email : 'none',
        username: existingUsernameUser ? existingUsernameUser.username : 'none',
      });
      return res.status(400).json({ error: 'Email or username already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashing:', { rawPassword: password, hashedPassword });

    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      verificationToken: crypto.randomBytes(32).toString('hex'),
    });
    console.log('Saving new user:', { username: normalizedUsername, email: normalizedEmail });
    await user.save();
    console.log('User saved:', { _id: user._id, email: normalizedEmail, username: normalizedUsername });

    if (referralLink) {
      console.log('Checking referral link:', referralLink);
      const affiliateLink = await AffiliateLink.findOne({ link: referralLink });
      if (affiliateLink) {
        console.log('Found affiliate link:', affiliateLink._id);
        const referral = new Referral({
          affiliateLinkId: affiliateLink._id,
          userId: affiliateLink.userId,
          programId: affiliateLink.programId,
          referredUserId: user._id,
        });
        await referral.save();
        console.log('Referral saved:', referral._id);
      }
    }

    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify/${user.verificationToken}`;
    console.log('Sending verification email to:', normalizedEmail);
    await transporter.sendMail({
      from: `"AffiliateNest" <jonercoolus@gmail.com>`,
      to: normalizedEmail,
      subject: 'Verify Your AffiliateNest Account',
      html: `<p>Thank you for signing up! Please verify your email by clicking <a href="${verificationUrl}">here</a>.</p>`,
    });
    console.log('Verification email sent to:', normalizedEmail);

    res.status(201).json({ message: 'Account created. Please verify your email.' });
  } catch (error) {
    console.error('Registration error:', error.message, error.stack);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

router.get('/verify/:token', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  console.log('Verify endpoint hit:', req.params.token);
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) {
      console.log('Invalid or expired token:', req.params.token);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    user.verified = true;
    user.verificationToken = undefined;
    await user.save();
    console.log('User verified:', { email: user.email, username: user.username });
    res.status(200).json({ message: 'Account verified successfully' });
  } catch (error) {
    console.error('Verification error:', error.message, error.stack);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

router.post('/login', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ error: 'Database not connected' });
  }
  console.log('Login endpoint hit:', req.body.email);
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    if (!email || !password || typeof password !== 'string') {
      console.log('Invalid login input:', { email, password, passwordType: typeof password });
      return res.status(400).json({ error: 'Email and password are required and must be strings' });
    }
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log('User not found:', normalizedEmail);
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    if (!user.verified) {
      console.log('User not verified:', normalizedEmail);
      return res.status(400).json({ error: 'Please verify your email' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password comparison:', { rawPassword: password, storedHash: user.password, isMatch });
    if (!isMatch) {
      console.log('Password mismatch:', normalizedEmail);
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    console.log('Login successful:', { email: normalizedEmail, userId: user._id });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

module.exports = router;
