const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema(
  {
    totalViews: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    totalReadTimeSeconds: { type: Number, default: 0 },
    averageReadTimeSeconds: { type: Number, default: 0 },
    ctaClicks: { type: Number, default: 0 },
    bookingClicks: { type: Number, default: 0 },
    contactClicks: { type: Number, default: 0 },
    whatsappClicks: { type: Number, default: 0 },
    languageViews: { type: Map, of: Number, default: {} },
    dailyViews: [
      {
        date: { type: String, required: true },
        views: { type: Number, default: 0 },
        uniqueVisitors: { type: Number, default: 0 },
      },
    ],
    referrers: [
      {
        source: { type: String, default: '' },
        count: { type: Number, default: 0 },
      },
    ],
    countries: [
      {
        country: { type: String, default: '' },
        count: { type: Number, default: 0 },
      },
    ],
  },
  { _id: false }
);

const BlogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, index: true },
    excerpt: { type: String, default: '', trim: true },
    content: { type: String, default: '' },

    coverImage: { type: String, default: '', trim: true },
    featuredImage: { type: String, default: '', trim: true },
    imageAltText: { type: String, default: '', trim: true },
    imagePrompt: { type: String, default: '', trim: true },

    language: {
      type: String,
      enum: ['en', 'ar', 'de'],
      default: 'en',
      index: true,
    },

    translationGroup: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    tags: { type: [String], default: [] },
    category: { type: String, default: 'travel', trim: true, index: true },
    keywords: { type: [String], default: [] },

    metaTitle: { type: String, default: '', trim: true },
    metaDescription: { type: String, default: '', trim: true },
    seoTitle: { type: String, default: '', trim: true },
    seoDescription: { type: String, default: '', trim: true },
    canonicalUrl: { type: String, default: '', trim: true },
    hreflang: [
      {
        language: { type: String, enum: ['en', 'ar', 'de'], required: true },
        url: { type: String, required: true },
        slug: { type: String, default: '' },
      },
    ],
    faq: [
      {
        question: { type: String, default: '' },
        answer: { type: String, default: '' },
      },
    ],
    schemaMarkup: { type: mongoose.Schema.Types.Mixed, default: {} },
    seoVersions: [
      {
        changedAt: { type: Date, default: Date.now },
        reason: { type: String, default: '' },
        oldMetaTitle: { type: String, default: '' },
        oldMetaDescription: { type: String, default: '' },
        newMetaTitle: { type: String, default: '' },
        newMetaDescription: { type: String, default: '' },
        applied: { type: Boolean, default: false },
      },
    ],
    internalLinks: [
      {
        label: { type: String, default: '' },
        url: { type: String, default: '' },
      },
    ],
    insertedLinksReport: [
      {
        anchor: { type: String, default: '' },
        url: { type: String, default: '' },
        insertedAt: { type: Date, default: Date.now },
        skipped: { type: Boolean, default: false },
        reason: { type: String, default: '' },
      },
    ],
    cta: {
      label: { type: String, default: 'Search flights with Skybridge Flights' },
      url: { type: String, default: '/flights' },
      type: {
        type: String,
        enum: ['booking', 'search', 'contact', 'whatsapp', 'custom'],
        default: 'search',
      },
    },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    source: { type: String, enum: ['AI', 'manual'], default: 'manual', index: true },
    author: { type: String, default: '', trim: true },

    authorStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },

    publishedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    readingTime: { type: Number, default: 0 },
    seoScore: { type: Number, default: 0 },
    qualityScore: { type: Number, default: 0 },
    topicScore: { type: Number, default: 0 },
    guardrailStatus: {
      type: String,
      enum: ['passed', 'failed', 'review'],
      default: 'review',
    },
    guardrailReasons: { type: [String], default: [] },
    duplicateCheck: {
      maxSimilarity: { type: Number, default: 0 },
      matchedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', default: null },
      method: { type: String, default: '' },
      passed: { type: Boolean, default: true },
      checkedAt: { type: Date, default: null },
    },
    research: {
      source: { type: String, default: '' },
      queries: { type: [String], default: [] },
      topicCluster: { type: [String], default: [] },
      outline: { type: [String], default: [] },
      relatedKeywords: { type: [String], default: [] },
      internalLinkTargets: [
        {
          label: { type: String, default: '' },
          url: { type: String, default: '' },
          reason: { type: String, default: '' },
        },
      ],
      failed: { type: Boolean, default: false },
      error: { type: String, default: '' },
    },
    authorProfile: {
      name: { type: String, default: 'Skybridge AI Travel Editor' },
      role: { type: String, default: 'AI-assisted travel content editor' },
      bio: { type: String, default: '' },
    },
    editorialPolicy: { type: String, default: '' },
    sourceNotes: { type: String, default: '' },
    travelDisclaimer: {
      type: String,
      default: 'Travel rules, prices, schedules, baggage policies, and visa requirements can change. Always verify details with the airline, airport, embassy, or official provider before booking or departure.',
    },
    lastReviewedAt: { type: Date, default: null },
    lastUpdatedAt: { type: Date, default: null },
    imageSeo: {
      provider: { type: String, default: '' },
      prompt: { type: String, default: '' },
      altText: { type: String, default: '' },
      format: { type: String, default: 'webp-ready' },
      width: { type: Number, default: 1200 },
      height: { type: Number, default: 630 },
      storage: { type: String, default: '' },
      fallbackUsed: { type: Boolean, default: false },
    },
    searchConsole: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 },
      averagePosition: { type: Number, default: 0 },
      topQueries: { type: [String], default: [] },
      lastSyncedAt: { type: Date, default: null },
    },
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
    refreshSuggestions: [
      {
        createdAt: { type: Date, default: Date.now },
        reason: { type: String, default: '' },
        suggestedMetaTitle: { type: String, default: '' },
        suggestedMetaDescription: { type: String, default: '' },
        suggestedSections: [
          {
            heading: { type: String, default: '' },
            body: { type: String, default: '' },
          },
        ],
        applied: { type: Boolean, default: false },
      },
    ],
    analytics: { type: AnalyticsSchema, default: () => ({}) },
    conversionTracking: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      lastClickedAt: { type: Date, default: null },
    },
    topicKey: { type: String, default: '', trim: true, index: true },
    trendData: {
      source: { type: String, default: '' },
      keyword: { type: String, default: '' },
      trendStrength: { type: Number, default: 0 },
      businessRelevance: { type: Number, default: 0 },
      bookingIntent: { type: Number, default: 0 },
      seasonality: { type: Number, default: 0 },
      uniqueness: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

BlogPostSchema.index({ slug: 1, language: 1 }, { unique: true });
BlogPostSchema.index({ status: 1, language: 1, publishedAt: -1 });
BlogPostSchema.index({ topicKey: 1, language: 1 });

module.exports = mongoose.model('BlogPost', BlogPostSchema);
