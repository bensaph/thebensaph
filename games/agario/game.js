// --- Constants ---
const WORLD_W = 5000, WORLD_H = 5000;
const GRID_SIZE = 50;
const FOOD_COUNT = 500;
const BOT_COUNT = 25;
const BOT_NAMES = [
  'Blob','Hungry','Nomnom','Chomper','Snack','Gobbler','Muncher',
  'Nibbler','Gulper','Devourer','Feeder','Grazer','Prowler',
  'Lurker','Hunter','Stalker','Creeper','Dasher','Zoomer',
  'Speedy','Tiny','Massive','Crusher','Smasher','Biter'
];

// --- State ---
let canvas, ctx, W, H;
let player = null;
let food = [];
let bots = [];
let camera = { x: 0, y: 0, scale: 1 };
let mouse = { x: 0, y: 0 };
let running = false;
let animId = null;

// --- Helpers ---
const rand = (a, b) => Math.random() * (b - a) + a;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
const massToR = m => Math.sqrt(m) * 4;

function randomColor() { return hsl(rand(0, 360) | 0, 70, 55); }

function spawnFood() {
  return { x: rand(0, WORLD_W), y: rand(0, WORLD_H), r: rand(4, 8), color: randomColor() };
}

function createCell(name, x, y, mass, color, isPlayer) {
  return { name, x, y, mass, color, isPlayer, vx: 0, vy: 0 };
}

// --- Init ---
function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  document.getElementById('play-btn').addEventListener('click', startGame);
  document.getElementById('name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });
}

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function startGame() {
  const name = document.getElementById('name-input').value.trim() || 'Player';
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('leaderboard').classList.remove('hidden');

  player = createCell(name, WORLD_W / 2, WORLD_H / 2, 10, '#4CAF50', true);
  food = [];
  bots = [];
  for (let i = 0; i < FOOD_COUNT; i++) food.push(spawnFood());
  for (let i = 0; i < BOT_COUNT; i++) {
    bots.push(createCell(
      BOT_NAMES[i], rand(100, WORLD_W - 100), rand(100, WORLD_H - 100),
      rand(8, 80), randomColor(), false
    ));
  }
  running = true;
  if (animId) cancelAnimationFrame(animId);
  loop();
}

// --- Update ---
function moveCell(c, tx, ty, dt) {
  const r = massToR(c.mass);
  const speed = Math.max(1.5, 8 - c.mass * 0.02) * 60;
  const dx = tx - c.x, dy = ty - c.y;
  const d = Math.hypot(dx, dy) || 1;
  c.x += (dx / d) * speed * dt;
  c.y += (dy / d) * speed * dt;
  c.x = Math.max(r, Math.min(WORLD_W - r, c.x));
  c.y = Math.max(r, Math.min(WORLD_H - r, c.y));
}

function updatePlayer(dt) {
  const wx = (mouse.x - W / 2) / camera.scale + camera.x;
  const wy = (mouse.y - H / 2) / camera.scale + camera.y;
  moveCell(player, wx, wy, dt);
  player.mass -= player.mass * 0.0002 * dt;
  if (player.mass < 10) player.mass = 10;
}

function updateBots(dt) {
  for (const b of bots) {
    // Find nearest target: food or smaller cell
    let best = null, bestD = 600;
    for (const f of food) {
      const d = dist(b, f);
      if (d < bestD) { bestD = d; best = f; }
    }
    // Chase smaller bots or player
    const allCells = [player, ...bots];
    for (const c of allCells) {
      if (c === b) continue;
      if (c.mass < b.mass * 0.85) {
        const d = dist(b, c);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    // Flee from bigger
    let flee = null, fleeD = 300;
    for (const c of allCells) {
      if (c === b) continue;
      if (c.mass > b.mass * 1.2) {
        const d = dist(b, c);
        if (d < fleeD) { fleeD = d; flee = c; }
      }
    }
    let tx, ty;
    if (flee) {
      tx = b.x - (flee.x - b.x);
      ty = b.y - (flee.y - b.y);
    } else if (best) {
      tx = best.x; ty = best.y;
    } else {
      tx = b.x + rand(-200, 200);
      ty = b.y + rand(-200, 200);
    }
    moveCell(b, tx, ty, dt);
    b.mass -= b.mass * 0.0002 * dt;
    if (b.mass < 8) b.mass = 8;
  }
}

function checkEat() {
  const allCells = [player, ...bots];
  // Eat food
  for (const c of allCells) {
    const cr = massToR(c.mass);
    for (let i = food.length - 1; i >= 0; i--) {
      if (dist(c, food[i]) < cr) {
        c.mass += 0.5;
        food[i] = spawnFood();
      }
    }
  }
  // Eat other cells
  for (let i = allCells.length - 1; i >= 0; i--) {
    for (let j = allCells.length - 1; j >= 0; j--) {
      if (i === j) continue;
      const a = allCells[i], b = allCells[j];
      if (!a || !b) continue;
      if (a.mass > b.mass * 1.15 && dist(a, b) < massToR(a.mass)) {
        a.mass += b.mass * 0.8;
        if (b.isPlayer) {
          gameOver();
          return;
        }
        // Respawn bot
        const idx = bots.indexOf(b);
        if (idx !== -1) {
          bots[idx] = createCell(
            BOT_NAMES[idx], rand(100, WORLD_W - 100), rand(100, WORLD_H - 100),
            rand(8, 30), randomColor(), false
          );
        }
      }
    }
  }
}

function gameOver() {
  running = false;
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('leaderboard').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('start-screen').querySelector('h1').textContent = '💀 Game Over';
}

function updateCamera() {
  camera.x = player.x;
  camera.y = player.y;
  camera.scale = Math.max(0.3, Math.min(1, 50 / massToR(player.mass)));
}

function updateHUD() {
  document.getElementById('score').textContent = (player.mass | 0);
  document.getElementById('mass').textContent = (player.mass | 0);
  const all = [player, ...bots].sort((a, b) => b.mass - a.mass).slice(0, 10);
  const ol = document.getElementById('lb-list');
  ol.innerHTML = all.map(c =>
    `<li class="${c.isPlayer ? 'me' : ''}">${c.name}: ${c.mass | 0}</li>`
  ).join('');
}

// --- Draw ---
function draw() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-camera.x, -camera.y);

  // Grid
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  const x0 = 0, y0 = 0;
  for (let x = x0; x <= WORLD_W; x += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
  }
  for (let y = y0; y <= WORLD_H; y += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
  }

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, WORLD_W, WORLD_H);

  // Food
  for (const f of food) {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }

  // Bots
  for (const b of bots) drawCell(b);

  // Player
  if (player) drawCell(player);

  ctx.restore();
}

function drawCell(c) {
  const r = massToR(c.mass);
  // Body
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = c.color;
  ctx.fill();
  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Name
  const fontSize = Math.max(12, r * 0.45);
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.name, c.x, c.y);
}

// --- Loop ---
let lastTime = 0;
function loop(time = 0) {
  if (!running) return;
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  updatePlayer(dt);
  updateBots(dt);
  checkEat();
  updateCamera();
  updateHUD();
  draw();
  animId = requestAnimationFrame(loop);
}

// --- Start ---
init();
