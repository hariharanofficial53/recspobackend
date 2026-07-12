const router = require('express').Router();

const SPORTS = [
  { name: 'Football',  icon: '⚽', description: 'Department football teams battle it out on the field in this high-energy men\'s competition.', gender: 'mens'   },
  { name: 'Cricket',   icon: '🏏', description: 'The classic bat-and-ball game — department teams compete in this prestigious men\'s cricket tournament.', gender: 'mens'   },
  { name: 'Shuttle',   icon: '🏸', description: 'Fast-paced shuttlecock rally sport — women\'s singles and doubles competition across departments.', gender: 'womens' },
  { name: 'Kho Kho',   icon: '🤼', description: 'Traditional Indian tag sport — women\'s teams sprint, dodge, and chase in this thrilling competition.', gender: 'womens' },
];

// GET /api/sports
router.get('/', (_req, res) => {
  res.json({
    sports: SPORTS,
    mens:   SPORTS.filter(s => s.gender === 'mens'),
    womens: SPORTS.filter(s => s.gender === 'womens'),
  });
});

module.exports = router;
