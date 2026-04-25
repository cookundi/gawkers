import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/session';

export async function GET() {
    try {
        const clientId = process.env.TWITTER_CLIENT_ID;
        if (!clientId) {
            return NextResponse.json({ error: 'Twitter OAuth not configured' }, { status: 500 });
        }

        const state = generateState();
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Store state + verifier in DB (short-lived)
        await sql`
            INSERT INTO oauth_states (state, code_verifier)
            VALUES (${state}, ${codeVerifier})
        `;

        // Clean up old states (older than 10 min)
        await sql`DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes'`;

        const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`;

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: callbackUrl,
            scope: 'tweet.read users.read',
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        const authUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`;

        return NextResponse.redirect(authUrl);
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
