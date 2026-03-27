import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');
    
    if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

    try {
        const player = await sql`SELECT current_level, completed FROM players WHERE wallet_address = ${wallet}`;
        return NextResponse.json(player[0] || { current_level: 1, completed: false });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { walletAddress, action, level } = await req.json();

        if (action === 'complete') {
            const isFullyFinished = level >= 4;
            
            await sql`
                INSERT INTO players (wallet_address, current_level, completed, completed_at)
                VALUES (${walletAddress}, ${level}, ${isFullyFinished}, NOW())
                ON CONFLICT (wallet_address) DO UPDATE 
                SET current_level = GREATEST(players.current_level, EXCLUDED.current_level),
                    completed = CASE WHEN EXCLUDED.completed = true THEN true ELSE players.completed END,
                    completed_at = CASE WHEN EXCLUDED.completed = true THEN NOW() ELSE players.completed_at END;
            `;

            const countRes = await sql`SELECT count(*) FROM players WHERE completed = true`;
            const totalWinners = parseInt(countRes[0].count);

            return NextResponse.json({ 
                success: true, 
                whitelisted: totalWinners <= 300 && isFullyFinished 
            });
        }
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}