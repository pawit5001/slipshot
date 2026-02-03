

# 🧾 SlipShot - Smart Slip Management System

SlipShot is a modern, intelligent web application for managing and extracting data from payment slips using OCR. It features powerful categorization, income/expense tracking, a statistics dashboard, and robust admin management. Built with Next.js (frontend) and Django (backend), SlipShot is designed for seamless, secure, and mobile-friendly financial management.

![Django](https://img.shields.io/badge/Django-5.2-green?style=flat-square&logo=django&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?style=flat-square&logo=postgresql&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)

---

## 📋 Table of Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Usage Guide](#-usage-guide)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## ✨ Features

### 📱 Core Features
- ✅ Upload and extract data from payment slips (OCR)
- ✅ Dashboard with income/expense summary and charts
- ✅ Categorize transactions with tags
- ✅ User authentication (JWT, httpOnly cookie)
- ✅ Admin panel for user and system management
- ✅ Leaderboard for user activity
- ✅ Responsive web design

### 🎨 UI/UX
- ✅ Modern, clean interface (Next.js + Tailwind CSS)
- ✅ Mobile-friendly layout
- ✅ Intuitive navigation and alerts
- ✅ Image gallery for slip uploads

---

## 💻 Requirements

| Item | Minimum Version |
|------|-----------------|
| Python | 3.11 or higher |
| Node.js | 20 or higher |
| PostgreSQL | 14 or higher |
| Git | Any |

---


## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/pawit5001/slipshot.git
cd slipshot
```

### 2. Backend Setup (Django)
```bash
cd slipshot_backend
python -m venv venv
# Activate (Windows)
.\venv\Scripts\activate
# Activate (macOS/Linux)
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database, secret key, and OCR settings
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 3. Frontend Setup (Next.js)
```bash
cd slipshot-frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000 (or your backend URL)
npm run dev
```

### 4. Access the App
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/
- Admin Panel: http://localhost:8000/admin/

---

## ☁️ Deployment

SlipShot is production-ready and can be deployed on Vercel (frontend) and Render, Heroku, or any cloud provider (backend).

**Frontend (Vercel):**
- Connect your GitHub repo to Vercel
- Set `NEXT_PUBLIC_API_URL` in Vercel project settings to your backend URL
- Deploy!

**Backend (Render/Heroku):**
- Add your environment variables (.env)
- Set up PostgreSQL database
- Deploy using Render/Heroku dashboard or CLI

---

## 🌍 Environment Variables

**Backend (.env):**
- `SECRET_KEY`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `OCR_API_KEY`, etc.

**Frontend (.env.local):**
- `NEXT_PUBLIC_API_URL=http://localhost:8000` (or your deployed backend URL)

---

---


## 📖 Usage Guide

1. Register or log in to your account
2. Upload payment slip images on the Slip page
3. Review and edit extracted slip data
4. Categorize slips with tags
5. View statistics and charts on the Dashboard
6. Manage users and view system stats in the Admin Panel (admin only)

---

---


## 📁 Project Structure

```
slipshot/
├── slipshot_backend/           # Django Backend
│   ├── slips/                  # Main App
│   │   ├── models.py           # Database Models
│   │   ├── views.py            # API Views
│   │   ├── admin_views.py      # Admin API Views
│   │   ├── serializers.py      # DRF Serializers
│   │   └── urls.py             # URL Routes
│   ├── slipshot_backend/       # Django Settings
│   ├── manage.py
│   ├── requirements.txt
│   └── build.sh                # Build script
│
└── slipshot-frontend/          # Next.js Frontend
    ├── src/
    │   ├── app/                # Pages (App Router)
    │   ├── components/         # Reusable Components
    │   ├── context/            # React Context
    │   └── lib/                # Utilities
    └── package.json
```

---


## 📱 API Endpoints (Selected)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/token/cookie/` | Login |
| POST | `/api/auth/token/refresh/` | Refresh Token |
| POST | `/api/auth/logout/` | Logout |
| POST | `/api/register/` | Register |
| POST | `/api/auth/change_password/` | Change Password |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me/` | Get current user |
| PUT | `/api/users/me/` | Update profile |

### Slips
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/slips/` | List slips |
| POST | `/api/slips/` | Create slip |
| GET | `/api/slips/{id}/` | Get slip |
| PUT | `/api/slips/{id}/` | Update slip |
| DELETE | `/api/slips/{id}/` | Delete slip |
| POST | `/api/slips/ocr/` | OCR read slip |

### Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags/` | List tags |
| POST | `/api/tags/` | Create tag |
| PUT | `/api/tags/{id}/` | Update tag |
| DELETE | `/api/tags/{id}/` | Delete tag |

### Dashboard & Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/` | Dashboard data |
| GET | `/api/leaderboard/` | Leaderboard |
| GET | `/api/admin/stats/` | Admin statistics |
| GET | `/api/admin/users/` | List users |

---


## 🔧 Troubleshooting & FAQ

### ❌ Backend won't start
- Ensure PostgreSQL is running and .env is configured correctly
- Check Python and package versions

### ❌ CORS or API errors
- Verify NEXT_PUBLIC_API_URL in frontend .env.local
- Check CORS_ALLOWED_ORIGINS in Django settings

### ❌ OCR not working
- Check OCR.space API key and network connection

---


---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

MIT License - Free to use and modify
