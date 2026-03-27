// 'use client';
// import { usePrivy } from '@privy-io/react-auth';
// import { useState, useEffect } from 'react';
// import { GameCanvas } from '@/components/GameCanvas';

// export default function Home() {
//   const { login, logout, authenticated, user } = usePrivy();
//   const [activeLevel, setActiveLevel] = useState<number | null>(null);
//   const [maxUnlocked, setMaxUnlocked] = useState(1);
//   const [isWhitelisted, setIsWhitelisted] = useState(false);
//   const [showProfile, setShowProfile] = useState(false);

//   useEffect(() => {
//     async function loadProgress() {
//       if (authenticated && user?.wallet?.address) {
//         const res = await fetch(`/api/player?wallet=${user.wallet.address}`);
//         const data = await res.json();
//         if (data.current_level) setMaxUnlocked(data.current_level);
//         if (data.completed) setIsWhitelisted(true);
//       }
//     }
//     loadProgress();
//   }, [authenticated, user]);

//   const handleLevelWin = async (wonLevel: number) => {
//     if (!user?.wallet?.address) return;
//     const nextLevel = wonLevel + 1;
//     await fetch('/api/player', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ walletAddress: user.wallet.address, action: 'complete', level: nextLevel })
//     });
//     if (nextLevel > maxUnlocked) setMaxUnlocked(nextLevel);
//   };

//   const progress = Math.min(((maxUnlocked - 1) / 3) * 100, 100);

//   return (
//     <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
//       {/* Visual background details */}
//       <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-900/10 to-transparent" />
      
//       {!activeLevel ? (
//         <div className="max-w-4xl w-full z-10 flex flex-col items-center">
//           <header className="w-full flex justify-between items-center mb-20">
//             <div>
//               <h1 className="text-5xl font-black italic tracking-tighter text-purple-600">GAWKERS.</h1>
//               <p className="text-zinc-600 text-[10px] uppercase tracking-[0.5em]">The Gauntlet v2.0</p>
//             </div>
            
//             {authenticated && (
//               <button 
//                 onClick={() => setShowProfile(!showProfile)}
//                 className="bg-zinc-900 border border-white/10 px-6 py-2 text-[10px] font-bold uppercase hover:bg-white hover:text-black transition-all"
//               >
//                 {showProfile ? 'Hide Profile' : 'User Profile'}
//               </button>
//             )}
//           </header>

//           {showProfile && authenticated && (
//             <div className="w-full max-w-md mb-12 p-6 border border-purple-500/20 bg-zinc-900/50 backdrop-blur-md animate-in fade-in slide-in-from-top-4">
//               <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
//                 <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Pilot Profile</span>
//                 <button onClick={logout} className="text-red-500 text-[10px] font-bold uppercase hover:underline">Logout</button>
//               </div>
//               <div className="space-y-6">
//                 <div>
//                     <p className="text-[9px] text-zinc-500 uppercase mb-1">Wallet Address</p>
//                     <p className="text-xs font-mono break-all text-zinc-300">{user?.wallet?.address}</p>
//                 </div>
//                 <div>
//                     <div className="flex justify-between text-[10px] font-black uppercase mb-2">
//                         <span>Whitelist Status</span>
//                         <span className={isWhitelisted ? "text-green-500" : "text-zinc-500"}>
//                             {isWhitelisted ? "Secured" : "In Progress"}
//                         </span>
//                     </div>
//                     <div className="h-1.5 bg-black w-full border border-white/5 overflow-hidden">
//                         <div className="h-full bg-purple-600 transition-all duration-700" style={{ width: `${progress}%` }} />
//                     </div>
//                 </div>
//               </div>
//             </div>
//           )}

//           {!authenticated ? (
//             <button onClick={login} className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all shadow-[10px_10px_0px_rgba(147,51,234,0.3)]">
//               Connect Identity
//             </button>
//           ) : (
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
//               {[1, 2, 3].map((lvl) => {
//                 const isLocked = lvl > maxUnlocked;
//                 return (
//                   <button
//                     key={lvl}
//                     disabled={isLocked}
//                     onClick={() => setActiveLevel(lvl)}
//                     className={`relative p-12 flex flex-col items-center justify-center border-2 transition-all group ${
//                       isLocked ? 'border-white/5 opacity-20 cursor-not-allowed' : 'border-purple-600/20 hover:border-purple-600 bg-zinc-900/20'
//                     }`}
//                   >
//                     <span className="text-6xl font-black italic mb-4">{lvl}</span>
//                     <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-white">
//                       {isLocked ? 'Sector Locked' : 'Engage'}
//                     </span>
//                     {lvl < maxUnlocked && (
//                       <div className="absolute top-4 right-4 text-[8px] bg-green-500 text-black px-2 py-0.5 font-black uppercase">Cleared</div>
//                     )}
//                   </button>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       ) : (
//         <GameCanvas 
//           levelToPlay={activeLevel} 
//           onLevelWin={handleLevelWin} 
//           onQuit={() => setActiveLevel(null)} 
//         />
//       )}
      
