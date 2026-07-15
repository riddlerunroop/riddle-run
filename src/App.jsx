import { useState, useEffect, useRef } from "react";

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const SUBSCRIPTION_FEE = 200;
const SEASON_NUMBER = 1;
const SEASON_PRIZE = "Amazon Echo Dot (4th Gen)";
const SEASON_PRIZE_VALUE = "₹4,499";
const ADMIN_PASSWORD = "Moro2017!";
const GAME_START_DATE = new Date("2026-07-07T00:00:00"); // ← SET LAUNCH DATE
const SEASON_DURATION_DAYS = 10; // 10 day season
const RIDDLE_INTERVAL_HOURS = 24; // new riddle every 24 hours

// ─── ATTEMPTS PER LEVEL ───────────────────────────────────────────────────────
// Difficulty scales up as players progress
const ATTEMPTS_PER_LEVEL = {
  1: Infinity, // Day 1 — Unlimited
  2: Infinity, // Day 2 — Unlimited
  3: 10,       // Day 3 — 10 attempts
  4: 10,       // Day 4 — 10 attempts
  5: 5,        // Day 5 — 5 attempts
  6: 5,        // Day 6 — 5 attempts
  7: 3,        // Day 7 — 3 attempts
  8: 3,        // Day 8 — 3 attempts
  9: 2,        // Day 9 — 2 attempts
  10: 1,       // Day 10 — 1 attempt only!
};

function getMaxAttempts(levelIndex) {
  return ATTEMPTS_PER_LEVEL[levelIndex + 1] || Infinity;
}

// Max hints a player can use on a SINGLE riddle, no matter how many
// hints they have banked (earned via referrals or bought).
const MAX_HINTS_PER_RIDDLE = 3;

// Day 10 is permanently reserved, every season, for a real-person "manhunt" —
// the person may or may not be a celebrity, but they are always real and must be
// found and contacted using genuine investigation, not guessed or looked up outright.
// This notice renders automatically above the Day 10 riddle every season, so it
// never needs to be retyped into the riddle text itself.
const DAY10_MANHUNT_NOTICE = {
  title: "This Is A Manhunt",
  body: "Every season, Day 10 leads to one real, living person — they may or may not be well known, but they are always real. Solving this riddle takes genuine investigation: reading closely, cross-referencing clues, and searching deliberately — not a lucky guess. Before you search, know this: the answer is not a legend from a history book, nor a name that appears just by asking a machine. They are real, and they are waiting to be found — not solved for you."
};

function getAttemptsLabel(levelIndex) {
  const max = getMaxAttempts(levelIndex);
  if (max === Infinity) return "Unlimited attempts";
  if (max === 1) return "1 attempt only — make it count!";
  return `${max} attempts allowed`;
}

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://jgcyjrxryriqltixzytt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnY3lqcnhyeXJpcWx0aXh6eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjEwMTAsImV4cCI6MjA5NjU5NzAxMH0.udyNBilBveBZxyyojxT__Qc20ozydKiAz1l6DsmZUYQ";
const RAZORPAY_KEY = "rzp_test_SyINirv7CvyYR7";

const supabase = {
  async query(endpoint, options = {}) {
    const res = await fetch(SUPABASE_URL + endpoint, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json", "Prefer": options.prefer || "", ...options.headers },
      cache: "no-store",
      ...options
    });
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  async getPlayer(email) { const d = await this.query(`/rest/v1/players?email=eq.${encodeURIComponent(email)}&select=*`); return d?.[0] || null; },
  async createPlayer(p) { return await this.query("/rest/v1/players", { method:"POST", prefer:"return=representation", body:JSON.stringify(p) }); },
  async getProgress(pid) { const d = await this.query(`/rest/v1/progress?player_id=eq.${pid}&season=eq.${SEASON_NUMBER}&select=*`); return d?.[0] || null; },
  async saveProgress(pid, completed, current, hints) {
    const ex = await this.getProgress(pid);
    if (ex) return await this.query(`/rest/v1/progress?player_id=eq.${pid}&season=eq.${SEASON_NUMBER}`, { method:"PATCH", prefer:"return=representation", body:JSON.stringify({ completed_levels:completed, current_level:current, hints_used:hints, last_updated:new Date().toISOString() }) });
    return await this.query("/rest/v1/progress", { method:"POST", prefer:"return=representation", body:JSON.stringify({ player_id:pid, season:SEASON_NUMBER, completed_levels:completed, current_level:current, hints_used:hints }) });
  },
  async getPlayerCount() {
    const res = await fetch(SUPABASE_URL + "/rest/v1/players?select=id", { headers: { "apikey":SUPABASE_ANON_KEY, "Authorization":"Bearer "+SUPABASE_ANON_KEY, "Prefer":"count=exact" } });
    const c = res.headers.get("content-range");
    return c ? parseInt(c.split("/")[1]) || 0 : 0;
  },
  // ── Riddles persistence — so Admin edits survive page reloads and future deploys ──
  async getRiddles() { return await this.query(`/rest/v1/riddles?season=eq.${SEASON_NUMBER}&select=*&order=id.asc`); },
  async seedRiddles(riddleList) {
    return await this.query("/rest/v1/riddles", { method:"POST", prefer:"return=representation",
      body: JSON.stringify(riddleList.map(r => ({ id:r.id, season:SEASON_NUMBER, title:r.title, riddle:r.riddle, answer:r.answer, hints:r.hints||["","",""], explanation:r.explanation||"", unlock_day:r.unlockDay }))) });
  },
  async saveRiddleToDb(r) {
    return await this.query(`/rest/v1/riddles?id=eq.${r.id}&season=eq.${SEASON_NUMBER}`, { method:"PATCH", prefer:"return=representation",
      body: JSON.stringify({ title:r.title, riddle:r.riddle, answer:r.answer, hints:r.hints||["","",""], explanation:r.explanation||"", unlock_day:r.unlockDay, updated_at:new Date().toISOString() }) });
  }
};

// ─── SUBSCRIPTION PLANS ──────────────────────────────────────────────────────
const PLANS = [
  { id:"monthly", label:"Monthly", price:200, badge:"POPULAR", desc:"Access to current season", perks:["Full access to all riddles","Leaderboard ranking","Hint purchases available"] },
  { id:"biannual", label:"6 Months", price:999, badge:"SAVE 17%", desc:"6 seasons access", perks:["Full access to all riddles","Leaderboard ranking","2 free hints per season","Gold name on leaderboard"] },
  { id:"annual", label:"Annual", price:1799, badge:"BEST VALUE", desc:"12 seasons access", perks:["Full access to all riddles","Leaderboard ranking","2 free hints per season","Gold name on leaderboard","Subscriber badge"] },
];

// ─── REFERRAL REWARDS ────────────────────────────────────────────────────────
const REFERRAL_REWARDS = [
  { count:1, reward:"1 free hint" },
  { count:2, reward:"2 free hints" },
  { count:3, reward:"Next month FREE" },
  { count:5, reward:"🏅 Badge of Honour + 1 month FREE" },
];

