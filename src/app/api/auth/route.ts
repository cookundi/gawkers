import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, COOKIE_NAME } from '@/lib/session';
import { cookies } from 'next/headers';

// GET /api/auth — check current session
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ authenticated: false });
        }

        const player = await sql`
            SELECT twitter_id, twitter_handle, display_name, profile_image_url,
                   current_level, best_score, total_games, total_kills,
                   current_streak, best_streak, completed, created_at
            FROM players WHERE twitter_id = ${session.twitter_id}
        `;

        if (player.length === 0) {
            return NextResponse.json({ authenticated: false });
        }

        return NextResponse.json({ authenticated: true, player: player[0] });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

// POST /api/auth — logout only
export async function POST(req: Request) {
    try {
        const { action } = await req.json();

        if (action === 'logout') {
            const session = await getSession();
            if (session) {
                await sql`UPDATE players SET session_token = NULL WHERE twitter_id = ${session.twitter_id}`;
            }
            const cookieStore = await cookies();
            cookieStore.delete(COOKIE_NAME);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
