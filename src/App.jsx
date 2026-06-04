import { useState, useEffect, useRef } from "react";

const GAME_NAME = "RIDDLE RUN";
const TAGLINE = "10 Levels. 30 Days. One Winner.";

const PUZZLES = [
  {
    level: 1,
    title: "The First Gate",
    riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
    answer: "echo",
    hint: "Think of what happens when you shout in a valley or a mountain.",
    unlockDay: 1,
  },
  {
    level: 2,
    title: "The Mirror Room",
    riddle: "The more you take, the more you leave behind. What am I?",
    answer: "footsteps",
    hint: "Think about walking on sand or snow.",
    unlockDay: 4,
  },
  {
    level: 3,
    title: "The Hollow Clock",
    riddle: "I have cities, but no houses live there. I have mountains, but no trees grow. I have water, but no fish swim. I have roads, but no cars drive. What am I?",
    answer: "map",
    hint: "You use me to find your way — but I am not a phone.",
    unlockDay: 7,
  },
  {
    level: 4,
    title: "The Blind Merchant",
    riddle: "A man buys it to eat but never eats it. Another man sells it but has never owned it. What is it?",
    answer: "coffin",
    hint: "This is something you hope to never need — but everyone eventually does.",
    unlockDay: 10,
  },
  {
    level: 5,
    title: "The Twin Doors",
    riddle: "What has one eye but cannot see, a tail but cannot wag, and a body but no soul?",
    answer: "needle",
    hint: "Your grandmother might have used this to stitch your torn kurta.",
    unlockDay: 13,
  },
  {
    level: 6,
    title: "The Burning Library",
    riddle: "I am always in front of you but can never be seen. What am I?",
    answer: "future",
    hint: "It is not the past. It is not now.",
    unlockDay: 16,
  },
  {
    level: 7,
    title: "The Weightless Stone",
    riddle: "The one who makes it, sells it. The one who buys it, never uses it. The one who uses it, never knows it. What is it?",
    answer: "coffin",
    hint: "Same as level 4's theme but from a different angle — different words, same answer.",
    unlockDay: 19,
  },
  {
    level: 8,
    title: "The Whispering Wall",
    riddle: "I shrink every time I work. I vanish when I am done. Yet without me, things stay dirty. What am I?",
    answer: "soap",
    hint: "You use me every morning. I ask for nothing except to disappear.",
    unlockDay: 22,
  },
  {
    level: 9,
    title: "The Fallen King",
    riddle: "Kings and queens bow before me. The proud become humble in my presence. The strong grow weak. I am invisible, yet all-powerful. What am I?",
    answer: "time",
    hint: "Even mountains cannot resist me.",
    unlockDay: 25,
  },
  {
    level: 10,
    title: "The Final Vault",
    riddle: "I have no beginning, no end, and nothing in the middle. What am I?",
    answer: "doughnut",
    hint: "Sometimes the answer is simpler than you think. Think of a shape you can eat.",
    unlockDay: 28,
  },
];

const ENTRY_FEE = 199;
const PRIZE_POOL_PERCENT = 70;

// --- Screens ---
const SCREEN = {
  LANDING: "landing",
  REGISTER: "register",
  PAYMENT: "payment",
  GAME: "game",
  LEADERBOARD: "leaderboard",
  ADMIN: "admin",
};

