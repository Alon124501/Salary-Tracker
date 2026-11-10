// Copies text to the clipboard; resolves true on success, false otherwise.
// The Clipboard API needs a secure context (missing over the http LAN dev server)
// and can be refused, so fall back to a hidden textarea + execCommand('copy').
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall back below */ }

  const ta = document.createElement('textarea');
  ta.value = text;
  // Not readonly: iOS won't select text in a readonly field.
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  ta.style.fontSize = '16px'; // below 16px iOS zooms in on focus
  try {
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    if (ta.parentNode !== null) {
      try { document.body.removeChild(ta); } catch { /* not attached */ }
    }
  }
}
