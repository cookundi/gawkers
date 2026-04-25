import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { generateToken, COOKIE_NAME } from '@/lib/session';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        // User denied access
        if (error) {
            return NextResponse.redirect(`${baseUrl}?error=denied`);
        }

        if (!code || !state) {
            return NextResponse.redirect(`${baseUrl}?error=missing_params`);
        }

        // Look up the stored state + code_verifier
        const storedState = await sql`
            SELECT code_verifier FROM oauth_states WHERE state = ${state}
        `;

        if (storedState.length === 0) {
            return NextResponse.redirect(`${baseUrl}?error=invalid_state`);
        }

        const codeVerifier = storedState[0].code_verifier;

        // Clean up used state
        await sql`DELETE FROM oauth_states WHERE state = ${state}`;

        const callbackUrl = `${baseUrl}/api/auth/callback`;
        const clientId = process.env.TWITTER_CLIENT_ID!;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

        // Exchange code for access token
        const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: callbackUrl,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('Token exchange failed:', errText);
            return NextResponse.redirect(`${baseUrl}?error=token_exchange`);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // Fetch user profile from X
        const userRes = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url,name,username', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!userRes.ok) {
            return NextResponse.redirect(`${baseUrl}?error=user_fetch`);
        }

        const userData = await userRes.json();
        const twitterId = userData.data.id;
        const handle = userData.data.username;
        const displayName = userData.data.name;
        // Get higher-res version of profile image (replace _normal with _200x200)
        let profileImage = userData.data.profile_image_url || '';
        profileImage = profileImage.replace('_normal', '_200x200');

        // Create session
        const sessionToken = generateToken();

        // Upsert player
        await sql`
            INSERT INTO players (twitter_id, twitter_handle, display_name, profile_image_url, session_token)
            VALUES (${twitterId}, ${handle}, ${displayName}, ${profileImage}, ${sessionToken})
            ON CONFLICT (twitter_id) DO UPDATE
            SET twitter_handle = ${handle},
                display_name = ${displayName},
                profile_image_url = ${profileImage},
                session_token = ${sessionToken}
        `;

        // Set session cookie
        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
        });

        return NextResponse.redirect(baseUrl);
    } catch (e) {
        console.error('OAuth callback error:', e);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        return NextResponse.redirect(`${baseUrl}?error=server`);
    }
}
