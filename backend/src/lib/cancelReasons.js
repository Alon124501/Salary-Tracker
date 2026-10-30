const supabase = require('../supabase');

const UNSPECIFIED_LABEL = 'לא צוין';

async function loadCancelReasons() {
  const { data, error } = await supabase.from('cancellation_reasons')
    .select('id, label, is_other, active');
  if (error) throw error;
  return data || [];
}

function labelsById(reasons) {
  return Object.fromEntries((reasons || []).map(r => [r.id, r.label]));
}

// Per-reason counts for one entry, plus "לא צוין" for any part of the total
// the breakdown doesn't explain (legacy rows saved before reasons existed).
function cancelReasonCounts(entry, labels) {
  const counts = {};
  let explained = 0;
  for (const { reason_id, count } of entry.cancellation_reasons || []) {
    const n = Number(count) || 0;
    if (n <= 0) continue;
    const label = labels[reason_id] || UNSPECIFIED_LABEL;
    counts[label] = (counts[label] || 0) + n;
    explained += n;
  }
  const rest = (Number(entry.cancellations) || 0) - explained;
  if (rest > 0) counts[UNSPECIFIED_LABEL] = (counts[UNSPECIFIED_LABEL] || 0) + rest;
  return counts;
}

// "לקוח לא הגיע×2, אחר×1 (הערה)" — used by the Excel report and the recap.
function formatCancelReasons(entry, labels) {
  const parts = Object.entries(cancelReasonCounts(entry, labels)).map(([l, n]) => `${l}×${n}`);
  if (!parts.length) return '';
  const note = entry.cancellation_other_note?.trim();
  return parts.join(', ') + (note ? ` (${note})` : '');
}

// Validates a submitted breakdown and syncs fields.cancellations to its sum.
// When no breakdown is submitted, the total can't change (a count without a
// reason) and the stored breakdown stays as-is. Returns an error string or null.
function applyCancellationBreakdown(fields, existing, reasons) {
  const prevTotal = Number(existing?.cancellations) || 0;

  if (fields.cancellation_reasons === undefined) {
    if (fields.cancellations !== undefined && Number(fields.cancellations) !== prevTotal) {
      return 'חסרה סיבת ביטול';
    }
    fields.cancellations = prevTotal;
    delete fields.cancellation_other_note;
    return null;
  }

  const byId = Object.fromEntries(reasons.map(r => [r.id, r]));
  const prevIds = new Set((existing?.cancellation_reasons || []).map(r => r.reason_id));
  const merged = {};
  for (const { reason_id, count } of fields.cancellation_reasons) {
    if (count <= 0) continue;
    const reason = byId[reason_id];
    if (!reason || (!reason.active && !prevIds.has(reason_id))) return 'סיבת ביטול לא תקינה';
    merged[reason_id] = (merged[reason_id] || 0) + count;
  }

  const breakdown = Object.entries(merged).map(([reason_id, count]) => ({ reason_id, count }));
  const otherCount = breakdown.filter(b => byId[b.reason_id].is_other).reduce((s, b) => s + b.count, 0);
  const note = fields.cancellation_other_note?.trim() || '';
  if (otherCount > 0 && !note) return 'נדרש פירוט לסיבת "אחר"';

  fields.cancellation_reasons = breakdown;
  fields.cancellations = breakdown.reduce((s, b) => s + b.count, 0);
  fields.cancellation_other_note = otherCount > 0 ? note : null;
  return null;
}

module.exports = {
  loadCancelReasons, labelsById, cancelReasonCounts, formatCancelReasons, applyCancellationBreakdown,
};
