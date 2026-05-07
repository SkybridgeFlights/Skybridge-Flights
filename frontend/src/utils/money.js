// frontend/src/utils/money.js
export function fmt(amount, currency = 'EUR', locale = navigator.language || 'en-GB') {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function percent(part, total) {
  const p = Number(total) > 0 ? (Number(part || 0) / Number(total)) * 100 : 0;
  return Math.round(p);
}