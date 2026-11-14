# GeoAlarm – Location-Based Smart Alarm Web Application

GeoAlarm is a modern, responsive full-stack MERN application that allows travellers, commuters, and road-trippers to set alarms based on **geographical location** rather than time.

Traditional alarms wake you at a fixed clock time—even if your bus is delayed by traffic or your train arrives ahead of schedule. GeoAlarm continuously monitors your physical GPS position in the foreground and sounds an alarm when you arrive within your chosen destination radius.

---

## 🚀 Key Features

- **Interactive Leaflet & OpenStreetMap**: Pinpoint any destination across the globe by clicking, dragging pins, or searching addresses without paid Google Maps APIs.
- **Instant Address Geocoding**: Search landmarks, bus stands, and railway stations using free OpenStreetMap Nominatim forward & reverse geocoding.
- **Accurate Haversine Geofencing**: Computes geodesic distances with millisecond precision to trigger alerts the moment you enter the radius ($500\text{m}, 1\text{km}, 2\text{km}, 5\text{km}$).
- **Web Audio Synthesizer Alarm**: Reliable, in-browser synthesized double-chime buzzer that never fails due to missing audio assets.
- **System Web Notifications API**: Dispatches desktop and mobile browser notifications when approaching your stop.
- **Duplicate Alert Suppression**: Built-in guard ensures you are alerted once per arrival without repeated annoying triggers.
- **Secure JWT Authentication & Multi-Tenancy**: Password encryption via `bcryptjs`, signed 7-day JWT tokens, and strict user-isolated database access.
- **Full Alarm Management**: Filter, search, edit, pause, resume, and delete saved alarms.
- **User Profile Management**: Update your display name and securely change your account password.
- **GPS Simulation Control**: Built-in simulation tool allowing travellers and developers to test arrival alerts immediately without travelling miles in real life.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 6, Tailwind CSS, React Router DOM v6, Axios, Lucide React, Leaflet, React Leaflet |
| **Backend** | Node.js, Express.js, MongoDB, Mongoose, JWT (`jsonwebtoken`), `bcryptjs`, `dotenv`, `cors` |
| **Location & Audio** | Browser Geolocation API (`watchPosition`), Web Notifications API, Web Audio API |
| **Map & Geocoding** | OpenStreetMap Tiles, Nominatim Search & Reverse Geocoding (Zero paid API keys) |

---

## 📂 Project Structure

```
GeoAlarm/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # MongoDB connection & status monitoring
│   │   ├── controllers/
│   │   │   ├── authController.js     # User registration, login, profile updates
│   │   │   └── alarmController.js    # Alarm CRUD, status toggle (pause/resume)
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js     # JWT Bearer token verification
│   │   │   ├── errorMiddleware.js    # 404 handler and centralized error handling
│   │   │   └── validationMiddleware.js # Input and coordinates validation
│   │   ├── models/
│   │   │   ├── User.js               # User schema with bcrypt password hashing
│   │   │   └── Alarm.js              # Alarm schema with coordinates, radius, status
│   │   ├── routes/
│   │   │   ├── authRoutes.js         # /api/auth endpoints
│   │   │   └── alarmRoutes.js        # /api/alarms endpoints
│   │   ├── services/
│   │   │   └── locationService.js    # Geofence evaluation helper
│   │   ├── utils/
│   │   │   ├── generateToken.js      # JWT signing helper
│   │   │   └── haversine.js          # Geodesic distance calculation
│   │   └── index.js                  # Main Express server entry point
│   ├── test-api.js                   # Automated backend test suite
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg               # GeoAlarm vector icon
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Navbar.jsx        # Responsive navigation with auth states
│   │   │   │   ├── Footer.jsx        # SaaS footer with architecture info
│   │   │   │   └── ProtectedRoute.jsx# Auth guard for private pages
│   │   │   ├── map/
│   │   │   │   └── LocationPickerMap.jsx # Interactive Leaflet map & dynamic radius
│   │   │   └── tracking/
│   │   │       ├── TrackingHud.jsx   # Live GPS telemetry, start/stop, simulation
│   │   │       └── AlarmTriggerModal.jsx # Arrival alert screen with sound & snooze
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # Global user authentication state
│   │   │   └── TrackingContext.jsx   # Foreground watchPosition & proximity engine
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx       # Hero, visual simulation, features, how it works
│   │   │   ├── LoginPage.jsx         # Sign in with validation
│   │   │   ├── RegisterPage.jsx      # Sign up with validation
│   │   │   ├── DashboardPage.jsx     # Telemetry HUD, stats, saved alarms list
│   │   │   ├── CreateAlarmPage.jsx   # Leaflet destination picker & radius selector
│   │   │   ├── MyAlarmsPage.jsx      # Filter, search, edit, pause, resume alarms
│   │   │   └── ProfilePage.jsx       # User details, name update, change password
│   │   ├── services/
│   │   │   ├── api.js                # Axios instance with JWT interceptors
│   │   │   ├── authService.js        # Client auth API methods
│   │   │   ├── alarmService.js       # Client alarm API methods
│   │   │   └── geocodingService.js   # Nominatim free search & reverse geocoding
│   │   ├── utils/
│   │   │   ├── haversine.js          # Frontend distance calculation & formatters
│   │   │   └── sound.js              # Web Audio API synthesized chimes & loops
│   │   ├── App.jsx                   # React Router route definitions
│   │   ├── main.jsx                  # React DOM root with providers
│   │   └── index.css                 # Tailwind CSS directives & custom scrollbars
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
└── README.md
```

