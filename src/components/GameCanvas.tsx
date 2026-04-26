'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

const CHARACTERS = [
    { id: 1, name: 'Steezed Gawker', url: 'https://i.imgur.com/4sBhVbB.png' },
    { id: 2, name: 'Gawk Papi', url: 'https://i.imgur.com/q3JeLr5.png' },
    { id: 3, name: 'Deep Sea', url: 'https://i.imgur.com/fxZVD8Q.png' },
];

const TARGET_SCORE: Record<number, number> = { 1: 800, 2: 1500, 3: 3000 };
const CANVAS_W = 400;
const CANVAS_H = 600;

type EnemyType = 'small' | 'mid' | 'big' | 'shooter';
type MovementPattern = 'straight' | 'zigzag' | 'sine';

interface Enemy {
    x: number; y: number; w: number; h: number;
    hp: number; maxHp: number;
    type: EnemyType;
    speed: number;
    pattern: MovementPattern;
    spawnX: number;
    age: number;
    shootCooldown: number;
}

interface EnemyBullet {
    x: number; y: number; speed: number;
}

interface GameProps {
    levelToPlay: number;
    gameToken: string;
    onLevelWin: (level: number, score: number, kills: number, timeMs: number) => void;
    onGameOver: (level: number, score: number, kills: number, timeMs: number) => void;
    onRetry: (level: number) => Promise<string>; // returns new game token
    onQuit: () => void;
}

