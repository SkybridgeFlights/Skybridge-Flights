const User = require('../models/User');
const Provider = require('../models/Provider');
const BlogPost = require('../models/BlogPost');
const SupportThread = require('../models/SupportThread');
const ClickLog = require('../models/ClickLog');

const getDashboardStats = async (req, res) => {
  try {
    const [
      users,
      verifiedUsers,
      providers,
      activeProviders,
      blogPosts,
      publishedBlogPosts,
      draftBlogPosts,
      supportThreads,
      openSupportThreads,
      pendingSupportThreads,
      outboundClicks,
      clicksToday,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),

      Provider.countDocuments(),
      Provider.countDocuments({ enabled: true }),

      BlogPost.countDocuments(),
      BlogPost.countDocuments({ status: 'published' }),
      BlogPost.countDocuments({ status: 'draft' }),

      SupportThread.countDocuments(),
      SupportThread.countDocuments({ status: 'open' }),
      SupportThread.countDocuments({ status: 'pending' }),

      ClickLog.countDocuments(),
      ClickLog.countDocuments({
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),
    ]);

    res.json({
      users,
      verifiedUsers,
      providers,
      activeProviders,
      blogPosts,
      publishedBlogPosts,
      draftBlogPosts,
      supportThreads,
      openSupportThreads,
      pendingSupportThreads,
      outboundClicks,
      clicksToday,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics' });
  }
};

module.exports = {
  getDashboardStats,
};