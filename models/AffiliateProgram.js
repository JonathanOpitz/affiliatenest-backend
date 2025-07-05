// models/AffiliateProgram.js
const mongoose = require('mongoose');

const affiliateProgramSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  commissionRate: { type: Number, required: true, min: 0, max: 100 },
  widgetStyles: {
    backgroundColor: { type: String, default: '#ffffff' },
    textColor: { type: String, default: '#000000' },
    buttonColor: { type: String, default: '#2563eb' },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AffiliateProgram', affiliateProgramSchema);