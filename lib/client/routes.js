export const TAB_ROUTE_MAP = {
  map: '/map',
  feed: '/feed',
  report: '/report',
  gov: '/gov',
  business: '/contractor',
};

export function hrefForTab(tabId) {
  return TAB_ROUTE_MAP[tabId] ?? '/map';
}

export function hrefForAuthView(view = 'sign-in', roleHint = 'citizen') {
  if (view === 'gov') return '/auth/gov';
  const search = roleHint && roleHint !== 'citizen' ? `?role=${encodeURIComponent(roleHint)}` : '';
  return `/auth/${view}${search}`;
}
