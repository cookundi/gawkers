import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';

const MAX_SCORE: Record<number, number> = { 1: 4000, 2: 8000, 3: 16000 };
const TARGET_SCORE: Record<number, number> = { 1: 800, 2: 1500, 3: 3000 };
const MIN_TIME_MS: Record<number, number> = { 1: 20000, 2: 35000, 3: 50000 };

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const { gameToken, score, level, kills, timeMs } = await req.json();

        if (!gameToken) return NextResponse.json({ error: 'Missing game token' }, { status: 400 });

        const sessions = await sql`
            SELECT * FROM game_sessions
            WHERE token = ${gameToken} AND twitter_id = ${session.twitter_id}
            AND used = FALSE AND level = ${level}
        `;

        if (sessions.length === 0) {
            return NextResponse.json({ error: 'Invalid or expired session' }, { status: 403 });
        }

        const gameSession = sessions[0];
        const sessionStarted = new Date(gameSession.started_at).getTime();
        const realElapsed = Date.now() - sessionStarted;

        if (realElapsed < MIN_TIME_MS[level] * 0.8) {
            return NextResponse.json({ error: 'Suspicious timing' }, { status: 403 });
        }

        if (score < 0 || score > MAX_SCORE[level]) {
            return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
        }

        const maxPossibleKills = Math.floor(timeMs / 300);
        if (kills > maxPossibleKills) {
            return NextResponse.json({ error: 'Suspicious kills' }, { status: 403 });
        }

        await sql`UPDATE game_sessions SET used = TRUE WHERE token = ${gameToken}`;

        await sql`
            INSERT INTO scores (twitter_id, level, score, time_ms, kills)
            VALUES (${session.twitter_id}, ${level}, ${score}, ${timeMs}, ${kills})
        `;

        const isWin = score >= TARGET_SCORE[level];
        const nextLevel = isWin ? Math.min(level + 1, 4) : level;
        const isComplete = nextLevel >= 4;

        const player = await sql`
            SELECT current_streak, best_streak, best_score, total_games, total_kills
            FROM players WHERE twitter_id = ${session.twitter_id}
        `;
        const p = player[0];
        const newStreak = isWin ? (p.current_streak || 0) + 1 : 0;
        const newBestStreak = Math.max(newStreak, p.best_streak || 0);

        // total_score is cumulative — always add the score from this game
        if (isComplete) {
            await sql`
                UPDATE players SET
                    current_level = GREATEST(current_level, ${nextLevel}),
                    best_score = GREATEST(best_score, ${score}),
                    total_score = total_score + ${score},
                    total_games = total_games + 1,
                    total_kills = total_kills + ${kills},
                    current_streak = ${newStreak},
                    best_streak = ${newBestStreak},
                    last_played_at = NOW(),
                    completed = TRUE,
                    completed_at = CASE WHEN completed = FALSE THEN NOW() ELSE completed_at END
                WHERE twitter_id = ${session.twitter_id}
            `;
        } else {
            await sql`
                UPDATE players SET
                    current_level = GREATEST(current_level, ${nextLevel}),
                    best_score = GREATEST(best_score, ${score}),
                    total_score = total_score + ${score},
                    total_games = total_games + 1,
                    total_kills = total_kills + ${kills},
                    current_streak = ${newStreak},
                    best_streak = ${newBestStreak},
                    last_played_at = NOW()
                WHERE twitter_id = ${session.twitter_id}
            `;
        }

        const updated = await sql`
            SELECT twitter_id, twitter_handle, display_name, profile_image_url,
                   current_level, best_score, total_score, total_games, total_kills,
                   current_streak, best_streak, completed, created_at
            FROM players WHERE twitter_id = ${session.twitter_id}
        `;

        return NextResponse.json({
            success: true,
            isWin,
            score,
            nextLevel,
            streak: newStreak,
            player: updated[0],
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}