'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { GameCanvas } from '@/components/GameCanvas';

export default function Home() {
  const { login, logout, authenticated, user } = usePrivy();
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [maxUnlocked, setMaxUnlocked] = useState(1);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    async function loadProgress() {
      if (authenticated && user?.wallet?.address) {
        const res = await fetch(`/api/player?wallet=${user.wallet.address}`);
        const data = await res.json();
        if (data.current_level) setMaxUnlocked(data.current_level);
        if (data.completed) setIsWhitelisted(true);
      }
    }
    loadProgress();
  }, [authenticated, user]);

  useEffect(() => {
    if (activeLevel && maxUnlocked > activeLevel) {
       // Transition logic placeholder
    }
  }, [maxUnlocked, activeLevel]);

  const handleLevelWin = async (wonLevel: number) => {
    if (!user?.wallet?.address) return;
    const nextLevel = wonLevel + 1;
    if (nextLevel > maxUnlocked) setMaxUnlocked(nextLevel);
    setActiveLevel(null); 

    await fetch('/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: user.wallet.address, action: 'complete', level: nextLevel })
    });
  };

  const progress = Math.min(((maxUnlocked - 1) / 3) * 100, 100);

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* GAMING VIBE BACKGROUND ELEMENTS */}
      <div className="absolute inset-0 z-0">
        {/* Radial Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a0033_0%,#050505_100%)]" />
        
        {/* Moving Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        {/* Animated Floating Orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px] animate-pulse [animation-delay:1s]" />
      </div>

      {/* DECORATIVE CORNERS */}
      <div className="absolute top-10 left-10 w-20 h-20 border-t-2 border-l-2 border-purple-500/30 z-0" />
      <div className="absolute top-10 right-10 w-20 h-20 border-t-2 border-r-2 border-purple-500/30 z-0" />
      <div className="absolute bottom-10 left-10 w-20 h-20 border-b-2 border-l-2 border-purple-500/30 z-0" />
      <div className="absolute bottom-10 right-10 w-20 h-20 border-b-2 border-r-2 border-purple-500/30 z-0" />
      
      {!activeLevel ? (
        <div className="max-w-4xl w-full z-10 flex flex-col items-center">
          <header className="w-full flex justify-between items-center mb-20">
            <div className="relative">
              <h1 className="text-6xl font-black italic tracking-tighter text-purple-600 drop-shadow-[0_0_15px_rgba(160,32,240,0.5)]">GAWKERS.</h1>
              <div className="flex items-center gap-2">
                <div className="h-[1px] w-8 bg-purple-500/50" />
                <p className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] font-bold">The Gauntlet</p>
              </div>
            </div>
            
            {authenticated && (
              <button 
                onClick={() => setShowProfile(!showProfile)}
                className="group relative bg-zinc-900 border border-purple-500/30 px-6 py-2 text-[10px] font-bold uppercase overflow-hidden transition-all hover:border-purple-500"
              >
                <div className="absolute inset-0 bg-purple-500/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                <span className="relative z-10">{showProfile ? 'Close Uplink' : 'Pilot Profile'}</span>
              </button>
            )}
          </header>

          {showProfile && authenticated && (
            <div className="w-full max-w-md mb-12 p-6 border border-purple-500/40 bg-black/60 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 animate-ping rounded-full" />
                  Pilot Profile
                </span>
                <button onClick={logout} className="text-zinc-500 text-[10px] font-bold uppercase hover:text-red-500 transition-colors">Terminate Session</button>
              </div>
              <div className="space-y-6">
                <div>
                    <p className="text-[9px] text-zinc-500 uppercase mb-1 font-bold">Address</p>
                    <p className="text-xs font-mono break-all text-purple-200/70">{user?.wallet?.address}</p>
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                        <span className="text-zinc-400">Whitelist Progress</span>
                        <span className={isWhitelisted ? "text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.4)]" : "text-purple-400"}>
                            {isWhitelisted ? "Under Review" : "In Progress"}
                        </span>
                    </div>
                    <div className="h-2 bg-zinc-900 w-full rounded-full border border-white/5 overflow-hidden p-[2px]">
                        <div className="h-full bg-gradient-to-r from-purple-800 to-purple-400 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                </div>
              </div>
            </div>
          )}

          {!authenticated ? (
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200" />
                <button onClick={login} className="relative px-16 py-6 bg-white text-black font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all duration-300">
                Connect Identity
                </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              {[1, 2, 3].map((lvl) => {
                const isLocked = lvl > maxUnlocked;
                return (
                  <button
                    key={lvl}
                    disabled={isLocked}
                    onClick={() => setActiveLevel(lvl)}
                    className={`relative p-12 flex flex-col items-center justify-center border-2 transition-all duration-500 overflow-hidden group ${
                      isLocked 
                        ? 'border-white/5 bg-transparent cursor-not-allowed grayscale' 
                        : 'border-purple-600/20 hover:border-purple-500 bg-zinc-900/40 hover:bg-purple-950/20 shadow-[0_0_20px_rgba(0,0,0,0.3)]'
                    }`}
                  >
                    {!isLocked && (
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    )}
                    <span className={`text-7xl font-black italic mb-4 transition-transform group-hover:scale-110 ${isLocked ? 'text-zinc-800' : 'text-white'}`}>{lvl}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isLocked ? 'text-zinc-700' : 'text-purple-400 group-hover:text-white'}`}>
                      {isLocked ? 'Locked' : 'Initiate'}
                    </span>
                    {lvl < maxUnlocked && (
                      <div className="absolute top-4 right-4 text-[8px] bg-green-500 text-black px-2 py-1 font-black uppercase shadow-[0_0_10px_rgba(34,197,94,0.4)]">Complete</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="z-10 animate-in zoom-in-95 duration-500">
            <GameCanvas 
              levelToPlay={activeLevel} 
              onLevelWin={handleLevelWin} 
              onQuit={() => setActiveLevel(null)} 
            />
        </div>
      )}
    </main>
  );
}