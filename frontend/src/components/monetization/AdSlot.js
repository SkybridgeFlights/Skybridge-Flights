import React, { useEffect, useMemo } from 'react';
import { featureFlags } from '../../utils/featureFlags';
import { hasConsent } from '../../utils/consent';
import { trackEvent } from '../../utils/analytics';
import './AdSlot.css';

const PLACEMENTS = new Set([
  'tracker_sidebar_top',
  'tracker_sidebar_bottom',
  'tracker_details_inline',
  'airport_page_inline',
  'blog_inline',
  'footer_banner',
]);

const AFFILIATE_COPY = {
  tracker_sidebar_top: {
    title: 'Need a hotel near this airport?',
    body: 'Compare nearby stays after checking live flight status.',
    action: 'Explore hotels',
    campaign: 'airport_hotels',
  },
  tracker_sidebar_bottom: {
    title: 'Airport transfer',
    body: 'Plan the last mile after arrival with transfer options.',
    action: 'Plan transfer',
    campaign: 'airport_transfer',
  },
  tracker_details_inline: {
    title: 'Book travel insurance',
    body: 'Prepare for delays, baggage issues, and route changes.',
    action: 'View options',
    campaign: 'travel_insurance',
  },
  airport_page_inline: {
    title: 'Need a hotel near this airport?',
    body: 'Stay close to the terminal for early departures or late arrivals.',
    action: 'Find airport hotels',
    campaign: 'airport_hotels',
  },
  blog_inline: {
    title: 'Book travel insurance',
    body: 'Protect the trip you are planning with practical coverage options.',
    action: 'Compare coverage',
    campaign: 'travel_insurance',
  },
  footer_banner: {
    title: 'Airport transfer',
    body: 'Move from flight planning to arrival logistics.',
    action: 'Check transfers',
    campaign: 'airport_transfer',
  },
};

function destinationFor(campaign) {
  if (campaign === 'airport_hotels') return '/flights?intent=hotels';
  if (campaign === 'airport_transfer') return '/flights?intent=transfer';
  if (campaign === 'travel_insurance') return '/flights?intent=insurance';
  return '/flights';
}

export default function AdSlot({ placement, className = '', metadata = {} }) {
  const validPlacement = PLACEMENTS.has(placement);
  const content = AFFILIATE_COPY[placement];
  const enabled = featureFlags.enableAffiliates;
  const slotId = placement;
  const metadataKey = JSON.stringify(metadata || {});

  const destination = useMemo(
    () => destinationFor(content?.campaign),
    [content?.campaign]
  );

  useEffect(() => {
    if (!validPlacement || !enabled || !content) return;
    trackEvent('ad_impression', {
      metadata: {
        slotId,
        campaign: content.campaign,
        placement,
        ...JSON.parse(metadataKey || '{}'),
      },
    });
  }, [content, enabled, metadataKey, placement, slotId, validPlacement]);

  if (!validPlacement || !content || !enabled) return null;

  const handleClick = () => {
    trackEvent('affiliate_click', {
      metadata: {
        slotId,
        campaign: content.campaign,
        destination,
        placement,
        consentAds: hasConsent('ads'),
        consentMarketing: hasConsent('marketing'),
        ...JSON.parse(metadataKey || '{}'),
      },
    });
    trackEvent('cta_conversion', {
      metadata: {
        slotId,
        campaign: content.campaign,
        destination,
      },
    });
  };

  return (
    <aside className={`ad-slot ad-slot--${placement} ${className}`.trim()} data-placement={placement}>
      <div className="ad-slot__label">Partner option</div>
      <strong>{content.title}</strong>
      <p>{content.body}</p>
      <a href={destination} onClick={handleClick}>
        {content.action}
      </a>
    </aside>
  );
}
