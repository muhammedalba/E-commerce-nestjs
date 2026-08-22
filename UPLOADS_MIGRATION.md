# Uploads Storage — Architecture & Migration Guide

## Architecture Overview

```
Upload Request
       ↓
FileUploadService.saveFileToDisk()
       ↓
getUploadsRoot()          ← src/shared/utils/upload-path.util.ts
       ↓
┌──────────────────────────────────────────────┐
│  Local Dev:   ./uploads  → /project/uploads  │
│  Production:  UPLOADS_ROOT env var           │
└──────────────────────────────────────────────┘
       ↓
Filesystem
       │
       ├── MongoDB stores: /uploads/Product/abc.webp   ← لا يتغير أبدًا
       │
       └── ServeStaticModule serves UPLOADS_ROOT on /uploads
```

### المبدأ الأساسي

| طبقة | القيمة | يتغير؟ |
|------|--------|--------|
| **Filesystem (Local)** | `/project/server/uploads/...` | ✅ حسب `UPLOADS_ROOT` |
| **Filesystem (Prod)** | `/home/USERNAME/uploads/...` | ✅ حسب `UPLOADS_ROOT` |
| **MongoDB** | `/uploads/Product/abc.webp` | ❌ ثابت دائمًا |
| **Public URL** | `https://domain.com/uploads/...` | ❌ ثابت دائمًا |
| **API Response** | `/uploads/...` أو `http://...` | ❌ ثابت دائمًا |

---

## 1. Local Development

لا تغيير في السلوك المحلي.

```env
# .env
UPLOADS_ROOT=./uploads
```

الملفات تُخزَّن في `server/uploads/` كما كان دائمًا.

---

## 2. Production — إعداد Hostinger

### الخطوة 1: معرفة اسم المستخدم

```bash
# عبر SSH على Hostinger
whoami
# أو
echo $HOME
```

### الخطوة 2: إنشاء مجلد uploads الدائم

```bash
mkdir -p /home/YOUR_USERNAME/uploads
```

### الخطوة 3: ضبط Environment Variable

في لوحة Hostinger → **Node.js App** → **Environment Variables**:

```
UPLOADS_ROOT=/home/YOUR_USERNAME/uploads
```

> ⚠️ استبدل `YOUR_USERNAME` بالاسم الحقيقي من الخطوة 1.
> لا تضع هذه القيمة في `.env` الذي يُرفع إلى GitHub.

### الخطوة 4: إعادة تشغيل التطبيق

من لوحة Hostinger، أعد تشغيل Node.js Application.

---

## 3. Migration للملفات الحالية (مرة واحدة)

إذا كانت هناك ملفات موجودة داخل `server/uploads/`، انقلها يدوياً:

```bash
# ── الخطوة 1: التأكد من وجود المجلد الهدف ──────────────────────────
mkdir -p /home/YOUR_USERNAME/uploads

# ── الخطوة 2: عدّ الملفات في المصدر ────────────────────────────────
SOURCE_COUNT=$(find /path/to/project/server/uploads -type f | wc -l)
echo "Source files: $SOURCE_COUNT"

# ── الخطوة 3: نسخ الملفات (مع الحفاظ على البنية) ───────────────────
# -r          = recursive
# -p          = preserve timestamps & permissions
# -v          = verbose output
# --no-clobber = لا تستبدل ملفات موجودة في الهدف
cp -rpv --no-clobber \
  /path/to/project/server/uploads/. \
  /home/YOUR_USERNAME/uploads/

# ── الخطوة 4: التحقق من عدد الملفات ────────────────────────────────
DEST_COUNT=$(find /home/YOUR_USERNAME/uploads -type f | wc -l)
echo "Destination files: $DEST_COUNT"

if [ "$SOURCE_COUNT" -eq "$DEST_COUNT" ]; then
  echo "✅ Migration successful: $SOURCE_COUNT files"
else
  echo "⚠️  Count mismatch! Source=$SOURCE_COUNT Dest=$DEST_COUNT"
  echo "    Do NOT delete source until counts match."
fi

# ── الخطوة 5: مقارنة الأحجام ────────────────────────────────────────
echo "Source total size:"; du -sh /path/to/project/server/uploads/
echo "Dest total size:";   du -sh /home/YOUR_USERNAME/uploads/
```

> 🛑 **لا تحذف المجلد المصدر** إلا بعد:
> 1. تأكيد تطابق عدد الملفات والأحجام
> 2. ضبط `UPLOADS_ROOT` وإعادة تشغيل التطبيق
> 3. التحقق أن الصور القديمة تظهر عبر `/uploads/...`
> 4. رفع صورة جديدة والتحقق أنها تُحفظ في `/home/YOUR_USERNAME/uploads/`

---

## 4. ماذا يحدث عند Redeploy؟

```
قبل التعديل:
  GitHub → Hostinger → يُنشئ project/server/uploads/ جديدة فارغة ❌

بعد التعديل:
  GitHub → Hostinger → يبني dist/ فقط
  /home/YOUR_USERNAME/uploads/ يبقى بدون تغيير ✅
```

---

## 5. Backup

```bash
# إنشاء نسخة احتياطية مضغوطة
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  /home/YOUR_USERNAME/uploads/

# نقل النسخة الاحتياطية إلى مكان آمن
# (يفضل Google Drive / S3 / Dropbox)
```

---

## 6. نقل المشروع إلى سيرفر آخر

```bash
# 1. على السيرفر القديم: إنشاء archive
tar -czf uploads_backup.tar.gz /home/OLD_USERNAME/uploads/

# 2. نقل الملف إلى السيرفر الجديد عبر scp أو rsync
scp uploads_backup.tar.gz user@new-server:/tmp/

# 3. على السيرفر الجديد: استخراج الملفات
mkdir -p /home/NEW_USERNAME/uploads
tar -xzf /tmp/uploads_backup.tar.gz -C /home/NEW_USERNAME/uploads/ --strip-components=3

# 4. ضبط UPLOADS_ROOT في المشروع الجديد
# UPLOADS_ROOT=/home/NEW_USERNAME/uploads
```

---

## 7. Path Traversal Security

`resolveToFilesystem()` في `src/shared/utils/upload-path.util.ts` توفر:

| المستوى | الحماية |
|---------|---------|
| 1 | رفض `..` في أي مكان من المسار |
| 2 | التحقق أن المسار يبدأ بـ `/uploads` |
| 3 | استخراج الجزء النسبي بطريقة آمنة |
| 4 | `path.resolve()` لحساب المسار المطلق |
| 5 | Containment check — المسار يجب أن يكون داخل `UPLOADS_ROOT` |

محاولات مثل `/uploads/../.env` أو `/etc/passwd` تُرفض تلقائياً.

---

## 8. Public URL لا يتغير

```json
// MongoDB — قبل وبعد التعديل (نفس القيم)
{ "image": "/uploads/Product/abc.webp" }
```

```
// URL الذي يستخدمه Frontend — لا يتغير
https://domain.com/uploads/Product/abc.webp
```

الـ Frontend لا يعلم شيئًا عن `/home/USERNAME/uploads/`.