//       <footer className="fixed bottom-8 text-zinc-800 text-[8px] uppercase tracking-[0.5em] font-bold pointer-events-none">
//         Neon Protocol // Base Mainnet
//       </footer>
//     </main>
//   );
// }


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

  // Fix: Monitor maxUnlocked to progress to the next level automatically
  useEffect(() => {
    if (activeLevel && maxUnlocked > activeLevel) {
       // Logic to transition can go here if needed, but the button now works
    }
  }, [maxUnlocked, activeLevel]);

  const handleLevelWin = async (wonLevel: number) => {
    if (!user?.wallet?.address) return;
    const nextLevel = wonLevel + 1;
    
    // Optimistic UI update
    if (nextLevel > maxUnlocked) setMaxUnlocked(nextLevel);
    
    // Trigger next level automatically or stay in selection
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
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-900/10 to-transparent" />
      
      {!activeLevel ? (
        <div className="max-w-4xl w-full z-10 flex flex-col items-center">
          <header className="w-full flex justify-between items-center mb-20">
            <div>
              <h1 className="text-5xl font-black italic tracking-tighter text-purple-600">GAWKERS.</h1>
              <p className="text-zinc-600 text-[10px] uppercase tracking-[0.5em]">The Gauntlet v2.0</p>
            </div>
            
            {authenticated && (
              <button 
                onClick={() => setShowProfile(!showProfile)}
                className="bg-zinc-900 border border-white/10 px-6 py-2 text-[10px] font-bold uppercase hover:bg-white hover:text-black transition-all"
              >
                {showProfile ? 'Hide Profile' : 'User Profile'}
              </button>
            )}
          </header>

          {showProfile && authenticated && (
            <div className="w-full max-w-md mb-12 p-6 border border-purple-500/20 bg-zinc-900/50 backdrop-blur-md animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Pilot Profile</span>
                <button onClick={logout} className="text-red-500 text-[10px] font-bold uppercase hover:underline">Logout</button>
              </div>
              <div className="space-y-6">
                <div>
                    <p className="text-[9px] text-zinc-500 uppercase mb-1">Wallet Address</p>
                    <p className="text-xs font-mono break-all text-zinc-300">{user?.wallet?.address}</p>
                </div>
                <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                        <span>Whitelist Status</span>
                        <span className={isWhitelisted ? "text-green-500" : "text-zinc-500"}>
                            {isWhitelisted ? "Secured" : "In Progress"}
                        </span>
                    </div>
                    <div className="h-1.5 bg-black w-full border border-white/5 overflow-hidden">
                        <div className="h-full bg-purple-600 transition-all duration-700" style={{ width: `${progress}%` }} />
                    </div>
                </div>
              </div>
            </div>
          )}

          {!authenticated ? (
            <button onClick={login} className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all shadow-[10px_10px_0px_rgba(147,51,234,0.3)]">
              Connect Identity
            </button>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              {[1, 2, 3].map((lvl) => {
                const isLocked = lvl > maxUnlocked;
                return (
                  <button
                    key={lvl}
                    disabled={isLocked}
                    onClick={() => setActiveLevel(lvl)}
                    className={`relative p-12 flex flex-col items-center justify-center border-2 transition-all group ${
                      isLocked ? 'border-white/5 opacity-20 cursor-not-allowed' : 'border-purple-600/20 hover:border-purple-600 bg-zinc-900/20'
                    }`}
                  >
                    <span className="text-6xl font-black italic mb-4">{lvl}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-white">
                      {isLocked ? 'Sector Locked' : 'Engage'}
                    </span>
                    {lvl < maxUnlocked && (
                      <div className="absolute top-4 right-4 text-[8px] bg-green-500 text-black px-2 py-0.5 font-black uppercase">Cleared</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <GameCanvas 
          levelToPlay={activeLevel} 
          onLevelWin={handleLevelWin} 
          onQuit={() => setActiveLevel(null)} 
        />
      )}
      
      <footer className="fixed bottom-8 text-zinc-800 text-[8px] uppercase tracking-[0.5em] font-bold pointer-events-none">
        Neon Protocol // Base Mainnet
      </footer>
    </main>
  );
}