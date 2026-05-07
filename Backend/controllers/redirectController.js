const ClickLog = require('../models/ClickLog');
const Provider = require('../models/Provider');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildAviasalesUrl(provider, query) {
  const {
    from = '',
    to = '',
    date = '',
    returnDate = '',
    adults = 1,
    children = 0,
    infants = 0,
    travelClass = 'Economy',
  } = query;

  const base = provider.redirectBaseUrl || 'https://aviasales.tp.st/odC0JPEc';
  const params = new URLSearchParams();

  if (from) params.set('origin', from);
  if (to) params.set('destination', to);
  if (date) params.set('departure_date', date);
  if (returnDate) params.set('return_date', returnDate);

  params.set('adults', String(toInt(adults, 1)));
  params.set('children', String(toInt(children, 0)));
  params.set('infants', String(toInt(infants, 0)));
  params.set('trip_class', String(travelClass || 'Economy'));

  if (provider.affiliateCode) {
    params.set('marker', provider.affiliateCode);
  }

  return `${base}?${params.toString()}`;
}

function buildGenericUrl(provider, query) {
  const {
    from = '',
    to = '',
    date = '',
    returnDate = '',
    adults = 1,
    children = 0,
    infants = 0,
    travelClass = 'Economy',
  } = query;

  const params = new URLSearchParams();

  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (date) params.set('date', date);
  if (returnDate) params.set('returnDate', returnDate);
  params.set('adults', String(toInt(adults, 1)));
  params.set('children', String(toInt(children, 0)));
  params.set('infants', String(toInt(infants, 0)));
  params.set('travelClass', String(travelClass || 'Economy'));

  if (provider.affiliateCode) {
    params.set('aff', provider.affiliateCode);
  }

  return `${provider.redirectBaseUrl}?${params.toString()}`;
}

function buildFinalUrl(provider, query) {
  const key = String(provider.key || '').toLowerCase();

  if (key === 'aviasales') {
    return buildAviasalesUrl(provider, query);
  }

  return buildGenericUrl(provider, query);
}

const redirectToProvider = async (req, res) => {
  try {
    const providerKey = String(req.params.provider || '').trim().toLowerCase();

    if (!providerKey) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    const provider = await Provider.findOne({
      key: providerKey,
      enabled: true,
    });

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found or disabled' });
    }

    const finalUrl = buildFinalUrl(provider, req.query || {});

    await ClickLog.create({
      providerKey: provider.key,
      providerName: provider.name,
      from: req.query.from || '',
      to: req.query.to || '',
      date: req.query.date || '',
      returnDate: req.query.returnDate || '',
      adults: toInt(req.query.adults, 1),
      children: toInt(req.query.children, 0),
      infants: toInt(req.query.infants, 0),
      travelClass: req.query.travelClass || 'Economy',
      finalUrl,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      userAgent: req.headers['user-agent'] || '',
      referrer: req.headers.referer || '',
    });

    return res.redirect(finalUrl);
  } catch (error) {
    console.error('redirectToProvider error:', error);
    return res.status(500).json({ error: 'Failed to redirect to provider' });
  }
};

const listProviders = async (_req, res) => {
  try {
    const providers = await Provider.find({ enabled: true }).sort({
      displayOrder: 1,
      createdAt: 1,
    });

    return res.json(providers);
  } catch (error) {
    console.error('listProviders error:', error);
    return res.status(500).json({ error: 'Failed to fetch providers' });
  }
};

const createProvider = async (req, res) => {
  try {
    const {
      key,
      name,
      redirectBaseUrl,
      affiliateCode = '',
      logoUrl = '',
      displayOrder = 0,
      enabled = true,
      isDefault = false,
    } = req.body || {};

    if (!key || !name || !redirectBaseUrl) {
      return res.status(400).json({
        error: 'key, name and redirectBaseUrl are required',
      });
    }

    const exists = await Provider.findOne({
      key: String(key).trim().toLowerCase(),
    });

    if (exists) {
      return res.status(409).json({ error: 'Provider key already exists' });
    }

    if (isDefault) {
      await Provider.updateMany({}, { $set: { isDefault: false } });
    }

    const provider = await Provider.create({
      key: String(key).trim().toLowerCase(),
      name: String(name).trim(),
      redirectBaseUrl: String(redirectBaseUrl).trim(),
      affiliateCode: String(affiliateCode).trim(),
      logoUrl: String(logoUrl).trim(),
      displayOrder: Number(displayOrder || 0),
      enabled: !!enabled,
      isDefault: !!isDefault,
    });

    return res.status(201).json(provider);
  } catch (error) {
    console.error('createProvider error:', error);
    return res.status(500).json({ error: 'Failed to create provider' });
  }
};

const updateProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const {
      name,
      redirectBaseUrl,
      affiliateCode,
      logoUrl,
      displayOrder,
      enabled,
      isDefault,
    } = req.body || {};

    if (name !== undefined) provider.name = String(name).trim();
    if (redirectBaseUrl !== undefined) {
      provider.redirectBaseUrl = String(redirectBaseUrl).trim();
    }
    if (affiliateCode !== undefined) {
      provider.affiliateCode = String(affiliateCode).trim();
    }
    if (logoUrl !== undefined) provider.logoUrl = String(logoUrl).trim();
    if (displayOrder !== undefined) {
      provider.displayOrder = Number(displayOrder || 0);
    }
    if (enabled !== undefined) provider.enabled = !!enabled;

    if (isDefault !== undefined) {
      if (isDefault) {
        await Provider.updateMany({}, { $set: { isDefault: false } });
      }
      provider.isDefault = !!isDefault;
    }

    await provider.save();
    return res.json(provider);
  } catch (error) {
    console.error('updateProvider error:', error);
    return res.status(500).json({ error: 'Failed to update provider' });
  }
};

const deleteProvider = async (req, res) => {
  try {
    const provider = await Provider.findByIdAndDelete(req.params.id);

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    return res.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    console.error('deleteProvider error:', error);
    return res.status(500).json({ error: 'Failed to delete provider' });
  }
};

module.exports = {
  redirectToProvider,
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
};