// ─── RIDDLES ─────────────────────────────────────────────────────────────────
// Each riddle supports up to 3 progressive hints (hints[0] = gentlest, hints[2] = most direct)
// and an "explanation" shown after the riddle is solved (or attempts run out) so players
// understand exactly why the answer is correct — and why other plausible-sounding
// answers don't actually fit every clue.
const DEFAULT_RIDDLES = [
  { id:1, title:"Day One", riddle:"I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer:"echo", hints:["Think of what happens when you shout in a valley.","",""], explanation:"An echo has no mouth or ears of its own — it only repeats sound that already exists, and it needs air (sound waves) to travel.", unlockDay:1 },
  { id:2, title:"Day Two", riddle:"The more you take, the more you leave behind. What am I?", answer:"footsteps", hints:["Think about walking on sand or snow.","",""], explanation:"Every step you take leaves a new footprint behind you — the more steps taken, the more footprints left.", unlockDay:2 },
  { id:3, title:"Day Three", riddle:"I have cities, but no houses live there. I have mountains, but no trees grow. I have water, but no fish swim. What am I?", answer:"map", hints:["You use me to find your way.","",""], explanation:"A map depicts cities, mountains, and water, but it's a flat representation — nothing actually lives or grows on it.", unlockDay:3 },
  { id:4, title:"Day Four", riddle:"A man buys it to eat but never eats it. Another man sells it but has never owned it. What is it?", answer:"coffin", hints:["Something you hope to never need.","",""], explanation:"A coffin is bought for the deceased (who can't eat it), and the undertaker sells it without ever having owned or used one personally.", unlockDay:4 },
  { id:5, title:"Day Five", riddle:"What has one eye but cannot see, a tail but cannot wag, and a body but no soul?", answer:"needle", hints:["Your grandmother used this to stitch clothes.","",""], explanation:"A sewing needle has an 'eye' (the hole for thread) and a 'tail' (the thread trailing behind), but neither is a literal, living eye or tail.", unlockDay:5 },
  { id:6, title:"Day Six", riddle:"I am always in front of you but can never be seen. What am I?", answer:"future", hints:["It is not the past. It is not now.","",""], explanation:"The future always lies ahead of us in time, but by definition it hasn't happened yet, so it can never actually be seen.", unlockDay:6 },
  { id:7, title:"Day Seven", riddle:"The one who makes it sells it. The one who buys it never uses it. The one who uses it never knows it.", answer:"coffin", hints:["Same theme as Day Four.","",""], explanation:"The maker sells the coffin, the buyer (a grieving family member) never personally uses it, and the person who ends up 'using' it is no longer conscious to know it.", unlockDay:7 },
  { id:8, title:"Day Eight", riddle:"I shrink every time I work. I vanish when I am done. Yet without me, things stay dirty. What am I?", answer:"soap", hints:["You use me every morning.","",""], explanation:"A bar of soap physically shrinks with every use and eventually disappears entirely, but it's essential for cleaning.", unlockDay:8 },
  { id:9, title:"Day Nine", riddle:"Kings and queens bow before me. The proud become humble. The strong grow weak. I am invisible, yet all-powerful. What am I?", answer:"time", hints:["Even mountains cannot resist me.","",""], explanation:"Time affects everyone regardless of status or strength — it's an abstract force, not a physical or visible thing, yet nothing escapes its effect.", unlockDay:9 },
  { id:10, title:"Day Ten", riddle:"I have no beginning, no end, and nothing in the middle. What am I?", answer:"doughnut", hints:["Think of a shape you can eat.","",""], explanation:"A doughnut is a ring — geometrically a torus — with no defined start or end point along its loop, and a hole in the middle rather than a filled center.", unlockDay:10 },
];

const MOCK_LEADERBOARD = [
  { name:"Aryan S.", level:6, time:"2h 14m", location:"Delhi", sub:true, referrals:5, badge:true },
  { name:"Meera K.", level:5, time:"3h 02m", location:"Mumbai", sub:false, referrals:3, badge:false },
  { name:"Vikram P.", level:5, time:"3h 45m", location:"Bangalore", sub:true, referrals:2, badge:false },
  { name:"Priya T.", level:4, time:"1h 58m", location:"Pune", sub:false, referrals:1, badge:false },
  { name:"Rahul N.", level:3, time:"4h 11m", location:"Hyderabad", sub:false, referrals:0, badge:false },
];

const SCREEN = { LANDING:"landing", PLANS:"plans", REGISTER:"register", PAYMENT:"payment", GAME:"game", LEADERBOARD:"leaderboard", ADMIN:"admin", LOGIN:"login", TC:"tc", PRIVACY:"privacy", REFERRAL:"referral", WHY_SUBSCRIBE:"why_subscribe" };
const ADMIN_TAB = { STATS:"stats", SEASON:"season", RIDDLES:"riddles", PLAYERS:"players" };

let REGISTERED_USERS = [
  { email:"roop.saggar@gmail.com", password:"roop123", name:"Roop", phone:"9999999993", plan:"monthly", isSub:true, completedLevels:[], hintsUsed:0, referrals:0, badge:false },
  { email:"aryan@test.com", password:"aryan123", name:"Aryan S.", phone:"9999999991", plan:"annual", isSub:true, completedLevels:[0,1,2,3,4,5], hintsUsed:1, referrals:5, badge:true },
  { email:"meera@test.com", password:"meera123", name:"Meera K.", phone:"9999999992", plan:"monthly", isSub:false, completedLevels:[0,1,2,3,4], hintsUsed:0, referrals:3, badge:false },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getDaysSinceStart(startDate) {
  const diff = new Date() - startDate;
  return diff > 0 ? Math.max(1, Math.floor(diff / (1000*60*60*24)) + 1) : 0;
}
function getUnlockDate(startDate, unlockDay) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + unlockDay - 1);
  return d;
}
function formatDate(d) { return d.toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }); }
function formatCountdown(date) {
  const diff = date - new Date();
  if (diff <= 0) return null;
  const days = Math.floor(diff/(1000*60*60*24));
  const hours = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
  const mins = Math.floor((diff%(1000*60*60))/(1000*60));
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
function getReferralReward(count) {
  if (count >= 5) return "🏅 Badge of Honour + 1 month FREE + 2 hints";
  if (count >= 3) return "Next month FREE";
  if (count >= 2) return "2 free hints";
  if (count >= 1) return "1 free hint";
  return null;
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --bg:#080810; --surface:#0f0f1a; --surface2:#16162a;
    --gold:#c9a84c; --gold-light:#e8c97a; --gold-dim:#7a6330;
    --text:#e8e0d0; --text-dim:#8a8070;
    --border:rgba(201,168,76,0.2); --glow:rgba(201,168,76,0.15);
    --green:#2a9d5c; --red:#c0392b;
  }
  body { background:var(--bg); color:var(--text); font-family:'Cormorant Garamond',serif; min-height:100vh; overflow-x:hidden; }
  .app { min-height:100vh; position:relative; }
  .app::before { content:''; position:fixed; inset:0; background:radial-gradient(ellipse at 20% 20%,rgba(139,26,26,0.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,rgba(201,168,76,0.06) 0%,transparent 50%); pointer-events:none; z-index:0; }
  .content { position:relative; z-index:1; }

  .nav { display:flex; justify-content:space-between; align-items:center; padding:1.2rem 2rem; border-bottom:1px solid var(--border); background:rgba(8,8,16,0.9); backdrop-filter:blur(10px); position:sticky; top:0; z-index:100; flex-wrap:wrap; gap:0.5rem; }
  .nav-logo { font-family:'Cinzel Decorative',serif; font-size:1rem; color:var(--gold); letter-spacing:0.2em; cursor:pointer; }
  .nav-links { display:flex; gap:1.2rem; align-items:center; flex-wrap:wrap; }
  .nav-link { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.15em; color:var(--text-dim); cursor:pointer; text-transform:uppercase; background:none; border:none; transition:color 0.2s; }
  .nav-link:hover { color:var(--gold); }
  .nav-btn { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.15em; background:var(--gold); color:var(--bg); border:none; padding:0.5rem 1.1rem; cursor:pointer; text-transform:uppercase; font-weight:700; transition:all 0.2s; }
  .nav-btn:hover { background:var(--gold-light); }

  /* LANDING */
  .landing { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:90vh; padding:2rem; text-align:center; }
  .eyebrow { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.4em; color:var(--gold-dim); text-transform:uppercase; margin-bottom:1.5rem; animation:fadeUp 0.8s ease both; }
  .landing-title { font-family:'Cinzel Decorative',serif; font-size:clamp(2.5rem,8vw,5rem); color:var(--gold); line-height:1.1; margin-bottom:1rem; animation:fadeUp 0.8s 0.1s ease both; text-shadow:0 0 60px rgba(201,168,76,0.3); }
  .rule { width:80px; height:1px; background:linear-gradient(90deg,transparent,var(--gold),transparent); margin:1.5rem auto; }
  .tagline { font-size:1.2rem; font-style:italic; color:var(--text-dim); margin-bottom:2rem; animation:fadeUp 0.8s 0.3s ease both; }

  /* PRIZE BANNER */
  .prize-banner { background:linear-gradient(135deg,rgba(201,168,76,0.16),rgba(42,157,92,0.08)); border:1px solid var(--border); padding:1.5rem 2.5rem; margin-bottom:2rem; text-align:center; animation:fadeUp 0.8s 0.35s ease both; position:relative; overflow:hidden; }
  .prize-banner::before { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(201,168,76,0.05),transparent); animation:shimmer 3s infinite; }
  .prize-eyebrow { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.3em; color:var(--text-dim); text-transform:uppercase; margin-bottom:0.4rem; }
  .prize-name { font-family:'Cinzel Decorative',serif; font-size:clamp(1.2rem,4vw,2rem); color:var(--gold); text-shadow:0 0 30px rgba(201,168,76,0.4); display:block; margin-bottom:0.3rem; }
  .prize-value { font-size:0.9rem; color:var(--text-dim); font-style:italic; }
  .prize-value span { color:var(--gold); font-weight:600; }

  /* FIRST RIDDLE PREVIEW */
  .riddle-preview { background:var(--surface); border:1px solid var(--border); padding:2rem; margin-bottom:2rem; max-width:600px; width:100%; text-align:left; animation:fadeUp 0.8s 0.4s ease both; position:relative; }
  .riddle-preview::before { content:'"'; position:absolute; top:-0.5rem; left:1.5rem; font-size:4rem; color:rgba(201,168,76,0.08); font-family:'Cinzel Decorative',serif; line-height:1; }
  .riddle-preview-label { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.2em; color:var(--gold); text-transform:uppercase; margin-bottom:0.8rem; }
  .riddle-preview-text { font-size:1.15rem; line-height:1.8; font-style:italic; color:var(--text); margin-bottom:1rem; }
  .riddle-preview-cta { font-family:'Space Mono',monospace; font-size:0.65rem; color:var(--text-dim); letter-spacing:0.1em; }
  .riddle-preview-cta span { color:var(--gold); }

  .stats-row { display:flex; gap:2.5rem; margin-bottom:2rem; animation:fadeUp 0.8s 0.45s ease both; flex-wrap:wrap; justify-content:center; }
  .stat { text-align:center; }
  .stat-number { font-family:'Cinzel Decorative',serif; font-size:1.8rem; color:var(--gold); display:block; }
  .stat-label { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.2em; color:var(--text-dim); text-transform:uppercase; }
  .landing-cta { display:flex; gap:1rem; flex-wrap:wrap; justify-content:center; animation:fadeUp 0.8s 0.5s ease both; }

  .btn-primary { font-family:'Space Mono',monospace; font-size:0.7rem; letter-spacing:0.2em; text-transform:uppercase; background:var(--gold); color:var(--bg); border:none; padding:1rem 2.5rem; cursor:pointer; font-weight:700; transition:all 0.2s; }
  .btn-primary:hover { background:var(--gold-light); box-shadow:0 0 30px rgba(201,168,76,0.4); }
  .btn-primary:disabled { background:var(--gold-dim); cursor:not-allowed; }
  .btn-secondary { font-family:'Space Mono',monospace; font-size:0.7rem; letter-spacing:0.2em; text-transform:uppercase; background:transparent; color:var(--gold); border:1px solid var(--gold-dim); padding:1rem 2.5rem; cursor:pointer; transition:all 0.2s; }
  .btn-secondary:hover { border-color:var(--gold); background:var(--glow); }

  /* HOW IT WORKS */
  .how-section { padding:4rem 2rem; max-width:900px; margin:0 auto; width:100%; }
  .section-title { font-family:'Cinzel Decorative',serif; font-size:1.1rem; color:var(--gold); text-align:center; margin-bottom:2.5rem; letter-spacing:0.1em; }
  .steps { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1.5rem; }
  .step { background:var(--surface); border:1px solid var(--border); padding:1.8rem; position:relative; transition:border-color 0.3s; }
  .step:hover { border-color:var(--gold-dim); }
  .step-num { font-family:'Cinzel Decorative',serif; font-size:2.5rem; color:rgba(201,168,76,0.12); position:absolute; top:0.8rem; right:0.8rem; }
  .step-icon { font-size:1.4rem; margin-bottom:0.6rem; }
  .step-title { font-family:'Space Mono',monospace; font-size:0.65rem; letter-spacing:0.15em; color:var(--gold); text-transform:uppercase; margin-bottom:0.4rem; }
  .step-desc { font-size:0.9rem; color:var(--text-dim); line-height:1.6; }

  /* PLANS */
  .page-wrap { max-width:900px; margin:0 auto; padding:3rem 2rem; }
  .page-title { font-family:'Cinzel Decorative',serif; font-size:1.5rem; color:var(--gold); text-align:center; margin-bottom:0.5rem; }
  .page-sub { color:var(--text-dim); font-style:italic; text-align:center; margin-bottom:2.5rem; }
  .plans-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1.2rem; margin-bottom:2rem; }
  .plan-card { background:var(--surface); border:1px solid var(--border); padding:1.8rem; cursor:pointer; transition:all 0.2s; position:relative; }
  .plan-card:hover { border-color:var(--gold-dim); }
  .plan-card.selected { border-color:var(--gold); background:rgba(201,168,76,0.06); }
  .plan-badge { font-family:'Space Mono',monospace; font-size:0.5rem; letter-spacing:0.15em; background:var(--gold); color:var(--bg); padding:0.2rem 0.5rem; text-transform:uppercase; font-weight:700; margin-bottom:0.8rem; display:inline-block; }
  .plan-name { font-family:'Cinzel Decorative',serif; font-size:1rem; color:var(--text); margin-bottom:0.2rem; }
  .plan-price { font-family:'Cinzel Decorative',serif; font-size:2rem; color:var(--gold); margin-bottom:0.2rem; }
  .plan-desc { font-size:0.8rem; color:var(--text-dim); font-style:italic; margin-bottom:0.8rem; }
  .plan-perks { list-style:none; }
  .plan-perk { font-size:0.78rem; color:var(--text-dim); padding:0.2rem 0; }
  .plan-perk::before { content:'✦ '; color:var(--gold); font-size:0.55rem; }

  /* FORMS */
  .form-wrap { max-width:480px; margin:0 auto; padding:3rem 2rem; }
  .form-group { margin-bottom:1.4rem; }
  .form-label { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--text-dim); display:block; margin-bottom:0.5rem; }
  .form-input { width:100%; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:0.8rem 1rem; font-family:'Cormorant Garamond',serif; font-size:1rem; outline:none; transition:border-color 0.2s; }
  .form-input:focus { border-color:var(--gold-dim); }
  .form-input::placeholder { color:var(--text-dim); }
  .form-textarea { width:100%; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:0.8rem 1rem; font-family:'Cormorant Garamond',serif; font-size:1rem; outline:none; resize:vertical; min-height:80px; transition:border-color 0.2s; }
  .form-textarea:focus { border-color:var(--gold-dim); }
  .fee-box { background:var(--surface2); border:1px solid var(--border); padding:1.2rem; margin-bottom:1rem; }
  .fee-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem; }
  .fee-label { font-size:0.9rem; color:var(--text-dim); }
  .fee-amount { font-family:'Cinzel Decorative',serif; font-size:1.4rem; color:var(--gold); }
  .fee-note { font-size:0.78rem; color:var(--text-dim); font-style:italic; }

  /* PAYMENT */
  .payment-wrap { max-width:420px; margin:0 auto; padding:3rem 2rem; text-align:center; }
  .razorpay-btn { width:100%; background:#2d6ef5; color:white; border:none; padding:1rem; font-family:'Space Mono',monospace; font-size:0.75rem; letter-spacing:0.15em; text-transform:uppercase; cursor:pointer; margin-bottom:1rem; transition:background 0.2s; }
  .razorpay-btn:hover { background:#1a56d4; }

  /* GAME */
  .game-wrap { max-width:700px; margin:0 auto; padding:3rem 2rem; }
  .level-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2rem; padding-bottom:1.5rem; border-bottom:1px solid var(--border); }
  .level-badge { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.2em; color:var(--gold); text-transform:uppercase; background:rgba(201,168,76,0.1); border:1px solid var(--border); padding:0.3rem 0.8rem; }
  .level-title { font-family:'Cinzel Decorative',serif; font-size:1.5rem; color:var(--text); margin-top:0.4rem; }
  .progress-wrap { margin-bottom:2rem; }
  .progress-label { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.15em; color:var(--text-dim); text-transform:uppercase; margin-bottom:0.5rem; display:flex; justify-content:space-between; }
  .progress-bar { display:flex; gap:3px; }
  .progress-seg { flex:1; height:3px; background:var(--surface2); transition:background 0.4s; border-radius:1px; }
  .progress-seg.done { background:var(--gold); }
  .progress-seg.current { background:var(--gold-dim); }
  .riddle-card { background:var(--surface); border:1px solid var(--border); padding:2.5rem; margin-bottom:2rem; position:relative; }
  .riddle-card::before { content:'"'; position:absolute; top:-0.5rem; left:1.5rem; font-size:5rem; color:rgba(201,168,76,0.08); font-family:'Cinzel Decorative',serif; line-height:1; }
  .riddle-text { font-size:1.3rem; line-height:1.8; font-style:italic; color:var(--text); }
  .answer-row { display:flex; gap:0.8rem; margin-bottom:1rem; }
  .answer-input { flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:0.9rem 1.2rem; font-family:'Cormorant Garamond',serif; font-size:1.1rem; outline:none; transition:border-color 0.2s; }
  .answer-input:focus { border-color:var(--gold-dim); }
  .answer-input.wrong { border-color:var(--red); animation:shake 0.3s ease; }
  .submit-btn { font-family:'Space Mono',monospace; font-size:0.65rem; letter-spacing:0.15em; text-transform:uppercase; background:var(--gold); color:var(--bg); border:none; padding:0.9rem 1.5rem; cursor:pointer; font-weight:700; transition:all 0.2s; white-space:nowrap; }
  .submit-btn:hover { background:var(--gold-light); }
  .submit-btn:disabled { background:var(--gold-dim); cursor:not-allowed; }
  .feedback { font-size:0.95rem; padding:0.8rem 1rem; margin-bottom:1rem; font-style:italic; }
  .feedback.success { background:rgba(42,157,92,0.1); border:1px solid rgba(42,157,92,0.3); color:var(--green); }
  .feedback.error { background:rgba(192,57,43,0.1); border:1px solid rgba(192,57,43,0.3); color:var(--red); }
  .hint-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
  .hint-btn { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.15em; text-transform:uppercase; background:transparent; color:var(--text-dim); border:1px solid rgba(255,255,255,0.1); padding:0.5rem 0.9rem; cursor:pointer; transition:all 0.2s; }
  .hint-btn:hover { color:var(--gold); border-color:var(--gold-dim); }
  .hint-box { background:rgba(201,168,76,0.05); border:1px solid rgba(201,168,76,0.15); padding:1rem 1.2rem; margin-bottom:1.5rem; font-style:italic; color:var(--text-dim); font-size:0.95rem; }
  .attempts-note { font-family:'Space Mono',monospace; font-size:0.58rem; color:var(--text-dim); letter-spacing:0.1em; }

  /* WAITING */
  .waiting-card { background:var(--surface); border:1px solid var(--border); padding:3rem; text-align:center; }
  .waiting-icon { font-size:3rem; margin-bottom:1rem; }
  .waiting-title { font-family:'Cinzel Decorative',serif; font-size:1.2rem; color:var(--gold); margin-bottom:0.5rem; }
  .waiting-date { font-size:1rem; color:var(--text); margin-bottom:0.5rem; }
  .waiting-countdown { font-family:'Space Mono',monospace; font-size:1.4rem; color:var(--gold); letter-spacing:0.1em; margin:1rem 0; }
  .waiting-note { font-size:0.9rem; color:var(--text-dim); font-style:italic; }

  /* LEADERBOARD */
  .lb-wrap { max-width:700px; margin:0 auto; padding:3rem 2rem; }
  .lb-title { font-family:'Cinzel Decorative',serif; font-size:1.5rem; color:var(--gold); margin-bottom:0.3rem; text-align:center; }
  .lb-sub { color:var(--text-dim); font-style:italic; text-align:center; margin-bottom:2rem; }
  .prize-card { background:linear-gradient(135deg,rgba(201,168,76,0.16),rgba(42,157,92,0.08)); border:1px solid var(--border); padding:1.5rem 2rem; text-align:center; margin-bottom:2rem; }
  .prize-card-label { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.25em; color:var(--text-dim); text-transform:uppercase; margin-bottom:0.3rem; }
  .prize-card-name { font-family:'Cinzel Decorative',serif; font-size:1.5rem; color:var(--gold); display:block; }
  .prize-card-value { font-size:0.85rem; color:var(--text-dim); font-style:italic; margin-top:0.3rem; }
  .lb-table { width:100%; border-collapse:collapse; }
  .lb-thead tr { border-bottom:1px solid var(--border); }
  .lb-th { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.2em; color:var(--text-dim); text-transform:uppercase; padding:0.8rem 0.8rem; text-align:left; }
  .lb-row { border-bottom:1px solid rgba(201,168,76,0.05); transition:background 0.2s; }
  .lb-row:hover { background:rgba(201,168,76,0.03); }
  .lb-row.top { background:rgba(201,168,76,0.06); }
  .lb-td { padding:0.9rem 0.8rem; font-size:0.95rem; color:var(--text); }
  .rank-badge { font-family:'Cinzel Decorative',serif; font-size:1rem; color:var(--gold); }
  .level-pill { font-family:'Space Mono',monospace; font-size:0.6rem; background:rgba(201,168,76,0.1); border:1px solid var(--border); color:var(--gold); padding:0.2rem 0.5rem; letter-spacing:0.1em; }
  .sub-badge { font-family:'Space Mono',monospace; font-size:0.45rem; background:rgba(201,168,76,0.2); border:1px solid var(--gold-dim); color:var(--gold); padding:0.15rem 0.4rem; letter-spacing:0.1em; margin-left:0.3rem; vertical-align:middle; }
  .honour-badge { font-size:0.8rem; margin-left:0.3rem; }

  /* REFERRAL */
  .referral-wrap { max-width:600px; margin:0 auto; padding:3rem 2rem; }
  .referral-title { font-family:'Cinzel Decorative',serif; font-size:1.4rem; color:var(--gold); margin-bottom:0.5rem; text-align:center; }
  .referral-sub { color:var(--text-dim); font-style:italic; text-align:center; margin-bottom:2rem; }
  .referral-link-box { background:var(--surface2); border:1px solid var(--border); padding:1rem 1.5rem; margin-bottom:2rem; display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
  .referral-link { font-family:'Space Mono',monospace; font-size:0.7rem; color:var(--gold); letter-spacing:0.05em; word-break:break-all; }
  .copy-btn { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.1em; background:var(--gold); color:var(--bg); border:none; padding:0.5rem 1rem; cursor:pointer; font-weight:700; white-space:nowrap; }
  .rewards-table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
  .rewards-th { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.15em; color:var(--text-dim); text-transform:uppercase; padding:0.8rem; text-align:left; border-bottom:1px solid var(--border); }
  .rewards-td { padding:0.9rem 0.8rem; font-size:0.95rem; color:var(--text); border-bottom:1px solid rgba(201,168,76,0.05); }
  .your-referrals { background:var(--surface); border:1px solid var(--border); padding:1.5rem; text-align:center; }

  /* ADMIN */
  .admin-wrap { max-width:800px; margin:0 auto; padding:3rem 2rem; }
  .admin-title { font-family:'Cinzel Decorative',serif; font-size:1.2rem; color:var(--gold); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid var(--border); }
  .admin-tabs { display:flex; gap:0; margin-bottom:2rem; border:1px solid var(--border); overflow:hidden; }
  .admin-tab { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.1em; text-transform:uppercase; padding:0.8rem 1.2rem; cursor:pointer; border:none; background:transparent; color:var(--text-dim); transition:all 0.2s; flex:1; }
  .admin-tab.active { background:var(--gold); color:var(--bg); font-weight:700; }
  .admin-stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:2rem; }
  .admin-stat-card { background:var(--surface); border:1px solid var(--border); padding:1.4rem; text-align:center; }
  .admin-stat-num { font-family:'Cinzel Decorative',serif; font-size:1.8rem; color:var(--gold); display:block; }
  .admin-stat-label { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.15em; color:var(--text-dim); text-transform:uppercase; margin-top:0.3rem; }
  .admin-table { width:100%; border-collapse:collapse; }
  .admin-th { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.15em; color:var(--text-dim); text-transform:uppercase; padding:0.8rem; text-align:left; border-bottom:1px solid var(--border); }
  .admin-td { padding:0.8rem; font-size:0.88rem; color:var(--text); border-bottom:1px solid rgba(201,168,76,0.04); }
  .riddle-editor { background:var(--surface); border:1px solid var(--border); padding:1.5rem; margin-bottom:1rem; }
  .riddle-editor-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem; }
  .riddle-level-badge { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.15em; color:var(--gold); background:rgba(201,168,76,0.1); border:1px solid var(--border); padding:0.3rem 0.8rem; text-transform:uppercase; }
  .riddle-unlock-info { font-family:'Space Mono',monospace; font-size:0.58rem; color:var(--text-dim); letter-spacing:0.1em; }
  .save-btn { font-family:'Space Mono',monospace; font-size:0.6rem; letter-spacing:0.15em; text-transform:uppercase; background:var(--green); color:white; border:none; padding:0.5rem 1.1rem; cursor:pointer; transition:opacity 0.2s; margin-top:0.8rem; }
  .save-btn:hover { opacity:0.85; }
  .saved-badge { font-family:'Space Mono',monospace; font-size:0.58rem; color:var(--green); margin-left:0.8rem; }
  .info-box { background:var(--surface2); border:1px solid var(--border); padding:1rem 1.5rem; margin-bottom:1.5rem; border-left:3px solid var(--gold); }
  .info-box-title { font-family:'Space Mono',monospace; font-size:0.6rem; color:var(--gold); letter-spacing:0.15em; margin-bottom:0.3rem; text-transform:uppercase; }
  .info-box-text { font-size:0.9rem; color:var(--text-dim); line-height:1.6; }

  /* FOOTER */
  .footer { border-top:1px solid var(--border); padding:2rem; text-align:center; margin-top:4rem; }
  .footer-links { display:flex; gap:2rem; justify-content:center; flex-wrap:wrap; margin-bottom:1rem; }
  .footer-link { font-family:'Space Mono',monospace; font-size:0.55rem; letter-spacing:0.15em; text-transform:uppercase; background:none; border:none; color:var(--text-dim); cursor:pointer; transition:color 0.2s; }
  .footer-link:hover { color:var(--gold); }
  .footer-copy { font-family:'Space Mono',monospace; font-size:0.5rem; color:var(--text-dim); letter-spacing:0.1em; }
  .footer-legal { font-family:'Space Mono',monospace; font-size:0.45rem; color:var(--text-dim); letter-spacing:0.08em; margin-top:0.3rem; }

  /* MISC */
  .divider { height:1px; background:linear-gradient(90deg,transparent,var(--border),transparent); margin:3rem 0; }

  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glow { 0%,100%{text-shadow:0 0 20px rgba(201,168,76,0.2)} 50%{text-shadow:0 0 60px rgba(201,168,76,0.5)} }
  @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
  .glow-anim { animation:glow 3s ease-in-out infinite; }

  @media(max-width:600px){
    .stats-row{gap:1.5rem} .stat-number{font-size:1.4rem} .level-title{font-size:1.2rem}
    .admin-stat-grid{grid-template-columns:repeat(2,1fr)} .plans-grid{grid-template-columns:1fr}
    .nav{padding:1rem} .admin-tabs{flex-wrap:wrap}
  }
