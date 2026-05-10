// frontend/src/apiConfig.js
const LOCAL_API = 'http://localhost:5000';
const PROD_API = 'https://skybridge-flights-production.up.railway.app';

const isLocalhost = window.location.hostname === 'localhost';
const API_BASE_URL = isLocalhost ? LOCAL_API : PROD_API;

export { API_BASE_URL };

console.log('🔗 API_BASE_URL =', API_BASE_URL);