# نُهوض (Nuhoud) — Digital Therapeutic Platform

> منصة تأهيل رقمي لمرضى السكتة الدماغية — تتبع حركي لحظي بالذكاء الاصطناعي

## 📋 المحتويات

### 1. لوحة التحكم (Next.js Dashboard)
- **المسار:** `/` (مسار واحد فقط)
- **التقنيات:** Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Prisma, SQLite
- **الميزات:**
  - مصادقة JWT (طبيب/مريض)
  - تتبع لحظي عبر WebSocket لخادم Python
  - لوحة طبيب كاملة (قائمة مرضى، مقارنة، لوحة صدارة، مكتبة تمارين)
  - لوحة مريض (تتبع حي، أهداف، أوسمة، تتابع، ملخص أسبوعي)
  - مدرب ذكي بالذكاء الاصطناعي
  - إشعارات لحظية (SSE)
  - دعم عربي/إنجليزي كامل (RTL/LTR)
  - تصدير HL7 FHIR R4

### 2. خادم Python للذكاء الاصطناعي
- **المسار:** `mini-services/pose-server/`
- **المنفذ:** 8001
- **التقنيات:** FastAPI, WebSocket, MediaPipe Pose, OpenCV, NumPy
- **التشغيل:** `cd mini-services/pose-server && python3 daemon.py`

### 3. لعبة UE5 (Unreal Engine 5)
- **المسار:** `ue5-game/`
- **المراحل:** 3 مراحل (أساس، ألعاب وصوت، جاهزية الإنتاج)
- **التقنيات:** C++, OpenXR, Niagara, UMG, WebSocket, HTTP

## 🚀 التشغيل المحلي

### المتطلبات
- Node.js 18+ (أو Bun)
- Python 3.10+
- SQLite

### الخطوات
```bash
# 1. تثبيت الحزم
bun install

# 2. تهيئة قاعدة البيانات
bun run db:push
bun run db:generate

# 3. بذرة البيانات التجريبية
curl -X POST http://localhost:3000/api/v2/seed

# 4. تشغيل خادم Python
cd mini-services/pose-server
pip install -r requirements.txt
python3 daemon.py

# 5. تشغيل لوحة التحكم
bun run dev
```

### الحسابات التجريبية
```
doctor@nuhoud.health  / demo1234  → طبيب
layla@nuhoud.health   / demo1234  → مريض
omar@nuhoud.health    / demo1234  → مريض
```

## 🌐 النشر على Vercel

1. ارفع المشروع إلى GitHub
2. اذهب إلى [vercel.com](https://vercel.com) → Import Project
3. أضف متغيرات البيئة:
   - `DATABASE_URL` = رابط Supabase PostgreSQL
   - `NUHOUD_JWT_SECRET` = سرك الخاص
4. Deploy

## 🗄️ إعداد Supabase

1. أنشئ مشروعاً على [supabase.com](https://supabase.com)
2. احصل على Connection String (PostgreSQL)
3. حدّث `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. شغّل `bun run db:push`
5. ضع الـ Connection String في `.env` أو متغيرات Vercel

## 📁 هيكل المشروع
```
nuhoud/
├── src/                    ← لوحة التحكم (Next.js)
│   ├── app/               ← الصفحات + API routes
│   ├── components/nuhoud/  ← مكونات الواجهة
│   ├── hooks/              ← React hooks
│   └── lib/                ← مكتبات مساعدة
├── messages/               ← ملفات الترجمة (ar.json, en.json)
├── mini-services/pose-server/  ← خادم Python
├── ue5-game/              ← لعبة UE5 (C++)
├── prisma/                ← قاعدة البيانات
└── scripts/               ← سكربتات مساعدة
```

## 📄 الترخيص
© 2026 نُهوض. جميع الحقوق محفوظة.
