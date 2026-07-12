const router = require('express').Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const Team = require('../models/Team');
const protect = require('../middleware/auth');

// Ownership guard — teams can only manage their own members
const ownsTeam = (req, res, next) => {
  if (req.team._id.toString() !== req.params.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
};

const memberValidation = [
  body('name').trim().notEmpty().withMessage('Member name is required'),
  body('year').trim().notEmpty().withMessage('Academic year is required'),
  body('number').trim().notEmpty().withMessage('Jersey / contact number is required'),
];

// ─── GET /api/teams/:id/members ───────────────────────────────────────────────
router.get('/', protect, ownsTeam, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    res.json({ members: team.members });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── POST /api/teams/:id/members ──────────────────────────────────────────────
router.post('/', protect, ownsTeam, memberValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, year, number } = req.body;
  const trimmedName = name.trim();
  const trimmedNumber = number.trim();

  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    // 1. Check duplicate name in this team
    const hasDuplicateName = team.members.some(
      (m) => m.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (hasDuplicateName) {
      return res.status(409).json({ error: 'A member with this name is already registered in your team.' });
    }

    // 2. Check duplicate roll number globally
    const existingGlobal = await Team.findOne({
      'members.number': { $regex: new RegExp('^' + trimmedNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
    });
    if (existingGlobal) {
      return res.status(409).json({
        error: `A member with Roll Number "${trimmedNumber}" is already registered under the team: "${existingGlobal.teamName}".`
      });
    }

    team.members.push({ name: trimmedName, year: year.trim(), number: trimmedNumber });
    await team.save();

    const savedMember = team.members[team.members.length - 1];

    res.status(201).json({ message: 'Member added.', member: savedMember, members: team.members });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── PUT /api/teams/:id/members/:memberId ─────────────────────────────────────
router.put('/:memberId', protect, ownsTeam, memberValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, year, number } = req.body;
  const trimmedName = name.trim();
  const trimmedNumber = number.trim();

  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const member = team.members.id(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found.' });

    // 1. Check duplicate name in this team (excluding current member)
    const hasDuplicateName = team.members.some(
      (m) => m._id.toString() !== req.params.memberId && m.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (hasDuplicateName) {
      return res.status(409).json({ error: 'Another member with this name is already registered in your team.' });
    }

    // 2. Check duplicate roll number globally (excluding current member)
    const existingGlobal = await Team.findOne({
      'members.number': { $regex: new RegExp('^' + trimmedNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
    });
    if (existingGlobal) {
      const duplicateMember = existingGlobal.members.find(
        (m) => m.number.toLowerCase() === trimmedNumber.toLowerCase()
      );
      if (duplicateMember && duplicateMember._id.toString() !== req.params.memberId) {
        return res.status(409).json({
          error: `A member with Roll Number "${trimmedNumber}" is already registered under the team: "${existingGlobal.teamName}".`
        });
      }
    }

    member.name = trimmedName;
    member.year = year.trim();
    member.number = trimmedNumber;
    await team.save();

    res.json({ message: 'Member updated.', member, members: team.members });
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── DELETE /api/teams/:id/members/:memberId ──────────────────────────────────
router.delete('/:memberId', protect, ownsTeam, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const memberIndex = team.members.findIndex(
      (m) => m._id.toString() === req.params.memberId
    );
    if (memberIndex === -1) return res.status(404).json({ error: 'Member not found.' });

    team.members.splice(memberIndex, 1);
    await team.save();

    res.json({ message: 'Member removed.', members: team.members });
  } catch (err) {
    console.error('Delete member error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
