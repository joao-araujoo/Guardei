export const PLATFORM_OPTIONS = [
  { id: 'tiktok', label: 'TikTok', short: 'TT', icon: 'tiktok', color: '#111111', accent: '#ffffff' },
  { id: 'youtube', label: 'YouTube', short: 'YT', icon: 'youtube', color: '#ff0033', accent: '#ffffff' },
  { id: 'twitter', label: 'X / Twitter', short: 'X', icon: 'x', color: '#111111', accent: '#ffffff' },
  { id: 'spotify', label: 'Spotify', short: 'SP', icon: 'spotify', color: '#1db954', accent: '#102214' },
  { id: 'instagram', label: 'Instagram', short: 'IG', icon: 'instagram', color: '#e4405f', accent: '#ffffff' },
  { id: 'reddit', label: 'Reddit', short: 'RD', icon: 'reddit', color: '#ff4500', accent: '#ffffff' },
  { id: 'pinterest', label: 'Pinterest', short: 'PI', icon: 'pinterest', color: '#bd081c', accent: '#ffffff' },
  { id: 'linkedin', label: 'LinkedIn', short: 'IN', icon: 'linkedin', color: '#0a66c2', accent: '#ffffff' },
  { id: 'substack', label: 'Substack', short: 'SS', icon: 'substack', color: '#ff6719', accent: '#1b110c' },
  { id: 'medium', label: 'Medium', short: 'M', icon: 'medium', color: '#111111', accent: '#ffffff' },
  { id: 'github', label: 'GitHub', short: 'GH', icon: 'github', color: '#24292f', accent: '#ffffff' },
  { id: 'twitch', label: 'Twitch', short: 'TW', icon: 'twitch', color: '#9146ff', accent: '#ffffff' },
  { id: 'netflix', label: 'Netflix', short: 'N', icon: 'netflix', color: '#e50914', accent: '#ffffff' },
  { id: 'web', label: 'Internet', short: 'WWW', color: '#2f6f4e', accent: '#f7e7bc' }
];

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORM_OPTIONS.map(platform => [platform.id, platform]));

export function getPlatformMeta(platform) {
  return PLATFORM_BY_ID[platform] || PLATFORM_BY_ID.web;
}
