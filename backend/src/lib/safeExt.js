// Extracts a safe storage-path file extension from a (possibly attacker-
// controlled) filename. Strips everything except letters/digits so a crafted
// name (e.g. containing "../" or no "." at all) can never inject path
// separators into a storage path built as `${...}.${ext}`.
function safeExt(filename, fallback = 'bin') {
  if (typeof filename !== 'string') return fallback;
  const raw = filename.split('.').pop() || '';
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toLowerCase();
  return clean || fallback;
}

module.exports = { safeExt };
