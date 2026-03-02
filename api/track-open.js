// Vercel serverless function — email open tracking pixel + redirect
//
// Pixel mode:    GET /api/track-open?id=<outreach_log_id>
//               Returns 1x1 transparent GIF, logs open to Supabase.
//
// Redirect mode: GET /api/track-open?id=<outreach_log_id>&url=<destination>
//               Logs open to Supabase, then 302-redirects to destination.
//               Used for tracked links (works when images are blocked by client).

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

async function logOpen(id) {
  if (!id || !SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_email_open`, {
      method: 'POST',
      headers: {
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ log_id: id }),
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  const id  = req.query?.id;
  const url = req.query?.url;

  if (url) {
    // Redirect mode — log first (await so it fires before redirect), then bounce
    await logOpen(id);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
    return;
  }

  // Pixel mode — send GIF immediately, log async
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(PIXEL);

  logOpen(id); // fire-and-forget
}
