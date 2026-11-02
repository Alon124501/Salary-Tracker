const supabase = require('../supabase');

async function loadOtherTestTypes() {
  const { data, error } = await supabase.from('other_test_types')
    .select('id, label, active, created_at');
  if (error) throw error;
  return (data || []).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

// type id → count for one entry.
function otherTestCounts(entry) {
  const counts = {};
  for (const { type_id, count } of entry.other_test_breakdown || []) {
    const n = Number(count) || 0;
    if (n > 0) counts[type_id] = (counts[type_id] || 0) + n;
  }
  return counts;
}

// Excel columns: every active type, plus inactive ones still used in these entries.
function typesForReport(types, entries) {
  const used = new Set();
  for (const e of entries) for (const id of Object.keys(otherTestCounts(e))) used.add(id);
  return types.filter(t => t.active || used.has(t.id));
}

// Validates a submitted breakdown and syncs fields.other_tests to its sum.
// When no breakdown is submitted the stored breakdown and total stay as-is.
// Returns an error string or null.
function applyOtherTestBreakdown(fields, existing, types) {
  if (fields.other_test_breakdown === undefined) {
    delete fields.other_test_breakdown;
    fields.other_tests = Number(existing?.other_tests) || 0;
    return null;
  }

  const byId = Object.fromEntries(types.map(t => [t.id, t]));
  const prevIds = new Set((existing?.other_test_breakdown || []).map(b => b.type_id));
  const merged = {};
  for (const { type_id, count } of fields.other_test_breakdown) {
    if (count <= 0) continue;
    const type = byId[type_id];
    if (!type || (!type.active && !prevIds.has(type_id))) return 'סוג בדיקה לא תקין';
    merged[type_id] = (merged[type_id] || 0) + count;
  }

  fields.other_test_breakdown = Object.entries(merged).map(([type_id, count]) => ({ type_id, count }));
  fields.other_tests = fields.other_test_breakdown.reduce((s, b) => s + b.count, 0);
  return null;
}

module.exports = { loadOtherTestTypes, otherTestCounts, typesForReport, applyOtherTestBreakdown };
