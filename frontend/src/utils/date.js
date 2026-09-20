export function formatDate(value) {
  if (!value) return '';
  let d;
  if (value instanceof Date) {
    d = value;
  } else {
    // Plain date-only 'YYYY-MM-DD' strings must be parsed as local calendar
    // dates, not UTC midnight — otherwise timezones behind UTC show the
    // previous day. Full timestamps (has a time component) go through the
    // normal Date parser so they still convert to the viewer's local time.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  }
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
