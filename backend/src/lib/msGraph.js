// Microsoft Graph client for the company mailbox (SUPPLIER_SENDER_EMAIL, alonm@mpcheck.co.il on
// Microsoft 365), via the Entra app "MPCHECK Orders" (client credentials). Exchange RBAC for
// Applications limits the app to that one mailbox: "Application Mail.Send" for orders and
// "Application Mail.Read" for reading supplier replies.

function graphConfigured() {
  return Boolean(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID
    && process.env.MS_CLIENT_SECRET && process.env.SUPPLIER_SENDER_EMAIL);
}

let graphToken = null; // { value, expiresAt } — reused across requests on a warm instance

async function getGraphToken() {
  if (graphToken && graphToken.expiresAt > Date.now() + 60_000) return graphToken.value;

  const res = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Microsoft login failed: ${data.error_description || data.error || res.status}`);

  graphToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return graphToken.value;
}

// Path is relative to the mailbox, e.g. '/sendMail' or '/messages?$filter=...'
async function graphRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await getGraphToken();
  const mailbox = encodeURIComponent(process.env.SUPPLIER_SENDER_EMAIL);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Microsoft Graph ${res.status}: ${data.error?.message || 'request failed'}`);
  }
  return res.status === 202 || res.status === 204 ? null : res.json();
}

async function sendMail({ to, replyTo, subject, text }) {
  await graphRequest('/sendMail', {
    method: 'POST',
    body: {
      message: {
        subject,
        body: { contentType: 'Text', content: text },
        toRecipients: [{ emailAddress: { address: to } }],
        replyTo: [{ emailAddress: { address: replyTo } }],
      },
      saveToSentItems: true, // the order shows up in the sender's Outlook "Sent Items"
    },
  });
}

// Messages from one sender received at or after `since` (ISO string), newest first.
// uniqueBody = only the new part of a reply, without the quoted original order.
async function listMessagesFrom(fromAddress, since) {
  const filter = `receivedDateTime ge ${since} and from/emailAddress/address eq '${fromAddress.replace(/'/g, "''")}'`;
  const params = new URLSearchParams({
    $filter: filter,
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,receivedDateTime,uniqueBody,bodyPreview,webLink',
    $top: '25',
  });
  const data = await graphRequest(`/messages?${params}`, {
    headers: { Prefer: 'outlook.body-content-type="text"' },
  });
  return data?.value || [];
}

module.exports = { graphConfigured, sendMail, listMessagesFrom };
