import { useState, useEffect, useRef } from "react";

const GAME_NAME = "RIDDLE RUN";
const TAGLINE = "10 Levels. 30 Days. One Winner.";

const ENTRY_FEE = 199;
const PRIZE_PER_PLAYER = 100; // Prize pool = players × ₹100
const RAZORPAY_KEY = "rzp_test_SyINirv7CvyYR7";

const PLANS = [
  { id: "season", label: "Single Season", price: 199, badge: "", desc: "One season entry", perks: [] },
  { id: "monthly", label: "Monthly Pass", price: 149, badge: "POPULAR", desc: "Auto-entry every season", perks: ["2 free hints/season", "Gold name on leaderboard", "Early level preview (1hr)"] },
  { id: "biannual", label: "6-Month Pass", price: 699, badge: "SAVE 42%", desc: "6 seasons, billed once", perks: ["2 free hints/season", "Gold name on leaderboard", "Early level preview (1hr)", "Exclusive subscriber badge"] },
  { id: "annual", label: "Annual Pass", price: 999, badge: "BEST VALUE", desc: "12 seasons, billed once", perks: ["2 free hints/season", "Gold name on leaderboard", "Early level preview (1hr)", "Exclusive subscriber badge", "Priority winner support"] },
];

const PUZZLES = [
  { level: 1, title: "The First Gate", riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "echo", hint: "Think of what happens when you shout in a valley or a mountain.", unlockDay: 1 },
  { level: 2, title: "The Mirror Room", riddle: "The more you take, the more you leave behind. What am I?", answer: "footsteps", hint: "Think about walking on sand or snow.", unlockDay: 4 },
  { level: 3, title: "The Hollow Clock", riddle: "I have cities, but no houses live there. I have mountains, but no trees grow. I have water, but no fish swim. I have roads, but no cars drive. What am I?", answer: "map", hint: "You use me to find your way — but I am not a phone.", unlockDay: 7 },
  { level: 4, title: "The Blind Merchant", riddle: "A man buys it to eat but never eats it. Another man sells it but has never owned it. What is it?", answer: "coffin", hint: "This is something you hope to never need — but everyone eventually does.", unlockDay: 10 },
  { level: 5, title: "The Twin Doors", riddle: "What has one eye but cannot see, a tail but cannot wag, and a body but no soul?", answer: "needle", hint: "Your grandmother might have used this to stitch your torn kurta.", unlockDay: 13 },
  { level: 6, title: "The Burning Library", riddle: "I am always in front of you but can never be seen. What am I?", answer: "future", hint: "It is not the past. It is not now.", unlockDay: 16 },
  { level: 7, title: "The Weightless Stone", riddle: "The one who makes it, sells it. The one who buys it, never uses it. The one who uses it, never knows it. What is it?", answer: "coffin", hint: "Same theme as level 4 — different words, same answer.", unlockDay: 19 },
  { level: 8, title: "The Whispering Wall", riddle: "I shrink every time I work. I vanish when I am done. Yet without me, things stay dirty. What am I?", answer: "soap", hint: "You use me every morning. I ask for nothing except to disappear.", unlockDay: 22 },
  { level: 9, title: "The Fallen King", riddle: "Kings and queens bow before me. The proud become humble in my presence. The strong grow weak. I am invisible, yet all-powerful. What am I?", answer: "time", hint: "Even mountains cannot resist me.", unlockDay: 25 },
  { level: 10, title: "The Final Vault", riddle: "I have no beginning, no end, and nothing in the middle. What am I?", answer: "doughnut", hint: "Sometimes the answer is simpler than you think. Think of a shape you can eat.", unlockDay: 28 },
];

const SCREEN = { LANDING: "landing", PLANS: "plans", REGISTER: "register", PAYMENT: "payment", GAME: "game", LEADERBOARD: "leaderboard", ADMIN: "admin" };