export const GameCanvas = ({ levelToPlay, gameToken, onLevelWin, onGameOver, onRetry, onQuit }: GameProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [gameState, setGameState] = useState<'selection' | 'playing' | 'paused' | 'gameover' | 'win'>('selection');
    const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
    const [scale, setScale] = useState(1);
    const [finalScore, setFinalScore] = useState(0);
    const [finalKills, setFinalKills] = useState(0);
    const [retrying, setRetrying] = useState(false);

    // Audio
    const sfx = useRef<Record<string, HTMLAudioElement | null>>({});
    const bgMusic = useRef<HTMLAudioElement | null>(null);

    // Game state refs
    const player = useRef({ x: CANVAS_W / 2 - 25, y: CANVAS_H - 100, w: 50, h: 50, recoil: 0 });
    const enemies = useRef<Enemy[]>([]);
    const bullets = useRef<{ x: number; y: number }[]>([]);
    const enemyBullets = useRef<EnemyBullet[]>([]);
    const particles = useRef<any[]>([]);
    const floatTexts = useRef<{ x: number; y: number; text: string; life: number; color: string }[]>([]);
    const score = useRef(0);
    const kills = useRef(0);
    const frame = useRef(0);
    const startTime = useRef(Date.now());
    const gameStateRef = useRef(gameState);
    const shakeRef = useRef(0);
    const currentTokenRef = useRef(gameToken);
    const targetScore = TARGET_SCORE[levelToPlay] || 800;

    // Big-kill streak: 3 consecutive big-enemy kills → 2x on the 3rd
    const bigKillStreak = useRef(0);

    // Input
    const keys = useRef<Record<string, boolean>>({});
    const activePointers = useRef<Map<number, string>>(new Map());

    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { currentTokenRef.current = gameToken; }, [gameToken]);

    // Responsive scaling
    useEffect(() => {
        const resize = () => {
            if (!wrapperRef.current) return;
            const maxW = Math.min(window.innerWidth - 16, CANVAS_W);
            const maxH = Math.min(window.innerHeight - 16, CANVAS_H);
            setScale(Math.min(maxW / CANVAS_W, maxH / CANVAS_H));
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Audio setup
    useEffect(() => {
        sfx.current = {
            shoot: new Audio('/laser.mp3'),
            explode: new Audio('/explosion.mp3'),
            win: new Audio('/levelup.mp3'),
        };
        bgMusic.current = new Audio('/bg-music.mp3');
        if (bgMusic.current) { bgMusic.current.loop = true; bgMusic.current.volume = 0.15; }
        return () => { bgMusic.current?.pause(); bgMusic.current = null; };
    }, []);

    const playSound = (sound: HTMLAudioElement | null | undefined, vol = 0.2) => {
        if (!sound) return;
        const clone = sound.cloneNode() as HTMLAudioElement;
        clone.volume = vol;
        clone.play().catch(() => {});
    };

    const clearAllInput = useCallback(() => {
        keys.current = {};
        activePointers.current.clear();
    }, []);

    // Reset game state (used by both initGame and retry)
    const resetGameState = useCallback(() => {
        score.current = 0;
        kills.current = 0;
        bigKillStreak.current = 0;
        enemies.current = [];
        bullets.current = [];
        enemyBullets.current = [];
        particles.current = [];
        floatTexts.current = [];
        frame.current = 0;
        shakeRef.current = 0;
        player.current.x = CANVAS_W / 2 - 25;
        player.current.y = CANVAS_H - 100;
        player.current.recoil = 0;
        startTime.current = Date.now();
        clearAllInput();
    }, [clearAllInput]);

    const initGame = (url: string) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
            setSelectedImg(img);
            setGameState('playing');
            bgMusic.current?.play().catch(() => {});
            resetGameState();
        };
    };

    // Instant retry — same character, same level, new token
    const handleRetry = async () => {
        if (retrying) return;
        setRetrying(true);
        try {
            const newToken = await onRetry(levelToPlay);
            currentTokenRef.current = newToken;
            resetGameState();
            setGameState('playing');
            bgMusic.current?.play().catch(() => {});
        } catch {
            // If token fetch fails, fall back to hub
            onQuit();
        } finally {
            setRetrying(false);
        }
    };

    // Touch controls
    const handlePointerDown = useCallback((direction: string, pointerId: number) => {
        activePointers.current.set(pointerId, direction);
        keys.current[direction] = true;
    }, []);

    const handlePointerEnd = useCallback((pointerId: number) => {
        const direction = activePointers.current.get(pointerId);
        if (direction) {
            activePointers.current.delete(pointerId);
            let stillHeld = false;
            activePointers.current.forEach((dir) => { if (dir === direction) stillHeld = true; });
            if (!stillHeld) keys.current[direction] = false;
        }
    }, []);

    useEffect(() => {
        const onUp = (e: PointerEvent) => handlePointerEnd(e.pointerId);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => { window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
    }, [handlePointerEnd]);

    // Particles
    const spawnParticles = (x: number, y: number, color: string, count = 6) => {
        for (let i = 0; i < count; i++) {
            particles.current.push({
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 15 + Math.random() * 10,
                color,
                size: 2 + Math.random() * 3,
            });
        }
    };

    // Draw enemy
    const drawEnemy = (ctx: CanvasRenderingContext2D, en: Enemy) => {
        ctx.save();
        const cx = en.x + en.w / 2, cy = en.y + en.h / 2, r = en.w / 2;
        ctx.shadowColor = en.type === 'shooter' ? '#ffaa00' : en.type === 'big' ? '#ff0044' : en.type === 'mid' ? '#ff6600' : '#ff3333';
        ctx.shadowBlur = 8;
        ctx.fillStyle = en.type === 'shooter' ? '#cc8800' : en.type === 'big' ? '#cc0033' : en.type === 'mid' ? '#cc4400' : '#993333';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - r * 0.35, cy - r * 0.2, r * 0.25, r * 0.25);
        ctx.fillRect(cx + r * 0.1, cy - r * 0.2, r * 0.25, r * 0.25);
        ctx.fillStyle = en.type === 'shooter' ? '#ffaa00' : '#ff0000';
        ctx.fillRect(cx - r * 0.3, cy - r * 0.15, r * 0.12, r * 0.12);
        ctx.fillRect(cx + r * 0.15, cy - r * 0.15, r * 0.12, r * 0.12);
        if (en.type === 'shooter') { ctx.fillStyle = '#ffcc00'; ctx.fillRect(cx - 2, cy + r - 2, 4, 6); }
        ctx.restore();
    };

    // ═══ GAME LOOP ═══
    useEffect(() => {
        if (gameState !== 'playing' || !canvasRef.current || !selectedImg) {
            if (gameState === 'gameover' || gameState === 'selection') bgMusic.current?.pause();
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d')!;
        let animId: number;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'p') setGameState('paused');
            keys.current[e.key] = true;
        };
        const onKeyUp = (e: KeyboardEvent) => { keys.current[e.key] = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const loop = () => {
            if (gameStateRef.current !== 'playing') return;

            frame.current++;
            const elapsed = (Date.now() - startTime.current) / 1000;
            const diffBoost = Math.floor(elapsed / 8) * 0.5;

            // Movement
            const moveSpeed = 7;
            if (keys.current['a'] || keys.current['ArrowLeft'] || keys.current['left']) player.current.x -= moveSpeed;
            if (keys.current['d'] || keys.current['ArrowRight'] || keys.current['right']) player.current.x += moveSpeed;
            player.current.x += player.current.recoil;
            player.current.recoil *= 0.9;
            if (Math.abs(player.current.recoil) < 0.1) player.current.recoil = 0;
            player.current.x = Math.max(0, Math.min(CANVAS_W - player.current.w, player.current.x));

            // Auto-shoot
            if (frame.current % 18 === 0) {
                bullets.current.push({ x: player.current.x + 23, y: player.current.y });
                player.current.recoil = (Math.random() - 0.5) * 8;
                playSound(sfx.current.shoot, 0.06);
            }

            // Spawn enemies
            const baseRate = Math.max(10, 38 - (levelToPlay * 5) - Math.floor(diffBoost * 3));
            if (frame.current % baseRate === 0) {
                const rand = Math.random();
                let type: EnemyType;
                let pattern: MovementPattern = 'straight';

                if (levelToPlay >= 2 && rand > 0.88) type = 'shooter';
                else if (rand > 0.82) type = 'big';
                else if (rand > 0.45) type = 'mid';
                else type = 'small';

                const patternRoll = Math.random();
                if (levelToPlay >= 2 && patternRoll > 0.6) pattern = 'zigzag';
                else if (levelToPlay >= 3 && patternRoll > 0.4) pattern = patternRoll > 0.7 ? 'sine' : 'zigzag';
                else if (patternRoll > 0.8) pattern = 'zigzag';

                const size = type === 'small' ? 30 : type === 'mid' ? 48 : type === 'shooter' ? 42 : 76;
                const spawnX = Math.random() * (CANVAS_W - size);

                enemies.current.push({
                    x: spawnX, y: -size, w: size, h: size,
                    hp: type === 'small' ? 1 : type === 'mid' ? 2 : type === 'shooter' ? 3 : 5,
                    maxHp: type === 'small' ? 1 : type === 'mid' ? 2 : type === 'shooter' ? 3 : 5,
                    type, pattern,
                    speed: (type === 'small' ? 4 : type === 'mid' ? 2.8 : type === 'shooter' ? 2 : 1.8) + diffBoost,
                    spawnX, age: 0,
                    shootCooldown: 60 + Math.floor(Math.random() * 40),
                });
            }

            // Update player bullets
            for (let i = bullets.current.length - 1; i >= 0; i--) {
                bullets.current[i].y -= 14;
                if (bullets.current[i].y < -10) bullets.current.splice(i, 1);
            }

            // Update enemy bullets
            for (let i = enemyBullets.current.length - 1; i >= 0; i--) {
                const eb = enemyBullets.current[i];
                eb.y += eb.speed;
                if (eb.y > CANVAS_H + 10) { enemyBullets.current.splice(i, 1); continue; }
                const px = player.current.x + 8, py = player.current.y + 8;
                const pw = player.current.w - 16, ph = player.current.h - 16;
                if (eb.x > px && eb.x < px + pw && eb.y > py && eb.y < py + ph) {
                    const timeMs = Date.now() - startTime.current;
                    setFinalScore(score.current); setFinalKills(kills.current);
                    setGameState('gameover'); clearAllInput();
                    onGameOver(levelToPlay, score.current, kills.current, timeMs);
                    return;
                }
            }

            // Update enemies
            for (let ei = enemies.current.length - 1; ei >= 0; ei--) {
                const en = enemies.current[ei];
                en.age++;
                en.y += en.speed;
                if (en.pattern === 'zigzag') en.x = en.spawnX + Math.sin(en.age * 0.08) * 60;
                else if (en.pattern === 'sine') en.x = en.spawnX + Math.sin(en.age * 0.05) * 40 + Math.cos(en.age * 0.12) * 20;
                en.x = Math.max(0, Math.min(CANVAS_W - en.w, en.x));

                // Shooter fires
                if (en.type === 'shooter' && en.y > 40 && en.y < CANVAS_H - 100) {
                    en.shootCooldown--;
                    if (en.shootCooldown <= 0) {
                        enemyBullets.current.push({ x: en.x + en.w / 2, y: en.y + en.h, speed: 5 + diffBoost * 0.3 });
                        en.shootCooldown = 50 + Math.floor(Math.random() * 30);
                    }
                }

                // Bullet-enemy collision
                for (let bi = bullets.current.length - 1; bi >= 0; bi--) {
                    const b = bullets.current[bi];
                    if (b.x > en.x && b.x < en.x + en.w && b.y < en.y + en.h && b.y > en.y) {
                        en.hp--;
                        bullets.current.splice(bi, 1);
                        if (en.hp <= 0) {
                            // ─── BIG-KILL STREAK LOGIC ───
                            const basePoints = en.type === 'small' ? 10 : en.type === 'mid' ? 30 : en.type === 'shooter' ? 50 : 80;
                            let pts = basePoints;
                            let showMultiplier = false;

                            if (en.type === 'big') {
                                bigKillStreak.current++;
                                if (bigKillStreak.current >= 3) {
                                    // 3rd consecutive big kill → 2x on this kill only
                                    pts = basePoints * 2;
                                    showMultiplier = true;
                                    bigKillStreak.current = 0; // reset after reward
                                }
                            } else {
                                // Any non-big kill resets the streak
                                bigKillStreak.current = 0;
                            }

                            score.current += pts;
                            kills.current++;

                            // Float text
                            if (showMultiplier) {
                                floatTexts.current.push({ x: en.x + en.w / 2, y: en.y, text: `+${pts} 2x!`, life: 50, color: '#ffcc00' });
                            } else {
                                floatTexts.current.push({ x: en.x + en.w / 2, y: en.y, text: `+${pts}`, life: 25, color: '#fff' });
                            }

                            const particleColor = en.type === 'shooter' ? '#ffaa00' : en.type === 'big' ? '#ff0044' : '#ff4444';
                            spawnParticles(en.x + en.w / 2, en.y + en.h / 2, particleColor, en.type === 'big' ? 12 : 6);
                            shakeRef.current = en.type === 'big' ? 6 : 3;
                            enemies.current.splice(ei, 1);
                            playSound(sfx.current.explode, 0.12);
                            break;
                        }
                    }
                }

                // Player-enemy collision
                if (enemies.current[ei]) {
                    const e = enemies.current[ei];
                    const px = player.current.x + 6, py = player.current.y + 6;
                    const pw = player.current.w - 12, ph = player.current.h - 12;
                    if (px < e.x + e.w - 5 && px + pw > e.x + 5 && py < e.y + e.h - 5 && py + ph > e.y + 5) {
                        const timeMs = Date.now() - startTime.current;
                        setFinalScore(score.current); setFinalKills(kills.current);
                        setGameState('gameover'); clearAllInput();
                        onGameOver(levelToPlay, score.current, kills.current, timeMs);
                        return;
                    }
                    if (e.y > CANVAS_H + 20) enemies.current.splice(ei, 1);
                }
            }

            // Update particles
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life--;
                if (p.life <= 0) particles.current.splice(i, 1);
            }

            // Update float texts
            for (let i = floatTexts.current.length - 1; i >= 0; i--) {
                floatTexts.current[i].y -= 1.2; floatTexts.current[i].life--;
                if (floatTexts.current[i].life <= 0) floatTexts.current.splice(i, 1);
            }

            // Screen shake decay
            shakeRef.current *= 0.85;
            if (shakeRef.current < 0.3) shakeRef.current = 0;

            // Win check
            if (score.current >= targetScore) {
                const timeMs = Date.now() - startTime.current;
                setFinalScore(score.current); setFinalKills(kills.current);
                setGameState('win'); clearAllInput();
                playSound(sfx.current.win, 0.3);
                onLevelWin(levelToPlay, score.current, kills.current, timeMs);
                return;
            }

            // ═══ DRAWING ═══
            ctx.save();
            if (shakeRef.current > 0) ctx.translate((Math.random() - 0.5) * shakeRef.current * 2, (Math.random() - 0.5) * shakeRef.current * 2);
            ctx.fillStyle = '#050505'; ctx.fillRect(-5, -5, CANVAS_W + 10, CANVAS_H + 10);
            ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
            for (let i = 0; i < CANVAS_W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_H); ctx.stroke(); }
            for (let i = 0; i < CANVAS_H; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_W, i); ctx.stroke(); }

            // Particles
            particles.current.forEach(p => {
                ctx.globalAlpha = p.life / 25; ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            });
            ctx.globalAlpha = 1;

            // Player bullets
            ctx.shadowColor = '#A020F0'; ctx.shadowBlur = 6; ctx.fillStyle = '#A020F0';
            bullets.current.forEach(b => ctx.fillRect(b.x, b.y, 4, 14));
            ctx.shadowBlur = 0;

            // Enemy bullets
            ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 5; ctx.fillStyle = '#ffaa00';
            enemyBullets.current.forEach(eb => { ctx.beginPath(); ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2); ctx.fill(); });
            ctx.shadowBlur = 0;

            // Enemies + HP bars
            enemies.current.forEach(en => {
                drawEnemy(ctx, en);
                if (en.maxHp > 1 && en.hp < en.maxHp) {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(en.x, en.y - 8, en.w, 4);
                    ctx.fillStyle = en.hp / en.maxHp > 0.5 ? '#22c55e' : '#ef4444';
                    ctx.fillRect(en.x, en.y - 8, en.w * (en.hp / en.maxHp), 4);
                }
            });

            // Player
            ctx.drawImage(selectedImg, player.current.x, player.current.y, 50, 50);

            // Float texts
            floatTexts.current.forEach(ct => {
                ctx.globalAlpha = Math.min(ct.life / 15, 1); ctx.fillStyle = ct.color;
                ctx.font = 'bold 14px "Pixelify Sans", monospace'; ctx.textAlign = 'center';
                ctx.fillText(ct.text, ct.x, ct.y);
            });
            ctx.globalAlpha = 1; ctx.textAlign = 'left';

            // HUD
            ctx.fillStyle = '#A020F0'; ctx.font = 'bold 12px "Pixelify Sans", monospace'; ctx.fillText('SCORE', 16, 24);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Pixelify Sans", monospace'; ctx.fillText(`${score.current}`, 16, 44);
            const barY = 54, barW = 120, pct = Math.min(score.current / targetScore, 1);
            ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(16, barY, barW, 6);
            ctx.fillStyle = '#A020F0'; ctx.fillRect(16, barY, barW * pct, 6);
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '10px monospace'; ctx.fillText(`${targetScore} TO WIN`, 16, barY + 18);

            // Big-kill streak indicator
            if (bigKillStreak.current > 0) {
                ctx.textAlign = 'center'; ctx.font = 'bold 12px "Pixelify Sans", monospace';
                ctx.fillStyle = bigKillStreak.current >= 2 ? '#ffcc00' : '#ff4444';
                ctx.globalAlpha = 0.7;
                ctx.fillText(`BIG STREAK: ${bigKillStreak.current}/3`, CANVAS_W / 2, 30);
                ctx.globalAlpha = 1; ctx.textAlign = 'left';
            }

            ctx.fillStyle = 'rgba(160,32,240,0.3)'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right';
            ctx.fillText(`LVL ${levelToPlay}`, CANVAS_W - 16, 24);
            if (levelToPlay >= 2) { ctx.fillStyle = 'rgba(255,170,0,0.3)'; ctx.fillText('⚠ SHOOTERS', CANVAS_W - 16, 38); }
            ctx.textAlign = 'left';

            ctx.restore();
            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);
        return () => { cancelAnimationFrame(animId); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
    }, [gameState, selectedImg, levelToPlay, targetScore, clearAllInput, onLevelWin, onGameOver]);

    return (
        <div ref={wrapperRef} className="relative overflow-hidden select-none"
            style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, touchAction: 'none' }}>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="block origin-top-left"
                style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, imageRendering: 'pixelated' }} />

            {/* Mobile controls */}
            {gameState === 'playing' && (
                <>
                    <div className="absolute left-2 sm:left-4" style={{ bottom: Math.max(12, 12 * scale) }}
                        onPointerDown={(e) => { e.preventDefault(); handlePointerDown('left', e.pointerId); }}
                        onPointerUp={(e) => { e.preventDefault(); handlePointerEnd(e.pointerId); }}
                        onPointerCancel={(e) => { e.preventDefault(); handlePointerEnd(e.pointerId); }}>
                        <div className="flex items-center justify-center bg-white/[0.06] border border-white/[0.15] rounded-full active:bg-[#A020F0]/30 active:border-[#A020F0]/50 transition-colors"
                            style={{ width: Math.max(48, 56 * scale), height: Math.max(48, 56 * scale), touchAction: 'none' }}>
                            <span className="text-white/60 text-xl font-bold select-none">◀</span>
                        </div>
                    </div>
                    <div className="absolute right-2 sm:right-4" style={{ bottom: Math.max(12, 12 * scale) }}
                        onPointerDown={(e) => { e.preventDefault(); handlePointerDown('right', e.pointerId); }}
                        onPointerUp={(e) => { e.preventDefault(); handlePointerEnd(e.pointerId); }}
                        onPointerCancel={(e) => { e.preventDefault(); handlePointerEnd(e.pointerId); }}>
                        <div className="flex items-center justify-center bg-white/[0.06] border border-white/[0.15] rounded-full active:bg-[#A020F0]/30 active:border-[#A020F0]/50 transition-colors"
                            style={{ width: Math.max(48, 56 * scale), height: Math.max(48, 56 * scale), touchAction: 'none' }}>
                            <span className="text-white/60 text-xl font-bold select-none">▶</span>
                        </div>
                    </div>
                    <button onClick={() => { setGameState('paused'); clearAllInput(); }}
                        className="absolute top-3 right-3 bg-black/40 border border-white/10 px-3 py-1.5 font-mono uppercase text-white/60 hover:text-white transition-colors"
                        style={{ fontSize: 10, letterSpacing: '0.1em' }}>❚❚</button>
                </>
            )}

            {/* CHARACTER SELECTION */}
            {gameState === 'selection' && (
                <div className="absolute inset-0 bg-[#050505] flex flex-col items-center justify-center p-6 text-center z-10">
                    <div className="font-mono uppercase text-[#A020F0] mb-1" style={{ fontSize: 10, letterSpacing: '0.2em' }}>Choose</div>
                    <h2 className="text-2xl font-bold mb-8 text-white uppercase italic font-pixel">Your Vessel</h2>
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        {CHARACTERS.map(c => (
                            <button key={c.id} onClick={() => initGame(c.url)}
                                className="border border-white/10 p-3 bg-white/[0.02] hover:border-[#A020F0] hover:bg-[#A020F0]/10 transition-all group">
                                <img src={c.url} alt={c.name} className="w-14 h-14 object-contain mx-auto group-hover:scale-110 transition-transform" />
                                <p className="font-mono text-white/30 mt-2 uppercase font-bold group-hover:text-[#A020F0]" style={{ fontSize: 8 }}>{c.name}</p>
                            </button>
                        ))}
                    </div>
                    <button onClick={onQuit} className="font-mono text-zinc-600 uppercase hover:text-white transition-colors" style={{ fontSize: 10 }}>← Back to Hub</button>
                </div>
            )}

            {/* PAUSED */}
            {gameState === 'paused' && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-20">
                    <h2 className="text-3xl font-bold mb-2 text-white italic font-pixel">PAUSED</h2>
                    <p className="font-mono text-zinc-500 mb-8" style={{ fontSize: 10, letterSpacing: '0.2em' }}>PRESS TO CONTINUE</p>
                    <button onClick={() => setGameState('playing')} className="bg-[#A020F0] text-black px-10 py-3 font-bold uppercase font-pixel hover:bg-white transition-all mb-4">Resume</button>
                    <button onClick={onQuit} className="font-mono text-zinc-600 uppercase hover:text-white transition-colors" style={{ fontSize: 10 }}>Quit Game</button>
                </div>
            )}

            {/* WIN */}
            {gameState === 'win' && (
                <div className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center p-6 text-center z-30">
                    <div className="border border-[#A020F0]/40 p-8 bg-black/80 max-w-[280px] w-full">
                        <div className="font-mono text-[#A020F0] mb-1 uppercase" style={{ fontSize: 10, letterSpacing: '0.3em' }}>Sector Clear</div>
                        <h2 className="text-3xl font-bold mb-6 text-white italic font-pixel uppercase">Level {levelToPlay}</h2>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div><div className="font-mono text-zinc-500 uppercase" style={{ fontSize: 9 }}>Score</div><div className="text-2xl font-bold text-white font-pixel">{finalScore}</div></div>
                            <div><div className="font-mono text-zinc-500 uppercase" style={{ fontSize: 9 }}>Kills</div><div className="text-2xl font-bold text-white font-pixel">{finalKills}</div></div>
                        </div>
                        <button onClick={onQuit} className="w-full bg-[#A020F0] text-black py-3 font-bold uppercase font-pixel hover:bg-white transition-all">Continue</button>
                    </div>
                </div>
            )}

            {/* GAME OVER */}
            {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-6 z-40">
                    <h2 className="text-4xl font-bold mb-1 text-white italic font-pixel">WRECKED</h2>
                    <p className="font-mono text-white/40 mb-8 uppercase" style={{ fontSize: 10, letterSpacing: '0.2em' }}>Score: {finalScore}</p>
                    <button
                        onClick={handleRetry}
                        disabled={retrying}
                        className="w-full max-w-[240px] bg-white text-black py-3 font-bold uppercase font-pixel hover:bg-red-500 hover:text-white transition-all mb-3 disabled:opacity-50"
                    >
                        {retrying ? 'Loading...' : 'Try Again'}
                    </button>
                    <button onClick={onQuit} className="font-mono text-white/30 uppercase hover:text-white transition-colors" style={{ fontSize: 10 }}>Quit</button>
                </div>
            )}
        </div>
    );
};