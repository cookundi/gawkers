import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || 'overall';
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = 50;
        const offset = (page - 1) * limit;
        const searchParam = search ? `%${search.toLowerCase().replace('@', '')}%` : '';

        if (period === 'overall') {
            const leaderboard = searchParam
                ? await sql`
                    SELECT p.twitter_handle, p.profile_image_url, p.total_score,
                           LEAST(p.current_level, 3) as level, p.total_games as games,
                           p.total_kills as kills, p.completed,
                           ROW_NUMBER() OVER (ORDER BY p.total_score DESC, p.created_at ASC) as rank
                    FROM players p WHERE p.total_games > 0
                    AND LOWER(p.twitter_handle) LIKE ${searchParam}
                    ORDER BY p.total_score DESC LIMIT ${limit} OFFSET ${offset}
                `
                : await sql`
                    SELECT p.twitter_handle, p.profile_image_url, p.total_score,
                           LEAST(p.current_level, 3) as level, p.total_games as games,
                           p.total_kills as kills, p.completed,
                           ROW_NUMBER() OVER (ORDER BY p.total_score DESC, p.created_at ASC) as rank
                    FROM players p WHERE p.total_games > 0
                    ORDER BY p.total_score DESC LIMIT ${limit} OFFSET ${offset}
                `;
            return NextResponse.json({ leaderboard, page, period });
        }

        if (period === 'daily') {
            const leaderboard = searchParam
                ? await sql`
                    SELECT p.twitter_handle, p.profile_image_url,
                           SUM(s.score) as total_score,
                           LEAST(MAX(s.level), 3) as level, COUNT(*) as games,
                           SUM(s.kills) as kills,
                           ROW_NUMBER() OVER (ORDER BY SUM(s.score) DESC) as rank
                    FROM scores s JOIN players p ON s.twitter_id = p.twitter_id
                    WHERE s.created_at >= NOW() - INTERVAL '24 hours'
                    AND LOWER(p.twitter_handle) LIKE ${searchParam}
                    GROUP BY p.twitter_handle, p.profile_image_url
                    ORDER BY total_score DESC LIMIT ${limit} OFFSET ${offset}
                `
                : await sql`
                    SELECT p.twitter_handle, p.profile_image_url,
                           SUM(s.score) as total_score,
                           LEAST(MAX(s.level), 3) as level, COUNT(*) as games,
                           SUM(s.kills) as kills,
                           ROW_NUMBER() OVER (ORDER BY SUM(s.score) DESC) as rank
                    FROM scores s JOIN players p ON s.twitter_id = p.twitter_id
                    WHERE s.created_at >= NOW() - INTERVAL '24 hours'
                    GROUP BY p.twitter_handle, p.profile_image_url
                    ORDER BY total_score DESC LIMIT ${limit} OFFSET ${offset}
                `;
            return NextResponse.json({ leaderboard, page, period });
        }

        if (period === 'weekly') {
            const leaderboard = searchParam
                ? await sql`
                    SELECT p.twitter_handle, p.profile_image_url,
                           SUM(s.score) as total_score,
                           LEAST(MAX(s.level), 3) as level, COUNT(*) as games,
                           SUM(s.kills) as kills,
                           ROW_NUMBER() OVER (ORDER BY SUM(s.score) DESC) as rank
                    FROM scores s JOIN players p ON s.twitter_id = p.twitter_id
                    WHERE s.created_at >= NOW() - INTERVAL '7 days'
                    AND LOWER(p.twitter_handle) LIKE ${searchParam}
                    GROUP BY p.twitter_handle, p.profile_image_url
                    ORDER BY total_score DESC LIMIT ${limit} OFFSET ${offset}
                `
                : await sql`
                    SELECT p.twitter_handle, p.profile_image_url,
                           SUM(s.score) as total_score,
                           LEAST(MAX(s.level), 3) as level, COUNT(*) as games,
                           SUM(s.kills) as kills,
                           ROW_NUMBER() OVER (ORDER BY SUM(s.score) DESC) as rank
                    FROM scores s JOIN players p ON s.twitter_id = p.twitter_id
                    WHERE s.created_at >= NOW() - INTERVAL '7 days'
                    GROUP BY p.twitter_handle, p.profile_image_url
                    ORDER BY total_score DESC LIMIT ${limit} OFFSET ${offset}
                `;
            return NextResponse.json({ leaderboard, page, period });
        }

        return NextResponse.json({ leaderboard: [], page, period });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}