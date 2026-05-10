# GitHub va Vercel Deploy Qilish Yo'riqnoma

## 📋 Qadamlar

### 1️⃣ GitHub Repository Yaratish

1. [GitHub.com](https://github.com) ga kiring
2. "New repository" tugmasini bosing
3. Quyidagilarni to'ldiring:
   - **Repository name**: `code-analyzer-pro`
   - **Description**: `Professional Code Analysis System`
   - **Visibility**: Public (yoki Private)
   - **Add README**: ❌ (chunki allaqachon bor)
   - **Add .gitignore**: ❌ (chunki allaqachon bor)

4. "Create repository" tugmasini bosing

### 2️⃣ Lokal Repository ni GitHub ga ulash

```bash
# GitHub repository manzilini qo'shing (o'zingizning username bilan almashtiring)
git remote add origin https://github.com/YOUR_USERNAME/code-analyzer-pro.git

# Branch nomini main ga o'zgartiring
git branch -M main

# Kodlarni GitHub ga yuklang
git push -u origin main
```

### 3️⃣ Vercel ga Deploy Qilish

1. [Vercel.com](https://vercel.com) ga kiring
2. "Dashboard" ga kiring
3. "Add New..." → "Project" tugmasini bosing
4. GitHub ni tanlang va "Connect" bosing
5. `code-analyzer-pro` repository ni tanlang
6. "Import" tugmasini bosing

### 4️⃣ Vercel Konfiguratsiyasi

Import qilingan so'ng quyidagi sozlamalarni tekshiring:

**Framework Settings:**
- **Framework**: `Other`
- **Build Command**: (bo'sh qoldiring)
- **Output Directory**: `public`
- **Install Command**: `npm install`

**Environment Variables:**
- `JWT_SECRET`: `your_super_secret_jwt_key_change_in_production`
- `NODE_ENV`: `production`

### 5️⃣ Deploy

"Deploy" tugmasini bosing. Jarayon 2-3 daqiqa davom etadi.

## 🔗 Natijalar

Deploy tugagandan so'ba siz olasiz:
- **URL**: `https://code-analyzer-pro.vercel.app`
- **Admin Panel**: `https://code-analyzer-pro.vercel.app/admin.html`

## 🔑 Test Ma'lumotlari

- **Admin Username**: `admin`
- **Admin Password**: `admin123`

## ✅ Tekshirish

1. Asosiy sahifa yuklanishi
2. Login/Register ishlashi
3. Admin panelga kirish
4. Foydalanuvchi boshqaruvi
5. Toast notifikatsiyalar

Agar qandaydir muammo bo'lsa, Vercel dashboarddan "Logs" ni tekshiring.
