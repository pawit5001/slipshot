# 🧾 SlipShot - Smart Slip Management System

An intelligent financial slip management system that automatically extracts data from slips using OCR. Supports categorization, income/expense tracking, and statistics visualization.

## ✨ Key Features

- 📸 **Auto Slip Reading** - OCR powered slip data extraction
- 📊 **Dashboard** - Income/expense summary with trend charts
- 🏷️ **Categorization** - Custom category management
- 👑 **Admin Panel** - User management and system statistics
- 🏆 **Leaderboard** - Top users ranking
- 🔐 **Authentication** - Secure JWT-based login

## 🛠️ Tech Stack

### Backend
- **Django 5.2** - Python Web Framework
- **Django REST Framework** - RESTful API
- **PostgreSQL** - Database
- **EasyOCR** - AI-based text recognition
- **JWT** - Authentication

### Frontend
- **Next.js 16** - React Framework
- **TypeScript** - Type Safety
- **Tailwind CSS 4** - Styling
- **Heroicons** - Icons

---

## 📋 Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+
- Git

---

## 🚀 Installation (Development)

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

# Copy and configure environment file
cp .env.example .env
# Edit values in .env as needed

# Run database migrations
python manage.py migrate

# Create Superuser (Admin)
python manage.py createsuperuser

# Start Development Server
python manage.py runserver
```

### 3. Frontend Setup

```bash
cd slipshot-frontend

# Install Dependencies
npm install

# Copy and configure environment file
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to point to backend

# Start Development Server
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/

---

## 🌐 Deploy to Render.com

### Backend (Web Service)

1. **Create a new Web Service**
   - Select your repository
   - Root Directory: `slipshot_backend`
   - Runtime: Python 3
   - Build Command: `./build.sh`
   - Start Command: `gunicorn slipshot_backend.wsgi:application`

2. **Set Environment Variables**
   ```
   DJANGO_SECRET_KEY=<generate-a-secure-key>
   DJANGO_DEBUG=False
   DJANGO_ALLOWED_HOSTS=.onrender.com
   FRONTEND_URL=https://your-frontend.vercel.app
   DATABASE_URL=<auto-set if using Render PostgreSQL>
   ```

3. **Create PostgreSQL Database**
   - Go to Render Dashboard > New > PostgreSQL
   - Connect to your Web Service

### Frontend (Vercel or Render)

#### On Vercel (Recommended):

1. Import Repository
2. Root Directory: `slipshot-frontend`
3. Framework Preset: Next.js
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   ```

#### On Render:

1. Create Static Site
2. Root Directory: `slipshot-frontend`
3. Build Command: `npm run build`
4. Publish Directory: `out` (requires `output: 'export'` in next.config.ts)

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
│   └── build.sh                # Render build script
│
└── slipshot-frontend/          # Next.js Frontend
    ├── src/
    │   ├── app/                # Pages (App Router)
    │   │   ├── dashboard/      # Dashboard
    │   │   ├── slip/           # Slip Management
    │   │   ├── admin/          # Admin Panel
    │   │   └── profile/        # User Profile
    │   ├── components/         # Reusable Components
    │   └── lib/                # Utilities
    ├── package.json
    └── tailwind.config.ts
```

---

## 🔐 Security Configuration

### Production Checklist

- [x] `DEBUG = False` 
- [x] `SECRET_KEY` is randomly generated and kept secret
- [x] HTTPS enforced (`SECURE_SSL_REDIRECT`)
- [x] HSTS enabled
- [x] CORS restricted to allowed domains only
- [x] Cookies set with `Secure` and `HttpOnly`
- [x] Rate Limiting enabled
- [x] JWT Tokens have limited lifetime

### Generate New Secret Key

```python
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
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
| GET | `/api/users/me/` | Get current user info |
| PUT | `/api/users/me/` | Update profile |

### Slips
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/slips/` | List all slips |
| POST | `/api/slips/` | Create new slip |
| GET | `/api/slips/{id}/` | Get slip details |
| PUT | `/api/slips/{id}/` | Update slip |
| DELETE | `/api/slips/{id}/` | Delete slip |
| POST | `/api/slips/ocr/` | Read slip with OCR |
| POST | `/api/slips/scan-qr/` | Scan QR Code |

### Tags (Categories)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags/` | List categories |
| POST | `/api/tags/` | Create category |
| PUT | `/api/tags/{id}/` | Update category |
| DELETE | `/api/tags/{id}/` | Delete category |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/` | Dashboard data |
| GET | `/api/leaderboard/` | User rankings |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats/` | System statistics |
| GET | `/api/admin/users/` | List all users |
| POST | `/api/admin/users/create/` | Create user |
| PUT | `/api/admin/users/{id}/` | Update user |
| DELETE | `/api/admin/users/{id}/delete/` | Delete user |

---

## 🐛 Troubleshooting

### OCR Not Working
- Ensure `easyocr` and all dependencies are installed
- Check if GPU is available (runs slower on CPU)

### CORS Error
- Verify `FRONTEND_URL` in environment variables
- Check `CORS_ALLOWED_ORIGINS` in settings.py

### Database Connection Error
- Verify `DATABASE_URL` or PostgreSQL settings
- Ensure PostgreSQL is running

---

## 📄 License

MIT License - Free to use