const MOCK_LEADERBOARD = [
  { name: "Aryan S.", level: 6, time: "2h 14m", location: "Delhi", sub: true },
  { name: "Meera K.", level: 5, time: "3h 02m", location: "Mumbai", sub: false },
  { name: "Vikram P.", level: 5, time: "3h 45m", location: "Bangalore", sub: true },
  { name: "Priya T.", level: 4, time: "1h 58m", location: "Pune", sub: false },
  { name: "Rahul N.", level: 3, time: "4h 11m", location: "Hyderabad", sub: false },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080810; --surface: #0f0f1a; --surface2: #16162a;
    --gold: #c9a84c; --gold-light: #e8c97a; --gold-dim: #7a6330;
    --crimson: #8b1a1a; --crimson-light: #c0392b;
    --text: #e8e0d0; --text-dim: #8a8070;
    --border: rgba(201,168,76,0.2); --glow: rgba(201,168,76,0.15);
    --green: #2a9d5c;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Cormorant Garamond', serif; min-height: 100vh; overflow-x: hidden; }
  .app { min-height: 100vh; position: relative; }
  .app::before { content: ''; position: fixed; inset: 0; background: radial-gradient(ellipse at 20% 20%, rgba(139,26,26,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(201,168,76,0.06) 0%, transparent 50%); pointer-events: none; z-index: 0; }
  .content { position: relative; z-index: 1; }
  .nav { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 2rem; border-bottom: 1px solid var(--border); background: rgba(8,8,16,0.8); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 100; }
  .nav-logo { font-family: 'Cinzel Decorative', serif; font-size: 1rem; color: var(--gold); letter-spacing: 0.2em; cursor: pointer; }
  .nav-links { display: flex; gap: 1.5rem; align-items: center; }
  .nav-link { font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em; color: var(--text-dim); cursor: pointer; text-transform: uppercase; transition: color 0.2s; background: none; border: none; }
  .nav-link:hover { color: var(--gold); }
  .nav-btn { font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em; background: var(--gold); color: var(--bg); border: none; padding: 0.5rem 1.2rem; cursor: pointer; text-transform: uppercase; transition: all 0.2s; font-weight: 700; }
  .nav-btn:hover { background: var(--gold-light); }

  /* Landing */
  .landing { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; padding: 2rem; text-align: center; }
  .landing-eyebrow { font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.4em; color: var(--gold-dim); text-transform: uppercase; margin-bottom: 1.5rem; animation: fadeUp 0.8s ease both; }
  .landing-title { font-family: 'Cinzel Decorative', serif; font-size: clamp(2.5rem, 8vw, 5rem); color: var(--gold); line-height: 1.1; margin-bottom: 1rem; animation: fadeUp 0.8s 0.1s ease both; text-shadow: 0 0 60px rgba(201,168,76,0.3); }
  .landing-rule { width: 80px; height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); margin: 1.5rem auto; animation: fadeUp 0.8s 0.2s ease both; }
  .landing-tagline { font-size: 1.3rem; font-style: italic; color: var(--text-dim); margin-bottom: 2rem; animation: fadeUp 0.8s 0.3s ease both; }

  /* Live counter */
  .prize-counter { background: linear-gradient(135deg, rgba(201,168,76,0.12), rgba(139,26,26,0.08)); border: 1px solid var(--border); padding: 1.5rem 3rem; margin-bottom: 2rem; text-align: center; animation: fadeUp 0.8s 0.35s ease both; position: relative; overflow: hidden; }
  .prize-counter::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(201,168,76,0.05), transparent); animation: shimmer 3s infinite; }
  .prize-counter-label { font-family: 'Space Mono', monospace; font-size: 0.6rem; letter-spacing: 0.3em; color: var(--text-dim); text-transform: uppercase; margin-bottom: 0.4rem; }
  .prize-counter-amount { font-family: 'Cinzel Decorative', serif; font-size: clamp(2rem, 6vw, 3.5rem); color: var(--gold); text-shadow: 0 0 40px rgba(201,168,76,0.5); display: block; }
  .prize-counter-formula { font-size: 0.85rem; color: var(--text-dim); font-style: italic; margin-top: 0.4rem; }
  .prize-counter-formula span { color: var(--gold); font-weight: 600; }

  .stats-row { display: flex; gap: 3rem; margin-bottom: 2.5rem; animation: fadeUp 0.8s 0.4s ease both; }
  .stat { text-align: center; }
  .stat-number { font-family: 'Cinzel Decorative', serif; font-size: 2rem; color: var(--gold); display: block; }
  .stat-label { font-family: 'Space Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; }
  .landing-cta { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; animation: fadeUp 0.8s 0.5s ease both; }
  .btn-primary { font-family: 'Space Mono', monospace; font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; background: var(--gold); color: var(--bg); border: none; padding: 1rem 2.5rem; cursor: pointer; font-weight: 700; transition: all 0.2s; }
  .btn-primary:hover { background: var(--gold-light); box-shadow: 0 0 30px rgba(201,168,76,0.4); }
  .btn-secondary { font-family: 'Space Mono', monospace; font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; background: transparent; color: var(--gold); border: 1px solid var(--gold-dim); padding: 1rem 2.5rem; cursor: pointer; transition: all 0.2s; }
  .btn-secondary:hover { border-color: var(--gold); background: var(--glow); }
  .how-section { padding: 5rem 2rem; max-width: 900px; margin: 0 auto; }
  .section-title { font-family: 'Cinzel Decorative', serif; font-size: 1.2rem; color: var(--gold); text-align: center; margin-bottom: 3rem; letter-spacing: 0.1em; }
  .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; }
  .step { background: var(--surface); border: 1px solid var(--border); padding: 2rem; position: relative; transition: border-color 0.3s; }
  .step:hover { border-color: var(--gold-dim); }
  .step-num { font-family: 'Cinzel Decorative', serif; font-size: 2.5rem; color: rgba(201,168,76,0.15); position: absolute; top: 1rem; right: 1rem; }
  .step-icon { font-size: 1.5rem; margin-bottom: 0.8rem; }
  .step-title { font-family: 'Space Mono', monospace; font-size: 0.7rem; letter-spacing: 0.15em; color: var(--gold); text-transform: uppercase; margin-bottom: 0.5rem; }
  .step-desc { font-size: 0.95rem; color: var(--text-dim); line-height: 1.6; }

  /* Plans */
  .plans-wrap { max-width: 900px; margin: 0 auto; padding: 3rem 2rem; }
  .plans-title { font-family: 'Cinzel Decorative', serif; font-size: 1.5rem; color: var(--gold); text-align: center; margin-bottom: 0.5rem; }
  .plans-sub { color: var(--text-dim); font-style: italic; text-align: center; margin-bottom: 3rem; }
  .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.2rem; margin-bottom: 2rem; }
  .plan-card { background: var(--surface); border: 1px solid var(--border); padding: 1.8rem; position: relative; cursor: pointer; transition: all 0.2s; }
  .plan-card:hover { border-color: var(--gold-dim); }
  .plan-card.selected { border-color: var(--gold); background: rgba(201,168,76,0.06); }
  .plan-badge { font-family: 'Space Mono', monospace; font-size: 0.55rem; letter-spacing: 0.15em; background: var(--gold); color: var(--bg); padding: 0.2rem 0.6rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.8rem; display: inline-block; }
  .plan-badge.empty { visibility: hidden; }
  .plan-name { font-family: 'Cinzel Decorative', serif; font-size: 1rem; color: var(--text); margin-bottom: 0.3rem; }
  .plan-price { font-family: 'Cinzel Decorative', serif; font-size: 2rem; color: var(--gold); margin-bottom: 0.3rem; }
  .plan-desc { font-size: 0.85rem; color: var(--text-dim); font-style: italic; margin-bottom: 1rem; }
  .plan-perks { list-style: none; }
  .plan-perk { font-size: 0.8rem; color: var(--text-dim); padding: 0.2rem 0; }
  .plan-perk::before { content: '✦ '; color: var(--gold); font-size: 0.6rem; }
  .plan-select-indicator { position: absolute; top: 1rem; right: 1rem; width: 18px; height: 18px; border: 1px solid var(--gold-dim); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .plan-select-indicator.selected { background: var(--gold); border-color: var(--gold); }

  /* Register */
  .register-wrap { max-width: 480px; margin: 0 auto; padding: 4rem 2rem; }
  .form-title { font-family: 'Cinzel Decorative', serif; font-size: 1.5rem; color: var(--gold); margin-bottom: 0.5rem; text-align: center; }
  .form-sub { font-style: italic; color: var(--text-dim); text-align: center; margin-bottom: 2.5rem; font-size: 1rem; }
  .form-group { margin-bottom: 1.5rem; }
  .form-label { font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-dim); display: block; margin-bottom: 0.5rem; }
  .form-input { width: 100%; background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.8rem 1rem; font-family: 'Cormorant Garamond', serif; font-size: 1rem; outline: none; transition: border-color 0.2s; }
  .form-input:focus { border-color: var(--gold-dim); }
  .form-input::placeholder { color: var(--text-dim); }
  .fee-box { background: var(--surface2); border: 1px solid var(--border); padding: 1.5rem; margin-bottom: 1rem; }
  .fee-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
  .fee-label { font-size: 0.9rem; color: var(--text-dim); }
  .fee-amount { font-family: 'Cinzel Decorative', serif; font-size: 1.5rem; color: var(--gold); }
  .fee-note { font-size: 0.8rem; color: var(--text-dim); font-style: italic; }
  .prize-note { font-size: 0.85rem; color: var(--text-dim); font-style: italic; text-align: center; margin-bottom: 1.5rem; }

  /* Payment */
  .payment-wrap { max-width: 420px; margin: 0 auto; padding: 4rem 2rem; text-align: center; }
  .payment-icon { font-size: 3rem; margin-bottom: 1rem; }
  .payment-title { font-family: 'Cinzel Decorative', serif; font-size: 1.3rem; color: var(--gold); margin-bottom: 0.5rem; }
  .payment-sub { color: var(--text-dim); font-style: italic; margin-bottom: 2rem; }
  .razorpay-btn { width: 100%; background: #2d6ef5; color: white; border: none; padding: 1rem; font-family: 'Space Mono', monospace; font-size: 0.8rem; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; margin-bottom: 1rem; transition: background 0.2s; }
  .razorpay-btn:hover { background: #1a56d4; }
  .payment-note { font-size: 0.8rem; color: var(--text-dim); font-style: italic; }

  /* Game */
  .game-wrap { max-width: 700px; margin: 0 auto; padding: 3rem 2rem; }
  .level-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
  .level-badge { font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.2em; color: var(--gold); text-transform: uppercase; background: rgba(201,168,76,0.1); border: 1px solid var(--border); padding: 0.3rem 0.8rem; }
  .level-title { font-family: 'Cinzel Decorative', serif; font-size: 1.6rem; color: var(--text); margin-top: 0.5rem; }
  .progress-bar-wrap { display: flex; gap: 4px; margin-bottom: 2.5rem; }
  .progress-seg { flex: 1; height: 3px; background: var(--surface2); transition: background 0.4s; }
  .progress-seg.done { background: var(--gold); }
  .progress-seg.current { background: var(--gold-dim); }
  .riddle-card { background: var(--surface); border: 1px solid var(--border); padding: 2.5rem; margin-bottom: 2rem; position: relative; }
  .riddle-card::before { content: '"'; position: absolute; top: -0.5rem; left: 1.5rem; font-size: 5rem; color: rgba(201,168,76,0.08); font-family: 'Cinzel Decorative', serif; line-height: 1; }
  .riddle-text { font-size: 1.35rem; line-height: 1.7; font-style: italic; color: var(--text); }
  .answer-row { display: flex; gap: 0.8rem; margin-bottom: 1rem; }
  .answer-input { flex: 1; background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.9rem 1.2rem; font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; outline: none; transition: border-color 0.2s; }
  .answer-input:focus { border-color: var(--gold-dim); }
  .answer-input.wrong { border-color: var(--crimson-light); }
  .submit-btn { font-family: 'Space Mono', monospace; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; background: var(--gold); color: var(--bg); border: none; padding: 0.9rem 1.5rem; cursor: pointer; font-weight: 700; transition: all 0.2s; white-space: nowrap; }
  .submit-btn:hover { background: var(--gold-light); }
  .submit-btn:disabled { background: var(--gold-dim); cursor: not-allowed; }
  .feedback { font-size: 0.95rem; padding: 0.8rem 1rem; margin-bottom: 1rem; font-style: italic; }
  .feedback.success { background: rgba(42,157,92,0.1); border: 1px solid rgba(42,157,92,0.3); color: #2a9d5c; }
  .feedback.error { background: rgba(192,57,43,0.1); border: 1px solid rgba(192,57,43,0.3); color: #c0392b; }
  .hint-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
  .hint-btn { font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; background: transparent; color: var(--text-dim); border: 1px solid rgba(255,255,255,0.1); padding: 0.5rem 1rem; cursor: pointer; transition: all 0.2s; }
  .hint-btn:hover { color: var(--gold); border-color: var(--gold-dim); }
  .hint-box { background: rgba(201,168,76,0.05); border: 1px solid rgba(201,168,76,0.15); padding: 1rem 1.2rem; margin-bottom: 1.5rem; font-style: italic; color: var(--text-dim); font-size: 0.95rem; }
  .attempts-note { font-family: 'Space Mono', monospace; font-size: 0.6rem; color: var(--text-dim); letter-spacing: 0.1em; }
  .locked-level { background: var(--surface); border: 1px solid var(--border); padding: 3rem; text-align: center; margin-top: 2rem; }
  .locked-icon { font-size: 2.5rem; margin-bottom: 1rem; }
  .locked-title { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem; color: var(--text-dim); margin-bottom: 0.5rem; }
  .locked-note { color: var(--text-dim); font-style: italic; font-size: 0.95rem; }

  /* Leaderboard */
  .lb-wrap { max-width: 700px; margin: 0 auto; padding: 3rem 2rem; }
  .lb-header { text-align: center; margin-bottom: 2.5rem; }
  .lb-title { font-family: 'Cinzel Decorative', serif; font-size: 1.5rem; color: var(--gold); margin-bottom: 0.3rem; }
  .lb-sub { color: var(--text-dim); font-style: italic; }
  .lb-table { width: 100%; border-collapse: collapse; }
  .lb-thead tr { border-bottom: 1px solid var(--border); }
  .lb-th { font-family: 'Space Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; color: var(--text-dim); text-transform: uppercase; padding: 0.8rem 1rem; text-align: left; }
  .lb-row { border-bottom: 1px solid rgba(201,168,76,0.05); transition: background 0.2s; }
  .lb-row:hover { background: rgba(201,168,76,0.03); }
  .lb-row.top { background: rgba(201,168,76,0.06); }
  .lb-td { padding: 1rem; font-size: 1rem; color: var(--text); }
  .rank-badge { font-family: 'Cinzel Decorative', serif; font-size: 1.1rem; color: var(--gold); }
  .level-pill { font-family: 'Space Mono', monospace; font-size: 0.65rem; background: rgba(201,168,76,0.1); border: 1px solid var(--border); color: var(--gold); padding: 0.2rem 0.6rem; letter-spacing: 0.1em; }
  .sub-badge { font-family: 'Space Mono', monospace; font-size: 0.5rem; background: rgba(201,168,76,0.2); border: 1px solid var(--gold-dim); color: var(--gold); padding: 0.15rem 0.4rem; letter-spacing: 0.1em; margin-left: 0.4rem; vertical-align: middle; }
  .prize-banner { background: linear-gradient(135deg, rgba(201,168,76,0.1), rgba(139,26,26,0.1)); border: 1px solid var(--border); padding: 2rem; text-align: center; margin-bottom: 2.5rem; }
  .prize-amount { font-family: 'Cinzel Decorative', serif; font-size: 2.5rem; color: var(--gold); display: block; text-shadow: 0 0 40px rgba(201,168,76,0.4); }
  .prize-label { font-style: italic; color: var(--text-dim); font-size: 0.95rem; }
  .prize-formula-note { font-family: 'Space Mono', monospace; font-size: 0.6rem; color: var(--text-dim); letter-spacing: 0.1em; margin-top: 0.5rem; }

  /* Admin */
  .admin-wrap { max-width: 700px; margin: 0 auto; padding: 3rem 2rem; }
  .admin-title { font-family: 'Cinzel Decorative', serif; font-size: 1.3rem; color: var(--gold); margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
  .admin-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
  .admin-stat-card { background: var(--surface); border: 1px solid var(--border); padding: 1.5rem; text-align: center; }
  .admin-stat-num { font-family: 'Cinzel Decorative', serif; font-size: 2rem; color: var(--gold); display: block; }
  .admin-stat-label { font-family: 'Space Mono', monospace; font-size: 0.6rem; letter-spacing: 0.15em; color: var(--text-dim); text-transform: uppercase; margin-top: 0.3rem; }
  .admin-table { width: 100%; border-collapse: collapse; }
  .admin-th { font-family: 'Space Mono', monospace; font-size: 0.6rem; letter-spacing: 0.15em; color: var(--text-dim); text-transform: uppercase; padding: 0.8rem; text-align: left; border-bottom: 1px solid var(--border); }
  .admin-td { padding: 0.8rem; font-size: 0.9rem; color: var(--text); border-bottom: 1px solid rgba(201,168,76,0.04); }

  .divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 3rem 0; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes glow { 0%, 100% { text-shadow: 0 0 20px rgba(201,168,76,0.2); } 50% { text-shadow: 0 0 60px rgba(201,168,76,0.5); } }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  @keyframes countUp { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
  .glow-anim { animation: glow 3s ease-in-out infinite; }

  @media (max-width: 600px) {
    .stats-row { gap: 1.5rem; } .stat-number { font-size: 1.5rem; } .level-title { font-size: 1.2rem; }
    .admin-stat-grid { grid-template-columns: repeat(2, 1fr); } .plans-grid { grid-template-columns: 1fr; }
    .prize-counter { padding: 1.2rem; }
  }
`;

export default function App() {
  const [screen, setScreen] = useState(SCREEN.LANDING);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", age: "" });
  const [selectedPlan, setSelectedPlan] = useState("season");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(247);
  const [displayPlayers, setDisplayPlayers] = useState(247);
  const [adminPass, setAdminPass] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const answerRef = useRef(null);

  // Load Razorpay SDK on mount
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => console.error("Failed to load Razorpay SDK");
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // Prize pool = players × ₹100
  const prizePool = totalPlayers * PRIZE_PER_PLAYER;
  const totalRevenue = totalPlayers * ENTRY_FEE;
  const platformEarnings = totalRevenue - prizePool;

  // Animated counter for prize pool
  const [displayPrize, setDisplayPrize] = useState(prizePool);
  useEffect(() => {
    let start = 0;
    const end = prizePool;
    const duration = 1500;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplayPrize(end); clearInterval(timer); }
      else setDisplayPrize(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [prizePool]);

  const unlockedLevels = PUZZLES.filter(p => p.unlockDay <= 10).length;
  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);

  const handleRegister = () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.age) { alert("Please fill all fields."); return; }
    if (parseInt(formData.age) < 18) { alert("You must be 18 or older to participate."); return; }
    setScreen(SCREEN.PAYMENT);
  };

  const handlePayment = () => {
    const amount = selectedPlanData?.price * 100; // Razorpay needs paise
    const options = {
      key: RAZORPAY_KEY,
      amount: amount,
      currency: "INR",
      name: "RIDDLE RUN",
      description: selectedPlanData?.label + " — Season 1",
      image: "https://riddle-run-e3pm.vercel.app/favicon.ico",
      prefill: {
        name: formData.name,
        email: formData.email,
        contact: formData.phone,
      },
      theme: { color: "#c9a84c" },
      handler: function (response) {
        // Payment successful — response.razorpay_payment_id is the payment ID
        setUser({ name: formData.name, email: formData.email, plan: selectedPlan, isSub: selectedPlan !== "season", paymentId: response.razorpay_payment_id });
        setTotalPlayers(p => p + 1);
        setScreen(SCREEN.GAME);
      },
      modal: {
        ondismiss: function () {
          alert("Payment cancelled. Please try again to enter the game.");
        }
      }
    };
    if (window.Razorpay) {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      alert("Razorpay is loading, please try again in a moment.");
    }
  };

  const handleSubmitAnswer = () => {
    const puzzle = PUZZLES[currentLevel];
    const userAnswer = answer.trim().toLowerCase();
    if (userAnswer === puzzle.answer.toLowerCase()) {
      setFeedback({ type: "success", msg: "Correct! The vault opens. Proceed to the next level." });
      setCompletedLevels(prev => [...prev, currentLevel]);
      setTimeout(() => {
        if (currentLevel < unlockedLevels - 1) {
          setCurrentLevel(prev => prev + 1); setAnswer(""); setFeedback(null); setShowHint(false); setAttempts(0);
        } else {
          setFeedback({ type: "success", msg: "You've reached the current frontier. The next level unlocks in 3 days. Watch the leaderboard!" });
        }
      }, 2000);
    } else {
      const n = attempts + 1; setAttempts(n);
      setFeedback({ type: "error", msg: `Wrong answer. Think deeper. (Attempt ${n})` });
      if (answerRef.current) { answerRef.current.classList.add("wrong"); setTimeout(() => answerRef.current?.classList.remove("wrong"), 800); }
    }
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
            <div className="nav-logo" onClick={() => setScreen(SCREEN.LANDING)}>RIDDLE RUN</div>
            <div className="nav-links">
              <button className="nav-link" onClick={() => setScreen(SCREEN.LEADERBOARD)}>Leaderboard</button>
              {user && <button className="nav-link" onClick={() => setScreen(SCREEN.GAME)}>My Game</button>}
              <button className="nav-link" onClick={() => setScreen(SCREEN.ADMIN)}>Admin</button>
              {!user
                ? <button className="nav-btn" onClick={() => setScreen(SCREEN.PLANS)}>Join Now</button>
                : <button className="nav-btn" onClick={() => setScreen(SCREEN.GAME)}>Continue</button>}
            </div>
          </nav>

          {/* LANDING */}
          {screen === SCREEN.LANDING && (
            <div className="landing">
              <p className="landing-eyebrow">Season 1 · Now Live</p>
              <h1 className="landing-title glow-anim">RIDDLE<br />RUN</h1>
              <div className="landing-rule" />
              <p className="landing-tagline">{TAGLINE}</p>

              {/* Live Prize Counter */}
              <div className="prize-counter">
                <p className="prize-counter-label">Current Prize Pool</p>
                <span className="prize-counter-amount">₹{displayPrize.toLocaleString("en-IN")}</span>
                <p className="prize-counter-formula">
                  <span>{totalPlayers} players</span> × ₹100 — grows with every entry
                </p>
              </div>

              <div className="stats-row">
                <div className="stat"><span className="stat-number">{totalPlayers}</span><span className="stat-label">Players</span></div>
                <div className="stat"><span className="stat-number">10</span><span className="stat-label">Levels</span></div>
                <div className="stat"><span className="stat-number">30</span><span className="stat-label">Days</span></div>
                <div className="stat"><span className="stat-number">₹199</span><span className="stat-label">Entry</span></div>
              </div>

              <div className="landing-cta">
                <button className="btn-primary" onClick={() => setScreen(SCREEN.PLANS)}>Join & Win</button>
                <button className="btn-secondary" onClick={() => setScreen(SCREEN.LEADERBOARD)}>View Leaderboard</button>
              </div>

              <div className="divider" />

              <div className="how-section" style={{width:"100%"}}>
                <p className="section-title">How It Works</p>
                <div className="steps">
                  <div className="step"><span className="step-num">1</span><div className="step-icon">🔐</div><p className="step-title">Pay & Enter</p><p className="step-desc">Pay ₹199 entry fee. Every player adds ₹100 to the prize pool. You compete for real money.</p></div>
                  <div className="step"><span className="step-num">2</span><div className="step-icon">🧩</div><p className="step-title">Solve Riddles</p><p className="step-desc">Original riddles — not findable online. Solve each one to unlock the next.</p></div>
                  <div className="step"><span className="step-num">3</span><div className="step-icon">📅</div><p className="step-title">New Levels Every 3 Days</p><p className="step-desc">10 levels over 30 days. Join anytime — but clear all previous levels first.</p></div>
                  <div className="step"><span className="step-num">4</span><div className="step-icon">🏆</div><p className="step-title">Win the Prize Pool</p><p className="step-desc">First to clear all 10 levels wins. More players = bigger prize. Simple math.</p></div>
                </div>
              </div>
            </div>
          )}

          {/* PLANS */}
          {screen === SCREEN.PLANS && (
            <div className="plans-wrap">
              <h2 className="plans-title">Choose Your Plan</h2>
              <p className="plans-sub">Single entry or subscribe and never miss a season</p>

              <div className="plans-grid">
                {PLANS.map(plan => (
                  <div key={plan.id} className={`plan-card ${selectedPlan === plan.id ? "selected" : ""}`} onClick={() => setSelectedPlan(plan.id)}>
                    <div className={`plan-badge ${!plan.badge ? "empty" : ""}`}>{plan.badge || "."}</div>
                    <div className="plan-select-indicator" style={{position:"absolute",top:"1rem",right:"1rem",width:"18px",height:"18px",border:`1px solid ${selectedPlan===plan.id?"var(--gold)":"var(--gold-dim)"}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:selectedPlan===plan.id?"var(--gold)":"transparent"}}>
                      {selectedPlan === plan.id && <span style={{color:"#080810",fontSize:"0.7rem",fontWeight:"bold"}}>✓</span>}
                    </div>
                    <p className="plan-name">{plan.label}</p>
                    <p className="plan-price">₹{plan.price}</p>
                    <p className="plan-desc">{plan.desc}</p>
                    {plan.perks.length > 0 && (
                      <ul className="plan-perks">
                        {plan.perks.map((perk, i) => <li key={i} className="plan-perk">{perk}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              <div style={{background:"var(--surface2)",border:"1px solid var(--border)",padding:"1rem 1.5rem",marginBottom:"1.5rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:"var(--text-dim)",fontSize:"0.9rem"}}>Selected: <strong style={{color:"var(--text)"}}>{selectedPlanData?.label}</strong></span>
                  <span style={{fontFamily:"'Cinzel Decorative',serif",color:"var(--gold)",fontSize:"1.3rem"}}>₹{selectedPlanData?.price}</span>
                </div>
                {selectedPlan === "season" && <p style={{fontSize:"0.8rem",color:"var(--text-dim)",fontStyle:"italic",marginTop:"0.4rem"}}>Your entry adds ₹100 to the prize pool</p>}
                {selectedPlan !== "season" && <p style={{fontSize:"0.8rem",color:"var(--gold)",fontStyle:"italic",marginTop:"0.4rem"}}>✦ Subscriber perks included every season</p>}
              </div>

              <button className="btn-primary" style={{width:"100%"}} onClick={() => setScreen(SCREEN.REGISTER)}>
                Continue with {selectedPlanData?.label}
              </button>
              <button className="btn-secondary" style={{width:"100%",marginTop:"0.8rem"}} onClick={() => setScreen(SCREEN.LANDING)}>
                ← Back
              </button>
            </div>
          )}

          {/* REGISTER */}
          {screen === SCREEN.REGISTER && (
            <div className="register-wrap">
              <h2 className="form-title">Enter the Vault</h2>
              <p className="form-sub">One entry. One chance. No shortcuts.</p>
              <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" placeholder="Your name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="you@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Phone (for prize contact)</label><input className="form-input" placeholder="+91 XXXXX XXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Age (must be 18+)</label><input className="form-input" type="number" placeholder="25" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} /></div>

              <div className="fee-box">
                <div className="fee-row"><span className="fee-label">{selectedPlanData?.label}</span><span className="fee-amount">₹{selectedPlanData?.price}</span></div>
                {selectedPlan === "season" && <p className="fee-note">₹100 from your entry goes to the prize pool</p>}
                {selectedPlan !== "season" && <p className="fee-note" style={{color:"var(--gold)"}}>✦ Subscriber perks activated on payment</p>}
              </div>

              <button className="btn-primary" style={{width:"100%"}} onClick={handleRegister}>Proceed to Payment</button>
              <button className="btn-secondary" style={{width:"100%",marginTop:"0.8rem"}} onClick={() => setScreen(SCREEN.PLANS)}>← Change Plan</button>
            </div>
          )}

          {/* PAYMENT */}
          {screen === SCREEN.PAYMENT && (
            <div className="payment-wrap">
              <div className="payment-icon">🔒</div>
              <h2 className="payment-title">Secure Payment</h2>
              <p className="payment-sub">Complete your entry via Razorpay</p>
              <div className="fee-box" style={{marginBottom:"1.5rem",textAlign:"left"}}>
                <div className="fee-row"><span className="fee-label">Plan</span><span style={{color:"var(--text)",fontSize:"0.9rem"}}>{selectedPlanData?.label}</span></div>
                <div className="fee-row"><span className="fee-label">Total</span><span className="fee-amount">₹{selectedPlanData?.price}</span></div>
              </div>
              <button className="razorpay-btn" onClick={handlePayment}>Pay ₹{selectedPlanData?.price} with Razorpay</button>
              <p className="payment-note">Powered by Razorpay · UPI, Cards, Net Banking, Wallets accepted<br/>Your entry is confirmed instantly on payment.</p>
              <div style={{marginTop:"1.5rem",display:"flex",gap:"0.5rem",justifyContent:"center",flexWrap:"wrap"}}>
                {["UPI","Visa","Mastercard","RuPay","Net Banking","Wallets"].map(m => (
                  <span key={m} style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",padding:"0.3rem 0.6rem",border:"1px solid var(--border)",color:"var(--text-dim)",letterSpacing:"0.1em"}}>{m}</span>
                ))}
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
                  <p style={{fontSize:"0.85rem",color:"var(--text-dim)"}}>Welcome,</p>
                  <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"0.9rem",color:"var(--gold)"}}>{user.name}{user.isSub && <span className="sub-badge">SUBSCRIBER</span>}</p>
                </div>
              </div>

              <div className="progress-bar-wrap">{PUZZLES.map((p, i) => <div key={i} className={`progress-seg ${completedLevels.includes(i)?"done":i===currentLevel?"current":""}`} />)}</div>

              {isLevelLocked ? (
                <div className="locked-level"><div className="locked-icon">🔒</div><p className="locked-title">Level Locked</p><p className="locked-note">This level unlocks in a few days. Check the leaderboard while you wait.</p></div>
              ) : isLevelCompleted ? (
                <div style={{textAlign:"center",padding:"3rem",background:"var(--surface)",border:"1px solid rgba(42,157,92,0.3)"}}>
                  <p style={{fontSize:"2rem",marginBottom:"0.5rem"}}>✓</p>
                  <p style={{fontFamily:"'Cinzel Decorative',serif",color:"#2a9d5c",fontSize:"1.1rem",marginBottom:"0.5rem"}}>Level Cleared</p>
                  <p style={{color:"var(--text-dim)",fontStyle:"italic"}}>You cracked it. Move to the next level.</p>
                  {currentLevel < unlockedLevels - 1 && <button className="btn-primary" style={{marginTop:"1.5rem"}} onClick={() => { setCurrentLevel(p=>p+1); setAnswer(""); setFeedback(null); setShowHint(false); setAttempts(0); }}>Next Level →</button>}
                </div>
              ) : (
                <>
                  <div className="riddle-card"><p className="riddle-text">{puzzle.riddle}</p></div>
                  {showHint && <div className="hint-box">💡 Hint: {puzzle.hint}</div>}
                  {feedback && <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>}
                  <div className="answer-row">
                    <input ref={answerRef} className="answer-input" placeholder="Your answer..." value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSubmitAnswer()} />
                    <button className="submit-btn" onClick={handleSubmitAnswer} disabled={!answer.trim()}>Submit</button>
                  </div>
                  <div className="hint-row">
                    {!showHint ? <button className="hint-btn" onClick={() => { setShowHint(true); setHintsUsed(p=>p+1); }}>🔍 Use Hint {user.isSub ? "(Free)" : "(₹29)"}</button> : <span style={{fontSize:"0.8rem",color:"var(--text-dim)",fontStyle:"italic"}}>Hint revealed</span>}
                    <span className="attempts-note">{attempts} attempt{attempts!==1?"s":""}</span>
                  </div>
                  {completedLevels.length > 0 && (
                    <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                      {PUZZLES.slice(0,unlockedLevels).map((p,i) => (
                        <button key={i} style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",padding:"0.3rem 0.8rem",background:completedLevels.includes(i)?"rgba(42,157,92,0.15)":i===currentLevel?"rgba(201,168,76,0.15)":"var(--surface)",border:`1px solid ${completedLevels.includes(i)?"rgba(42,157,92,0.3)":i===currentLevel?"var(--border)":"rgba(255,255,255,0.05)"}`,color:completedLevels.includes(i)?"#2a9d5c":i===currentLevel?"var(--gold)":"var(--text-dim)",cursor:completedLevels.includes(i)?"pointer":"default",letterSpacing:"0.1em"}} onClick={() => { if(completedLevels.includes(i)||i===currentLevel) setCurrentLevel(i); }}>L{i+1}</button>
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
              <div className="lb-header"><h2 className="lb-title">The Leaderboard</h2><p className="lb-sub">Updated in real-time · Season 1</p></div>
              <div className="prize-banner">
                <span className="prize-amount">₹{prizePool.toLocaleString("en-IN")}</span>
                <p className="prize-label">Current Prize Pool</p>
                <p className="prize-formula-note">{totalPlayers} PLAYERS × ₹100 = ₹{prizePool.toLocaleString("en-IN")}</p>
              </div>
              <table className="lb-table">
                <thead className="lb-thead"><tr><th className="lb-th">Rank</th><th className="lb-th">Player</th><th className="lb-th">Level</th><th className="lb-th">Time</th><th className="lb-th">City</th></tr></thead>
                <tbody>
                  {MOCK_LEADERBOARD.map((p, i) => (
                    <tr key={i} className={`lb-row ${i===0?"top":""}`}>
                      <td className="lb-td"><span className="rank-badge">{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span></td>
                      <td className="lb-td">{p.name}{p.sub && <span className="sub-badge">SUB</span>}</td>
                      <td className="lb-td"><span className="level-pill">LVL {p.level}</span></td>
                      <td className="lb-td" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.8rem",color:"var(--text-dim)"}}>{p.time}</td>
                      <td className="lb-td" style={{color:"var(--text-dim)",fontSize:"0.9rem"}}>{p.location}</td>
                    </tr>
                  ))}
                  {user && <tr className="lb-row" style={{background:"rgba(201,168,76,0.04)"}}>
                    <td className="lb-td" style={{color:"var(--text-dim)"}}>#—</td>
                    <td className="lb-td" style={{color:"var(--gold)"}}>{user.name} (You){user.isSub&&<span className="sub-badge">SUB</span>}</td>
                    <td className="lb-td"><span className="level-pill">LVL {currentLevel+1}</span></td>
                    <td className="lb-td" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.8rem",color:"var(--text-dim)"}}>—</td>
                    <td className="lb-td" style={{color:"var(--text-dim)"}}>—</td>
                  </tr>}
                </tbody>
              </table>
              {!user && <div style={{textAlign:"center",marginTop:"3rem"}}><p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1.5rem"}}>Your name isn't here yet.</p><button className="btn-primary" onClick={() => setScreen(SCREEN.PLANS)}>Join for ₹199</button></div>}
            </div>
          )}

          {/* ADMIN */}
          {screen === SCREEN.ADMIN && (
            <div className="admin-wrap">
              <h2 className="admin-title">Admin Dashboard</h2>
              {!adminUnlocked ? (
                <div>
                  <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1rem"}}>Enter admin password.</p>
                  <div style={{display:"flex",gap:"0.8rem"}}>
                    <input className="form-input" type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key==="Enter"&&(adminPass==="admin123"?setAdminUnlocked(true):alert("Wrong password"))} />
                    <button className="submit-btn" onClick={() => adminPass==="admin123"?setAdminUnlocked(true):alert("Wrong password")}>Enter</button>
                  </div>
                  <p style={{fontSize:"0.75rem",color:"var(--text-dim)",marginTop:"0.5rem",fontStyle:"italic"}}>Demo password: admin123</p>
                </div>
              ) : (
                <>
                  <div className="admin-stat-grid">
                    <div className="admin-stat-card"><span className="admin-stat-num">{totalPlayers}</span><span className="admin-stat-label">Total Players</span></div>
                    <div className="admin-stat-card"><span className="admin-stat-num">₹{totalRevenue.toLocaleString("en-IN")}</span><span className="admin-stat-label">Gross Revenue</span></div>
                    <div className="admin-stat-card"><span className="admin-stat-num">₹{prizePool.toLocaleString("en-IN")}</span><span className="admin-stat-label">Prize Pool</span></div>
                    <div className="admin-stat-card"><span className="admin-stat-num">₹{platformEarnings.toLocaleString("en-IN")}</span><span className="admin-stat-label">Your Earnings</span></div>
                    <div className="admin-stat-card"><span className="admin-stat-num">{unlockedLevels}</span><span className="admin-stat-label">Levels Unlocked</span></div>
                    <div className="admin-stat-card"><span className="admin-stat-num">{hintsUsed}</span><span className="admin-stat-label">Hints Sold</span></div>
                  </div>
                  <div style={{background:"var(--surface2)",border:"1px solid var(--border)",padding:"1rem 1.5rem",marginBottom:"2rem",borderLeft:"3px solid var(--gold)"}}>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--gold)",letterSpacing:"0.15em",marginBottom:"0.3rem"}}>PRIZE POOL FORMULA</p>
                    <p style={{fontSize:"0.9rem",color:"var(--text-dim)"}}>{totalPlayers} players × ₹100 = <strong style={{color:"var(--gold)"}}>₹{prizePool.toLocaleString("en-IN")}</strong> prize pool</p>
                    <p style={{fontSize:"0.85rem",color:"var(--text-dim)",marginTop:"0.3rem",fontStyle:"italic"}}>Every new player adds exactly ₹100 to the winner's pot</p>
                  </div>
                  <table className="admin-table">
                    <thead><tr><th className="admin-th">Player</th><th className="admin-th">Level</th><th className="admin-th">City</th><th className="admin-th">Status</th></tr></thead>
                    <tbody>
                      {MOCK_LEADERBOARD.map((p, i) => (
                        <tr key={i}>
                          <td className="admin-td">{p.name}{p.sub&&<span className="sub-badge">SUB</span>}</td>
                          <td className="admin-td">{p.level} / 10</td>
                          <td className="admin-td" style={{color:"var(--text-dim)"}}>{p.location}</td>
                          <td className="admin-td"><span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",padding:"0.2rem 0.5rem",background:p.level>=6?"rgba(42,157,92,0.1)":"rgba(201,168,76,0.1)",color:p.level>=6?"#2a9d5c":"var(--gold)",border:`1px solid ${p.level>=6?"rgba(42,157,92,0.3)":"var(--border)"}`}}>{p.level>=6?"LEADING":"ACTIVE"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {screen === SCREEN.GAME && !user && (
            <div style={{textAlign:"center",padding:"5rem 2rem"}}>
              <p style={{fontFamily:"'Cinzel Decorative',serif",color:"var(--gold)",fontSize:"1.3rem",marginBottom:"0.5rem"}}>You're not in the vault.</p>
              <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"2rem"}}>Register and pay to begin your journey.</p>
              <button className="btn-primary" onClick={() => setScreen(SCREEN.PLANS)}>Join Now</button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
