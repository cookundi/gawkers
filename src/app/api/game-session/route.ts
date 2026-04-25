import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession, generateGameToken } from '@/lib/session';

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const { level } = await req.json();
        if (!level || level < 1 || level > 3) {
            return NextResponse.json({ error: 'Invalid level' }, { status: 400 });
        }

        const player = await sql`
            SELECT current_level FROM players WHERE twitter_id = ${session.twitter_id}
        `;
        if (player.length === 0 || player[0].current_level < level) {
            return NextResponse.json({ error: 'Level not unlocked' }, { status: 403 });
        }

        // Clean up old unused sessions
        await sql`
            DELETE FROM game_sessions 
            WHERE twitter_id = ${session.twitter_id} AND used = FALSE
            AND started_at < NOW() - INTERVAL '1 hour'
        `;

        const token = generateGameToken();
        await sql`
            INSERT INTO game_sessions (token, twitter_id, level)
            VALUES (${token}, ${session.twitter_id}, ${level})
        `;

        return NextResponse.json({ token });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
