const router = require('express').Router();
const path = require('path');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Team = require('../models/Team');
const protect = require('../middleware/auth');

// ─── Multer config for logo uploads ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, SVG images are allowed.'));
  },
});

const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Ownership guard ──────────────────────────────────────────────────────────
const ownsTeam = (req, res, next) => {
  if (req.team && req.team.isAdmin) {
    return next();
  }
  if (req.team._id.toString() !== req.params.id) {
    return res.status(403).json({ error: 'Access denied. You can only manage your own team.' });
  }
  next();
};

// ─── GET /api/teams (Admin overview) ──────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const teams = await Team.find({}).sort({ createdAt: -1 });
    res.json({ teams });
  } catch (err) {
    console.error('Fetch teams error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── GET /api/teams/verify/:code (Verify registration pass code) ───────────────
router.get('/verify/:code', protect, async (req, res) => {
  try {
    const team = await Team.findOne({ registrationCode: req.params.code });
    if (!team) return res.status(404).json({ error: 'Invalid pass code.' });
    res.json({ team });
  } catch (err) {
    console.error('Verify pass code error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── GET /api/teams/:id ───────────────────────────────────────────────────────
router.get('/:id', protect, ownsTeam, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── PUT /api/teams/:id ───────────────────────────────────────────────────────
router.put(
  '/:id',
  protect,
  ownsTeam,
  [
    body('teamName').optional().trim().notEmpty(),
    body('leaderName').optional().trim().notEmpty(),
    body('leaderPhone').optional().trim().notEmpty(),
    body('selectedSports').optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const allowed = ['teamName', 'leaderName', 'leaderPhone', 'selectedSports', 'status'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    try {
      // Prevent duplicate team name
      if (updates.teamName) {
        const dup = await Team.findOne({ teamName: updates.teamName, _id: { $ne: req.params.id } });
        if (dup) return res.status(409).json({ error: 'Another team with this name already exists.' });
      }

      const team = await Team.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
      if (!team) return res.status(404).json({ error: 'Team not found.' });
      res.json({ message: 'Team updated successfully.', team });
    } catch (err) {
      console.error('Update team error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// ─── POST /api/teams/:id/logo ─────────────────────────────────────────────────
router.post('/:id/logo', protect, ownsTeam, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'rec_trophy_logos',
    });

    try {
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
    } catch (fsErr) {
      console.error('Error deleting temp file:', fsErr);
    }

    const logoUrl = result.secure_url;
    const team = await Team.findByIdAndUpdate(req.params.id, { teamLogo: logoUrl }, { new: true });
    res.json({ message: 'Logo uploaded to Cloudinary successfully.', logoUrl, team });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: 'Cloudinary upload failed.' });
  }
});

// ─── POST /api/teams/:id/payment ──────────────────────────────────────────────
router.post('/:id/payment', protect, ownsTeam, upload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No screenshot file uploaded.' });

  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'rec_trophy_payments',
    });

    try {
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
    } catch (fsErr) {
      console.error('Error deleting temp file:', fsErr);
    }

    const screenshotUrl = result.secure_url;
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { paymentScreenshot: screenshotUrl, paymentStatus: 'pending_approval' },
      { new: true }
    );
    res.json({ message: 'Payment screenshot uploaded successfully.', screenshotUrl, team });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: 'Cloudinary upload failed.' });
  }
});

// ─── POST /api/teams/:id/approve (Simulated Admin Approval) ──────────────────────
router.post('/:id/approve', protect, async (req, res) => {
  try {
    // Generate a random 6-digit code
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { status: 'active', paymentStatus: 'approved', registrationCode: randomCode },
      { new: true }
    );

    if (!team) return res.status(404).json({ error: 'Team not found.' });
    res.json({ message: 'Team registration approved successfully.', team });
  } catch (err) {
    console.error('Approve team error:', err);
    res.status(500).json({ error: 'Server error during approval.' });
  }
});

// ─── POST /api/teams/:id/reject (Simulated Admin Rejection) ──────────────────────
router.post('/:id/reject', protect, async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { status: 'pending', paymentStatus: 'rejected' },
      { new: true }
    );
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    res.json({ message: 'Team registration rejected successfully.', team });
  } catch (err) {
    console.error('Reject team error:', err);
    res.status(500).json({ error: 'Server error during rejection.' });
  }
});

module.exports = router;