---

## ⚙️ Prerequisites

- **Node.js**: `v18.0.0` or later (tested on `v26.13.1`)
- **npm**: `v9.0.0` or later (tested on `v11.20.0`)
- **MongoDB**: A running local instance (`mongodb://127.0.0.1:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster connection string.

---

## 🏃 Quick Start Guide

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create .env from example (or customize if needed)
cp .env.example .env

# Install backend dependencies
npm install

# Start the backend server
npm start
# or development mode with live watch:
npm run dev
```

The backend server will run on `http://localhost:5000`. You can verify it at `http://localhost:5000/api/health`.

### 2. Frontend Setup

In a new terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Create .env from example
cp .env.example .env

# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will run on `http://localhost:5173`. Open your browser and navigate to `http://localhost:5173`.

---

## 🔐 Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/geoalarm
JWT_SECRET=your_super_secret_jwt_key_here_at_least_32_characters_long
CLIENT_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 🧪 Automated Testing

GeoAlarm includes self-contained test suites covering all layers of the application:

### Run Backend REST API Tests
```bash
cd backend
node test-api.js
```
*Verifies: Health check, user registration, JWT generation, password hiding, login authentication, auth route guards, alarm CRUD, multi-tenant user isolation, pause/resume status, and Haversine math.*

### Run Step 6 Location Monitoring & Trigger Tests
```bash
cd frontend
node test-step6.cjs
```
*Verifies: Great-circle math, boundary threshold testing, simulated approach journey (highway $\rightarrow$ approach $\rightarrow$ arrival), trigger firing, duplicate alert suppression, and database completion status.*

### Run Step 7 My Alarms & Profile Tests
```bash
cd frontend
node test-step7.cjs
```
*Verifies: Display name update, password update verification, old password rejection, new password login, alarm search/filtering, full editing, and deletion.*

### Run Production Build
```bash
cd frontend
npm run build
```

---

## 🧭 Important Note on Foreground Location Tracking

- **Browser Security Policy**: Modern web browsers only grant active GPS access via `watchPosition()` while the browser tab remains open and active in the foreground.
- **Battery Optimization**: If a mobile device turns off its screen or suspends the browser tab, the browser suspends JavaScript timers to conserve battery.
- **Best Practice for Travellers**: Keep the GeoAlarm tab active on your device while in transit.
- **Future Native Architecture**: The modular architecture (`haversine.js`, `locationService.js`, and `alarmService.js`) is cleanly separated and ready to be integrated with background services in a React Native or native Android foreground service.

---

## 📄 License
This project is open-source and free for travellers worldwide.
