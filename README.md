# REC Intra College Tournament — Backend API

## Tech Stack
- **Node.js** + **Express.js**
- **MongoDB** + **Mongoose**
- **JWT** authentication
- **bcryptjs** password hashing
- **multer** for team logo uploads

## Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
Edit `.env` (already created):
```
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/rec_trophy
JWT_SECRET=rec_trophy_super_secret_key_2026
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

### 3. Start MongoDB
Make sure MongoDB is running locally (`mongod`), or use MongoDB Atlas and replace `MONGO_URI`.

### 4. Start the server
```bash
npm run dev      # with auto-reload (nodemon)
# or
npm start        # production
```

Server starts at **http://localhost:4000**

---

## API Reference

### Auth
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/auth/register` | Register new team | — |
| POST | `/api/auth/login` | Login, get JWT | — |
| GET | `/api/auth/me` | Get current team | ✅ |

### Teams
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/teams/:id` | Get team by ID | ✅ |
| PUT | `/api/teams/:id` | Update team info | ✅ |
| POST | `/api/teams/:id/logo` | Upload team logo | ✅ |

### Members
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/teams/:id/members` | List members | ✅ |
| POST | `/api/teams/:id/members` | Add member | ✅ |
| PUT | `/api/teams/:id/members/:memberId` | Edit member | ✅ |
| DELETE | `/api/teams/:id/members/:memberId` | Delete member | ✅ |

### Sports
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/sports` | List all sports | — |

### Health
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Server status |

---

## Register Request Body
```json
{
  "teamName": "Computer Science",
  "leaderName": "John Doe",
  "leaderEmail": "john@rec.ac.in",
  "leaderPhone": "9876543210",
  "password": "yourpassword",
  "selectedSports": ["Football", "Cricket"]
}
```

## Login Request Body
```json
{
  "leaderEmail": "john@rec.ac.in",
  "password": "yourpassword"
}
```

All protected routes require:
```
Authorization: Bearer <token>
```
