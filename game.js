(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const scoreNode = document.querySelector('#score');
  const livesNode = document.querySelector('#lives');
  const bestNode = document.querySelector('#best');
  const overlay = document.querySelector('#overlay');
  const overlayKicker = document.querySelector('#overlay-kicker');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const startButton = document.querySelector('#start-button');
  const soundButton = document.querySelector('#sound-button');

  const W = canvas.width;
  const H = canvas.height;
  const keys = new Set();
  const touchDirections = new Set();
  const bestKey = 'waddles-on-ice-best';
  let best = Number.parseInt(localStorage.getItem(bestKey) || '0', 10) || 0;
  let state = 'ready';
  let score = 0;
  let lives = 3;
  let player;
  let fish = [];
  let snowballs = [];
  let particles = [];
  let spawnClock = 0;
  let fishClock = 0;
  let lastTime = 0;
  let audioContext;
  let soundOn = false;
  let hitFlash = 0;

  bestNode.textContent = String(best);

  function resetGame() {
    score = 0;
    lives = 3;
    player = { x: W * 0.5, y: H * 0.58, vx: 0, vy: 0, radius: 21, invulnerable: 0, wobble: 0 };
    fish = [];
    snowballs = [];
    particles = [];
    spawnClock = 0.9;
    fishClock = 0;
    hitFlash = 0;
    updateHud();
  }

  function updateHud() {
    scoreNode.textContent = String(score);
    livesNode.textContent = `${'♥ '.repeat(lives).trim()}${'♡ '.repeat(3 - lives).trim()}`;
    bestNode.textContent = String(best);
  }

  function startGame() {
    resetGame();
    state = 'playing';
    overlay.classList.add('hidden');
    lastTime = performance.now();
  }

  function finishGame() {
    state = 'over';
    const newBest = score > best;
    if (newBest) {
      best = score;
      localStorage.setItem(bestKey, String(best));
    }
    updateHud();
    overlayKicker.textContent = newBest ? 'A new personal best!' : 'The ice has claimed another';
    overlayTitle.textContent = score === 0 ? 'Very slippery.' : 'Nice flipper work!';
    overlayCopy.innerHTML = `You collected <strong>${score}</strong> ${score === 1 ? 'fish' : 'fish'} before the bonks.<br />The snowballs are being very smug.`;
    startButton.textContent = 'Waddle again';
    overlay.classList.remove('hidden');
  }

  function sound(frequency = 520, duration = 0.08, type = 'sine') {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(0.045, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_) { /* Audio is optional; the game still works without it. */ }
  }

  function random(min, max) { return min + Math.random() * (max - min); }

  function addFish() {
    const edge = 40;
    let x = random(edge, W - edge);
    let y = random(edge, H - edge);
    if (player && Math.hypot(x - player.x, y - player.y) < 100) {
      x = x < W / 2 ? W - edge : edge;
    }
    fish.push({ x, y, r: 12, phase: random(0, Math.PI * 2), spin: random(-1, 1) });
  }

  function addSnowball() {
    const side = Math.floor(random(0, 4));
    const speed = Math.min(125 + score * 2.2, 235);
    let x, y, angle;
    if (side === 0) { x = random(10, W - 10); y = -25; angle = random(0.65, 2.5); }
    else if (side === 1) { x = W + 25; y = random(10, H - 10); angle = random(2.2, 4.1); }
    else if (side === 2) { x = random(10, W - 10); y = H + 25; angle = random(3.8, 5.8); }
    else { x = -25; y = random(10, H - 10); angle = random(-0.9, 0.9); }
    snowballs.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: random(17, 24), spin: random(-4, 4), angle: random(0, 6) });
  }

  function burst(x, y, color, amount = 8) {
    for (let i = 0; i < amount; i++) {
      const a = random(0, Math.PI * 2);
      const speed = random(35, 125);
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: random(0.3, 0.65), max: 0.65, color, size: random(2, 5) });
    }
  }

  function collectFish(index) {
    const item = fish[index];
    fish.splice(index, 1);
    score++;
    sound(660 + Math.min(score * 20, 260), 0.12, 'triangle');
    burst(item.x, item.y, '#f5a64a', 11);
    fishClock = Math.min(fishClock, 0.2);
    updateHud();
  }

  function hitSnowball(index) {
    const ball = snowballs[index];
    snowballs.splice(index, 1);
    if (player.invulnerable > 0) return;
    lives--;
    player.invulnerable = 1.25;
    hitFlash = 0.23;
    player.vx += (player.x - ball.x) * 3.2;
    player.vy += (player.y - ball.y) * 3.2;
    sound(145, 0.2, 'square');
    burst(player.x, player.y, '#d9f3f3', 15);
    updateHud();
    if (lives <= 0) finishGame();
  }

  function update(dt) {
    if (state !== 'playing') return;
    const left = keys.has('ArrowLeft') || keys.has('a') || touchDirections.has('left');
    const right = keys.has('ArrowRight') || keys.has('d') || touchDirections.has('right');
    const up = keys.has('ArrowUp') || keys.has('w') || touchDirections.has('up');
    const down = keys.has('ArrowDown') || keys.has('s') || touchDirections.has('down');
    let ax = (right ? 1 : 0) - (left ? 1 : 0);
    let ay = (down ? 1 : 0) - (up ? 1 : 0);
    if (ax && ay) { ax *= Math.SQRT1_2; ay *= Math.SQRT1_2; }
    const acceleration = 570;
    player.vx += ax * acceleration * dt;
    player.vy += ay * acceleration * dt;
    const friction = Math.pow(0.965, dt * 60);
    player.vx *= friction;
    player.vy *= friction;
    const maxSpeed = 255;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) { player.vx = player.vx / speed * maxSpeed; player.vy = player.vy / speed * maxSpeed; }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(25, Math.min(W - 25, player.x));
    player.y = Math.max(28, Math.min(H - 27, player.y));
    player.wobble += dt * (4 + Math.hypot(player.vx, player.vy) * 0.015);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    hitFlash = Math.max(0, hitFlash - dt);

    fishClock -= dt;
    if (fish.length < 4 && fishClock <= 0) { addFish(); fishClock = 2.8; }
    spawnClock -= dt;
    if (spawnClock <= 0) {
      addSnowball();
      spawnClock = Math.max(0.55, 1.6 - score * 0.035) * random(0.72, 1.25);
    }

    for (let i = fish.length - 1; i >= 0; i--) {
      const item = fish[i];
      item.phase += dt * 3;
      if (Math.hypot(item.x - player.x, item.y - player.y) < player.radius + item.r) collectFish(i);
    }
    for (let i = snowballs.length - 1; i >= 0; i--) {
      const ball = snowballs[i];
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.angle += ball.spin * dt;
      if (ball.x < -55 || ball.x > W + 55 || ball.y < -55 || ball.y > H + 55) { snowballs.splice(i, 1); continue; }
      if (Math.hypot(ball.x - player.x, ball.y - player.y) < ball.r + player.radius * 0.72) hitSnowball(i);
      if (state !== 'playing') break;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#c9edf1');
    gradient.addColorStop(1, '#e7f5e9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Quiet icy patches and skate marks give the rink texture without hiding hazards.
    ctx.globalAlpha = 0.36;
    for (let i = 0; i < 9; i++) {
      const x = (i * 127 + 42) % W;
      const y = (i * 83 + 24) % H;
      ctx.fillStyle = i % 2 ? '#b7e2e4' : '#f7fffa';
      ctx.beginPath(); ctx.ellipse(x, y, 30 + (i % 3) * 8, 10 + (i % 2) * 5, -0.25, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 34; i++) {
      const x = (i * 173 + 29) % W;
      const drift = (time * (8 + (i % 4) * 3) + i * 37) % (H + 20);
      const y = drift - 10;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.45 + (i % 3) * 0.12;
      ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 2.1 : 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Faint boundary dashes make the play area legible.
    ctx.strokeStyle = '#99cfd1'; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.setLineDash([8, 9]);
    ctx.strokeRect(13, 13, W - 26, H - 26); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  function drawFish(item, time) {
    const bob = Math.sin(item.phase) * 3;
    ctx.save(); ctx.translate(item.x, item.y + bob); ctx.rotate(Math.sin(item.phase * 0.6) * 0.12);
    ctx.shadowColor = '#a75d1b45'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#f3a849';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-18, -7); ctx.lineTo(-18, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d58b37'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(-5, 5); ctx.stroke();
    ctx.fillStyle = '#314b53'; ctx.beginPath(); ctx.arc(7, -2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSnowball(ball) {
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle);
    ctx.shadowColor = '#54747c35'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#e5f5f4'; ctx.beginPath(); ctx.arc(-ball.r * .28, -ball.r * .3, ball.r * .34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b9dadd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, ball.r - 3, -0.3, 1.5); ctx.stroke();
    ctx.restore();
  }

  function drawPenguin(time) {
    if (!player) return;
    const speed = Math.hypot(player.vx, player.vy);
    const tilt = Math.max(-0.2, Math.min(0.2, player.vx * 0.0008));
    const squash = 1 + Math.sin(player.wobble) * Math.min(speed / 240, 0.07);
    ctx.save(); ctx.translate(player.x, player.y + Math.sin(player.wobble * 0.7) * 1.5); ctx.rotate(tilt);
    if (player.invulnerable > 0 && Math.floor(time * 15) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.shadowColor = '#385d6540'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
    ctx.scale(1 / squash, squash);
    // Feet
    ctx.fillStyle = '#f49a45';
    ctx.beginPath(); ctx.ellipse(-10, 17, 9, 5, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 17, 9, 5, 0.25, 0, Math.PI * 2); ctx.fill();
    // Flippers swing as Waddles slides.
    ctx.fillStyle = '#223c49';
    ctx.save(); ctx.rotate(Math.sin(player.wobble) * 0.18);
    ctx.beginPath(); ctx.ellipse(-20, 2, 7, 15, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(-Math.sin(player.wobble) * 0.18);
    ctx.beginPath(); ctx.ellipse(20, 2, 7, 15, 0.35, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // Body and belly
    ctx.beginPath(); ctx.ellipse(0, 0, 19, 23, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(0, 5, 12, 15, 0, 0, Math.PI * 2); ctx.fill();
    // Eyes glance in the direction of travel.
    const glanceX = Math.max(-2, Math.min(2, player.vx * 0.012));
    const glanceY = Math.max(-1.5, Math.min(1.5, player.vy * 0.009));
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-6, -8, 4.2, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -8, 4.2, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#203b4a'; ctx.beginPath(); ctx.arc(-6 + glanceX, -7 + glanceY, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6 + glanceX, -7 + glanceY, 2, 0, Math.PI * 2); ctx.fill();
    // Tiny orange beak
    ctx.fillStyle = '#f3a34d'; ctx.beginPath(); ctx.moveTo(-4, -1); ctx.lineTo(4, -1); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let visualTime = 0;
  function render() {
    visualTime += 1 / 60;
    drawBackground(visualTime);
    for (const item of fish) drawFish(item, visualTime);
    for (const ball of snowballs) drawSnowball(ball);
    drawParticles();
    drawPenguin(visualTime);
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 112, 91, ${hitFlash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000 || 0, 0.033);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
    if (key === ' ' && state !== 'playing') startGame();
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  window.addEventListener('blur', () => { keys.clear(); touchDirections.clear(); });
  document.querySelectorAll('.touch-key').forEach((button) => {
    const direction = button.dataset.direction;
    const release = (event) => { event.preventDefault(); touchDirections.delete(direction); button.classList.remove('pressed'); };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (state !== 'playing') startGame();
      touchDirections.add(direction); button.classList.add('pressed');
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
  startButton.addEventListener('click', startGame);
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.textContent = `Sound: ${soundOn ? 'on' : 'off'}`;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) sound(550, 0.08, 'triangle');
  });

  resetGame();
  requestAnimationFrame((now) => { lastTime = now; frame(now); });
})();
