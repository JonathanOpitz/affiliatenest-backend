// models/Referral.js
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  affiliateLinkId: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateLink', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateProgram', required: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  commission: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Referral', referralSchema);