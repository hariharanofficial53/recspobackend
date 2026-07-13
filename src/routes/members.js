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
  body('sport').trim().notEmpty().withMessage('Sport category is required'),
];

const SPORT_LIMITS = {
  'cricket': 15,
  'football': 8,
  'kho kho': 12,
  'shuttle': 2,
  'badminton': 2,
};

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

  const { name, year, number, sport } = req.body;
  const trimmedName = name.trim();
  const trimmedNumber = number.trim();
  const trimmedSport = sport.trim();

  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    // 0. Check member limit for the selected sport category
    const sportKey = trimmedSport.toLowerCase();
    const limit = SPORT_LIMITS[sportKey];
    if (limit !== undefined) {
      const currentCount = team.members.filter(m => m.sport && m.sport.toLowerCase() === sportKey).length;
      if (currentCount >= limit) {
        return res.status(400).json({
          error: `Cannot register member. The limit for ${trimmedSport} is ${limit} members.`
        });
      }
    }

    // 1. Check duplicate name in this team for this sport
    const hasDuplicateName = team.members.some(
      (m) => m.sport && m.sport.toLowerCase() === trimmedSport.toLowerCase() && m.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (hasDuplicateName) {
      return res.status(409).json({ error: `A member with this name is already registered in your ${trimmedSport} team.` });
    }

    // 2. Check duplicate roll number globally for this sport
    const existingGlobal = await Team.findOne({
      members: {
        $elemMatch: {
          sport: { $regex: new RegExp('^' + trimmedSport.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
          number: { $regex: new RegExp('^' + trimmedNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
        }
      }
    });
    if (existingGlobal) {
      return res.status(409).json({
        error: `A member with Roll Number "${trimmedNumber}" is already registered in the ${trimmedSport} team under the department: "${existingGlobal.teamName}".`
      });
    }

    team.members.push({ name: trimmedName, year: year.trim(), number: trimmedNumber, sport: trimmedSport });
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

  const { name, year, number, sport } = req.body;
  const trimmedName = name.trim();
  const trimmedNumber = number.trim();
  const trimmedSport = sport.trim();

  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });

    const member = team.members.id(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found.' });

    // 0. Check member limit if the sport category is being changed
    if (member.sport.toLowerCase() !== trimmedSport.toLowerCase()) {
      const sportKey = trimmedSport.toLowerCase();
      const limit = SPORT_LIMITS[sportKey];
      if (limit !== undefined) {
        const currentCount = team.members.filter(m => m.sport && m.sport.toLowerCase() === sportKey).length;
        if (currentCount >= limit) {
          return res.status(400).json({
            error: `Cannot register member. The limit for ${trimmedSport} is ${limit} members.`
          });
        }
      }
    }

    // 1. Check duplicate name in this team for this sport (excluding current member)
    const hasDuplicateName = team.members.some(
      (m) => m._id.toString() !== req.params.memberId && m.sport && m.sport.toLowerCase() === trimmedSport.toLowerCase() && m.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (hasDuplicateName) {
      return res.status(409).json({ error: `Another member with this name is already registered in your ${trimmedSport} team.` });
    }

    // 2. Check duplicate roll number globally for this sport (excluding current member)
    const existingGlobal = await Team.findOne({
      members: {
        $elemMatch: {
          sport: { $regex: new RegExp('^' + trimmedSport.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
          number: { $regex: new RegExp('^' + trimmedNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
        }
      }
    });
    if (existingGlobal) {
      const duplicateMember = existingGlobal.members.find(
        (m) => m.number.toLowerCase() === trimmedNumber.toLowerCase() && m.sport && m.sport.toLowerCase() === trimmedSport.toLowerCase()
      );
      if (duplicateMember && duplicateMember._id.toString() !== req.params.memberId) {
        return res.status(409).json({
          error: `A member with Roll Number "${trimmedNumber}" is already registered in the ${trimmedSport} team under the department: "${existingGlobal.teamName}".`
        });
      }
    }

    member.name = trimmedName;
    member.year = year.trim();
    member.number = trimmedNumber;
    member.sport = trimmedSport;
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
