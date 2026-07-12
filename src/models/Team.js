const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TeamMemberSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  year:   { type: String, required: true, trim: true },   // e.g. "3rd Year"
  number: { type: String, required: true, trim: true },   // jersey / contact
}, { _id: true, timestamps: false });

const TeamSchema = new mongoose.Schema({
  teamName:          { type: String, required: true, unique: true, trim: true },
  leaderName:        { type: String, required: true, trim: true },
  leaderEmail:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  leaderPhone:       { type: String, required: true, trim: true },
  teamLogo:          { type: String, default: '' },          // filename stored in /uploads
  selectedSports:    { type: [String], default: [] },        // e.g. ['Football', 'Cricket']
  status:            { type: String, enum: ['pending', 'active'], default: 'pending' },
  passwordHash:      { type: String, required: true },
  paymentScreenshot: { type: String, default: '' },
  paymentStatus:     { type: String, enum: ['unpaid', 'pending_approval', 'approved', 'rejected'], default: 'unpaid' },
  registrationCode:  { type: String, default: '' },
  members:           { type: [TeamMemberSchema], default: [] },
}, { timestamps: true });

// Hash password before saving
TeamSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Compare plain password with stored hash
TeamSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never send passwordHash in JSON responses
TeamSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('Team', TeamSchema);
