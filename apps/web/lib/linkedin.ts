export interface LinkedInProfile {
  name: string;
  email: string;
  picture: string;
}

export function isLinkedInConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID);
}

// Opens the LinkedIn OAuth popup and resolves with the imported profile.
// Free-tier OpenID Connect only returns name, email, and photo.
export function importFromLinkedIn(): Promise<LinkedInProfile> {
  return new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID;
    if (!clientId) {
      reject(new Error('LinkedIn import is not configured.'));
      return;
    }

    const state = Math.random().toString(36).slice(2);
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/linkedin/callback`);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);

    const popup = window.open(authUrl.toString(), 'linkedin-oauth', 'width=550,height=700');
    if (!popup) {
      reject(new Error('Popup blocked — allow popups and try again.'));
      return;
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.source !== 'jobman-linkedin' || e.data.state !== state) return;
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.profile as LinkedInProfile);
    }
    window.addEventListener('message', onMessage);

    const closedPoll = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedPoll);
        window.removeEventListener('message', onMessage);
        reject(new Error('LinkedIn window was closed.'));
      }
    }, 800);
  });
}
