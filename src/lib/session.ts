import { cookies } from 'next/headers';
import { sql } from './db';
import crypto from 'crypto';

const COOKIE_NAME = 'gawkers_session';

export type SessionUser = {
    twitter_id: string;
    twitter_handle: string;
    profile_image_url: string | null;
};

export async function getSession(): Promise<SessionUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    try {
        const result = await sql`
            SELECT twitter_id, twitter_handle, profile_image_url
            FROM players WHERE session_token = ${token}
        `;
        if (result.length === 0) return null;
        return {
            twitter_id: result[0].twitter_id,
            twitter_handle: result[0].twitter_handle,
            profile_image_url: result[0].profile_image_url,
        };
    } catch {
        return null;
    }
}

export function generateToken(): string {
    return crypto.randomBytes(48).toString('hex');
}

export function generateGameToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

// PKCE helpers
export function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generateState(): string {
    return crypto.randomBytes(32).toString('hex');
}

export { COOKIE_NAME };
