import { NextResponse } from 'next/server';

// Serialize a value for safe embedding inside an inline <script>. JSON.stringify
// alone does not neutralize "</script>", U+2028/U+2029, or HTML-comment openers,
// so a value like the attacker-controlled `state` param could otherwise break out
// of the script element and inject markup (reflected XSS). Escaping these as \uXXXX
// keeps the output valid JSON that parses back to the original characters.
function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// LinkedIn OAuth (OpenID Connect) callback. The popup lands here with ?code=;
// we exchange it server-side (client secret never reaches the browser), fetch
// the userinfo, and postMessage the profile back to the window that opened us.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error');

  const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  let payload: Record<string, unknown>;
  if (error || !code) {
    payload = { error: error ?? 'Missing authorization code' };
  } else if (!clientId || !clientSecret) {
    payload = { error: 'LinkedIn is not configured' };
  } else {
    try {
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${url.origin}/api/linkedin/callback`,
        }),
      });
      const token = await tokenRes.json();
      if (!token.access_token) throw new Error(token.error_description ?? 'Token exchange failed');

      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const info = await profileRes.json();
      payload = {
        profile: {
          name: info.name ?? '',
          email: info.email ?? '',
          picture: info.picture ?? '',
        },
      };
    } catch (err: any) {
      payload = { error: err.message ?? 'LinkedIn import failed' };
    }
  }

  const html = `<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding-top:4rem">
<p>Connecting to JobMan…</p>
<script>
  if (window.opener) {
    window.opener.postMessage(
      { source: 'jobman-linkedin', state: ${serializeForScript(state)}, ...${serializeForScript(payload)} },
      ${serializeForScript(url.origin)}
    );
    window.close();
  } else {
    document.body.textContent = 'You can close this window.';
  }
</script></body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
