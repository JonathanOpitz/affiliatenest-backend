// models/AffiliateLink.js
const mongoose = require('mongoose');

const affiliateLinkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateProgram', required: true },
  link: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AffiliateLink', affiliateLinkSchema);