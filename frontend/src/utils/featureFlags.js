function enabled(value) {
  return String(value || '').toLowerCase() === 'true';
}

export const featureFlags = {
  enableAds: enabled(process.env.REACT_APP_ENABLE_ADS),
  enableAffiliates: enabled(process.env.REACT_APP_ENABLE_AFFILIATES),
  enableSponsoredContent: enabled(process.env.REACT_APP_ENABLE_SPONSORED_CONTENT),
  enableTrackerWeather: enabled(process.env.REACT_APP_ENABLE_TRACKER_WEATHER),
  enableTrackerPlayback: enabled(process.env.REACT_APP_ENABLE_TRACKER_PLAYBACK),
};

export function isMonetizationEnabled() {
  return featureFlags.enableAds || featureFlags.enableAffiliates || featureFlags.enableSponsoredContent;
}
