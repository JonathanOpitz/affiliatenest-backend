// routes/affiliate.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const AffiliateProgram = require('../models/AffiliateProgram');
const AffiliateLink = require('../models/AffiliateLink');
const Referral = require('../models/Referral');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/program', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { name, commissionRate, widgetStyles } = req.body;
    const program = new AffiliateProgram({ userId, name, commissionRate, widgetStyles });
    await program.save();
    res.status(201).json(program);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/generate-link', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { programId } = req.body;
    const program = await AffiliateProgram.findById(programId);
    if (!program || program.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const link = `https://affiliatenest.com/ref/${programId}-${Math.random().toString(36).substr(2, 8)}`;
    const affiliateLink = new AffiliateLink({ userId, programId, link });
    await affiliateLink.save();
    res.status(201).json({ link, embedCode: `<script src="https://affiliatenest.com/api/widget.js?link=${encodeURIComponent(link)}"></script>` });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/track/:link', async (req, res) => {
  try {
    console.log('Received track request for link:', req.params.link);
    const link = `https://affiliatenest.com/ref/${req.params.link}`;
    console.log('Querying AffiliateLink for:', link);
    const affiliateLink = await AffiliateLink.findOne({ link });
    if (!affiliateLink) {
      console.log('Affiliate link not found:', link);
      return res.status(404).json({ error: 'Invalid link' });
    }
    console.log('Found affiliate link:', affiliateLink);
    const referral = new Referral({
      affiliateLinkId: affiliateLink._id,
      userId: affiliateLink.userId,
      programId: affiliateLink.programId,
    });
    console.log('Saving referral:', referral);
    await referral.save();
    console.log('Referral saved');
    res.json({ status: 'Referral tracked', redirect: 'https://affiliatenest.com/signup' });
  } catch (error) {
    console.error('Error in track endpoint:', error.message, error.stack);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

router.post('/payout', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { amount, affiliateId } = req.body;
    const user = await User.findById(affiliateId);
    if (!user.stripeAccountId) {
      return res.status(400).json({ error: 'Affiliate has no Stripe account' });
    }
    const transfer = await stripe.transfers.create({
      amount: amount * 100, // Stripe uses cents
      currency: 'usd',
      destination: user.stripeAccountId,
      description: `Affiliate commission for ${user.email}`,
    });
    res.json({ transfer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;