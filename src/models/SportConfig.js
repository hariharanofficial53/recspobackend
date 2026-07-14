const mongoose = require('mongoose');

const SportConfigSchema = new mongoose.Schema({
  sportName: { type: String, required: true, unique: true, trim: true },
  isClosed:  { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('SportConfig', SportConfigSchema);
