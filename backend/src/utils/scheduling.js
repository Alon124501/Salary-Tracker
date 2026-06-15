const TZ = 'Asia/Jerusalem';

// Converts a "YYYY-MM-DD" date at h:m local time in the given IANA timezone to UTC ms.
// Uses the Intl offset-trick so DST transitions are handled correctly.
function localToUtcMs(dateStr, h, m, tz) {
  const asIfUtc = new Date(
    `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`
  );
  const locStr = asIfUtc.toLocaleString('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  // en-US format: "MM/DD/YYYY, HH:mm:ss"
  const [datePart, timePart] = locStr.split(', ');
  const [mo, dd, yyyy] = datePart.split('/');
  const [hh, mm, ss] = timePart.split(':');
  const locAsUtc = new Date(`${yyyy}-${mo}-${dd}T${hh}:${mm}:${ss}Z`);
  const offsetMs = locAsUtc.getTime() - asIfUtc.getTime(); // e.g. +7200000 (UTC+2) or +10800000 (UTC+3)
  return asIfUtc.getTime() - offsetMs;
}

// Returns the ISO UTC string for the next occurrence of a recurring schedule.
// recurrenceDays: int[] where 0=Sun, 1=Mon, ..., 6=Sat (local Israel days)
// recurrenceTimeLocal: "HH:MM" in Israel time
function computeNextOccurrence(recurrenceDays, recurrenceTimeLocal) {
  const [h, m] = recurrenceTimeLocal.split(':').map(Number);
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const probe = new Date(now.getTime() + dayOffset * 86400000);

    // Get Israel-local day-of-week and calendar date for this UTC moment
    const ilDateStr = probe.toLocaleDateString('en-CA', { timeZone: TZ }); // "YYYY-MM-DD"
    const dow = new Date(probe.toLocaleString('en-US', { timeZone: TZ })).getDay();

    if (!recurrenceDays.includes(dow)) continue;

    const utcCandidate = new Date(localToUtcMs(ilDateStr, h, m, TZ));
    if (utcCandidate > now) return utcCandidate.toISOString();
  }
  return null;
}

module.exports = { computeNextOccurrence };
