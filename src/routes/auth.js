const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Team = require('../models/Team');
const protect = require('../middleware/auth');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('teamName').trim().notEmpty().withMessage('Team name is required'),
    body('leaderName').trim().notEmpty().withMessage('Leader name is required'),
    body('leaderEmail')
      .isEmail().withMessage('Valid email is required')
      .custom((value) => {
        if (!value.toLowerCase().endsWith('@rajalakshmi.edu.in')) {
          throw new Error('Only official @rajalakshmi.edu.in emails are allowed.');
        }
        return true;
      }),
    body('leaderPhone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('selectedSports')
      .isArray({ min: 1, max: 2 })
      .withMessage('You can register for a minimum of 1 and maximum of 2 sports.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teamName, leaderName, leaderEmail, leaderPhone, selectedSports, password } = req.body;

    try {
      // Check duplicate email or team name
      const existing = await Team.findOne({
        $or: [{ leaderEmail: leaderEmail.toLowerCase() }, { teamName }],
      });
      if (existing) {
        const field = existing.leaderEmail === leaderEmail.toLowerCase() ? 'email' : 'team name';
        return res.status(409).json({ error: `A team with this ${field} already exists.` });
      }

      const team = await Team.create({
        teamName,
        leaderName,
        leaderEmail,
        leaderPhone,
        selectedSports,
        passwordHash: password, // pre-save hook will hash it
        status: 'pending',
      });

      const token = signToken(team._id);

      res.status(201).json({
        message: 'Team registered successfully!',
        token,
        team,
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error during registration.' });
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('leaderEmail').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { leaderEmail, password } = req.body;

    try {
      // Manually select passwordHash (excluded by toJSON)
      const team = await Team.findOne({ leaderEmail: leaderEmail.toLowerCase() }).select('+passwordHash');
      if (!team) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await team.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = signToken(team._id);

      res.json({
        message: 'Login successful.',
        token,
        team,
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error during login.' });
    }
  }
);

// ─── POST /api/auth/admin-login ───────────────────────────────────────────────
router.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter both username and password' });
  }

  const normalizedUser = username.trim().toLowerCase();
  const normalizedPass = password.trim();

  if (normalizedUser === 'admin' && normalizedPass === 'admin') {
    const token = jwt.sign(
      { id: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
    return res.json({
      message: 'Admin login successful.',
      token,
      admin: { username: 'admin' }
    });
  } else {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => {
  res.json({ team: req.team });
});

module.exports = router;
