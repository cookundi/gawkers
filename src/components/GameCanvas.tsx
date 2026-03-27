'use client';
import React, { useEffect, useRef, useState } from 'react';

const CHARACTERS = [
    { id: 1, name: 'Gawker Prime', url: 'https://i.imgur.com/4sBhVbB.png' }, 
    { id: 2, name: 'Neon Gawker', url: 'https://i.imgur.com/q3JeLr5.png' },
    { id: 3, name: 'Deep Sea', url: 'https://i.imgur.com/fxZVD8Q.png' },
];

interface GameProps {
    levelToPlay: number;
    onLevelWin: (level: number, score: number) => void;
    onQuit: () => void;
}

export const GameCanvas = ({ levelToPlay, onLevelWin, onQuit }: GameProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<'selection' | 'playing' | 'paused' | 'gameover' | 'win'>('selection');
    const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);

    // Audio Refs
    const sfx = useRef<{ [key: string]: HTMLAudioElement | null }>({});
    const bgMusic = useRef<HTMLAudioElement | null>(null);

    // Gameplay Refs
    const player = useRef({ x: 175, y: 500, w: 50, h: 50, recoil: 0 });
    const enemies = useRef<any[]>([]);
    const bullets = useRef<any[]>([]);
    const score = useRef(0);
    const frame = useRef(0);
    const startTime = useRef(Date.now());
    const targetScore = levelToPlay === 1 ? 500 : levelToPlay === 2 ? 1000 : 2000;

    useEffect(() => {
        sfx.current = {
            shoot: new Audio('/laser.mp3'),
            explode: new Audio('/explosion.mp3'),
            win: new Audio('/levelup.mp3'),
        };
        
        bgMusic.current = new Audio('/bg-music.mp3');
        if (bgMusic.current) {
            bgMusic.current.loop = true;
            bgMusic.current.volume = 0.15;
        }

        return () => {
            bgMusic.current?.pause();
            bgMusic.current = null;
        };
    }, []);

    const playSound = (sound: HTMLAudioElement | undefined | null, vol = 0.2) => {
        if (sound) {
            const clone = sound.cloneNode() as HTMLAudioElement;
            clone.volume = vol;
            clone.play().catch(() => {}); 
        }
    };

    const initGame = (url: string) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => {
            setSelectedImg(img);
            setGameState('playing');
            bgMusic.current?.play().catch(() => {});
            
            // Reset game state
            score.current = 0;
            enemies.current = [];
            bullets.current = [];
            frame.current = 0;
            player.current.x = 175;
            player.current.recoil = 0;
            startTime.current = Date.now();
        };
    };

    const drawBombEnemy = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
        ctx.save();
        ctx.translate(x + size / 2, y + size / 2);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.fillRect(-size / 4, -size / 6, size / 6, size / 6);
        ctx.fillRect(size / 10, -size / 6, size / 6, size / 6);
        ctx.fillStyle = 'red';
        ctx.fillRect(-size / 4 + 2, -size / 6 + 2, 3, 3);
        ctx.fillRect(size / 10 + 2, -size / 6 + 2, 3, 3);
        ctx.restore();
    };

    useEffect(() => {
        if (gameState !== 'playing' || !canvasRef.current || !selectedImg) {
            if (gameState !== 'playing' && gameState !== 'paused' && gameState !== 'win') {
                bgMusic.current?.pause();
            }
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d')!;
        let animationId: number;
        const keys: Record<string, boolean> = {};

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'p') setGameState('paused');
            keys[e.key] = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => keys[e.key] = false;
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        const loop = () => {
            frame.current++;
            const secondsElapsed = Math.floor((Date.now() - startTime.current) / 1000);
            const timeDifficultyBoost = Math.floor(secondsElapsed / 10) * 0.8;

            // --- MOVEMENT + RECOIL (ANTI-CAMP) ---
            if (keys['a'] || keys['ArrowLeft']) player.current.x -= 8;
            if (keys['d'] || keys['ArrowRight']) player.current.x += 8;
            
            player.current.x += player.current.recoil;
            player.current.recoil *= 0.92; // Decay recoil over time
            player.current.x = Math.max(0, Math.min(canvas.width - player.current.w, player.current.x));

            // Shooting
            if (frame.current % 20 === 0) {
                bullets.current.push({ x: player.current.x + 23, y: player.current.y });
                // Kick the player randomly left or right when shooting
                player.current.recoil = (Math.random() - 0.5) * 12;
                playSound(sfx.current.shoot, 0.1);
            }

            // Spawning
            if (frame.current % Math.max(15, 45 - (levelToPlay * 5)) === 0) {
                const rand = Math.random();
                let type = rand > 0.8 ? 'big' : rand > 0.5 ? 'mid' : 'small';
                enemies.current.push({
                    x: Math.random() * (canvas.width - 60),
                    y: -60,
                    w: type === 'small' ? 35 : type === 'mid' ? 55 : 90,
                    h: type === 'small' ? 35 : type === 'mid' ? 55 : 90,
                    hp: type === 'small' ? 1 : type === 'mid' ? 2 : 3,
                    type,
                    speed: (type === 'small' ? 6 : type === 'mid' ? 4 : 2.5) + timeDifficultyBoost
                });
            }

            // Update Bullets
            bullets.current.forEach((b, bi) => {
                b.y -= 12;
                if (b.y < 0) bullets.current.splice(bi, 1);
            });

            // Update Enemies + Collision
            enemies.current.forEach((en, ei) => {
                en.y += en.speed;
                
                // Bullet collision
                bullets.current.forEach((b, bi) => {
                    if (b.x > en.x && b.x < en.x + en.w && b.y < en.y + en.h && b.y > en.y) {
                        en.hp--;
                        bullets.current.splice(bi, 1);
                        if (en.hp <= 0) {
                            score.current += en.type === 'small' ? 10 : en.type === 'mid' ? 30 : 50;
                            enemies.current.splice(ei, 1);
                            playSound(sfx.current.explode, 0.15);
                        }
                    }
                });

                // Player collision
                if (player.current.x < en.x + en.w - 10 && player.current.x + 40 > en.x + 10 && player.current.y < en.y + en.h - 10 && player.current.y + 40 > en.y + 10) {
                    setGameState('gameover');
                }

                if (en.y > canvas.height) enemies.current.splice(ei, 1);
            });

            // Win Condition
            if (score.current >= targetScore) {
                setGameState('win');
                playSound(sfx.current.win, 0.3);
            }

            // DRAWING
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Grid lines
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1;
            for (let i = 0; i < canvas.width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
            for (let i = 0; i < canvas.height; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

            // Bullets
            ctx.fillStyle = '#A020F0';
            bullets.current.forEach(b => ctx.fillRect(b.x, b.y, 4, 15));

            // Enemies
            enemies.current.forEach(en => {
                const color = en.type === 'small' ? '#550000' : en.type === 'mid' ? '#880000' : '#bb0000';
                drawBombEnemy(ctx, en.x, en.y, en.w, color);
            });

            // Player
            ctx.drawImage(selectedImg, player.current.x, player.current.y, 50, 50);

            // Score UI
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(`SCORE: ${score.current} / ${targetScore}`, 20, 30);

            if (gameState === 'playing') animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState, selectedImg, levelToPlay, targetScore]);

    return (
        <div className="relative border-4 border-purple-900/50 bg-black shadow-[0_0_50px_rgba(160,32,240,0.2)] overflow-hidden">
            <canvas ref={canvasRef} width={400} height={600} className="block" />
            
            {/* UI: Playing / Pause Button */}
            {gameState === 'playing' && (
                <button 
                    onClick={() => setGameState('paused')} 
                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 text-[10px] text-white uppercase font-bold transition-colors"
                >
                    Pause (P)
                </button>
            )}

            {/* UI: Selection Screen */}
            {gameState === 'selection' && (
                <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 text-center z-10">
                    <h2 className="text-2xl font-black mb-8 text-purple-500 uppercase italic tracking-tighter">Select Your Vessel</h2>
                    <div className="grid grid-cols-3 gap-4 mb-10">
                        {CHARACTERS.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => initGame(c.url)} 
                                className="group border border-white/10 p-2 bg-zinc-900/50 hover:border-purple-500 hover:bg-purple-900/20 transition-all"
                            >
                                <img src={c.url} alt={c.name} className="w-16 h-16 object-contain mx-auto" />
                                <p className="text-[8px] text-white/40 mt-1 uppercase font-bold">{c.name}</p>
                            </button>
                        ))}
                    </div>
                    <button onClick={onQuit} className="text-[10px] text-zinc-500 uppercase underline hover:text-white transition-colors">Quit Game</button>
                </div>
            )}

            {/* UI: Paused Screen */}
            {gameState === 'paused' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                    <h2 className="text-4xl font-black mb-8 text-white italic tracking-widest">SYSTEM PAUSED</h2>
                    <button 
                        onClick={() => setGameState('playing')} 
                        className="bg-purple-600 hover:bg-purple-500 text-white px-12 py-4 font-black uppercase shadow-lg shadow-purple-500/20"
                    >
                        Resume Engine
                    </button>
                </div>
            )}

            {/* UI: Win Screen */}
            {gameState === 'win' && (
                <div className="absolute inset-0 bg-zinc-900/90 flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in duration-300">
                    <div className="border-2 border-purple-500 p-8 bg-black shadow-[0_0_40px_rgba(160,32,240,0.5)]">
                        <h2 className="text-4xl font-black mb-2 text-white italic tracking-tighter uppercase">Level Complete</h2>
                        <p className="text-purple-400 font-mono text-xs mb-6 uppercase tracking-[0.3em]">Sector Secured</p>
                        <div className="mb-8">
                            <p className="text-white/40 text-[10px] uppercase font-bold">Data Harvested</p>
                            <p className="text-4xl font-black text-white">{score.current}</p>
                        </div>
                        <button 
                            onClick={() => onLevelWin(levelToPlay, score.current)} 
                            className="w-full bg-white text-black py-4 font-black uppercase hover:bg-purple-500 hover:text-white transition-all transform active:scale-95"
                        >
                            Next Level
                        </button>
                    </div>
                </div>
            )}

            {/* UI: Game Over Screen */}
            {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-6 z-40">
                    <h2 className="text-6xl font-black mb-2 text-white italic tracking-tighter">WRECKED</h2>
                    <p className="mb-10 font-mono text-white/50 text-xs uppercase tracking-widest">Final Score: {score.current}</p>
                    <button 
                        onClick={() => setGameState('selection')} 
                        className="w-full bg-white text-black py-4 font-black uppercase mb-4 hover:bg-red-500 hover:text-white transition-all"
                    >
                        Restart System
                    </button>
                    <button onClick={onQuit} className="text-white/40 uppercase text-[10px] underline hover:text-white transition-colors">Abort Mission</button>
                </div>
            )}
        </div>
    );
};