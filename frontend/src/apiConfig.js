// src/apiConfig.js

// روابط الـ Backend
const PROD_API = 'https://skybridge-flights.onrender.com'; // Backend على Render
const CUSTOM_DOMAIN = 'https://skybridgeflights.com';      // الدومين الرسمي
const DEV_API = 'http://localhost:5000';                   // Backend محلي

/**
 * نحدد الـ API_BASE_URL حسب بيئة التشغيل:
 * 1. إذا كان متغير البيئة REACT_APP_API_URL مضبوط (مثل Vercel) -> نستخدمه.
 * 2. إذا كنا على localhost -> نستخدم DEV_API.
 * 3. إذا كان الموقع يعمل من دوميننا الرسمي -> نستخدم PROD_API.
 * 4. وإلا fallback إلى PROD_API.
 */
let API_BASE_URL;
if (process.env.REACT_APP_API_URL) {
  API_BASE_URL = process.env.REACT_APP_API_URL;
} else if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  API_BASE_URL = DEV_API;
} else if (typeof window !== 'undefined' && window.location.hostname.includes('skybridgeflights.com')) {
  API_BASE_URL = PROD_API;
} else {
  API_BASE_URL = PROD_API;
}

export { API_BASE_URL };

console.log('🔗 API_BASE_URL =', API_BASE_URL);