// Backend/models/Setting.js
const mongoose = require('mongoose');

/* ======================= Booking ======================= */
const bookingSchema = new mongoose.Schema({
  allowCancellation:      { type: Boolean, default: true },
  cancellationHoursLimit: { type: Number,  default: 24 },
  cancellationPolicyText: { type: String,  default: '' },

  allowRefunds:           { type: Boolean, default: false },
  refundHoursLimit:       { type: Number,  default: 72 },
}, { _id: false });

/* ======================= Payment (بوابات الدفع) ======================= */
/**
 * يضم:
 * - stripe (بطاقات) + applePay (toggle)
 * - paypal
 * - wallet (تفعيل/تعطيل خيار المحفظة)
 * - bank (تعليمات عامة)
 * - customProviders (manual/redirect) تُدار بالكامل من الواجهة
 *   - manual: تعليمات يدويّة (إيداع/تحويل..)
 *   - redirect: مزوّد خارجي بصفحة دفع (رابط بدء + webhookSecret)
 */

const customProviderSchema = new mongoose.Schema({
  key:           { type: String, required: true }, // معرف داخلي فريد مثل: "mybank" أو "tap"
  label:         { type: String, required: true }, // الاسم الظاهر
  type:          { type: String, enum: ['manual','redirect'], required: true },
  enabled:       { type: Boolean, default: false },
  // manual:
  instructions:  { type: String, default: '' },    // نص تعليمات الدفع (يظهر للعميل)
  // redirect:
  redirectUrl:   { type: String, default: '' },    // رابط بدء الدفع لدى المزود
  webhookSecret: { type: String, default: '' },    // سر الويبهوك (لا يُعرض للعامة)
  feePercent:    { type: Number, default: 0 },     // معلومة للعرض فقط
  notes:         { type: String, default: '' },    // ملاحظات داخلية
}, { _id: true });

const paymentSchema = new mongoose.Schema({
  defaultCurrency: { type: String, default: 'USD' },

  stripe: {
    enabled:        { type: Boolean, default: false },
    publishableKey: { type: String,  default: '' },
    secretKey:      { type: String,  default: '' },
    webhookSecret:  { type: String,  default: '' },
  },

  applePay: {
    enabled:  { type: Boolean, default: false }, // يتطلب Stripe + domain verification
  },

  paypal: {
    enabled:      { type: Boolean, default: false },
    clientId:     { type: String,  default: '' },
    clientSecret: { type: String,  default: '' },
    mode:         { type: String,  default: 'sandbox' }, // production
  },

  wallet: {
    enabled: { type: Boolean, default: false },
  },

  bank: {
    enabled:        { type: Boolean, default: false },
    instructions:   { type: String,  default: '' },
    accountName:    { type: String,  default: '' },
    accountNumber:  { type: String,  default: '' },
    iban:           { type: String,  default: '' },
    swift:          { type: String,  default: '' },
    branch:         { type: String,  default: '' },
  },

  // ✅ مزوّدات مخصّصة
  customProviders: { type: [customProviderSchema], default: [] },

}, { _id: false });

