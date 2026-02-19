const CACHE_NAME = 'glass-pos-v1';

// الملفات التي نريد تخزينها لتعمل أوفلاين
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/firebase-config.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// حدث التثبيت: نقوم بفتح الكاش وتخزين جميع الملفات المحددة
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('تم تخزين الملفات في الكاش');
      return cache.addAll(ASSETS);
    })
  );
  // إجبار الـ Service Worker على العمل مباشرة بعد التثبيت
  self.skipWaiting();
});

// حدث التفعيل: نقوم بحذف أي نسخ كاش قديمة إذا تم تغيير رقم الإصدار
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('تم مسح الكاش القديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// حدث الطلب: استراتيجية (Cache First) مع دعم الأوفلاين
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // 1- إذا كان الملف موجوداً في الكاش، قم بإرجاعه
      if (response) {
        return response;
      }
      
      // 2- إذا لم يكن في الكاش، اطلبه من الإنترنت
      return fetch(e.request).then((networkResponse) => {
        // التحقق من صحة الاستجابة قبل إضافتها للكاش
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // حفظ نسخة من الملف الجديد في الكاش للاستخدام المستقبلي
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 3- في حال انقطاع الإنترنت والملف غير موجود بالكاش، نرجع صفحة البداية
        if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