`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(SCREEN.LANDING);
  const [user, setUser] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [formData, setFormData] = useState({ name:"", email:"", phone:"", age:"", referralCode:"" });
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [attemptsExhausted, setAttemptsExhausted] = useState(false);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintsAvailable, setHintsAvailable] = useState(0);
  const [hintsUsedThisRiddle, setHintsUsedThisRiddle] = useState(0); // resets every time currentLevel changes; capped at MAX_HINTS_PER_RIDDLE
  const [revealedHints, setRevealedHints] = useState([]); // hint strings revealed so far for the current riddle
  const [totalPlayers, setTotalPlayers] = useState(47);
  const [adminPass, setAdminPass] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminTab, setAdminTab] = useState(ADMIN_TAB.STATS);
  const [riddles, setRiddles] = useState(DEFAULT_RIDDLES);
  const [riddlesLoadError, setRiddlesLoadError] = useState("");
  const [editingRiddle, setEditingRiddle] = useState(null);
  const [savedLevel, setSavedLevel] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [seasonStart, setSeasonStart] = useState("2026-07-07");
  const [editingSeasonDate, setEditingSeasonDate] = useState(false);
  const [tempSeasonDate, setTempSeasonDate] = useState("2026-07-07");
  const [referrals, setReferrals] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const answerRef = useRef(null);

  const gameStartDate = new Date(seasonStart + "T00:00:00");
  const now = new Date();
  const diffMs = now - gameStartDate;
  const daysSinceStart = diffMs > 0 ? Math.max(1, Math.floor(diffMs/(1000*60*60*24)) + 1) : 0;
  const gameStarted = diffMs > 0;
  const globalUnlockedCount = gameStarted ? riddles.filter(r => r.unlockDay <= daysSinceStart).length : 0;
  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);
  const totalRevenue = totalPlayers * SUBSCRIPTION_FEE;

  // Load player count
  useEffect(() => {
    supabase.getPlayerCount().then(c => { if(c > 0) setTotalPlayers(c); }).catch(()=>{});
  }, []);

  // Load riddles from Supabase — this is now the single source of truth, so Admin
  // edits persist across reloads and future code deploys. If the table is empty
  // (first time ever running this), seed it once from DEFAULT_RIDDLES.
  useEffect(() => {
    (async () => {
      try {
        const rows = await supabase.getRiddles();
        if (rows && rows.length > 0) {
          setRiddles(rows.map(r => ({ id:r.id, title:r.title, riddle:r.riddle, answer:r.answer, hints:r.hints||["","",""], explanation:r.explanation||"", unlockDay:r.unlock_day })));
          setRiddlesLoadError("");
        } else {
          await supabase.seedRiddles(DEFAULT_RIDDLES);
          setRiddles(DEFAULT_RIDDLES);
          setRiddlesLoadError("");
        }
      } catch (e) {
        // Surface this visibly — silently falling back to hardcoded defaults is exactly
        // what caused edits to appear "lost" before. Better to show the real error.
        console.error("Failed to load riddles from Supabase, using defaults:", e);
        setRiddlesLoadError("Could not load riddles from the database — showing default placeholders instead. Your saved edits are NOT visible right now. Error: " + (e?.message || "unknown"));
      }
    })();
  }, []);

  // Load Razorpay
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(s);
    return () => { if(document.body.contains(s)) document.body.removeChild(s); };
  }, []);

  // Countdown ticker
  useEffect(() => {
    const tick = () => {
      const gsd = new Date(seasonStart + "T00:00:00");
      const dss = new Date() > gsd ? Math.max(1, Math.floor((new Date()-gsd)/(1000*60*60*24))+1) : 0;
      const next = riddles.find(r => r.unlockDay > dss);
      if (next) { const d = new Date(gsd); d.setDate(d.getDate()+next.unlockDay-1); setCountdown(formatCountdown(d)||""); }
      else setCountdown("");
    };
    tick(); const t = setInterval(tick, 30000); return () => clearInterval(t);
  }, [riddles, seasonStart]);

  // Save progress
  const saveProgress = async (completed, current, hints) => {
    if (playerId) { try { await supabase.saveProgress(playerId, completed, current, hints); } catch(e){} }
    const idx = REGISTERED_USERS.findIndex(u => u.email === user?.email);
    if (idx !== -1) REGISTERED_USERS[idx].completedLevels = completed;
  };

  // Login
  const handleLogin = async () => {
    setLoginError("");
    if (!loginEmail || !loginPassword) { setLoginError("Please enter your email and password."); return; }
    setLoginLoading(true);
    try {
      const player = await supabase.getPlayer(loginEmail.toLowerCase().trim());
      if (player && player.password === loginPassword) {
        const progress = await supabase.getProgress(player.id);
        const completed = progress?.completed_levels || [];
        setUser({ name:player.name, email:player.email, plan:player.plan, isSub:player.is_sub });
        setPlayerId(player.id); setCompletedLevels(completed);
        setHintsUsed(progress?.hints_used||0);
        setCurrentLevel(completed.length > 0 ? completed[completed.length-1] + 1 : 0);
        setAnswer(""); setFeedback(null); setShowHint(false); setAttempts(0); setAttemptsExhausted(false);
        setHintsUsedThisRiddle(0); setRevealedHints([]);
        setLoginEmail(""); setLoginPassword(""); setLoginError(""); setScreen(SCREEN.GAME); return;
      }
      const found = REGISTERED_USERS.find(u => u.email.toLowerCase()===loginEmail.toLowerCase() && u.password===loginPassword);
      if (found) {
        setUser({ name:found.name, email:found.email, plan:found.plan, isSub:found.isSub });
        setCompletedLevels(found.completedLevels); setReferrals(found.referrals||0);
        setHintsAvailable(found.referrals >= 5 ? 2 : found.referrals >= 2 ? found.referrals : found.referrals >= 1 ? 1 : 0);
        setCurrentLevel(found.completedLevels.length > 0 ? found.completedLevels[found.completedLevels.length-1] : 0);
        setLoginEmail(""); setLoginPassword(""); setLoginError(""); setScreen(SCREEN.GAME); return;
      }
      setLoginError("Email or password is incorrect. Please try again.");
    } catch(e) { setLoginError("Connection error. Please try again."); }
    finally { setLoginLoading(false); }
  };

  // Register
  const handleRegister = () => {
    if (!formData.name||!formData.email||!formData.phone||!formData.age) { alert("Please fill all fields."); return; }
    if (parseInt(formData.age) < 18) { alert("You must be 18 or older."); return; }
    if (!agreed) { alert("Please agree to the Terms & Conditions and Privacy Policy."); return; }
    setScreen(SCREEN.PAYMENT);
  };

  // Payment
  const handlePayment = () => {
    const amount = selectedPlanData?.price * 100;
    const options = {
      key: RAZORPAY_KEY, amount, currency:"INR",
      name:"RIDDLE RUN", description:selectedPlanData?.label + " — Knowledge Competition",
      prefill: { name:formData.name, email:formData.email, contact:formData.phone },
      theme: { color:"#c9a84c" },
      handler: async (response) => {
        const password = formData.phone.replace(/\s/g,"").slice(-6);
        try {
          const saved = await supabase.createPlayer({ name:formData.name, email:formData.email.toLowerCase().trim(), phone:formData.phone, age:parseInt(formData.age), password, plan:selectedPlan, is_sub:true, payment_id:response.razorpay_payment_id });
          if (saved?.[0]?.id) { setPlayerId(saved[0].id); await supabase.saveProgress(saved[0].id,[],0,0); }
        } catch(e) {}
        const newU = { email:formData.email, password, name:formData.name, phone:formData.phone, plan:selectedPlan, isSub:true, completedLevels:[], hintsUsed:0, referrals:0, badge:false };
        REGISTERED_USERS.push(newU);
        setUser({ name:formData.name, email:formData.email, plan:selectedPlan, isSub:true });
        setTotalPlayers(p=>p+1); setScreen(SCREEN.GAME);
      },
      modal: { ondismiss: () => alert("Payment cancelled. Please try again.") }
    };
    if (window.Razorpay) new window.Razorpay(options).open();
    else alert("Razorpay loading, please try again.");
  };

  // Answer
  const handleSubmitAnswer = () => {
    const puzzle = riddles[currentLevel];
    if (!puzzle) return;
    if (answer.trim().toLowerCase() === puzzle.answer.toLowerCase()) {
      setFeedback({ type:"success", msg:"Correct! Well done. Moving forward...", explanation: puzzle.explanation });
      const newCompleted = [...completedLevels, currentLevel];
      setCompletedLevels(newCompleted);
      saveProgress(newCompleted, currentLevel, hintsUsed);
      setTimeout(() => {
        const nextIdx = currentLevel + 1;
        if (nextIdx >= riddles.length) { setFeedback({ type:"success", msg:"🏆 You've completed all levels! You are in the lead!", explanation: puzzle.explanation }); return; }
        setCurrentLevel(nextIdx); setAnswer(""); setFeedback(null); setShowHint(false); setAttempts(0);
        setAttemptsExhausted(false); setHintsUsedThisRiddle(0); setRevealedHints([]);
      }, 1500);
    } else {
      const n = attempts + 1; setAttempts(n);
      const max = getMaxAttempts(currentLevel);
      if (max !== Infinity && n >= max) {
        // Out of attempts — show the explanation so the player understands why the
        // answer was what it was (and why other plausible guesses didn't fit), rather
        // than being left feeling wronged.
        setAttemptsExhausted(true);
        setFeedback({ type:"error", msg:"No attempts remaining for today's riddle.", explanation: puzzle.explanation });
      } else {
        setFeedback({ type:"error", msg:`Wrong answer. Think deeper. (Attempt ${n})` });
      }
      if(answerRef.current){ answerRef.current.classList.add("wrong"); setTimeout(()=>answerRef.current?.classList.remove("wrong"),500); }
    }
  };

  const handleUseHint = () => {
    const puzzle = riddles[currentLevel];
    if (!puzzle) return;
    // Hard cap: max 3 hints per riddle, no matter how many hints the player has
    // banked from referrals or purchases.
    if (hintsUsedThisRiddle >= MAX_HINTS_PER_RIDDLE) return;

    const hintPool = puzzle.hints && puzzle.hints.length ? puzzle.hints : [puzzle.hint || ""];
    const nextHintText = hintPool[hintsUsedThisRiddle] || hintPool[hintPool.length-1] || "";

    if (hintsAvailable > 0) {
      setHintsAvailable(p=>p-1);
    }
    // Paid hint — in production charge via Razorpay before reaching here
    setRevealedHints(prev => [...prev, nextHintText]);
    setHintsUsedThisRiddle(p=>p+1);
    setShowHint(true);
    setAttemptsExhausted(false); // Using a hint restores one attempt
    setFeedback(null);
    setHintsUsed(p=>p+1);
  };

  // Admin riddle save
  const [riddleSaveError, setRiddleSaveError] = useState("");
  const saveRiddle = async (id) => {
    const updated = {...editingRiddle};
    setRiddles(prev => prev.map(r => r.id===id ? updated : r)); // optimistic local update
    setEditingRiddle(null);
    try {
      await supabase.saveRiddleToDb(updated);
      setSavedLevel(id); setTimeout(()=>setSavedLevel(null),2000);
      setRiddleSaveError("");
    } catch (e) {
      setRiddleSaveError(`Could not save Day ${updated.title||id} to the database — your edit may not persist. Please try again.`);
      console.error("saveRiddleToDb failed:", e);
    }
  };

  const puzzle = riddles[currentLevel];
  const isLevelCompleted = completedLevels.includes(currentLevel);
  const isCaughtUp = completedLevels.length >= globalUnlockedCount;
  const isWaiting = isCaughtUp && puzzle && puzzle.unlockDay > daysSinceStart;
  const referralLink = user ? `riddle-run-e3pm.vercel.app?ref=${user.email.split("@")[0]}` : "";

  return (
    <>
      <style>{styles}</style>
      <div className="app"><div className="content">

        {/* NAV */}
        <nav className="nav">
          <div className="nav-logo" onClick={()=>setScreen(SCREEN.LANDING)} onDoubleClick={()=>setScreen(SCREEN.ADMIN)} style={{userSelect:"none"}}>RIDDLE RUN</div>
          <div className="nav-links">
            <button className="nav-link" onClick={()=>setScreen(SCREEN.LEADERBOARD)}>Leaderboard</button>
            {user && <button className="nav-link" onClick={()=>setScreen(SCREEN.GAME)}>My Game</button>}
            {user && <button className="nav-link" onClick={()=>setScreen(SCREEN.REFERRAL)}>Refer & Earn</button>}
            {/* Admin hidden - access via triple click on logo or ?admin=true */}
            {!user ? (
              <><button className="nav-link" onClick={()=>setScreen(SCREEN.LOGIN)}>Log In</button>
              <button className="nav-btn" onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe ₹200</button></>
            ) : (
              <><button className="nav-link" onClick={()=>{setUser(null);setCompletedLevels([]);setCurrentLevel(0);setScreen(SCREEN.LANDING);}}>Log Out</button>
              <button className="nav-btn" onClick={()=>setScreen(SCREEN.GAME)}>My Game</button></>
            )}
          </div>
        </nav>

        {/* ── LANDING ── */}
        {screen === SCREEN.LANDING && (
          <div className="landing">
            <p className="eyebrow">Season {SEASON_NUMBER} · Now Live · 10 Days · 10 Riddles</p>
            <h1 className="landing-title glow-anim">RIDDLE<br/>RUN</h1>
            <div className="rule"/>
            <p className="tagline">Can you outsmart India? One riddle a day. Ten days. One winner.</p>

            {/* Season Prize */}
            <div className="prize-banner">
              <p className="prize-eyebrow">Season {SEASON_NUMBER} Grand Prize</p>
              <span className="prize-name">{SEASON_PRIZE}</span>
              <p className="prize-value">Worth <span>{SEASON_PRIZE_VALUE}</span> · Goes to the first player to solve all 10 riddles</p>
            </div>

            {/* First Riddle Preview — visible to all */}
            <div className="riddle-preview">
              <p className="riddle-preview-label">🧩 Day 1 Riddle — Free Preview</p>
              <p className="riddle-preview-text">{riddles[0].riddle}</p>
              {user
                ? <button className="btn-primary" style={{marginTop:"1rem"}} onClick={()=>setScreen(SCREEN.GAME)}>Go to My Game →</button>
                : <button className="btn-primary" style={{marginTop:"1rem"}} onClick={()=>setScreen(SCREEN.WHY_SUBSCRIBE)}>Answer This Riddle →</button>
              }
            </div>

            <div className="stats-row">
              <div className="stat"><span className="stat-number">{totalPlayers}</span><span className="stat-label">Players</span></div>
              <div className="stat"><span className="stat-number">10</span><span className="stat-label">Riddles</span></div>
              <div className="stat"><span className="stat-number">10</span><span className="stat-label">Days</span></div>
              <div className="stat"><span className="stat-number">₹200</span><span className="stat-label">Per Month</span></div>
            </div>

            {/* Season Day Counter */}
            {gameStarted && (
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"1rem 2rem",marginBottom:"1rem",width:"100%",maxWidth:"600px",textAlign:"center"}}>
                <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.3em",color:"var(--text-dim)",textTransform:"uppercase",marginBottom:"0.5rem"}}>Season {SEASON_NUMBER} Progress</p>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",justifyContent:"center",marginBottom:"0.5rem"}}>
                  {Array.from({length:10}).map((_,i)=>(
                    <div key={i} style={{flex:1,height:"6px",borderRadius:"3px",background:i<globalUnlockedCount?"var(--gold)":"var(--surface2)",transition:"background 0.4s"}}/>
                  ))}
                </div>
                <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--text-dim)",letterSpacing:"0.1em"}}>
                  DAY <span style={{color:"var(--gold)",fontWeight:"bold"}}>{Math.min(daysSinceStart,10)}</span> OF 10 &nbsp;·&nbsp; <span style={{color:"var(--gold)",fontWeight:"bold"}}>{globalUnlockedCount}</span> OF 10 RIDDLES LIVE
                  {globalUnlockedCount < 10 && <> &nbsp;·&nbsp; <span style={{color:"var(--text-dim)"}}>{10-globalUnlockedCount} MORE TO COME</span></>}
                  {globalUnlockedCount === 10 && <span style={{color:"var(--green)"}}> &nbsp;·&nbsp; ALL RIDDLES LIVE — FINAL DAY!</span>}
                </p>
                {!user && globalUnlockedCount > 1 && (
                  <p style={{fontSize:"0.85rem",color:"var(--text-dim)",fontStyle:"italic",marginTop:"0.5rem"}}>
                    Joining today? Solve <strong style={{color:"var(--gold)"}}>{globalUnlockedCount} riddles</strong> to catch up to the current level — then compete live!
                  </p>
                )}
              {/* Difficulty scale preview */}
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",color:"var(--text-dim)",letterSpacing:"0.08em",marginTop:"0.5rem"}}>
                DAYS 1-2: UNLIMITED ATTEMPTS · DAYS 3-4: 10 · DAYS 5-6: 5 · DAYS 7-8: 3 · DAY 9: 2 · DAY 10: 1
              </div>
              </div>
            )}
            {!gameStarted && (
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"1rem 2rem",marginBottom:"1rem",width:"100%",maxWidth:"600px",textAlign:"center"}}>
                <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.3em",color:"var(--text-dim)",textTransform:"uppercase",marginBottom:"0.3rem"}}>Season {SEASON_NUMBER} Starts</p>
                <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1.1rem",color:"var(--gold)"}}>{formatDate(gameStartDate)}</p>
                <p style={{fontSize:"0.85rem",color:"var(--text-dim)",fontStyle:"italic",marginTop:"0.3rem"}}>Subscribe now — be ready from Day 1</p>
              </div>
            )}
            {countdown && (
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--text-dim)",letterSpacing:"0.15em",marginBottom:"1.5rem"}}>
                NEXT RIDDLE IN: <span style={{color:"var(--gold)"}}>{countdown}</span>
              </div>
            )}

            <div className="landing-cta">
              {!user
                ? <><button className="btn-primary" onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe & Compete</button>
                    <button className="btn-secondary" onClick={()=>setScreen(SCREEN.LEADERBOARD)}>View Leaderboard</button></>
                : <><button className="btn-primary" onClick={()=>setScreen(SCREEN.GAME)}>Continue My Game</button>
                    <button className="btn-secondary" onClick={()=>setScreen(SCREEN.REFERRAL)}>Refer & Earn</button></>
              }
            </div>

            <div className="divider"/>
            <div className="how-section">
              <p className="section-title">How It Works</p>
              <div className="steps">
                <div className="step"><span className="step-num">1</span><div className="step-icon">📱</div><p className="step-title">Subscribe</p><p className="step-desc">Pay ₹200/month. Access all 10 riddles of the season. Cancel anytime.</p></div>
                <div className="step"><span className="step-num">2</span><div className="step-icon">🧩</div><p className="step-title">Solve Daily</p><p className="step-desc">One new riddle every 24 hours. Original riddles — not findable online. Pure knowledge.</p></div>
                <div className="step"><span className="step-num">3</span><div className="step-icon">🏃</div><p className="step-title">Race Others</p><p className="step-desc">First to solve all 10 riddles wins. Speed matters. Every second counts.</p></div>
                <div className="step"><span className="step-num">4</span><div className="step-icon">🏆</div><p className="step-title">Win the Prize</p><p className="step-desc">Season {SEASON_NUMBER} winner takes home {SEASON_PRIZE} worth {SEASON_PRIZE_VALUE}.</p></div>
              </div>
            </div>
          </div>
        )}

        {/* ── PLANS ── */}
        {screen === SCREEN.PLANS && (
          <div className="page-wrap">
            <h2 className="page-title">Choose Your Plan</h2>
            <p className="page-sub">Subscribe to compete. Cancel anytime. No hidden fees.</p>
            <div className="plans-grid">
              {PLANS.map(plan => (
                <div key={plan.id} className={`plan-card ${selectedPlan===plan.id?"selected":""}`} onClick={()=>setSelectedPlan(plan.id)}>
                  {plan.badge && <div className="plan-badge">{plan.badge}</div>}
                  <p className="plan-name">{plan.label}</p>
                  <p className="plan-price">₹{plan.price}</p>
                  <p className="plan-desc">{plan.desc}</p>
                  <ul className="plan-perks">{plan.perks.map((p,i)=><li key={i} className="plan-perk">{p}</li>)}</ul>
                </div>
              ))}
            </div>
            <div className="fee-box">
              <div className="fee-row"><span className="fee-label">{selectedPlanData?.label}</span><span className="fee-amount">₹{selectedPlanData?.price}</span></div>
              <p className="fee-note">Knowledge competition subscription — not a gaming entry fee</p>
            </div>
            <button className="btn-primary" style={{width:"100%"}} onClick={()=>setScreen(SCREEN.REGISTER)}>Continue →</button>
            <button className="btn-secondary" style={{width:"100%",marginTop:"0.8rem"}} onClick={()=>setScreen(SCREEN.LANDING)}>← Back</button>
          </div>
        )}

        {/* ── REGISTER ── */}
        {screen === SCREEN.REGISTER && (
          <div className="form-wrap">
            <h2 className="page-title" style={{textAlign:"center",marginBottom:"0.5rem"}}>Create Account</h2>
            <p className="page-sub" style={{marginBottom:"2rem"}}>Join the competition</p>
            {[["Full Name","text","Your name","name"],["Email","email","you@email.com","email"],["Phone","tel","+91 XXXXX XXXXX","phone"]].map(([label,type,ph,field])=>(
              <div className="form-group" key={field}>
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} placeholder={ph} value={formData[field]} onChange={e=>setFormData({...formData,[field]:e.target.value})}/>
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Age (18+)</label>
              <input className="form-input" type="number" placeholder="25" value={formData.age} onChange={e=>setFormData({...formData,age:e.target.value})}/>
            </div>
            <div className="form-group">
              <label className="form-label">Referral Code (optional)</label>
              <input className="form-input" placeholder="Friend's referral code" value={formData.referralCode} onChange={e=>setFormData({...formData,referralCode:e.target.value})}/>
            </div>
            <div className="fee-box">
              <div className="fee-row"><span className="fee-label">{selectedPlanData?.label}</span><span className="fee-amount">₹{selectedPlanData?.price}</span></div>
              <p className="fee-note">Your password will be the last 6 digits of your phone number</p>
            </div>
            <div style={{background:"var(--surface2)",border:`1px solid ${agreed?"rgba(42,157,92,0.3)":"var(--border)"}`,padding:"1rem",marginBottom:"1.5rem",transition:"border-color 0.2s"}}>
              <label style={{display:"flex",gap:"0.8rem",alignItems:"flex-start",cursor:"pointer"}}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{marginTop:"0.2rem",accentColor:"var(--gold)",width:"16px",height:"16px",flexShrink:0}}/>
                <span style={{fontSize:"0.85rem",color:"var(--text-dim)",lineHeight:1.6}}>
                  I have read and agree to the{" "}
                  <span style={{color:"var(--gold)",textDecoration:"underline",cursor:"pointer"}} onClick={()=>setScreen(SCREEN.TC)}>Terms & Conditions</span>
                  {" "}and{" "}
                  <span style={{color:"var(--gold)",textDecoration:"underline",cursor:"pointer"}} onClick={()=>setScreen(SCREEN.PRIVACY)}>Privacy Policy</span>.
                  I am 18+ and a resident of India.
                </span>
              </label>
            </div>
            <button className="btn-primary" style={{width:"100%",opacity:agreed?1:0.6}} onClick={handleRegister}>Proceed to Payment</button>
            <button className="btn-secondary" style={{width:"100%",marginTop:"0.8rem"}} onClick={()=>setScreen(SCREEN.PLANS)}>← Change Plan</button>
          </div>
        )}

        {/* ── PAYMENT ── */}
        {screen === SCREEN.PAYMENT && (
          <div className="payment-wrap">
            <div style={{fontSize:"3rem",marginBottom:"1rem"}}>🔒</div>
            <h2 className="page-title" style={{marginBottom:"0.5rem"}}>Secure Payment</h2>
            <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"2rem"}}>Complete your subscription</p>
            <div className="fee-box" style={{textAlign:"left",marginBottom:"1.5rem"}}>
              <div className="fee-row"><span className="fee-label">Plan</span><span style={{color:"var(--text)"}}>{selectedPlanData?.label}</span></div>
              <div className="fee-row"><span className="fee-label">Total</span><span className="fee-amount">₹{selectedPlanData?.price}</span></div>
              <p className="fee-note">Knowledge competition subscription</p>
            </div>
            <button className="razorpay-btn" onClick={handlePayment}>Pay ₹{selectedPlanData?.price} with Razorpay</button>
            <p style={{fontSize:"0.78rem",color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1rem"}}>UPI, Cards, Net Banking, Wallets accepted</p>
            <div style={{display:"flex",gap:"0.4rem",justifyContent:"center",flexWrap:"wrap"}}>
              {["UPI","Visa","Mastercard","RuPay","Net Banking"].map(m=>(
                <span key={m} style={{fontFamily:"'Space Mono',monospace",fontSize:"0.5rem",padding:"0.3rem 0.6rem",border:"1px solid var(--border)",color:"var(--text-dim)",letterSpacing:"0.1em"}}>{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── GAME ── */}
        {screen === SCREEN.GAME && user && (
          <div className="game-wrap">
            <div className="level-header">
              <div>
                <div className="level-badge">Day {currentLevel+1} of {riddles.length}</div>
                <h2 className="level-title">{puzzle?.title}</h2>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:"0.8rem",color:"var(--text-dim)"}}>Welcome,</p>
                <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"0.85rem",color:"var(--gold)"}}>{user.name}</p>
                {referrals >= 5 && <span style={{fontSize:"0.8rem"}}>🏅</span>}
                {hintsAvailable > 0 && <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",color:"var(--green)",marginTop:"0.2rem"}}>{hintsAvailable} FREE HINT{hintsAvailable>1?"S":""}</p>}
              </div>
            </div>

            <div className="progress-wrap">
              <div className="progress-label">
                <span>Progress</span>
                <span>{completedLevels.length}/{riddles.length} solved</span>
              </div>
              <div className="progress-bar">
                {riddles.map((_,i)=><div key={i} className={`progress-seg ${completedLevels.includes(i)?"done":i===currentLevel?"current":""}`}/>)}
              </div>
            </div>

            {/* Waiting screen */}
            {/* Attempts & Difficulty Info Bar */}
            {!isLevelCompleted && !isWaiting && (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--surface2)",border:"1px solid var(--border)",padding:"0.7rem 1.2rem",marginBottom:"1.5rem",flexWrap:"wrap",gap:"0.5rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  <span style={{fontSize:"1rem"}}>{getMaxAttempts(currentLevel)===Infinity?"🔓":getMaxAttempts(currentLevel)<=2?"🔴":getMaxAttempts(currentLevel)<=3?"🟡":"🟢"}</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",letterSpacing:"0.1em",textTransform:"uppercase"}}>
                    {getMaxAttempts(currentLevel)===Infinity
                      ? "Unlimited attempts"
                      : attemptsExhausted
                        ? "No attempts remaining"
                        : `${Math.max(0, getMaxAttempts(currentLevel)-attempts)} of ${getMaxAttempts(currentLevel)} attempt${getMaxAttempts(currentLevel)!==1?"s":""} remaining`}
                  </span>
                </div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",color:"var(--gold)",letterSpacing:"0.1em",textTransform:"uppercase"}}>
                  {currentLevel < 2 ? "EASY" : currentLevel < 4 ? "MEDIUM" : currentLevel < 6 ? "HARD" : currentLevel < 8 ? "VERY HARD" : currentLevel < 9 ? "BRUTAL" : "LEGENDARY"}
                </div>
              </div>
            )}

            {/* Attempts exhausted screen */}
            {attemptsExhausted && !isLevelCompleted && (
              <div style={{background:"rgba(139,26,26,0.1)",border:"1px solid rgba(192,57,43,0.3)",padding:"2rem",marginBottom:"1.5rem",textAlign:"center"}}>
                <p style={{fontSize:"2rem",marginBottom:"0.8rem"}}>🔒</p>
                <p style={{fontFamily:"'Cinzel Decorative',serif",color:"var(--red)",fontSize:"1rem",marginBottom:"0.5rem"}}>All attempts used!</p>
                {hintsUsedThisRiddle < MAX_HINTS_PER_RIDDLE ? (
                  <>
                    <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1.5rem",fontSize:"0.9rem"}}>Use a hint to unlock one more attempt and try again. ({hintsUsedThisRiddle}/{MAX_HINTS_PER_RIDDLE} hints used on this riddle)</p>
                    <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
                      {hintsAvailable > 0 ? (
                        <button className="btn-primary" onClick={handleUseHint}>
                          Use Free Hint ({hintsAvailable} left) — Unlock Attempt
                        </button>
                      ) : (
                        <button className="btn-primary" style={{background:"#2d6ef5"}} onClick={handleUseHint}>
                          🔍 Buy Hint for ₹29 — Unlock Attempt
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{color:"var(--text-dim)",fontStyle:"italic",fontSize:"0.9rem"}}>You've used the maximum of {MAX_HINTS_PER_RIDDLE} hints on this riddle. Come back tomorrow for the next one!</p>
                )}
                {feedback?.explanation && (
                  <div style={{marginTop:"1.5rem",textAlign:"left",background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.2)",padding:"1rem 1.2rem"}}>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--gold)",letterSpacing:"0.1em",marginBottom:"0.4rem",textTransform:"uppercase"}}>Why This Was The Answer</p>
                    <p style={{fontSize:"0.85rem",color:"var(--text-dim)",lineHeight:1.6}}>{feedback.explanation}</p>
                  </div>
                )}
              </div>
            )}

            {isWaiting && isLevelCompleted ? (
              <div className="waiting-card">
                <div className="waiting-icon">⏳</div>
                <p className="waiting-title">You're all caught up!</p>
                <p className="waiting-date">Day {currentLevel+2} riddle unlocks on <strong style={{color:"var(--gold)"}}>{formatDate(getUnlockDate(gameStartDate, riddles[currentLevel]?.unlockDay||0))}</strong></p>
                {countdown && <div className="waiting-countdown">{countdown}</div>}
                <p className="waiting-note">Check the leaderboard to see where you stand. Tomorrow's riddle is coming — be ready.</p>
                <div style={{display:"flex",gap:"1rem",justifyContent:"center",marginTop:"1.5rem",flexWrap:"wrap"}}>
                  <button className="btn-secondary" onClick={()=>setScreen(SCREEN.LEADERBOARD)}>View Leaderboard</button>
                  <button className="btn-secondary" onClick={()=>setScreen(SCREEN.REFERRAL)}>Refer & Earn</button>
                </div>
              </div>
            ) : isLevelCompleted ? (
              <div style={{textAlign:"center",padding:"3rem",background:"var(--surface)",border:"1px solid rgba(42,157,92,0.3)"}}>
                <p style={{fontSize:"2rem",marginBottom:"0.5rem"}}>✓</p>
                <p style={{fontFamily:"'Cinzel Decorative',serif",color:"var(--green)",fontSize:"1.1rem",marginBottom:"0.5rem"}}>Solved!</p>
                <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1.5rem"}}>
                  {completedLevels.length < globalUnlockedCount ? "You're catching up — next riddle is ready!" : "Well done. Next riddle tomorrow."}
                </p>
                {currentLevel+1 < riddles.length && (
                  <button className="btn-primary" onClick={()=>{setCurrentLevel(p=>p+1);setAnswer("");setFeedback(null);setShowHint(false);setAttempts(0);setAttemptsExhausted(false);setHintsUsedThisRiddle(0);setRevealedHints([]);}}>
                    {completedLevels.length < globalUnlockedCount ? "Next Riddle →" : "See Status →"}
                  </button>
                )}
              </div>
            ) : (
              <>
                {riddlesLoadError && (
                  <div style={{background:"rgba(139,26,26,0.15)",border:"1px solid var(--red)",padding:"1rem 1.2rem",marginBottom:"1.5rem"}}>
                    <p style={{color:"var(--red)",fontSize:"0.85rem",lineHeight:1.6}}>⚠️ {riddlesLoadError}</p>
                  </div>
                )}
                {puzzle?.unlockDay === 10 && (
                  <div style={{background:"linear-gradient(135deg,rgba(201,168,76,0.14),rgba(201,168,76,0.02))",border:"1px solid var(--gold-dim)",padding:"1.5rem 1.8rem",marginBottom:"1.5rem"}}>
                    <p style={{fontFamily:"'Cinzel Decorative',serif",color:"var(--gold)",fontSize:"1rem",marginBottom:"0.6rem",letterSpacing:"0.03em"}}>🕵️ {DAY10_MANHUNT_NOTICE.title}</p>
                    <p style={{color:"var(--text-dim)",fontStyle:"italic",fontSize:"0.88rem",lineHeight:1.7}}>{DAY10_MANHUNT_NOTICE.body}</p>
                  </div>
                )}
                <div className="riddle-card"><p className="riddle-text">{puzzle?.riddle}</p></div>
                {revealedHints.map((h,i)=> h ? <div key={i} className="hint-box">💡 Hint {i+1}/{MAX_HINTS_PER_RIDDLE}: {h}</div> : null)}
                {feedback && (
                  <div className={`feedback ${feedback.type}`}>
                    {feedback.msg}
                    {feedback.explanation && (
                      <div style={{marginTop:"0.8rem",paddingTop:"0.8rem",borderTop:"1px solid rgba(255,255,255,0.1)",fontStyle:"normal"}}>
                        <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.1em",marginBottom:"0.35rem",textTransform:"uppercase",opacity:0.8}}>Why This Was The Answer</p>
                        <p style={{fontSize:"0.85rem",lineHeight:1.6,opacity:0.9}}>{feedback.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="answer-row">
                  <input ref={answerRef} className="answer-input" placeholder="Your answer..." value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmitAnswer()} autoCapitalize="on" autoCorrect="off" spellCheck="false"/>
                  <button className="submit-btn" onClick={handleSubmitAnswer} disabled={!answer.trim()}>Submit</button>
                </div>
                {/* Hint Section */}
                <div style={{marginBottom:"1.5rem"}}>
                  {hintsUsedThisRiddle < MAX_HINTS_PER_RIDDLE ? (
                    <div style={{display:"flex",gap:"0.8rem",alignItems:"center",flexWrap:"wrap"}}>
                      {hintsAvailable > 0 ? (
                        <button onClick={handleUseHint} style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.1em",textTransform:"uppercase",background:"rgba(42,157,92,0.1)",border:"1px solid rgba(42,157,92,0.3)",color:"var(--green)",padding:"0.6rem 1.2rem",cursor:"pointer",transition:"all 0.2s"}}>
                          ✦ Use Free Hint ({hintsAvailable} remaining) — {hintsUsedThisRiddle}/{MAX_HINTS_PER_RIDDLE} used
                        </button>
                      ) : (
                        <button onClick={handleUseHint} style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.1em",textTransform:"uppercase",background:"rgba(45,110,245,0.1)",border:"1px solid rgba(45,110,245,0.3)",color:"#5b8def",padding:"0.6rem 1.2rem",cursor:"pointer",transition:"all 0.2s"}}>
                          🔍 Buy Hint — ₹29 ({hintsUsedThisRiddle}/{MAX_HINTS_PER_RIDDLE} used)
                        </button>
                      )}
                      {attempts >= 2 && !attemptsExhausted && (
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",color:"var(--gold)",letterSpacing:"0.1em",fontStyle:"italic"}}>
                          Struggling? A hint might help!
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",color:"var(--text-dim)",letterSpacing:"0.1em",fontStyle:"italic"}}>
                      Maximum of {MAX_HINTS_PER_RIDDLE} hints used for this riddle — no more available, even with hints in your kitty.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {screen === SCREEN.GAME && !user && (
          <div style={{textAlign:"center",padding:"5rem 2rem"}}>
            <p style={{fontFamily:"'Cinzel Decorative',serif",color:"var(--gold)",fontSize:"1.2rem",marginBottom:"0.5rem"}}>You're not subscribed yet.</p>
            <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"2rem"}}>Subscribe for ₹200/month to compete.</p>
            <button className="btn-primary" onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe Now</button>
          </div>
        )}

        {/* ── LOGIN ── */}
        {screen === SCREEN.LOGIN && (
          <div className="form-wrap">
            <h2 className="page-title" style={{textAlign:"center",marginBottom:"0.5rem"}}>Welcome Back</h2>
            <p className="page-sub" style={{marginBottom:"2rem"}}>Log in to continue your game</p>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@email.com" value={loginEmail} onChange={e=>{setLoginEmail(e.target.value);setLoginError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{position:"relative"}}>
                <input className="form-input" type={showPassword?"text":"password"} placeholder="Last 6 digits of your phone" value={loginPassword} style={{paddingRight:"3rem"}} onChange={e=>{setLoginPassword(e.target.value);setLoginError("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
                <button onClick={()=>setShowPassword(p=>!p)} style={{position:"absolute",right:"0.8rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--text-dim)",cursor:"pointer"}}>{showPassword?"🙈":"👁️"}</button>
              </div>
            </div>
            {loginError && <div style={{background:"rgba(192,57,43,0.1)",border:"1px solid rgba(192,57,43,0.3)",color:"var(--red)",padding:"0.8rem 1rem",marginBottom:"1rem",fontSize:"0.9rem",fontStyle:"italic"}}>{loginError}</div>}
            <div style={{background:"var(--surface2)",border:"1px solid var(--border)",padding:"1rem",marginBottom:"1.5rem"}}>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--gold)",letterSpacing:"0.15em",marginBottom:"0.3rem"}}>YOUR PASSWORD</p>
              <p style={{fontSize:"0.85rem",color:"var(--text-dim)",lineHeight:1.6}}>Last 6 digits of your registered phone number.</p>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",marginTop:"0.3rem"}}>e.g. phone 98765 43210 → password <span style={{color:"var(--gold)"}}>432100</span></p>
            </div>
            <button className="btn-primary" style={{width:"100%"}} onClick={handleLogin} disabled={loginLoading}>{loginLoading?"Logging in...":"Log In & Continue"}</button>
            <button className="btn-secondary" style={{width:"100%",marginTop:"0.8rem"}} onClick={()=>setScreen(SCREEN.LANDING)}>← Back</button>
            <div style={{textAlign:"center",marginTop:"2rem"}}>
              <p style={{fontSize:"0.9rem",color:"var(--text-dim)"}}>New here? <span style={{color:"var(--gold)",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe Now</span></p>
            </div>
            <div style={{marginTop:"2rem",background:"var(--surface)",border:"1px solid var(--border)",padding:"1rem"}}>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:"0.5rem"}}>DEMO LOGINS</p>
              <p style={{fontSize:"0.78rem",color:"var(--text-dim)"}}>roop.saggar@gmail.com / roop123</p>
              <p style={{fontSize:"0.78rem",color:"var(--text-dim)"}}>aryan@test.com / aryan123</p>
            </div>
          </div>
        )}

        {/* ── LEADERBOARD ── */}
        {screen === SCREEN.LEADERBOARD && (
          <div className="lb-wrap">
            <h2 className="lb-title">Leaderboard</h2>
            <p className="lb-sub">Season {SEASON_NUMBER} · Updated in real-time</p>
            <div className="prize-card">
              <p className="prize-card-label">Season {SEASON_NUMBER} Grand Prize</p>
              <span className="prize-card-name">{SEASON_PRIZE}</span>
              <p className="prize-card-value">Worth {SEASON_PRIZE_VALUE} · Goes to the first player to solve all 10 riddles</p>
            </div>
            <table className="lb-table">
              <thead className="lb-thead"><tr>
                <th className="lb-th">Rank</th>
                <th className="lb-th">Player</th>
                <th className="lb-th">Level</th>
                <th className="lb-th">Time</th>
                <th className="lb-th">City</th>
              </tr></thead>
              <tbody>
                {MOCK_LEADERBOARD.map((p,i)=>(
                  <tr key={i} className={`lb-row ${i===0?"top":""}`}>
                    <td className="lb-td"><span className="rank-badge">{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span></td>
                    <td className="lb-td">{p.name}{p.sub&&<span className="sub-badge">SUB</span>}{p.badge&&<span className="honour-badge">🏅</span>}</td>
                    <td className="lb-td"><span className="level-pill">DAY {p.level}</span></td>
                    <td className="lb-td" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.75rem",color:"var(--text-dim)"}}>{p.time}</td>
                    <td className="lb-td" style={{color:"var(--text-dim)",fontSize:"0.88rem"}}>{p.location}</td>
                  </tr>
                ))}
                {user && <tr className="lb-row" style={{background:"rgba(201,168,76,0.04)"}}>
                  <td className="lb-td" style={{color:"var(--text-dim)"}}>#—</td>
                  <td className="lb-td" style={{color:"var(--gold)"}}>{user.name} (You){referrals>=5&&<span className="honour-badge">🏅</span>}</td>
                  <td className="lb-td"><span className="level-pill">DAY {currentLevel+1}</span></td>
                  <td className="lb-td" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.75rem",color:"var(--text-dim)"}}>—</td>
                  <td className="lb-td" style={{color:"var(--text-dim)"}}>—</td>
                </tr>}
              </tbody>
            </table>
            {!user && <div style={{textAlign:"center",marginTop:"3rem"}}>
              <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1.5rem"}}>Your name isn't here yet.</p>
              <button className="btn-primary" onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe for ₹200</button>
            </div>}
          </div>
        )}

        {/* ── REFERRAL ── */}
        {screen === SCREEN.REFERRAL && user && (
          <div className="referral-wrap">
            <h2 className="referral-title">Refer & Earn</h2>
            <p className="referral-sub">Bring friends. Earn hints, free months, and badges.</p>

            <div style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"1.5rem",marginBottom:"2rem",textAlign:"center"}}>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--gold)",letterSpacing:"0.15em",marginBottom:"0.5rem"}}>YOUR REFERRAL LINK</p>
              <div className="referral-link-box">
                <span className="referral-link">{referralLink}</span>
                <button className="copy-btn" onClick={()=>{navigator.clipboard?.writeText("https://"+referralLink);setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
                  {copied?"✓ Copied!":"Copy"}
                </button>
              </div>
              <p style={{fontSize:"0.85rem",color:"var(--text-dim)",fontStyle:"italic"}}>Share this link with friends. When they subscribe you earn rewards!</p>
            </div>

            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--gold)",letterSpacing:"0.15em",marginBottom:"1rem",textTransform:"uppercase"}}>Reward Tiers</p>
            <table className="rewards-table">
              <thead><tr>
                <th className="rewards-th">Referrals</th>
                <th className="rewards-th">Your Reward</th>
              </tr></thead>
              <tbody>
                {[
                  ["1 referral","1 free hint next season"],
                  ["2 referrals","2 free hints next season"],
                  ["3 referrals","Next month subscription FREE"],
                  ["5 referrals","🏅 Badge of Honour + 1 month FREE"],
                  ["5+ referrals","🏅 Badge + 1 month FREE + 2 free hints"],
                ].map(([count,reward],i)=>(
                  <tr key={i}>
                    <td className="rewards-td" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.75rem",color:"var(--gold)"}}>{count}</td>
                    <td className="rewards-td">{reward}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="your-referrals">
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",letterSpacing:"0.15em",marginBottom:"0.5rem"}}>YOUR REFERRALS</p>
              <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"2.5rem",color:"var(--gold)"}}>{referrals}</p>
              {getReferralReward(referrals) && <p style={{fontSize:"0.9rem",color:"var(--green)",fontStyle:"italic",marginTop:"0.5rem"}}>You've earned: {getReferralReward(referrals)}</p>}
              {!getReferralReward(referrals) && <p style={{fontSize:"0.9rem",color:"var(--text-dim)",fontStyle:"italic",marginTop:"0.5rem"}}>Refer 1 friend to earn your first hint!</p>}
            </div>
          </div>
        )}

        {/* ── ADMIN ── */}
        {screen === SCREEN.ADMIN && (
          <div className="admin-wrap">
            <h2 className="admin-title">Admin Dashboard</h2>
            {!adminUnlocked ? (
              <div>
                <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1rem"}}>Enter admin password.</p>
                <div style={{display:"flex",gap:"0.8rem"}}>
                  <input className="form-input" type="password" placeholder="Password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(adminPass===ADMIN_PASSWORD?setAdminUnlocked(true):alert("Wrong password"))}/>
                  <button className="submit-btn" onClick={()=>adminPass===ADMIN_PASSWORD?setAdminUnlocked(true):alert("Wrong password")}>Enter</button>
                </div>
                <p style={{fontSize:"0.72rem",color:"var(--text-dim)",marginTop:"0.5rem",fontStyle:"italic"}}>Demo: admin123</p>
              </div>
            ) : (
              <>
                <div className="admin-tabs">
                  {[[ADMIN_TAB.STATS,"📊 Stats"],[ADMIN_TAB.SEASON,"📅 Season"],[ADMIN_TAB.RIDDLES,"🧩 Riddles"],[ADMIN_TAB.PLAYERS,"👥 Players"]].map(([tab,label])=>(
                    <button key={tab} className={`admin-tab ${adminTab===tab?"active":""}`} onClick={()=>setAdminTab(tab)}>{label}</button>
                  ))}
                </div>

                {/* STATS */}
                {adminTab===ADMIN_TAB.STATS && (
                  <>
                    <div className="admin-stat-grid">
                      <div className="admin-stat-card"><span className="admin-stat-num">{totalPlayers}</span><span className="admin-stat-label">Subscribers</span></div>
                      <div className="admin-stat-card"><span className="admin-stat-num">₹{totalRevenue.toLocaleString("en-IN")}</span><span className="admin-stat-label">Revenue</span></div>
                      <div className="admin-stat-card"><span className="admin-stat-num">₹{(totalRevenue-15000-20000).toLocaleString("en-IN")}</span><span className="admin-stat-label">Est. Profit</span></div>
                      <div className="admin-stat-card"><span className="admin-stat-num">{globalUnlockedCount}</span><span className="admin-stat-label">Riddles Live</span></div>
                      <div className="admin-stat-card"><span className="admin-stat-num">{SEASON_DURATION_DAYS}</span><span className="admin-stat-label">Day Season</span></div>
                      <div className="admin-stat-card"><span className="admin-stat-num">{SEASON_NUMBER}</span><span className="admin-stat-label">Season</span></div>
                    </div>
                    <div className="info-box">
                      <p className="info-box-title">SEASON PRIZE</p>
                      <p className="info-box-text">{SEASON_PRIZE} · Worth {SEASON_PRIZE_VALUE} · Goes to first player to solve all 10 riddles</p>
                    </div>
                    <div className="info-box">
                      <p className="info-box-title">GAME STATUS</p>
                      <p className="info-box-text">
                        {gameStarted ? <>Day <strong style={{color:"var(--gold)"}}>{daysSinceStart}</strong> of {SEASON_DURATION_DAYS} · <strong style={{color:"var(--gold)"}}>{globalUnlockedCount}</strong> of 10 riddles live</>
                        : <>Season starts <strong style={{color:"var(--gold)"}}>{formatDate(gameStartDate)}</strong></>}
                      </p>
                    </div>
                  </>
                )}

                {/* SEASON */}
                {adminTab===ADMIN_TAB.SEASON && (
                  <>
                    <div className="info-box">
                      <p className="info-box-title">SEASON STATUS</p>
                      <p className="info-box-text">
                        {gameStarted ? <>🟢 LIVE · Day {daysSinceStart} of {SEASON_DURATION_DAYS} · {globalUnlockedCount} riddles unlocked</>
                        : <>⏳ Starts {formatDate(gameStartDate)}</>}
                      </p>
                    </div>
                    <div className="riddle-editor">
                      <div className="riddle-editor-header">
                        <span className="riddle-level-badge">📅 Launch Date</span>
                        <span className="riddle-unlock-info" style={{color:gameStarted?"var(--green)":"var(--gold-dim)"}}>
                          {gameStarted?"🟢 LIVE":"⏳ UPCOMING"}
                        </span>
                      </div>
                      {editingSeasonDate ? (
                        <div>
                          <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:"0.5rem"}}>SET LAUNCH DATE</p>
                          <input className="form-input" type="date" value={tempSeasonDate} onChange={e=>setTempSeasonDate(e.target.value)} style={{marginBottom:"0.8rem"}}/>
                          <div style={{display:"flex",gap:"0.8rem",alignItems:"center"}}>
                            <button className="save-btn" onClick={()=>{setSeasonStart(tempSeasonDate);setEditingSeasonDate(false);setSavedLevel("date");setTimeout(()=>setSavedLevel(null),2000);}}>✓ Save Date</button>
                            <button className="hint-btn" onClick={()=>setEditingSeasonDate(false)}>Cancel</button>
                            {savedLevel==="date"&&<span className="saved-badge">✓ Saved!</span>}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1rem",color:"var(--gold)",marginBottom:"0.5rem"}}>{formatDate(gameStartDate)}</p>
                          <button className="hint-btn" onClick={()=>{setTempSeasonDate(seasonStart);setEditingSeasonDate(true);}}>✏️ Change date</button>
                        </div>
                      )}
                    </div>
                    <div className="riddle-editor">
                      <div className="riddle-editor-header"><span className="riddle-level-badge">🗓️ Riddle Unlock Schedule</span></div>
                      <table className="admin-table">
                        <thead><tr><th className="admin-th">Riddle</th><th className="admin-th">Unlocks</th><th className="admin-th">Status</th></tr></thead>
                        <tbody>
                          {riddles.map(r=>{
                            const d = new Date(gameStartDate); d.setDate(d.getDate()+r.unlockDay-1);
                            const isLive = gameStarted && r.unlockDay <= daysSinceStart;
                            const isNext = gameStarted && !isLive && riddles.filter(x=>x.unlockDay<=daysSinceStart).length===r.id-1;
                            return (
                              <tr key={r.id}>
                                <td className="admin-td"><span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.68rem",color:"var(--gold)"}}>Day {r.id}</span> — {r.title}</td>
                                <td className="admin-td" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.7rem"}}>{d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</td>
                                <td className="admin-td">
                                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",padding:"0.2rem 0.5rem",background:isLive?"rgba(42,157,92,0.1)":isNext?"rgba(201,168,76,0.1)":"transparent",color:isLive?"var(--green)":isNext?"var(--gold)":"var(--text-dim)",border:`1px solid ${isLive?"rgba(42,157,92,0.3)":isNext?"var(--border)":"transparent"}`}}>
                                    {isLive?"🟢 LIVE":isNext?"⏭ NEXT":"🔒 UPCOMING"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* RIDDLES */}
                {adminTab===ADMIN_TAB.RIDDLES && (
                  <>
                    <div className="info-box">
                      <p className="info-box-title">HOW TO EDIT</p>
                      <p className="info-box-text">Click Edit on any riddle. Change the text, answer, and hint. Save — changes go live immediately. Answer is case-insensitive.</p>
                    </div>
                    {riddles.map(riddle=>(
                      <div key={riddle.id} className="riddle-editor">
                        <div className="riddle-editor-header">
                          <span className="riddle-level-badge">Day {riddle.id} — {riddle.title}</span>
                          <span className="riddle-unlock-info" style={{color:riddle.unlockDay<=daysSinceStart?"var(--green)":"var(--gold-dim)"}}>
                            {riddle.unlockDay<=daysSinceStart?"🟢 LIVE":`🔒 Day ${riddle.unlockDay}`}
                          </span>
                        </div>
                        {editingRiddle?.id===riddle.id ? (
                          <div style={{display:"grid",gap:"0.8rem"}}>
                            <div><p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:"0.3rem",textTransform:"uppercase"}}>Title</p><input className="form-input" value={editingRiddle.title} onChange={e=>setEditingRiddle({...editingRiddle,title:e.target.value})}/></div>
                            <div><p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:"0.3rem",textTransform:"uppercase"}}>Riddle</p><textarea className="form-textarea" value={editingRiddle.riddle} onChange={e=>setEditingRiddle({...editingRiddle,riddle:e.target.value})} rows={3}/></div>
                            <div><p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:"0.3rem",textTransform:"uppercase"}}>Answer</p><input className="form-input" value={editingRiddle.answer} onChange={e=>setEditingRiddle({...editingRiddle,answer:e.target.value})}/></div>
                            <div>
                              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:"0.3rem",textTransform:"uppercase"}}>Hints (up to {MAX_HINTS_PER_RIDDLE} — gentlest first, most direct last. Players can never unlock more than {MAX_HINTS_PER_RIDDLE}, even with hints banked from referrals/purchases.)</p>
                              {[0,1,2].map(i=>{
                                const currentHints = editingRiddle.hints && editingRiddle.hints.length ? editingRiddle.hints : [editingRiddle.hint||"","",""];
                                return (
                                  <input key={i} className="form-input" style={{marginBottom:"0.5rem"}} placeholder={`Hint ${i+1}${i===0?" (required)":" (optional)"}`}
                                    value={currentHints[i]||""}
                                    onChange={e=>{
                                      const newHints=[...currentHints]; newHints[i]=e.target.value;
                                      setEditingRiddle({...editingRiddle, hints:newHints});
                                    }}/>
                                );
                              })}
                            </div>
                            <div><p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-dim)",letterSpacing:"0.1em",marginBottom:"0.3rem",textTransform:"uppercase"}}>Explanation (shown after correct answer, or after all attempts are used — explains why THIS answer, not other plausible ones)</p><textarea className="form-textarea" value={editingRiddle.explanation||""} onChange={e=>setEditingRiddle({...editingRiddle,explanation:e.target.value})} rows={3}/></div>
                            <div style={{display:"flex",gap:"0.8rem",alignItems:"center"}}>
                              <button className="save-btn" onClick={()=>saveRiddle(riddle.id)}>✓ Save</button>
                              <button className="hint-btn" onClick={()=>setEditingRiddle(null)}>Cancel</button>
                              {savedLevel===riddle.id&&<span className="saved-badge">✓ Saved!</span>}
                            </div>
                            {riddleSaveError && <p style={{color:"var(--red)",fontSize:"0.75rem",marginTop:"0.5rem"}}>⚠️ {riddleSaveError}</p>}
                          </div>
                        ) : (
                          <div>
                            <p style={{fontSize:"0.88rem",color:"var(--text-dim)",fontStyle:"italic",marginBottom:"0.5rem",lineHeight:1.6}}>"{riddle.riddle}"</p>
                            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",letterSpacing:"0.08em"}}>ANS: <span style={{color:"var(--gold)"}}>{riddle.answer}</span></p>
                            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",letterSpacing:"0.08em",marginTop:"0.3rem"}}>HINTS: {(riddle.hints&&riddle.hints.filter(Boolean).length)?riddle.hints.filter(Boolean).join(" · "):(riddle.hint||"—")}</p>
                            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",letterSpacing:"0.08em",marginTop:"0.3rem"}}>EXPLANATION: {riddle.explanation||"—"}</p>
                            <button className="hint-btn" style={{marginTop:"0.8rem"}} onClick={()=>setEditingRiddle({...riddle})}>✏️ Edit</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* PLAYERS */}
                {adminTab===ADMIN_TAB.PLAYERS && (
                  <>
                    <div className="info-box">
                      <p className="info-box-title">OVERVIEW</p>
                      <p className="info-box-text">{totalPlayers} subscribers · Season {SEASON_NUMBER} · ₹{totalRevenue.toLocaleString("en-IN")} revenue</p>
                    </div>
                    <table className="admin-table">
                      <thead><tr><th className="admin-th">Player</th><th className="admin-th">Level</th><th className="admin-th">Referrals</th><th className="admin-th">Status</th></tr></thead>
                      <tbody>
                        {MOCK_LEADERBOARD.map((p,i)=>(
                          <tr key={i}>
                            <td className="admin-td">{p.name}{p.sub&&<span className="sub-badge">SUB</span>}{p.badge&&<span style={{marginLeft:"0.3rem"}}>🏅</span>}</td>
                            <td className="admin-td">Day {p.level}/10</td>
                            <td className="admin-td" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.7rem",color:"var(--gold)"}}>{p.referrals}</td>
                            <td className="admin-td">
                              <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",padding:"0.2rem 0.5rem",background:p.level>=globalUnlockedCount?"rgba(42,157,92,0.1)":"rgba(201,168,76,0.1)",color:p.level>=globalUnlockedCount?"var(--green)":"var(--gold)",border:`1px solid ${p.level>=globalUnlockedCount?"rgba(42,157,92,0.3)":"var(--border)"}`}}>
                                {p.level>=globalUnlockedCount?"LEADING":"ACTIVE"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── WHY SUBSCRIBE ── */}
        {screen === SCREEN.WHY_SUBSCRIBE && (
          <div style={{maxWidth:"700px",margin:"0 auto",padding:"3rem 2rem"}}>

            {/* Hero */}
            <div style={{textAlign:"center",marginBottom:"3rem"}}>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.3em",color:"var(--gold-dim)",textTransform:"uppercase",marginBottom:"1rem"}}>You saw the riddle. Now answer it.</p>
              <h1 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"clamp(1.8rem,5vw,3rem)",color:"var(--gold)",marginBottom:"1rem",textShadow:"0 0 40px rgba(201,168,76,0.3)"}}>Subscribe to Compete</h1>
              <p style={{fontSize:"1.1rem",color:"var(--text-dim)",fontStyle:"italic",marginBottom:"2rem"}}>₹200/month. Cancel anytime. Win real prizes every season.</p>
              <button className="btn-primary" style={{fontSize:"0.8rem",padding:"1.1rem 3rem"}} onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe for ₹200/month →</button>
            </div>

            {/* First Riddle Reminder */}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"2rem",marginBottom:"3rem",position:"relative"}}>
              <div style={{position:"absolute",top:"-0.5rem",left:"1.5rem",fontSize:"4rem",color:"rgba(201,168,76,0.08)",fontFamily:"'Cinzel Decorative',serif",lineHeight:1}}>"</div>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.2em",color:"var(--gold)",textTransform:"uppercase",marginBottom:"0.8rem"}}>Day 1 Riddle — Waiting for your answer</p>
              <p style={{fontSize:"1.1rem",lineHeight:1.8,fontStyle:"italic",color:"var(--text)",marginBottom:"1rem"}}>{riddles[0].riddle}</p>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-dim)",letterSpacing:"0.1em"}}>Subscribe to submit your answer and compete →</p>
            </div>

            {/* How Seasons Work */}
            <div style={{marginBottom:"3rem"}}>
              <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1.1rem",color:"var(--gold)",textAlign:"center",marginBottom:"2rem",letterSpacing:"0.1em"}}>How It Works</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1.2rem"}}>
                {[
                  ["📅","New Season Every Month","Fresh 10-day competition every month. New riddles. New prize. Subscribe once — compete every season automatically."],
                  ["🧩","10 Riddles in 10 Days","One original riddle released every 24 hours. Riddles based on real people and real events — not findable on Google."],
                  ["🏆","Win a Grand Prize","First player to solve all 10 riddles wins the season prize. Season 1 prize: Amazon Echo Dot worth ₹4,499."],
                  ["📈","Prizes Grow Every Season","Season 1: ₹4,499 prize. Season 3: ₹15,000 prize. Season 6: ₹75,000+ prize. The longer you play, the bigger it gets."],
                ].map(([icon,title,desc])=>(
                  <div key={title} style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"1.5rem"}}>
                    <div style={{fontSize:"1.4rem",marginBottom:"0.6rem"}}>{icon}</div>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",letterSpacing:"0.1em",color:"var(--gold)",textTransform:"uppercase",marginBottom:"0.4rem"}}>{title}</p>
                    <p style={{fontSize:"0.88rem",color:"var(--text-dim)",lineHeight:1.6}}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Referral Program */}
            <div style={{background:"linear-gradient(135deg,rgba(201,168,76,0.1),rgba(139,26,26,0.05))",border:"1px solid var(--border)",padding:"2rem",marginBottom:"3rem"}}>
              <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1rem",color:"var(--gold)",marginBottom:"0.5rem"}}>🤝 Refer Friends. Earn Rewards.</p>
              <p style={{fontSize:"0.9rem",color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1.5rem"}}>Once you subscribe, you get a personal referral link. Every friend who subscribes through your link earns you rewards:</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"0.8rem"}}>
                {[
                  ["1 friend","1 free hint"],
                  ["2 friends","2 free hints"],
                  ["3 friends","Next month FREE"],
                  ["5+ friends","🏅 Badge + 1 month FREE"],
                ].map(([friends,reward])=>(
                  <div key={friends} style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"1rem",textAlign:"center"}}>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--gold)",letterSpacing:"0.1em",marginBottom:"0.3rem"}}>{friends}</p>
                    <p style={{fontSize:"0.85rem",color:"var(--text-dim)"}}>{reward}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div style={{background:"var(--surface2)",border:"1px solid var(--border)",padding:"2rem",marginBottom:"3rem",textAlign:"center"}}>
              <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1rem",color:"var(--gold)",marginBottom:"1.5rem"}}>Simple Pricing</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"1rem",marginBottom:"1.5rem"}}>
                {PLANS.map(plan=>(
                  <div key={plan.id} style={{background:"var(--surface)",border:`1px solid ${plan.id==="monthly"?"var(--gold)":"var(--border)"}`,padding:"1.2rem",textAlign:"center"}}>
                    {plan.badge&&<div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.5rem",background:"var(--gold)",color:"var(--bg)",padding:"0.2rem 0.5rem",letterSpacing:"0.1em",marginBottom:"0.5rem",display:"inline-block"}}>{plan.badge}</div>}
                    <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"0.85rem",color:"var(--text)",marginBottom:"0.2rem"}}>{plan.label}</p>
                    <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1.8rem",color:"var(--gold)"}}>{plan.id==="monthly"?"₹200":plan.id==="biannual"?"₹999":"₹1,799"}</p>
                    <p style={{fontSize:"0.78rem",color:"var(--text-dim)",fontStyle:"italic"}}>{plan.desc}</p>
                  </div>
                ))}
              </div>
              <p style={{fontSize:"0.85rem",color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1.5rem"}}>No hidden fees. Cancel anytime. One subscription covers all seasons.</p>
              <button className="btn-primary" style={{fontSize:"0.8rem",padding:"1.1rem 3rem"}} onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe Now →</button>
            </div>

            {/* FAQ */}
            <div style={{marginBottom:"3rem"}}>
              <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1rem",color:"var(--gold)",marginBottom:"1.5rem",textAlign:"center"}}>Common Questions</p>
              {[
                ["What happens if I join mid-season?","You can join anytime! You'll solve all previous riddles at your own pace to catch up to the current day's riddle."],
                ["Is this legal in India?","Yes. Riddle Run is an Online Social Game — a subscription-based knowledge competition. You pay for platform access, not as a stake or wager. This is fully compliant with Indian law."],
                ["How is the winner determined?","The first subscriber to correctly solve all 10 riddles wins. Speed matters — fastest correct answers win."],
                ["Can I cancel my subscription?","Yes, anytime. Your access continues until the end of the paid period."],
                ["How do I claim my prize?","Winners are contacted via email. You'll need to provide ID and address for prize delivery."],
              ].map(([q,a])=>(
                <div key={q} style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"1.2rem 1.5rem",marginBottom:"0.8rem"}}>
                  <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--gold)",letterSpacing:"0.1em",marginBottom:"0.5rem",textTransform:"uppercase"}}>{q}</p>
                  <p style={{fontSize:"0.9rem",color:"var(--text-dim)",lineHeight:1.6}}>{a}</p>
                </div>
              ))}
            </div>

            {/* Final CTA */}
            <div style={{textAlign:"center",padding:"2rem",background:"var(--surface)",border:"1px solid var(--border)"}}>
              <p style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1.2rem",color:"var(--gold)",marginBottom:"0.5rem"}}>Ready to answer?</p>
              <p style={{color:"var(--text-dim)",fontStyle:"italic",marginBottom:"1.5rem"}}>The Day 1 riddle is waiting for you.</p>
              <button className="btn-primary" style={{fontSize:"0.8rem",padding:"1.1rem 3rem",marginBottom:"0.8rem",display:"block",width:"100%"}} onClick={()=>setScreen(SCREEN.PLANS)}>Subscribe for ₹200/month</button>
              <button className="btn-secondary" style={{fontSize:"0.7rem",padding:"0.8rem 2rem",width:"100%"}} onClick={()=>setScreen(SCREEN.LANDING)}>← Back to Home</button>
            </div>

          </div>
        )}

        {/* ── T&C ── */}
        {screen === SCREEN.TC && (
          <div style={{maxWidth:"800px",margin:"0 auto",padding:"3rem 2rem"}}>
            <button className="btn-secondary" style={{marginBottom:"2rem",padding:"0.5rem 1.2rem",fontSize:"0.6rem"}} onClick={()=>setScreen(SCREEN.LANDING)}>← Back</button>
            <h1 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1.6rem",color:"var(--gold)",marginBottom:"0.5rem"}}>Terms & Conditions</h1>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-dim)",letterSpacing:"0.15em",marginBottom:"2rem"}}>EFFECTIVE DATE: JUNE 2026 · VERSION 1.0</p>
            {[
              ["1. Nature of Competition","Riddle Run is a skill-based knowledge competition. Winners are determined entirely by correct answers and speed. This is NOT a lottery, gambling activity, or game of chance. Riddle Run operates as an Online Social Game under the Promotion and Regulation of Online Gaming Act 2025 — players pay a subscription fee for platform access, not as a stake or wager."],
              ["2. Subscription Model","Players pay a monthly subscription fee of ₹200 for access to the competition platform. This fee is for platform access only and is not a stake, entry fee, or wager. The Season prize is sponsored separately by the platform operator and is not funded by subscription fees."],
              ["3. Eligibility","You must be 18+ and a resident of India to participate. The Operator reserves the right to verify age and disqualify underage players."],
              ["4. Refund Policy","Subscription fees are non-refundable once the season has started. In case of technical failure causing season cancellation, a full refund will be issued."],
              ["5. Season Prize","The Season prize is an in-kind award (physical product) sponsored by the platform operator. It is not funded by player subscriptions. Prize is awarded to the first player to correctly solve all 10 riddles. TDS may apply on prizes valued above ₹10,000."],
              ["6. Fair Play","Using bots, AI, or automation to solve riddles is strictly prohibited. Sharing riddle answers publicly is prohibited. Violations result in immediate account termination."],
              ["7. Intellectual Property","All riddles are original works created by the Operator. You may not share, reproduce, or publish riddle content anywhere."],
              ["8. Governing Law","These Terms are governed by Indian law. Disputes shall be resolved by arbitration at Patiala, Punjab, India."],
              ["9. Contact","hello@riddlerun.in · Response within 3 business days."],
            ].map(([title,text])=>(
              <div key={title} style={{marginBottom:"2rem"}}>
                <h3 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"0.85rem",color:"var(--gold)",marginBottom:"0.6rem"}}>{title}</h3>
                <p style={{fontSize:"0.95rem",color:"var(--text-dim)",lineHeight:1.8}}>{text}</p>
              </div>
            ))}
            <div style={{background:"rgba(42,157,92,0.1)",border:"1px solid rgba(42,157,92,0.3)",padding:"1.2rem",marginTop:"2rem"}}>
              <p style={{fontSize:"0.9rem",color:"var(--green)",fontStyle:"italic",lineHeight:1.6}}>By subscribing to Riddle Run, you confirm you are 18+, have read these Terms, and agree to be bound by them.</p>
            </div>
            <button className="btn-primary" style={{marginTop:"2rem"}} onClick={()=>setScreen(SCREEN.REGISTER)}>I Agree — Subscribe Now</button>
          </div>
        )}

        {/* ── PRIVACY ── */}
        {screen === SCREEN.PRIVACY && (
          <div style={{maxWidth:"800px",margin:"0 auto",padding:"3rem 2rem"}}>
            <button className="btn-secondary" style={{marginBottom:"2rem",padding:"0.5rem 1.2rem",fontSize:"0.6rem"}} onClick={()=>setScreen(SCREEN.LANDING)}>← Back</button>
            <h1 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"1.6rem",color:"var(--gold)",marginBottom:"0.5rem"}}>Privacy Policy</h1>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-dim)",letterSpacing:"0.15em",marginBottom:"2rem"}}>EFFECTIVE DATE: JUNE 2026 · VERSION 1.0</p>
            {[
              ["What We Collect","Name, email, phone, age when you register. Payment confirmation from Razorpay (not card details). Game progress data. IP address for security."],
              ["How We Use It","Account management, game tracking, leaderboard display, payment processing, prize disbursement, and legal compliance including TDS deduction."],
              ["Who We Share With","We do NOT sell your data. We share only with: Razorpay (payments), Vercel (hosting), Indian Tax Department (TDS for prize winners above ₹10,000)."],
              ["Data Security","Encrypted storage on Mumbai servers (Supabase). HTTPS for all data transmission. Passwords stored as hashes — never in plain text."],
              ["Your Rights (DPDP Act 2023)","You have the right to access, correct, or delete your data. Email hello@riddlerun.in with subject 'Data Privacy Request'. We respond within 30 days."],
              ["Children","Riddle Run is strictly 18+. We do not knowingly collect data from minors. Contact hello@riddlerun.in if you believe a minor has registered."],
              ["Contact","Grievance Officer: Roop Saggar · hello@riddlerun.in · Patiala, Punjab, India"],
            ].map(([title,text])=>(
              <div key={title} style={{marginBottom:"2rem"}}>
                <h3 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:"0.85rem",color:"var(--gold)",marginBottom:"0.6rem"}}>{title}</h3>
                <p style={{fontSize:"0.95rem",color:"var(--text-dim)",lineHeight:1.8}}>{text}</p>
              </div>
            ))}
            <button className="btn-primary" style={{marginTop:"2rem"}} onClick={()=>setScreen(SCREEN.REGISTER)}>Back to Registration</button>
          </div>
        )}

        {/* ── FOOTER ── */}
        {![SCREEN.ADMIN,SCREEN.GAME].includes(screen) && (
          <div className="footer">
            <div className="footer-links">
              {[["Terms & Conditions",SCREEN.TC],["Privacy Policy",SCREEN.PRIVACY]].map(([label,sc])=>(
                <button key={sc} className="footer-link" onClick={()=>setScreen(sc)}>{label}</button>
              ))}
              <a href="mailto:hello@riddlerun.in" style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.15em",textTransform:"uppercase",color:"var(--text-dim)",textDecoration:"none"}}>Contact</a>
            </div>
            <p className="footer-copy">© 2026 RIDDLE RUN · OPERATED BY ROOP SAGGAR · PATIALA, PUNJAB, INDIA</p>
            <p className="footer-legal">ONLINE SOCIAL GAME — SUBSCRIPTION BASED KNOWLEDGE COMPETITION — NOT A MONEY GAME</p>
          </div>
        )}

      </div></div>
    </>
  );
}
