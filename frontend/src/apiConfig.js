// src/apiConfig.js

const LOCAL_API = 'http://localhost:5000';                      // Backend محلي
const PROD_API = 'https://skybridge-flights.onrender.com';      // Backend على Render
const CUSTOM_DOMAIN = 'https://skybridgeflights.com';           // الدومين الرسمي

// 🔁 اختيار الرابط حسب البيئة:
const isLocalhost = window.location.hostname === 'localhost';
const API_BASE_URL = isLocalhost ? LOCAL_API : PROD_API;

export { API_BASE_URL };

console.log('🔗 API_BASE_URL =', API_BASE_URL);