// Simulated registered players for leaderboard
const MOCK_LEADERBOARD = [
  { name: "Aryan S.", level: 6, time: "2h 14m", location: "Delhi" },
  { name: "Meera K.", level: 5, time: "3h 02m", location: "Mumbai" },
  { name: "Vikram P.", level: 5, time: "3h 45m", location: "Bangalore" },
  { name: "Priya T.", level: 4, time: "1h 58m", location: "Pune" },
  { name: "Rahul N.", level: 3, time: "4h 11m", location: "Hyderabad" },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Space+Mono:wght@400;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #080810;
    --surface: #0f0f1a;
    --surface2: #16162a;
    --gold: #c9a84c;
    --gold-light: #e8c97a;
    --gold-dim: #7a6330;
    --crimson: #8b1a1a;
    --crimson-light: #c0392b;
    --text: #e8e0d0;
    --text-dim: #8a8070;
    --border: rgba(201,168,76,0.2);
    --glow: rgba(201,168,76,0.15);
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Cormorant Garamond', serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app {
    min-height: 100vh;
    position: relative;
  }

  /* Background texture */
  .app::before {
    content: '';
    position: fixed;
    inset: 0;
    background: 
      radial-gradient(ellipse at 20% 20%, rgba(139,26,26,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(201,168,76,0.06) 0%, transparent 50%),
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 60px,
        rgba(201,168,76,0.01) 60px,
        rgba(201,168,76,0.01) 61px
      );
    pointer-events: none;
    z-index: 0;
  }

  .content { position: relative; z-index: 1; }

  /* Nav */
  .nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem 2rem;
    border-bottom: 1px solid var(--border);
    background: rgba(8,8,16,0.8);
    backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .nav-logo {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1rem;
    color: var(--gold);
    letter-spacing: 0.2em;
  }

  .nav-links { display: flex; gap: 1.5rem; align-items: center; }

  .nav-link {
    font-family: 'Space Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    color: var(--text-dim);
    cursor: pointer;
    text-transform: uppercase;
    transition: color 0.2s;
    background: none;
    border: none;
  }
  .nav-link:hover { color: var(--gold); }

  .nav-btn {
    font-family: 'Space Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    background: var(--gold);
    color: var(--bg);
    border: none;
    padding: 0.5rem 1.2rem;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.2s;
    font-weight: 700;
  }
  .nav-btn:hover { background: var(--gold-light); }

  /* Landing */
  .landing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 90vh;
    padding: 2rem;
    text-align: center;
  }

  .landing-eyebrow {
    font-family: 'Space Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.4em;
    color: var(--gold-dim);
    text-transform: uppercase;
    margin-bottom: 1.5rem;
    animation: fadeUp 0.8s ease both;
  }

  .landing-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: clamp(2.5rem, 8vw, 5rem);
    color: var(--gold);
    line-height: 1.1;
    margin-bottom: 1rem;
    animation: fadeUp 0.8s 0.1s ease both;
    text-shadow: 0 0 60px rgba(201,168,76,0.3);
  }

  .landing-rule {
    width: 80px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    margin: 1.5rem auto;
    animation: fadeUp 0.8s 0.2s ease both;
  }

  .landing-tagline {
    font-size: 1.3rem;
    font-style: italic;
    color: var(--text-dim);
    margin-bottom: 3rem;
    animation: fadeUp 0.8s 0.3s ease both;
  }

  .stats-row {
    display: flex;
    gap: 3rem;
    margin-bottom: 3rem;
    animation: fadeUp 0.8s 0.4s ease both;
  }

  .stat { text-align: center; }
  .stat-number {
    font-family: 'Cinzel Decorative', serif;
    font-size: 2rem;
    color: var(--gold);
    display: block;
  }
  .stat-label {
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .landing-cta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
    animation: fadeUp 0.8s 0.5s ease both;
  }

  .btn-primary {
    font-family: 'Space Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--bg);
    border: none;
    padding: 1rem 2.5rem;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .btn-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.1);
    transform: translateX(-100%);
    transition: transform 0.3s;
  }
  .btn-primary:hover::after { transform: translateX(0); }
  .btn-primary:hover { box-shadow: 0 0 30px rgba(201,168,76,0.4); }

  .btn-secondary {
    font-family: 'Space Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    background: transparent;
    color: var(--gold);
    border: 1px solid var(--gold-dim);
    padding: 1rem 2.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-secondary:hover { border-color: var(--gold); background: var(--glow); }

  /* How it works */
  .how-section {
    padding: 5rem 2rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .section-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.2rem;
    color: var(--gold);
    text-align: center;
    margin-bottom: 3rem;
    letter-spacing: 0.1em;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 2rem;
  }

  .step {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 2rem;
    position: relative;
    transition: border-color 0.3s;
  }
  .step:hover { border-color: var(--gold-dim); }

  .step-num {
    font-family: 'Cinzel Decorative', serif;
    font-size: 2.5rem;
    color: rgba(201,168,76,0.15);
    position: absolute;
    top: 1rem;
    right: 1rem;
  }

  .step-icon { font-size: 1.5rem; margin-bottom: 0.8rem; }

  .step-title {
    font-family: 'Space Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
    color: var(--gold);
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  .step-desc { font-size: 0.95rem; color: var(--text-dim); line-height: 1.6; }

  /* Register */
  .register-wrap {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 2rem;
  }

  .form-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.5rem;
    color: var(--gold);
    margin-bottom: 0.5rem;
    text-align: center;
  }

  .form-sub {
    font-style: italic;
    color: var(--text-dim);
    text-align: center;
    margin-bottom: 2.5rem;
    font-size: 1rem;
  }

  .form-group { margin-bottom: 1.5rem; }

  .form-label {
    font-family: 'Space Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-dim);
    display: block;
    margin-bottom: 0.5rem;
  }

  .form-input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.8rem 1rem;
    font-family: 'Cormorant Garamond', serif;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .form-input:focus { border-color: var(--gold-dim); }
  .form-input::placeholder { color: var(--text-dim); }

  .fee-box {
    background: var(--surface2);
    border: 1px solid var(--border);
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .fee-label { font-size: 0.9rem; color: var(--text-dim); }
  .fee-amount {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.5rem;
    color: var(--gold);
  }

  .prize-note {
    font-size: 0.85rem;
    color: var(--text-dim);
    font-style: italic;
    text-align: center;
    margin-bottom: 1.5rem;
  }

  /* Payment */
  .payment-wrap {
    max-width: 420px;
    margin: 0 auto;
    padding: 4rem 2rem;
    text-align: center;
  }

  .payment-icon { font-size: 3rem; margin-bottom: 1rem; }

  .payment-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.3rem;
    color: var(--gold);
    margin-bottom: 0.5rem;
  }

  .payment-sub {
    color: var(--text-dim);
    font-style: italic;
    margin-bottom: 2rem;
  }

  .razorpay-btn {
    width: 100%;
    background: #2d6ef5;
    color: white;
    border: none;
    padding: 1rem;
    font-family: 'Space Mono', monospace;
    font-size: 0.8rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    cursor: pointer;
    margin-bottom: 1rem;
    transition: background 0.2s;
  }
  .razorpay-btn:hover { background: #1a56d4; }

  .payment-note {
    font-size: 0.8rem;
    color: var(--text-dim);
    font-style: italic;
  }

  /* Game screen */
  .game-wrap {
    max-width: 700px;
    margin: 0 auto;
    padding: 3rem 2rem;
  }

  .level-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .level-badge {
    font-family: 'Space Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: var(--gold);
    text-transform: uppercase;
    background: rgba(201,168,76,0.1);
    border: 1px solid var(--border);
    padding: 0.3rem 0.8rem;
  }

  .level-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.6rem;
    color: var(--text);
    margin-top: 0.5rem;
  }

  .progress-bar-wrap {
    display: flex;
    gap: 4px;
    margin-bottom: 2.5rem;
  }

  .progress-seg {
    flex: 1;
    height: 3px;
    background: var(--surface2);
    transition: background 0.4s;
  }
  .progress-seg.done { background: var(--gold); }
  .progress-seg.current { background: var(--gold-dim); }

  .riddle-card {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 2.5rem;
    margin-bottom: 2rem;
    position: relative;
  }

  .riddle-card::before {
    content: '"';
    position: absolute;
    top: -0.5rem;
    left: 1.5rem;
    font-size: 5rem;
    color: rgba(201,168,76,0.08);
    font-family: 'Cinzel Decorative', serif;
    line-height: 1;
  }

  .riddle-text {
    font-size: 1.35rem;
    line-height: 1.7;
    font-style: italic;
    color: var(--text);
  }

  .answer-row {
    display: flex;
    gap: 0.8rem;
    margin-bottom: 1rem;
  }

  .answer-input {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.9rem 1.2rem;
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.1rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .answer-input:focus { border-color: var(--gold-dim); }
  .answer-input.correct { border-color: #2a9d5c; }
  .answer-input.wrong { border-color: var(--crimson-light); }

  .submit-btn {
    font-family: 'Space Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    background: var(--gold);
    color: var(--bg);
    border: none;
    padding: 0.9rem 1.5rem;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .submit-btn:hover { background: var(--gold-light); }
  .submit-btn:disabled { background: var(--gold-dim); cursor: not-allowed; }

  .feedback {
    font-size: 0.95rem;
    padding: 0.8rem 1rem;
    margin-bottom: 1rem;
    font-style: italic;
  }
  .feedback.success { background: rgba(42,157,92,0.1); border: 1px solid rgba(42,157,92,0.3); color: #2a9d5c; }
  .feedback.error { background: rgba(192,57,43,0.1); border: 1px solid rgba(192,57,43,0.3); color: #c0392b; }

  .hint-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .hint-btn {
    font-family: 'Space Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    background: transparent;
    color: var(--text-dim);
    border: 1px solid rgba(255,255,255,0.1);
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .hint-btn:hover { color: var(--gold); border-color: var(--gold-dim); }

  .hint-box {
    background: rgba(201,168,76,0.05);
    border: 1px solid rgba(201,168,76,0.15);
    padding: 1rem 1.2rem;
    margin-bottom: 1.5rem;
    font-style: italic;
    color: var(--text-dim);
    font-size: 0.95rem;
  }

  .attempts-note {
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    color: var(--text-dim);
    letter-spacing: 0.1em;
  }

  .locked-level {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 3rem;
    text-align: center;
    margin-top: 2rem;
  }

  .locked-icon { font-size: 2.5rem; margin-bottom: 1rem; }
  .locked-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.1rem;
    color: var(--text-dim);
    margin-bottom: 0.5rem;
  }
  .locked-note { color: var(--text-dim); font-style: italic; font-size: 0.95rem; }

  /* Leaderboard */
  .lb-wrap {
    max-width: 700px;
    margin: 0 auto;
    padding: 3rem 2rem;
  }

  .lb-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .lb-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.5rem;
    color: var(--gold);
    margin-bottom: 0.3rem;
  }

  .lb-sub { color: var(--text-dim); font-style: italic; }

  .lb-table { width: 100%; border-collapse: collapse; }

  .lb-thead tr {
    border-bottom: 1px solid var(--border);
  }

  .lb-th {
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    color: var(--text-dim);
    text-transform: uppercase;
    padding: 0.8rem 1rem;
    text-align: left;
  }

  .lb-row {
    border-bottom: 1px solid rgba(201,168,76,0.05);
    transition: background 0.2s;
  }
  .lb-row:hover { background: rgba(201,168,76,0.03); }
  .lb-row.top { background: rgba(201,168,76,0.06); }

  .lb-td {
    padding: 1rem;
    font-size: 1rem;
    color: var(--text);
  }

  .rank-badge {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.1rem;
    color: var(--gold);
  }

  .level-pill {
    font-family: 'Space Mono', monospace;
    font-size: 0.65rem;
    background: rgba(201,168,76,0.1);
    border: 1px solid var(--border);
    color: var(--gold);
    padding: 0.2rem 0.6rem;
    letter-spacing: 0.1em;
  }

  .prize-banner {
    background: linear-gradient(135deg, rgba(201,168,76,0.1), rgba(139,26,26,0.1));
    border: 1px solid var(--border);
    padding: 2rem;
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .prize-amount {
    font-family: 'Cinzel Decorative', serif;
    font-size: 2.5rem;
    color: var(--gold);
    display: block;
    text-shadow: 0 0 40px rgba(201,168,76,0.4);
  }

  .prize-label { font-style: italic; color: var(--text-dim); font-size: 0.95rem; }

  /* Admin */
  .admin-wrap {
    max-width: 700px;
    margin: 0 auto;
    padding: 3rem 2rem;
  }

  .admin-title {
    font-family: 'Cinzel Decorative', serif;
    font-size: 1.3rem;
    color: var(--gold);
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .admin-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .admin-stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 1.5rem;
    text-align: center;
  }

  .admin-stat-num {
    font-family: 'Cinzel Decorative', serif;
    font-size: 2rem;
    color: var(--gold);
    display: block;
  }

  .admin-stat-label {
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    color: var(--text-dim);
    text-transform: uppercase;
    margin-top: 0.3rem;
  }

  .admin-table { width: 100%; border-collapse: collapse; }
  .admin-th {
    font-family: 'Space Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    color: var(--text-dim);
    text-transform: uppercase;
    padding: 0.8rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  .admin-td {
    padding: 0.8rem;
    font-size: 0.9rem;
    color: var(--text);
    border-bottom: 1px solid rgba(201,168,76,0.04);
  }

  /* Animations */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes glow {
    0%, 100% { text-shadow: 0 0 20px rgba(201,168,76,0.2); }
    50% { text-shadow: 0 0 60px rgba(201,168,76,0.5); }
  }

  .glow-anim { animation: glow 3s ease-in-out infinite; }

  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border), transparent);
    margin: 3rem 0;
  }

  @media (max-width: 600px) {
    .stats-row { gap: 1.5rem; }
    .stat-number { font-size: 1.5rem; }
    .level-title { font-size: 1.2rem; }
    .admin-stat-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

// ---- Main App ----
export default function App() {
  const [screen, setScreen] = useState(SCREEN.LANDING);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", age: "" });
  const [currentLevel, setCurrentLevel] = useState(0); // 0-indexed
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [totalPlayers] = useState(247);
  const [totalRevenue] = useState(247 * ENTRY_FEE);
  const [adminPass, setAdminPass] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const answerRef = useRef(null);

  // Simulate which levels are unlocked (in real app: based on game start date)
  const unlockedLevels = PUZZLES.filter(p => p.unlockDay <= 10).length; // Day 10 of game = levels 1-3

  const prizePool = Math.round((totalRevenue * PRIZE_POOL_PERCENT) / 100);

  const handleRegister = () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.age) {
      alert("Please fill all fields.");
      return;
    }
    if (parseInt(formData.age) < 18) {
      alert("You must be 18 or older to participate.");
      return;
    }
    setScreen(SCREEN.PAYMENT);
  };

  const handlePayment = () => {
    // In production: integrate Razorpay SDK here
    // For MVP demo, simulate payment success
    setUser({ name: formData.name, email: formData.email });
    setScreen(SCREEN.GAME);
  };

  const handleSubmitAnswer = () => {
    const puzzle = PUZZLES[currentLevel];
    const userAnswer = answer.trim().toLowerCase();
    const correct = puzzle.answer.toLowerCase();

    if (userAnswer === correct) {
      setFeedback({ type: "success", msg: "Correct! The vault opens. Proceed to the next level." });
      setCompletedLevels(prev => [...prev, currentLevel]);
      setTimeout(() => {
        if (currentLevel < unlockedLevels - 1) {
          setCurrentLevel(prev => prev + 1);
          setAnswer("");
          setFeedback(null);
          setShowHint(false);
          setAttempts(0);
        } else {
          setFeedback({ type: "success", msg: "You've reached the current frontier. The next level unlocks in 3 days. Watch the leaderboard!" });
        }
      }, 2000);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setFeedback({ type: "error", msg: `Wrong answer. Think deeper. (Attempt ${newAttempts})` });
      if (answerRef.current) answerRef.current.classList.add("wrong");
      setTimeout(() => {
        if (answerRef.current) answerRef.current.classList.remove("wrong");
      }, 800);
    }
  };

  const handleUseHint = () => {
    setShowHint(true);
    setHintsUsed(prev => prev + 1);
    // In production: charge ₹29 via Razorpay before showing hint
  };

  const puzzle = PUZZLES[currentLevel];
  const isLevelCompleted = completedLevels.includes(currentLevel);
  const isLevelLocked = currentLevel >= unlockedLevels;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="content">
          {/* NAV */}
          <nav className="nav">
            <div className="nav-logo" onClick={() => setScreen(SCREEN.LANDING)} style={{cursor:"pointer"}}>
              {user ? "RIDDLE RUN" : "RIDDLE RUN"}
            </div>
            <div className="nav-links">
              <button className="nav-link" onClick={() => setScreen(SCREEN.LEADERBOARD)}>Leaderboard</button>
              {user && <button className="nav-link" onClick={() => setScreen(SCREEN.GAME)}>My Game</button>}
              <button className="nav-link" onClick={() => setScreen(SCREEN.ADMIN)}>Admin</button>
              {!user
                ? <button className="nav-btn" onClick={() => setScreen(SCREEN.REGISTER)}>Enter — ₹{ENTRY_FEE}</button>
                : <button className="nav-btn" onClick={() => setScreen(SCREEN.GAME)}>Continue</button>
              }
            </div>
          </nav>

          {/* LANDING */}
          {screen === SCREEN.LANDING && (
            <div className="landing">
              <p className="landing-eyebrow">Season 1 · Now Live</p>
              <h1 className="landing-title glow-anim">RIDDLE<br />RUN</h1>
              <div className="landing-rule" />
              <p className="landing-tagline">{TAGLINE}</p>
              <div className="stats-row">
                <div className="stat">
                  <span className="stat-number">{totalPlayers}</span>
                  <span className="stat-label">Players</span>
                </div>
                <div className="stat">
                  <span className="stat-number">₹{(prizePool/1000).toFixed(0)}K</span>
                  <span className="stat-label">Prize Pool</span>
                </div>
                <div className="stat">
                  <span className="stat-number">10</span>
                  <span className="stat-label">Levels</span>
                </div>
                <div className="stat">
                  <span className="stat-number">30</span>
                  <span className="stat-label">Days</span>
                </div>
              </div>
              <div className="landing-cta">
                <button className="btn-primary" onClick={() => setScreen(SCREEN.REGISTER)}>
                  Join for ₹{ENTRY_FEE}
                </button>
                <button className="btn-secondary" onClick={() => setScreen(SCREEN.LEADERBOARD)}>
                  View Leaderboard
                </button>
              </div>

              <div className="divider" />

              <div className="how-section" style={{width:"100%"}}>
                <p className="section-title">How It Works</p>
                <div className="steps">
                  <div className="step">
                    <span className="step-num">1</span>
                    <div className="step-icon">🔐</div>
                    <p className="step-title">Pay & Enter</p>
                    <p className="step-desc">Pay ₹{ENTRY_FEE} entry fee. 70% goes to the prize pool. You compete for real money.</p>
                  </div>
                  <div className="step">
                    <span className="step-num">2</span>
                    <div className="step-icon">🧩</div>
                    <p className="step-title">Solve Riddles</p>
                    <p className="step-desc">Original riddles — not findable online. Solve each one to unlock the next. Think harder.</p>
                  </div>
                  <div className="step">
                    <span className="step-num">3</span>
                    <div className="step-icon">📅</div>
                    <p className="step-title">New Levels Every 3 Days</p>
                    <p className="step-desc">10 levels over 30 days. Join anytime — but you must clear all previous levels first.</p>
                  </div>
                  <div className="step">
                    <span className="step-num">4</span>
                    <div className="step-icon">🏆</div>
                    <p className="step-title">Win the Vault</p>
                    <p className="step-desc">First to clear all 10 levels wins the grand prize. Podium prizes for 2nd and 3rd too.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REGISTER */}
          {screen === SCREEN.REGISTER && (
            <div className="register-wrap">
              <h2 className="form-title">Enter the Vault</h2>
              <p className="form-sub">One entry. One chance. No shortcuts.</p>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="Your name" value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="you@email.com" value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (for prize contact)</label>
                <input className="form-input" placeholder="+91 XXXXX XXXXX" value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Age (must be 18+)</label>
                <input className="form-input" type="number" placeholder="25" value={formData.age}
                  onChange={e => setFormData({...formData, age: e.target.value})} />
              </div>

              <div className="fee-box">
                <span className="fee-label">Entry Fee</span>
                <span className="fee-amount">₹{ENTRY_FEE}</span>
              </div>

              <p className="prize-note">₹{Math.round(ENTRY_FEE * PRIZE_POOL_PERCENT / 100)} from your entry goes directly into the prize pool</p>

              <button className="btn-primary" style={{width:"100%"}} onClick={handleRegister}>
                Proceed to Payment
              </button>
            </div>
          )}

          {/* PAYMENT */}
          {screen === SCREEN.PAYMENT && (
            <div className="payment-wrap">
              <div className="payment-icon">🔒</div>
              <h2 className="payment-title">Secure Payment</h2>
              <p className="payment-sub">Complete your entry via Razorpay</p>

              <div className="fee-box" style={{marginBottom:"1.5rem"}}>
                <span className="fee-label">Total to Pay</span>
                <span className="fee-amount">₹{ENTRY_FEE}</span>
              </div>

              <button className="razorpay-btn" onClick={handlePayment}>
                Pay ₹{ENTRY_FEE} with Razorpay
              </button>

              <p className="payment-note">
                Powered by Razorpay · UPI, Cards, Net Banking, Wallets accepted<br/>
                Your entry is confirmed instantly on payment.
              </p>

              <div style={{marginTop:"2rem", padding:"1rem", background:"var(--surface)", border:"1px solid var(--border)"}}>
                <p style={{fontSize:"0.8rem", color:"var(--text-dim)", fontStyle:"italic", lineHeight:1.6}}>
                  ⚠️ Demo Mode: In the live app, this button triggers the Razorpay SDK. Click to simulate a successful payment and enter the game.
                </p>
              </div>
            </div>
          )}

          {/* GAME */}
          {screen === SCREEN.GAME && user && (
            <div className="game-wrap">
              <div className="level-header">
                <div>
                  <div className="level-badge">Level {currentLevel + 1} of {unlockedLevels}</div>
                  <h2 className="level-title">{puzzle.title}</h2>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontSize:"0.85rem", color:"var(--text-dim)"}}>Welcome,</p>
                  <p style={{fontFamily:"'Cinzel Decorative', serif", fontSize:"0.9rem", color:"var(--gold)"}}>{user.name}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="progress-bar-wrap">
                {PUZZLES.map((p, i) => (
                  <div key={i} className={`progress-seg ${completedLevels.includes(i) ? "done" : i === currentLevel ? "current" : ""}`} />
                ))}
              </div>

              {isLevelLocked ? (
                <div className="locked-level">
                  <div className="locked-icon">🔒</div>
                  <p className="locked-title">Level Locked</p>
                  <p className="locked-note">This level unlocks in a few days. Check the leaderboard while you wait.</p>
                </div>
              ) : isLevelCompleted ? (
                <div style={{textAlign:"center", padding:"3rem", background:"var(--surface)", border:"1px solid rgba(42,157,92,0.3)"}}>
                  <p style={{fontSize:"2rem", marginBottom:"0.5rem"}}>✓</p>
                  <p style={{fontFamily:"'Cinzel Decorative', serif", color:"#2a9d5c", fontSize:"1.1rem", marginBottom:"0.5rem"}}>Level Cleared</p>
                  <p style={{color:"var(--text-dim)", fontStyle:"italic"}}>You cracked it. Move to the next level.</p>
                  {currentLevel < unlockedLevels - 1 && (
                    <button className="btn-primary" style={{marginTop:"1.5rem"}}
                      onClick={() => { setCurrentLevel(prev => prev + 1); setAnswer(""); setFeedback(null); setShowHint(false); setAttempts(0); }}>
                      Next Level →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="riddle-card">
                    <p className="riddle-text">{puzzle.riddle}</p>
                  </div>

                  {showHint && (
                    <div className="hint-box">
                      💡 Hint: {puzzle.hint}
                    </div>
                  )}

                  {feedback && (
                    <div className={`feedback ${feedback.type}`}>
                      {feedback.msg}
                    </div>
                  )}

                  <div className="answer-row">
                    <input
                      ref={answerRef}
                      className="answer-input"
                      placeholder="Your answer..."
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSubmitAnswer()}
                    />
                    <button className="submit-btn" onClick={handleSubmitAnswer} disabled={!answer.trim()}>
                      Submit
                    </button>
                  </div>

                  <div className="hint-row">
                    {!showHint ? (
                      <button className="hint-btn" onClick={handleUseHint}>
                        🔍 Use Hint (₹29)
                      </button>
                    ) : (
                      <span style={{fontSize:"0.8rem", color:"var(--text-dim)", fontStyle:"italic"}}>Hint revealed</span>
                    )}
                    <span className="attempts-note">{attempts} attempt{attempts !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Level nav */}
                  {completedLevels.length > 0 && (
                    <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap"}}>
                      {PUZZLES.slice(0, unlockedLevels).map((p, i) => (
                        <button key={i}
                          style={{
                            fontFamily:"'Space Mono', monospace",
                            fontSize:"0.6rem",
                            padding:"0.3rem 0.8rem",
                            background: completedLevels.includes(i) ? "rgba(42,157,92,0.15)" : i === currentLevel ? "rgba(201,168,76,0.15)" : "var(--surface)",
                            border: `1px solid ${completedLevels.includes(i) ? "rgba(42,157,92,0.3)" : i === currentLevel ? "var(--border)" : "rgba(255,255,255,0.05)"}`,
                            color: completedLevels.includes(i) ? "#2a9d5c" : i === currentLevel ? "var(--gold)" : "var(--text-dim)",
                            cursor: completedLevels.includes(i) ? "pointer" : "default",
                            letterSpacing:"0.1em"
                          }}
                          onClick={() => { if (completedLevels.includes(i) || i === currentLevel) setCurrentLevel(i); }}
                        >
                          L{i+1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* LEADERBOARD */}
          {screen === SCREEN.LEADERBOARD && (
            <div className="lb-wrap">
              <div className="lb-header">
                <h2 className="lb-title">The Leaderboard</h2>
                <p className="lb-sub">Updated in real-time · Season 1</p>
              </div>

              <div className="prize-banner">
                <span className="prize-amount">₹{prizePool.toLocaleString("en-IN")}</span>
                <p className="prize-label">Current Prize Pool · grows with every entry</p>
              </div>

              <table className="lb-table">
                <thead className="lb-thead">
                  <tr>
                    <th className="lb-th">Rank</th>
                    <th className="lb-th">Player</th>
                    <th className="lb-th">Level</th>
                    <th className="lb-th">Avg Time</th>
                    <th className="lb-th">City</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_LEADERBOARD.map((p, i) => (
                    <tr key={i} className={`lb-row ${i === 0 ? "top" : ""}`}>
                      <td className="lb-td"><span className="rank-badge">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span></td>
                      <td className="lb-td">{p.name}</td>
                      <td className="lb-td"><span className="level-pill">LVL {p.level}</span></td>
                      <td className="lb-td" style={{fontFamily:"'Space Mono', monospace", fontSize:"0.8rem", color:"var(--text-dim)"}}>{p.time}</td>
                      <td className="lb-td" style={{color:"var(--text-dim)", fontSize:"0.9rem"}}>{p.location}</td>
                    </tr>
                  ))}
                  {user && (
                    <tr className="lb-row" style={{background:"rgba(201,168,76,0.04)"}}>
                      <td className="lb-td" style={{color:"var(--text-dim)"}}>#—</td>
                      <td className="lb-td" style={{color:"var(--gold)"}}>{user.name} (You)</td>
                      <td className="lb-td"><span className="level-pill">LVL {currentLevel + 1}</span></td>
                      <td className="lb-td" style={{fontFamily:"'Space Mono', monospace", fontSize:"0.8rem", color:"var(--text-dim)"}}>—</td>
                      <td className="lb-td" style={{color:"var(--text-dim)"}}>—</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {!user && (
                <div style={{textAlign:"center", marginTop:"3rem"}}>
                  <p style={{color:"var(--text-dim)", fontStyle:"italic", marginBottom:"1.5rem"}}>Your name isn't here yet.</p>
                  <button className="btn-primary" onClick={() => setScreen(SCREEN.REGISTER)}>
                    Join for ₹{ENTRY_FEE}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ADMIN */}
          {screen === SCREEN.ADMIN && (
            <div className="admin-wrap">
              <h2 className="admin-title">Admin Dashboard</h2>

              {!adminUnlocked ? (
                <div>
                  <p style={{color:"var(--text-dim)", fontStyle:"italic", marginBottom:"1rem"}}>Enter admin password to access dashboard.</p>
                  <div style={{display:"flex", gap:"0.8rem"}}>
                    <input className="form-input" type="password" placeholder="Password" value={adminPass}
                      onChange={e => setAdminPass(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (adminPass === "admin123" ? setAdminUnlocked(true) : alert("Wrong password"))}
                    />
                    <button className="submit-btn"
                      onClick={() => adminPass === "admin123" ? setAdminUnlocked(true) : alert("Wrong password")}>
                      Enter
                    </button>
                  </div>
                  <p style={{fontSize:"0.75rem", color:"var(--text-dim)", marginTop:"0.5rem", fontStyle:"italic"}}>Demo password: admin123</p>
                </div>
              ) : (
                <>
                  <div className="admin-stat-grid">
                    <div className="admin-stat-card">
                      <span className="admin-stat-num">{totalPlayers}</span>
                      <span className="admin-stat-label">Total Players</span>
                    </div>
                    <div className="admin-stat-card">
                      <span className="admin-stat-num">₹{totalRevenue.toLocaleString("en-IN")}</span>
                      <span className="admin-stat-label">Gross Revenue</span>
                    </div>
                    <div className="admin-stat-card">
                      <span className="admin-stat-num">₹{prizePool.toLocaleString("en-IN")}</span>
                      <span className="admin-stat-label">Prize Pool</span>
                    </div>
                    <div className="admin-stat-card">
                      <span className="admin-stat-num">₹{Math.round(totalRevenue * 0.3).toLocaleString("en-IN")}</span>
                      <span className="admin-stat-label">Platform Earnings</span>
                    </div>
                    <div className="admin-stat-card">
                      <span className="admin-stat-num">{unlockedLevels}</span>
                      <span className="admin-stat-label">Levels Unlocked</span>
                    </div>
                    <div className="admin-stat-card">
                      <span className="admin-stat-num">{hintsUsed}</span>
                      <span className="admin-stat-label">Hints Sold</span>
                    </div>
                  </div>

                  <p style={{fontFamily:"'Space Mono', monospace", fontSize:"0.65rem", letterSpacing:"0.15em", color:"var(--text-dim)", textTransform:"uppercase", marginBottom:"1rem"}}>
                    Player Progress
                  </p>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th className="admin-th">Player</th>
                        <th className="admin-th">Level</th>
                        <th className="admin-th">City</th>
                        <th className="admin-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_LEADERBOARD.map((p, i) => (
                        <tr key={i}>
                          <td className="admin-td">{p.name}</td>
                          <td className="admin-td">{p.level} / 10</td>
                          <td className="admin-td" style={{color:"var(--text-dim)"}}>{p.location}</td>
                          <td className="admin-td">
                            <span style={{
                              fontFamily:"'Space Mono', monospace",
                              fontSize:"0.6rem",
                              padding:"0.2rem 0.5rem",
                              background: p.level >= 6 ? "rgba(42,157,92,0.1)" : "rgba(201,168,76,0.1)",
                              color: p.level >= 6 ? "#2a9d5c" : "var(--gold)",
                              border: `1px solid ${p.level >= 6 ? "rgba(42,157,92,0.3)" : "var(--border)"}`,
                            }}>
                              {p.level >= 6 ? "LEADING" : "ACTIVE"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* No game screen if not logged in */}
          {screen === SCREEN.GAME && !user && (
            <div style={{textAlign:"center", padding:"5rem 2rem"}}>
              <p style={{fontFamily:"'Cinzel Decorative', serif", color:"var(--gold)", fontSize:"1.3rem", marginBottom:"0.5rem"}}>You're not in the vault.</p>
              <p style={{color:"var(--text-dim)", fontStyle:"italic", marginBottom:"2rem"}}>Register and pay to begin your journey.</p>
              <button className="btn-primary" onClick={() => setScreen(SCREEN.REGISTER)}>Join Now</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
