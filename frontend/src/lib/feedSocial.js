const FEED_COMMENTS_KEY = 'cityeye_feed_comments';
const FEED_LIKES_KEY = 'cityeye_feed_likes';

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  return raw ? safeParse(raw, fallback) : fallback;
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readFeedComments() {
  const value = readStorage(FEED_COMMENTS_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

export function writeFeedComments(commentsMap) {
  writeStorage(FEED_COMMENTS_KEY, commentsMap);
}

export function readFeedLikes() {
  const value = readStorage(FEED_LIKES_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

export function writeFeedLikes(likesMap) {
  writeStorage(FEED_LIKES_KEY, likesMap);
}
