const router = require('express').Router();
const SportConfig = require('../models/SportConfig');
const Team = require('../models/Team');
const protect = require('../middleware/auth');

const SPORTS = [
  { name: 'Football',  icon: '⚽', description: 'Department football teams battle it out on the field in this high-energy men\'s competition.', gender: 'mens'   },
  { name: 'Cricket',   icon: '🏏', description: 'The classic bat-and-ball game — department teams compete in this prestigious men\'s cricket tournament.', gender: 'mens'   },
  { name: 'Shuttle',   icon: '🏸', description: 'Fast-paced shuttlecock rally sport — women\'s singles and doubles competition across departments.', gender: 'womens' },
  { name: 'Kho Kho',   icon: '🤼', description: 'Traditional Indian tag sport — women\'s teams sprint, dodge, and chase in this thrilling competition.', gender: 'womens' },
];

// GET /api/sports
router.get('/', async (_req, res) => {
  try {
    const configs = await SportConfig.find({});
    const closedMap = {};
    configs.forEach(c => {
      closedMap[c.sportName] = c.isClosed;
    });

    const sportsWithStats = await Promise.all(SPORTS.map(async (sport) => {
      const count = await Team.countDocuments({ selectedSports: sport.name });
      return {
        ...sport,
        registeredCount: count,
        isClosed: closedMap[sport.name] || false
      };
    }));

    res.json({
      sports: sportsWithStats,
      mens:   sportsWithStats.filter(s => s.gender === 'mens'),
      womens: sportsWithStats.filter(s => s.gender === 'womens'),
    });
  } catch (err) {
    console.error('Fetch sports error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/sports/toggle
router.post('/toggle', protect, async (req, res) => {
  if (!req.team || !req.team.isAdmin) {
    return res.status(403).json({ error: 'Access denied. Only administrators can close/open registrations.' });
  }

  const { sportName, isClosed } = req.body;
  if (!sportName) {
    return res.status(400).json({ error: 'Sport name is required.' });
  }

  try {
    const config = await SportConfig.findOneAndUpdate(
      { sportName },
      { isClosed },
      { new: true, upsert: true }
    );
    res.json({ message: `Registration for ${sportName} updated successfully.`, config });
  } catch (err) {
    console.error('Toggle sport registration error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
