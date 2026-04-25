import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const player = await sql`
            SELECT twitter_id, twitter_handle, display_name, profile_image_url,
                   current_level, best_score, total_score, total_games, total_kills,
                   current_streak, best_streak, completed, completed_at,
                   wallet_address, created_at
            FROM players WHERE twitter_id = ${session.twitter_id}
        `;

        if (player.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // Per-level best scores
        const levelBests = await sql`
            SELECT level, MAX(score) as best_score, COUNT(*) as games_played
            FROM scores WHERE twitter_id = ${session.twitter_id}
            GROUP BY level ORDER BY level
        `;

        // Recent scores
        const recentScores = await sql`
            SELECT level, score, kills, time_ms, created_at
            FROM scores WHERE twitter_id = ${session.twitter_id}
            ORDER BY created_at DESC LIMIT 10
        `;

        // Rank by total_score
        const rankResult = await sql`
            SELECT COUNT(*) + 1 as rank FROM players
            WHERE total_score > (
                SELECT total_score FROM players WHERE twitter_id = ${session.twitter_id}
            )
        `;

        return NextResponse.json({
            ...player[0],
            level_bests: levelBests,
            recent_scores: recentScores,
            rank: parseInt(rankResult[0].rank),
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}