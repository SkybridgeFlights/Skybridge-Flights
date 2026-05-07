const mongoose = require('mongoose');

const BlogSeoLandingPageSchema = new mongoose.Schema(
  {
    pageType: {
      type: String,
      enum: ['route', 'travel-guide', 'service'],
      default: 'route',
      index: true,
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    path: { type: String, required: true, trim: true, unique: true },
    origin: { type: String, default: '', trim: true },
    destination: { type: String, default: '', trim: true },
    service: { type: String, default: 'flights', trim: true },
    language: { type: String, enum: ['en', 'ar', 'de'], default: 'en', index: true },
    translationGroup: { type: String, default: '', trim: true, index: true },
    canonicalUrl: { type: String, default: '', trim: true },
    hreflang: [
      {
        language: { type: String, enum: ['en', 'ar', 'de'], required: true },
        url: { type: String, required: true },
        slug: { type: String, default: '' },
      },
    ],
    metaTitle: { type: String, default: '', trim: true },
    metaDescription: { type: String, default: '', trim: true },
    keywords: { type: [String], default: [] },
    sections: [
      {
        heading: { type: String, default: '' },
        body: { type: String, default: '' },
      },
    ],
    faq: [
      {
        question: { type: String, default: '' },
        answer: { type: String, default: '' },
      },
    ],
    cta: {
      label: { type: String, default: 'Search flights with Skybridge Flights' },
      url: { type: String, default: '/flights' },
      type: { type: String, default: 'search' },
    },
    sourceNotes: { type: String, default: '' },
    image: {
      url: { type: String, default: '' },
      alt: { type: String, default: '' },
      title: { type: String, default: '' },
      provider: { type: String, default: '' },
      publicId: { type: String, default: '' },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    seoScore: { type: Number, default: 0 },
    analytics: {
      totalViews: { type: Number, default: 0 },
      ctaClicks: { type: Number, default: 0 },
      dailyViews: [
        {
          date: { type: String, default: '' },
          views: { type: Number, default: 0 },
        },
      ],
    },
    schemaMarkup: { type: mongoose.Schema.Types.Mixed, default: {} },
    linkCheck: {
      lastCheckedAt: { type: Date, default: null },
      brokenCount: { type: Number, default: 0 },
      suspectCount: { type: Number, default: 0 },
      links: [
        {
          url: { type: String, default: '' },
          status: { type: String, enum: ['ok', 'broken', 'suspect'], default: 'suspect' },
          reason: { type: String, default: '' },
        },
      ],
    },
    lastReviewedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlogSeoLandingPage', BlogSeoLandingPageSchema);
