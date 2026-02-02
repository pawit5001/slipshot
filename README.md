# 🧾 SlipShot - Smart Slip Management System

ระบบจัดการสลิปการเงินอัจฉริยะ ที่ดึงข้อมูลจากสลิปอัตโนมัติด้วย OCR รองรับการจัดหมวดหมู่ ติดตามรายรับ-รายจ่าย และแสดงสถิติ

## ✨ Key Features

- 📸 **Auto Slip Reading** - ดึงข้อมูลจากสลิปอัตโนมัติด้วย OCR
- 📊 **Dashboard** - สรุปรายรับ-รายจ่ายพร้อมกราฟ
- 🏷️ **Tags** - จัดหมวดหมู่รายการ
- 👑 **Admin Panel** - จัดการผู้ใช้และดูสถิติระบบ
- 🏆 **Leaderboard** - อันดับผู้ใช้งาน
- 🔐 **Auth** - ระบบล็อกอินด้วย JWT

## 🛠️ Tech Stack

| Backend | Frontend |
|---------|----------|
| Django 5.2 | Next.js 16 |
| Django REST Framework | TypeScript |
| PostgreSQL | Tailwind CSS 4 |
| OCR.space API | React |
| JWT Auth | |

---

## � Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+
- Git

---

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/slipshot.git
cd slipshot
```

### 2. Backend Setup

```bash
cd slipshot_backend

# Create Virtual Environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Start server
python manage.py runserver
```

### 3. Frontend Setup

```bash
cd slipshot-frontend

# Install Dependencies
npm install

# Configure environment
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

# Start server
npm run dev
```

### 4. Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Admin Panel**: http://localhost:8000/admin/

---

## �📁 Project Structure

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

## 📱 API Endpoints

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

## 📄 License

MIT License