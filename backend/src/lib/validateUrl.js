// Only allows http(s) URLs — blocks javascript:/data:/other schemes from
// being stored and later rendered as a clickable link.
function isSafeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = { isSafeUrl };
