-- ============================================
-- GAWKERS v2.1 DATABASE MIGRATION
-- Run this in Neon SQL Editor
-- ============================================

-- 1. Drop old tables
DROP TABLE IF EXISTS game_sessions;
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS leaderboard;
DROP TABLE IF EXISTS players;

-- 2. Players table (X/Twitter OAuth identity)
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    twitter_id VARCHAR(30) UNIQUE NOT NULL,
    twitter_handle VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    profile_image_url TEXT,
    current_level INTEGER DEFAULT 1,
    best_score INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_played_at TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    wallet_address VARCHAR(42),
    session_token VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Scores table
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    twitter_id VARCHAR(30) REFERENCES players(twitter_id),
    level INTEGER NOT NULL,
    score INTEGER NOT NULL,
    time_ms INTEGER NOT NULL,
    kills INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Game sessions (anti-cheat)
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    token VARCHAR(128) UNIQUE NOT NULL,
    twitter_id VARCHAR(30) REFERENCES players(twitter_id),
    level INTEGER NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE
);

-- 5. OAuth state store (PKCE verification)
CREATE TABLE oauth_states (
    state VARCHAR(64) PRIMARY KEY,
    code_verifier VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Indexes
CREATE INDEX idx_scores_leaderboard ON scores(score DESC);
CREATE INDEX idx_scores_daily ON scores(created_at DESC, score DESC);
CREATE INDEX idx_scores_twitter ON scores(twitter_id);
CREATE INDEX idx_players_best ON players(best_score DESC);
CREATE INDEX idx_players_completed ON players(completed_at) WHERE completed = TRUE;
CREATE INDEX idx_game_sessions_token ON game_sessions(token);