/* ======================= Payments Extra (بنوك/مكاتب يدوي) ======================= */
const BankAccountSchema = new mongoose.Schema({
  bankName:      { type: String, default: '' },
  accountName:   { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  iban:          { type: String, default: '' },
  swift:         { type: String, default: '' },
  branch:        { type: String, default: '' },
  instructions:  { type: String, default: '' },
}, { _id: true });

const RemittanceOfficeSchema = new mongoose.Schema({
  officeName:   { type: String, default: '' },
  country:      { type: String, default: '' },
  city:         { type: String, default: '' },
  contact:      { type: String, default: '' },
  instructions: { type: String, default: '' },
}, { _id: true });

const PaymentsExtraSchema = new mongoose.Schema({
  bankAccounts:      { type: [BankAccountSchema],      default: [] },
  remittanceOffices: { type: [RemittanceOfficeSchema], default: [] },
}, { _id: false });

/* ======================= Visa Catalog ======================= */
const reqDocSchema = new mongoose.Schema({
  key:    String,
  label:  String,
  accept: { type: String, default: '.pdf,.jpg,.jpeg,.png' },
  min:    { type: Number, default: 1 },
  max:    { type: Number, default: 1 },
}, { _id: false });

const visaTypeSchema = new mongoose.Schema({
  key:         String,
  label:       String,
  enabled:     { type: Boolean, default: true },
  defaultFee:  {
    amount:   { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  fees:        [{ nationality:String, amount:Number, currency:{ type:String, default:'USD' } }],
  requiredDocs:[reqDocSchema],
  notes:       { type: String, default: '' },
}, { _id: false });

const visaCountrySchema = new mongoose.Schema({
  name:   String,
  enabled:{ type: Boolean, default: true },
  types:  [visaTypeSchema],
}, { _id: false });

/* ======================= Root ======================= */
const settingSchema = new mongoose.Schema({
  // توافق قديم
  allowCancellation:      { type: Boolean, default: undefined },
  cancellationHoursLimit: { type: Number,  default: undefined },

  booking:        { type: bookingSchema,        default: () => ({}) },
  payment:        { type: paymentSchema,        default: () => ({}) },
  visaCatalog:    { type: [visaCountrySchema],  default: [] },

  // ✅ مكان تخزين حسابات البنوك ومكاتب التحويل اليدوية
  paymentsExtra:  { type: PaymentsExtraSchema,  default: () => ({}) },
}, { timestamps: true });

/* ======================= Instance Helpers ======================= */
/**
 * تُحوّل إعدادات الدفع لصيغة عامة آمنة للعَرض للعملاء (بدون أسرار).
 */
settingSchema.methods.toPublicPaymentJSON = function () {
  const pay = this.payment || {};
  const defCur = pay.defaultCurrency || 'USD';

  const custom = Array.isArray(pay.customProviders) ? pay.customProviders : [];
  const customPublic = custom
    .filter(p => p && p.enabled)
    .map(p => ({
      key: p.key,
      label: p.label,
      type: p.type,
      enabled: true,
      // لا نُرجِع مفاتيح حساسة:
      redirectUrl: p.type === 'redirect' ? p.redirectUrl : '',
      instructions: p.type === 'manual' ? (p.instructions || '') : '',
      feePercent: typeof p.feePercent === 'number' ? p.feePercent : 0,
      notes: p.notes || '', // ملاحظة: ملاحظات عامة يمكن عرضها، احذفها إن أردت إخفاءها
    }));

  return {
    defaultCurrency: defCur,
    stripe:   { enabled: !!pay?.stripe?.enabled },
    paypal:   { enabled: !!pay?.paypal?.enabled },
    bank:     {
      enabled: !!pay?.bank?.enabled,
      // يُمكن إظهار تعليمات عامة للعميل مباشرةً
      instructions: pay?.bank?.instructions || '',
    },
    wallet:   { enabled: !!pay?.wallet?.enabled },
    applePay: { enabled: !!pay?.applePay?.enabled },
    customProviders: customPublic,
    // (اختياري) إرفاق PaymentsExtra للعَرض (تعليمات تفصيلية)
    paymentsExtra: {
      bankAccounts: (this.paymentsExtra?.bankAccounts || []).map(b => ({
        _id: String(b._id || ''),
        bankName: b.bankName || '',
        accountName: b.accountName || '',
        accountNumber: b.accountNumber || '',
        iban: b.iban || '',
        swift: b.swift || '',
        branch: b.branch || '',
        instructions: b.instructions || '',
      })),
      remittanceOffices: (this.paymentsExtra?.remittanceOffices || []).map(o => ({
        _id: String(o._id || ''),
        officeName: o.officeName || '',
        country: o.country || '',
        city: o.city || '',
        contact: o.contact || '',
        instructions: o.instructions || '',
      })),
    },
  };
};

/* ======================= Statics ======================= */
/**
 * Bootstrap + ترحيل/ملء من ENV عند أول تحميل.
 */
settingSchema.statics.loadOrBootstrap = async function () {
  let s = await this.findOne();
  if (!s) s = await this.create({});

  // ترحيل الحقول القديمة إلى booking
  if (s.allowCancellation !== undefined && s.booking.allowCancellation === undefined) {
    s.booking.allowCancellation = !!s.allowCancellation;
  }
  if (s.cancellationHoursLimit !== undefined && s.booking.cancellationHoursLimit === undefined) {
    s.booking.cancellationHoursLimit = Number(s.cancellationHoursLimit) || 24;
  }

  // تعبئة مفاتيح الدفع من .env عند فقدها
  const envStripe = {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    secretKey:      process.env.STRIPE_SECRET_KEY      || '',
    webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET  || '',
  };
  const envPaypal = {
    clientId:     process.env.PAYPAL_CLIENT_ID     || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode:         process.env.PAYPAL_MODE          || 'sandbox',
  };
  const envBank = {
    accountName:   process.env.BANK_ACCOUNT_NAME   || '',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '',
    iban:          process.env.BANK_IBAN           || '',
    swift:         process.env.BANK_SWIFT          || '',
    branch:        process.env.BANK_BRANCH         || '',
  };

  if (!s.payment) s.payment = {};
  if (!s.payment.defaultCurrency) s.payment.defaultCurrency = 'USD';

  s.payment.stripe = {
    ...(s.payment.stripe || {}),
    publishableKey: s.payment?.stripe?.publishableKey || envStripe.publishableKey,
    secretKey:      s.payment?.stripe?.secretKey      || envStripe.secretKey,
    webhookSecret:  s.payment?.stripe?.webhookSecret  || envStripe.webhookSecret,
    enabled:        s.payment?.stripe?.enabled ?? false,
  };

  s.payment.applePay = {
    ...(s.payment.applePay || {}),
    enabled: s.payment?.applePay?.enabled ?? false,
  };

  s.payment.paypal = {
    ...(s.payment.paypal || {}),
    clientId:     s.payment?.paypal?.clientId     || envPaypal.clientId,
    clientSecret: s.payment?.paypal?.clientSecret || envPaypal.clientSecret,
    mode:         s.payment?.paypal?.mode         || envPaypal.mode,
    enabled:      s.payment?.paypal?.enabled ?? false,
  };

  s.payment.wallet = {
    ...(s.payment.wallet || {}),
    enabled: s.payment?.wallet?.enabled ?? false,
  };

  s.payment.bank = {
    ...(s.payment.bank || {}),
    accountName:   s.payment?.bank?.accountName   || envBank.accountName,
    accountNumber: s.payment?.bank?.accountNumber || envBank.accountNumber,
    iban:          s.payment?.bank?.iban          || envBank.iban,
    swift:         s.payment?.bank?.swift         || envBank.swift,
    branch:        s.payment?.bank?.branch        || envBank.branch,
    instructions:  s.payment?.bank?.instructions  || '',
    enabled:       s.payment?.bank?.enabled ?? false,
  };

  // تأكد من وجود مصفوفة customProviders
  if (!Array.isArray(s.payment.customProviders)) s.payment.customProviders = [];

  // PaymentsExtra guard
  if (!s.paymentsExtra) s.paymentsExtra = { bankAccounts: [], remittanceOffices: [] };
  if (!Array.isArray(s.paymentsExtra.bankAccounts)) s.paymentsExtra.bankAccounts = [];
  if (!Array.isArray(s.paymentsExtra.remittanceOffices)) s.paymentsExtra.remittanceOffices = [];

  await s.save();
  return s;
};

/**
 * إرجاع إعدادات الدفع بصيغة عامة آمنة (للاستخدام في الراوت: GET /api/settings/payment/public)
 */
settingSchema.statics.getPublicPaymentSettings = async function () {
  const s = await this.loadOrBootstrap();
  return s.toPublicPaymentJSON();
};

/**
 * دمج باتش (PUT /api/settings/payment) بأمان داخل كائن payment القائم.
 * تعطيك كائنًا جديدًا مدمجًا دون فقدان الحقول الداخلية.
 */
settingSchema.statics.mergePaymentPatch = function (currentPayment, patch) {
  const cur = currentPayment || {};
  const p   = patch || {};

  // حافظ على defaultCurrency
  const defaultCurrency = typeof p.defaultCurrency === 'string' && p.defaultCurrency.trim()
    ? p.defaultCurrency.trim().toUpperCase()
    : (cur.defaultCurrency || 'USD');

  // دمج stripe
  const stripe = {
    enabled:        p.stripe?.enabled        ?? cur.stripe?.enabled ?? false,
    publishableKey: p.stripe?.publishableKey ?? cur.stripe?.publishableKey ?? '',
    // ⚠️ لا تفرغ المفاتيح السرية بالخطأ إن لم تُرسل
    secretKey:      p.stripe?.secretKey      ?? cur.stripe?.secretKey ?? '',
    webhookSecret:  p.stripe?.webhookSecret  ?? cur.stripe?.webhookSecret ?? '',
  };

  // applePay
  const applePay = {
    enabled: p.applePay?.enabled ?? cur.applePay?.enabled ?? false,
  };

  // paypal
  const paypal = {
    enabled:      p.paypal?.enabled      ?? cur.paypal?.enabled ?? false,
    clientId:     p.paypal?.clientId     ?? cur.paypal?.clientId ?? '',
    clientSecret: p.paypal?.clientSecret ?? cur.paypal?.clientSecret ?? '',
    mode:         p.paypal?.mode         ?? cur.paypal?.mode ?? 'sandbox',
  };

  // wallet
  const wallet = {
    enabled: p.wallet?.enabled ?? cur.wallet?.enabled ?? false,
  };

  // bank
  const bank = {
    enabled:       p.bank?.enabled       ?? cur.bank?.enabled ?? false,
    instructions:  p.bank?.instructions  ?? cur.bank?.instructions ?? '',
    accountName:   p.bank?.accountName   ?? cur.bank?.accountName ?? '',
    accountNumber: p.bank?.accountNumber ?? cur.bank?.accountNumber ?? '',
    iban:          p.bank?.iban          ?? cur.bank?.iban ?? '',
    swift:         p.bank?.swift         ?? cur.bank?.swift ?? '',
    branch:        p.bank?.branch        ?? cur.bank?.branch ?? '',
  };

  // customProviders
  let customProviders = Array.isArray(cur.customProviders) ? [...cur.customProviders] : [];
  if (Array.isArray(p.customProviders)) {
    // سياسة: إن وصلتك مصفوفة كاملة من الواجهة، اعتبرها الحالة الجديدة (CRUD كامل من الواجهة)
    customProviders = p.customProviders.map(x => ({
      _id:           x._id, // يترك mongoose يتولّى التوليد لو غير موجود
      key:           String(x.key || '').trim(),
      label:         String(x.label || '').trim(),
      type:          x.type === 'redirect' ? 'redirect' : 'manual',
      enabled:       !!x.enabled,
      instructions:  String(x.instructions || ''),
      redirectUrl:   String(x.redirectUrl || ''),
      webhookSecret: String(x.webhookSecret || ''),
      feePercent:    typeof x.feePercent === 'number' ? x.feePercent : 0,
      notes:         String(x.notes || ''),
    })).filter(cp => cp.key && cp.label);
  }

  return {
    defaultCurrency,
    stripe,
    applePay,
    paypal,
    wallet,
    bank,
    customProviders,
  };
};

/* ======================= Visa Helpers ======================= */
settingSchema.statics.resolveVisaMeta = async function ({ country, visaType, nationality }) {
  const s = await this.loadOrBootstrap();
  const c = (s.visaCatalog||[]).find(x =>
    x.enabled !== false && String(x.name||'').toLowerCase() === String(country||'').toLowerCase()
  );
  if (!c) return null;
  const t = (c.types||[]).find(tp =>
    tp.enabled !== false && String(tp.key||'').toLowerCase() === String(visaType||'').toLowerCase()
  );
  if (!t) return null;

  const natLow = String(nationality||'').toLowerCase();
  const feeNat = (t.fees||[]).find(f => String(f.nationality||'').toLowerCase() === natLow);
  const fee = feeNat
    ? { amount: feeNat.amount, currency: feeNat.currency || s.payment?.defaultCurrency || 'USD' }
    : (t.defaultFee || { amount: 0, currency: s.payment?.defaultCurrency || 'USD' });

  return {
    requiredDocs: t.requiredDocs || [],
    notes: t.notes || '',
    fee,
    maxFiles: 20,
  };
};

module.exports = mongoose.model('Setting', settingSchema);