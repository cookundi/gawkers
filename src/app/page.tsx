'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { GameCanvas } from '@/components/GameCanvas';

const TARGET_SCORE: Record<number, number> = { 1: 800, 2: 1500, 3: 3000 };

type View = 'auth' | 'hub' | 'game' | 'leaderboard' | 'profile';
type LevelBest = { level: number; best_score: number; games_played: number };
type Player = {
    twitter_id: string;
    twitter_handle: string;
    display_name: string;
    profile_image_url: string | null;
    current_level: number;
    best_score: number;
    total_score: number;
    total_games: number;
    total_kills: number;
    current_streak: number;
    best_streak: number;
    completed: boolean;
    rank?: number;
    level_bests?: LevelBest[];
    recent_scores?: any[];
};

function GawkerLoader({ text = 'Initializing' }: { text?: string }) {
    const [dots, setDots] = useState('');
    useEffect(() => {
        const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="flex flex-col items-center gap-6">
            <div className="loader-grid">
                {Array(9).fill(0).map((_, i) => (
                    <div key={i} className="loader-cell" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
            </div>
            <span className="font-mono text-zinc-500 uppercase" style={{ fontSize: 10, letterSpacing: '0.2em' }}>{text}{dots}</span>
        </div>
    );
}

function Avatar({ src, handle, size = 32 }: { src?: string | null; handle: string; size?: number }) {
    const [error, setError] = useState(false);
    if (!src || error) {
        return (
            <div className="bg-[#A020F0]/20 border border-[#A020F0]/30 flex items-center justify-center font-pixel font-bold text-[#A020F0] shrink-0"
                style={{ width: size, height: size, fontSize: size * 0.4 }}>
                {handle.charAt(0).toUpperCase()}
            </div>
        );
    }
    return <img src={src} alt={handle} onError={() => setError(true)} className="shrink-0 object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
}

export default function Home() {
    const [view, setView] = useState<View>('auth');
    const [player, setPlayer] = useState<Player | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeLevel, setActiveLevel] = useState(1);
    const [gameToken, setGameToken] = useState('');
    const [authError, setAuthError] = useState('');
    const [recMode, setRecMode] = useState(false);
    const [lbPeriod, setLbPeriod] = useState<'daily' | 'weekly' | 'overall'>('overall');
    const [lbData, setLbData] = useState<any[]>([]);
    const [lbSearch, setLbSearch] = useState('');
    const [lbLoading, setLbLoading] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('rec') === '1') setRecMode(true);
        const err = params.get('error');
        if (err) {
            setAuthError(err === 'denied' ? 'Access denied by X' : 'Login failed, try again');
            window.history.replaceState({}, '', '/');
        }
        fetch('/api/auth').then(r => r.json()).then(data => {
            if (data.authenticated) { setPlayer(data.player); setView('hub'); }
        }).catch(() => { }).finally(() => setLoading(false));
    }, []);

    const refreshProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/player');
            const data = await res.json();
            if (!data.error) setPlayer(data);
        } catch { }
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
        setPlayer(null); setView('auth');
    };

    // Start a level — fetches anti-cheat token
    const fetchGameToken = async (level: number): Promise<string> => {
        const res = await fetch('/api/game-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level }) });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.token;
    };

    const startLevel = async (level: number) => {
        try {
            const token = await fetchGameToken(level);
            setActiveLevel(level);
            setGameToken(token);
            setView('game');
        } catch (e: any) { alert(e.message || 'Failed to start game'); }
    };

    // Called by GameCanvas on retry — fetches a new token, returns it
    const handleRetry = async (level: number): Promise<string> => {
        const token = await fetchGameToken(level);
        setGameToken(token);
        return token;
    };

    const submitScore = async (level: number, score: number, kills: number, timeMs: number) => {
        try {
            const res = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameToken, score, level, kills, timeMs }) });
            const data = await res.json();
            if (data.player) setPlayer(prev => prev ? { ...prev, ...data.player } : prev);
        } catch { }
    };

    const handleQuitGame = async () => {
        await refreshProfile();
        setView('hub');
    };

    const fetchLeaderboard = useCallback(async () => {
        setLbLoading(true);
        try {
            const params = new URLSearchParams({ period: lbPeriod });
            if (lbSearch) params.set('search', lbSearch);
            const res = await fetch(`/api/leaderboard?${params}`);
            const data = await res.json();
            setLbData(data.leaderboard || []);
        } catch { } finally { setLbLoading(false); }
    }, [lbPeriod, lbSearch]);

    useEffect(() => { if (view === 'leaderboard') fetchLeaderboard(); }, [view, lbPeriod, fetchLeaderboard]);
    useEffect(() => { if (view === 'profile') refreshProfile(); }, [view, refreshProfile]);
    useEffect(() => { if (view === 'hub' && player) refreshProfile(); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

    const getLevelBest = (lvl: number): number => {
        if (!player?.level_bests) return 0;
        const found = player.level_bests.find((lb: LevelBest) => lb.level === lvl);
        return found ? found.best_score : 0;
    };

    if (loading) {
        return <main className="min-h-screen bg-[#050505] flex items-center justify-center"><GawkerLoader text="Loading" /></main>;
    }

    const progress = player ? Math.min(((player.current_level - 1) / 3) * 100, 100) : 0;

    return (
        <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center relative overflow-x-hidden">
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0d001a_0%,#050505_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            {/* ═══ AUTH ═══ */}
            {view === 'auth' && (
                <div className="z-10 flex flex-col items-center justify-center min-h-screen px-6 w-full max-w-md">
                    <h1 className="text-5xl sm:text-6xl font-bold italic text-[#A020F0] font-pixel mb-2 tracking-tighter">Gauntlet.</h1>
                    <p className="font-mono text-zinc-600 uppercase mb-12" style={{ fontSize: 10, letterSpacing: '0.3em' }}>By Gawkers</p>
                    <a href="/api/auth/twitter" className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold uppercase font-pixel py-4 hover:bg-[#A020F0] hover:text-black transition-all no-underline" style={{ fontSize: 14, letterSpacing: '0.05em' }}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                        Connect with X
                    </a>
                    {authError && <p className="font-mono text-red-400 mt-4 text-center" style={{ fontSize: 11 }}>{authError}</p>}
                    <p className="font-mono text-zinc-700 mt-8 text-center leading-relaxed" style={{ fontSize: 10 }}>Top 300 gamers who clear Level 3 earns GawkLord <br /> (Gawkers Free Mint Phase) </p>
                </div>
            )}

            {/* ═══ HUB ═══ */}
            {view === 'hub' && player && (
                <div className="z-10 w-full max-w-4xl px-5 sm:px-8 py-8 min-h-screen">
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                        <div>
                            <h1 className="text-4xl sm:text-5xl font-bold italic text-[#A020F0] font-pixel tracking-tighter">GAWKERS.</h1>
                            <p className="font-mono text-zinc-600 uppercase" style={{ fontSize: 10, letterSpacing: '0.3em' }}>The Gauntlet</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setView('leaderboard')} className="font-mono uppercase text-zinc-500 border border-white/[0.06] px-4 py-2 hover:border-[#A020F0]/40 hover:text-white transition-all" style={{ fontSize: 10, letterSpacing: '0.1em' }}>Leaderboard</button>
                            <button onClick={() => setView('profile')} className="flex items-center gap-2 border border-white/[0.06] px-3 py-1.5 hover:border-[#A020F0]/40 transition-all">
                                <Avatar src={player.profile_image_url} handle={player.twitter_handle} size={24} />
                                <span className="font-mono text-zinc-400 uppercase" style={{ fontSize: 10 }}>@{player.twitter_handle}</span>
                            </button>
                        </div>
                    </header>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-0.5 mb-10">
                        {[
                            { label: 'Total Score', value: (player.total_score || 0).toLocaleString() },
                            { label: 'Games', value: player.total_games || 0 },
                            { label: 'Kills', value: player.total_kills || 0 },
                            { label: 'Streak', value: player.current_streak || 0 },
                        ].map((s, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/[0.04] p-4 sm:p-5 text-center">
                                <div className="font-mono text-zinc-600 uppercase mb-1" style={{ fontSize: 9, letterSpacing: '0.15em' }}>{s.label}</div>
                                <div className="font-pixel text-xl sm:text-2xl font-bold text-white">{s.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mb-10">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-zinc-500 uppercase" style={{ fontSize: 10, letterSpacing: '0.15em' }}>Gauntlet Progress</span>
                            <span className="font-mono uppercase" style={{ fontSize: 10, color: player.completed ? '#22c55e' : '#A020F0' }}>
                                {player.completed ? 'Complete' : `Level ${player.current_level}`}
                            </span>
                        </div>
                        <div className="h-2 bg-zinc-900 w-full border border-white/[0.04] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#A020F0] to-purple-400 transition-all duration-1000" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {[1, 2, 3].map((lvl) => {
                            const locked = lvl > player.current_level;
                            const cleared = lvl < player.current_level;
                            const levelBest = getLevelBest(lvl);
                            return (
                                <button key={lvl} disabled={locked} onClick={() => startLevel(lvl)}
                                    className={`relative p-8 sm:p-10 flex flex-col items-center justify-center border transition-all overflow-hidden group ${locked ? 'border-white/[0.03] bg-transparent cursor-not-allowed opacity-30' : 'border-white/[0.06] bg-white/[0.02] hover:border-[#A020F0]/50 hover:bg-[#A020F0]/[0.03] cursor-pointer'}`}>
                                    {!locked && <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#A020F0]/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />}
                                    <span className={`text-5xl sm:text-6xl font-bold italic mb-3 font-pixel transition-transform group-hover:scale-105 ${locked ? 'text-zinc-800' : 'text-white'}`}>{lvl}</span>
                                    <span className="font-mono uppercase font-semibold" style={{ fontSize: 10, letterSpacing: '0.15em', color: locked ? '#333' : cleared ? '#22c55e' : '#A020F0' }}>
                                        {locked ? 'Locked' : cleared ? 'Cleared' : 'Play'}
                                    </span>
                                    <span className="font-mono text-zinc-700 mt-1" style={{ fontSize: 9 }}>
                                        {lvl === 1 ? '800 pts' : lvl === 2 ? '1,500 pts' : '3,000 pts'}
                                    </span>
                                    {levelBest > 0 && <span className="font-mono text-zinc-500 mt-1" style={{ fontSize: 8 }}>Best: {levelBest}</span>}
                                    {cleared && <div className="absolute top-3 right-3 bg-green-500/10 border border-green-500/20 text-green-400 font-mono font-bold px-2 py-0.5" style={{ fontSize: 8 }}>✓</div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ GAME ═══ */}
            {view === 'game' && (
                <div className="z-10 flex items-center justify-center min-h-screen p-2">
                    <GameCanvas
                        levelToPlay={activeLevel}
                        gameToken={gameToken}
                        recMode={recMode}
                        onLevelWin={(lvl, sc, k, t) => submitScore(lvl, sc, k, t)}
                        onGameOver={(lvl, sc, k, t) => submitScore(lvl, sc, k, t)}
                        onRetry={handleRetry}
                        onQuit={handleQuitGame}
                    />
                </div>
            )}

            {/* ═══ LEADERBOARD ═══ */}
            {view === 'leaderboard' && (
                <div className="z-10 w-full max-w-3xl px-5 sm:px-8 py-8 min-h-screen">
                    <button onClick={() => setView('hub')} className="font-mono text-zinc-600 uppercase hover:text-white transition-colors mb-6 block" style={{ fontSize: 10 }}>← Back</button>
                    <h2 className="text-3xl sm:text-4xl font-bold italic text-white font-pixel mb-1 uppercase">Leaderboard</h2>
                    <p className="font-mono text-zinc-600 uppercase mb-8" style={{ fontSize: 10, letterSpacing: '0.2em' }}>Ranked by Total Score</p>

                    <div className="flex gap-0.5 mb-6">
                        {(['daily', 'weekly', 'overall'] as const).map(p => (
                            <button key={p} onClick={() => setLbPeriod(p)} className="font-mono uppercase font-semibold px-4 py-2 transition-all"
                                style={{ fontSize: 10, letterSpacing: '0.1em', background: lbPeriod === p ? '#A020F0' : 'rgba(255,255,255,0.02)', color: lbPeriod === p ? '#000' : '#666', border: lbPeriod === p ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="mb-6">
                        <input type="text" value={lbSearch} onChange={(e) => setLbSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchLeaderboard()}
                            placeholder="Search @username..." className="w-full bg-zinc-900 border border-white/[0.06] px-4 py-2.5 font-mono text-white outline-none focus:border-[#A020F0]/50 transition-colors" style={{ fontSize: 12 }} />
                    </div>

                    <div className="border border-white/[0.04] overflow-x-auto">
                        {lbLoading ? (
                            <div className="py-12 flex justify-center"><GawkerLoader text="Fetching" /></div>
                        ) : lbData.length === 0 ? (
                            <div className="py-12 text-center font-mono text-zinc-600" style={{ fontSize: 11 }}>No data yet</div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/[0.04]">
                                        {['#', 'Player', 'Total Score', 'Lvl', 'Games'].map(h => (
                                            <th key={h} className="font-mono text-zinc-600 uppercase text-left px-4 py-3" style={{ fontSize: 9, letterSpacing: '0.15em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lbData.map((row: any, i: number) => (
                                        <tr key={i} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${player?.twitter_handle === row.twitter_handle ? 'bg-[#A020F0]/[0.05]' : ''}`}>
                                            <td className="px-4 py-3 font-mono font-bold" style={{ fontSize: 12, color: parseInt(row.rank) <= 3 ? '#A020F0' : '#555' }}>{row.rank}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar src={row.profile_image_url} handle={row.twitter_handle} size={28} />
                                                    <span className="font-mono text-white" style={{ fontSize: 12 }}>@{row.twitter_handle}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-pixel font-bold text-white" style={{ fontSize: 14 }}>{Number(row.total_score).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono text-zinc-500" style={{ fontSize: 11 }}>{row.level}</td>
                                            <td className="px-4 py-3 font-mono text-zinc-600" style={{ fontSize: 11 }}>{row.games}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ PROFILE ═══ */}
            {view === 'profile' && player && (
                <div className="z-10 w-full max-w-2xl px-5 sm:px-8 py-8 min-h-screen">
                    <button onClick={() => setView('hub')} className="font-mono text-zinc-600 uppercase hover:text-white transition-colors mb-6 block" style={{ fontSize: 10 }}>← Back</button>

                    <div className="flex items-center gap-4 mb-8">
                        <Avatar src={player.profile_image_url} handle={player.twitter_handle} size={56} />
                        <div className="flex-1">
                            <h2 className="text-2xl sm:text-3xl font-bold italic text-white font-pixel">@{player.twitter_handle}</h2>
                            <p className="font-mono uppercase mt-0.5" style={{ fontSize: 10, letterSpacing: '0.15em', color: player.completed ? '#22c55e' : '#A020F0' }}>
                                {player.completed ? 'Gauntlet Complete ✓' : `Level ${player.current_level} / 3`}
                            </p>
                        </div>
                        {player.rank && (
                            <div className="text-right">
                                <div className="font-mono text-zinc-600 uppercase" style={{ fontSize: 9 }}>Rank</div>
                                <div className="text-3xl font-bold font-pixel" style={{ color: player.rank <= 300 ? '#A020F0' : '#fff' }}>#{player.rank}</div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5 mb-8">
                        {[
                            { label: 'Total Score', value: (player.total_score || 0).toLocaleString(), accent: true },
                            { label: 'Total Games', value: player.total_games || 0, accent: false },
                            { label: 'Total Kills', value: player.total_kills || 0, accent: false },
                            { label: 'Win Streak', value: player.current_streak || 0, accent: false },
                            { label: 'Best Streak', value: player.best_streak || 0, accent: false },
                            { label: 'Level', value: `${Math.min(player.current_level, 3)} / 3`, accent: false },
                        ].map((s, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/[0.04] p-4 sm:p-5">
                                <div className="font-mono text-zinc-600 uppercase mb-1" style={{ fontSize: 9, letterSpacing: '0.15em' }}>{s.label}</div>
                                <div className={`font-pixel text-xl font-bold ${s.accent ? 'text-[#A020F0]' : 'text-white'}`}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mb-8">
                        <h3 className="font-mono text-zinc-500 uppercase mb-3" style={{ fontSize: 10, letterSpacing: '0.15em' }}>Best Score Per Level</h3>
                        <div className="grid grid-cols-3 gap-0.5">
                            {[1, 2, 3].map(lvl => {
                                const best = getLevelBest(lvl);
                                const target = TARGET_SCORE[lvl];
                                const cleared = best >= target;
                                return (
                                    <div key={lvl} className="bg-white/[0.02] border border-white/[0.04] p-4 text-center">
                                        <div className="font-mono text-zinc-600 uppercase mb-1" style={{ fontSize: 9 }}>Level {lvl}</div>
                                        <div className="font-pixel text-lg font-bold" style={{ color: cleared ? '#22c55e' : best > 0 ? '#fff' : '#333' }}>
                                            {best > 0 ? best : '—'}
                                        </div>
                                        <div className="font-mono mt-1" style={{ fontSize: 8, color: cleared ? '#22c55e' : '#444' }}>
                                            {cleared ? 'CLEARED' : `/ ${target}`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex justify-between mb-2">
                            <span className="font-mono text-zinc-500 uppercase" style={{ fontSize: 10 }}>Gauntlet Progress</span>
                            <span className="font-mono text-[#A020F0]" style={{ fontSize: 10 }}>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-3 bg-zinc-900 border border-white/[0.04] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#A020F0] to-purple-400 transition-all duration-1000" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    {player.recent_scores && player.recent_scores.length > 0 && (
                        <div>
                            <h3 className="font-mono text-zinc-500 uppercase mb-3" style={{ fontSize: 10, letterSpacing: '0.15em' }}>Recent Games</h3>
                            <div className="border border-white/[0.04]">
                                {player.recent_scores.map((s: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.02] last:border-0">
                                        <div className="flex items-center gap-4">
                                            <span className="font-mono text-zinc-600" style={{ fontSize: 10 }}>Lvl {s.level}</span>
                                            <span className="font-pixel font-bold text-white" style={{ fontSize: 14 }}>{s.score}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-mono text-zinc-600" style={{ fontSize: 10 }}>{s.kills} kills</span>
                                            <span className={`font-mono font-bold ${s.score >= (TARGET_SCORE[s.level as 1 | 2 | 3] || 800) ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: 10 }}>
                                                {s.score >= (TARGET_SCORE[s.level as 1 | 2 | 3] || 800) ? 'WIN' : 'LOSS'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button onClick={handleLogout} className="mt-10 font-mono text-zinc-700 uppercase hover:text-red-400 transition-colors" style={{ fontSize: 10, letterSpacing: '0.1em' }}>Disconnect</button>
                </div>
            )}
        </main>
    );
}