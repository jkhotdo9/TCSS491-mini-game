"use strict";

/*
  TCSS 491 Minigame for exra labors

  Jin Kwak
  
*/

class MeteoroidGame {
  constructor(engine, sprites) {
    this.engine = engine;
    this.sprites = sprites;

    // ===== Start gating =====
    this.started = false; 

    // ===== Player (Extreme Inertia) =====
    this.player = { 
      x: 0, y: 0, 
      vx: 0, vy: 0, 
      r: 18, 
      accel: 1200,     
      friction: 0.985   
    };

    this.shipW = 120;
    this.shipH = 120;
    this.meteoroidW = 64;
    this.meteoroidH = 64;
    this.SHIP_ROT_OFFSET = Math.PI / 2;

    this.meteoroids = [];
    this.particles = []; // For acceleration trail effects

    this.elapsed = 0;
    this.spawnTimer = 0;

    this.running = true;
    this.paused = false;

    this.isMoving = false;
    this.lastShipAngle = -Math.PI / 2;

    // HUD
    this.scoreEl = document.getElementById("score");
    this.meteoroidsEl = document.getElementById("meteoroids");
    this.statusEl = document.getElementById("status");
    this.bestEl = document.getElementById("best");
    this.bestTime = Number(localStorage.getItem("meteoroid_best_time") || 0);

    // Effects
    this.flashT = 0;
    this.shakeT = 0;
    this.gameOverOverlayAlpha = 0;

    // Stars
    this.stars = [];
    this.starLayers = [
      { count: 60, speed: 10, size: 1 },
      { count: 40, speed: 25, size: 2 },
      { count: 25, speed: 45, size: 2.5 }
    ];

    // Audio
    this.bgm = new Audio("audio/minibgm.mp3");
    this.bgm.loop = true;
    this.gameOverSound = new Audio("audio/gameover.mp3");

    this.volume = Number(localStorage.getItem("meteoroid_volume") || 0.1);
    this.gameOverVolume = Number(localStorage.getItem("meteoroid_over_volume") || 0.4);
    this.muted = (localStorage.getItem("meteoroid_muted") === "1");

    this.applyVolume();
    this.initStars();
    this.updateHudStatus();
  }

  // Create particles (for engine exhaust trails)
  createParticle(x, y, color) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 60,
      vy: (Math.random() - 0.5) * 60,
      life: 1.0,
      color: color
    });
  }

  getViewW() {
    const c = this.engine.ctx?.canvas || document.getElementById("gameWorld");
    return c.getBoundingClientRect().width;
  }

  getViewH() {
    const c = this.engine.ctx?.canvas || document.getElementById("gameWorld");
    return c.getBoundingClientRect().height;
  }

  // Helper to check and reset key state
  consumeKey(...names) {
    const keys = this.engine.keys || {};
    for (const n of names) {
      if (keys[n]) {
        keys[n] = false;
        return true;
      }
    }
    return false;
  }

  updateHudStatus() {
    if (!this.statusEl) return;
    const volPct = Math.round(this.volume * 100);
    const text = this.muted ? "Muted" : `Vol ${volPct}%`;
    this.statusEl.textContent = `${text}  |  M: Mute , [ : Volume down , ] : Volume up`;
  }

  applyVolume() {
    this.volume = Math.max(0, Math.min(1, this.volume));
    this.gameOverVolume = Math.max(0, Math.min(1, this.gameOverVolume));
    this.bgm.volume = this.muted ? 0 : this.volume;
    this.gameOverSound.volume = this.muted ? 0 : this.gameOverVolume;
    localStorage.setItem("meteoroid_volume", String(this.volume));
    localStorage.setItem("meteoroid_over_volume", String(this.gameOverVolume));
    localStorage.setItem("meteoroid_muted", this.muted ? "1" : "0");
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolume();
  }

  changeVolume(delta) {
    this.volume = Math.max(0, Math.min(1, this.volume + delta));
    this.applyVolume();
  }

  // Initialize background star positions
  initStars() {
    const w = this.getViewW();
    const h = this.getViewH();
    this.stars = this.starLayers.map(layer => {
      const arr = [];
      for (let i = 0; i < layer.count; i++) {
        arr.push({ x: this.rand(0, w), y: this.rand(0, h) });
      }
      return arr;
    });
  }

  updateStars(dt) {
    const w = this.getViewW();
    const h = this.getViewH();
    for (let li = 0; li < this.stars.length; li++) {
      const layer = this.starLayers[li];
      const stars = this.stars[li];
      for (const s of stars) {
        s.y += layer.speed * dt;
        s.x += (li + 1) * 0.6 * dt;
        if (s.y > h + 5) s.y = -5;
        if (s.x > w + 5) s.x = -5;
      }
    }
  }

  startRound() {
    this.started = true;
    this.restart();
    this.bgm.pause();
    this.bgm.currentTime = 0;
    this.bgm.play().catch(() => { });
  }

  restart() {
    this.engine.updateViewSize();
    const w = this.getViewW();
    const h = this.getViewH();
    this.player.x = w / 2;
    this.player.y = h / 2;
    this.player.vx = 0;
    this.player.vy = 0;
    this.meteoroids = [];
    this.particles = [];
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.running = true;
    this.paused = false;
    this.flashT = 0;
    this.shakeT = 0;
    this.gameOverOverlayAlpha = 0;
    this.initStars();
    this.gameOverSound.pause();
    this.gameOverSound.currentTime = 0;
    this.bgm.pause();
    this.bgm.currentTime = 0;
    this.applyVolume();
    this.updateHudStatus();
  }

  rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  spawnMeteoroid() {
    const w = this.getViewW();
    const h = this.getViewH();
    const side = Math.floor(Math.random() * 4);
    const margin = 80;
    let x = 0, y = 0;
    if (side === 0) { x = this.rand(0, w); y = -margin; }
    if (side === 1) { x = w + margin; y = this.rand(0, h); }
    if (side === 2) { x = this.rand(0, w); y = h + margin; }
    if (side === 3) { x = -margin; y = this.rand(0, h); }
    const tx = this.player.x + this.rand(-160, 160);
    const ty = this.player.y + this.rand(-160, 160);
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const t = this.elapsed;
    const difficulty = 1 + Math.min(3.0, t / 25);
    const baseSpeed = 150;
    const speed = (baseSpeed * difficulty) + this.rand(0, 120);
    const r = this.rand(12, 20);
    this.meteoroids.push({
      x, y,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      r,
      rotation: this.rand(0, Math.PI * 2),
      spin: this.rand(-2.6, 2.6)
    });
  }

  collideCircle(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const rr = a.r + b.r;
    return dx * dx + dy * dy <= rr * rr;
  }

  update() {
    const dt = this.engine.clockTick;
    this.updateStars(dt);

    if (this.consumeKey("m", "M")) this.toggleMute();
    if (this.consumeKey("[", "{")) this.changeVolume(-0.05);
    if (this.consumeKey("]", "}")) this.changeVolume(+0.05);

    if (!this.started) {
      if (this.consumeKey("enter", "Enter")) this.startRound();
      return;
    }

    if (this.engine.keys["r"]) {
      this.engine.keys["r"] = false;
      this.restart();
      this.bgm.play().catch(() => { });
      return;
    }

    if (this.engine.keys["p"]) {
      this.engine.keys["p"] = false;
      if (this.running) this.paused = !this.paused;
    }

    this.updateHudStatus();
    this.flashT = Math.max(0, this.flashT - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);

    if (!this.running || this.paused) return;

    this.elapsed += dt;

    const difficulty = 1 + Math.min(3.0, this.elapsed / 25);
    const spawnInterval = Math.max(0.12, 0.7 / difficulty);
    this.spawnTimer += dt;
    while (this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval;
      this.spawnMeteoroid();
    }

    // ===== Movement =====
    let ax = 0, ay = 0;
    if (this.engine.up) ay -= 1;
    if (this.engine.down) ay += 1;
    if (this.engine.left) ax -= 1;
    if (this.engine.right) ax += 1;

    const inputLen = Math.hypot(ax, ay);
    if (inputLen > 0) {
      ax /= inputLen;
      ay /= inputLen;
      this.isMoving = true;
      this.lastShipAngle = Math.atan2(ay, ax);
      
      // Generate particles while accelerating
      if (Math.random() > 0.6) {
        this.createParticle(this.player.x, this.player.y, "#44aaff");
      }
    } else {
      this.isMoving = false;
    }

    // Physics: Apply acceleration and friction
    this.player.vx += ax * this.player.accel * dt;
    this.player.vy += ay * this.player.accel * dt;
    this.player.vx *= this.player.friction;
    this.player.vy *= this.player.friction;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    // Boundary Bounce: Slight bounce back when hitting screen edges
    const w = this.getViewW();
    const h = this.getViewH();
    if (this.player.x < this.player.r) { this.player.x = this.player.r; this.player.vx *= -0.3; }
    if (this.player.x > w - this.player.r) { this.player.x = w - this.player.r; this.player.vx *= -0.3; }
    if (this.player.y < this.player.r) { this.player.y = this.player.r; this.player.vy *= -0.3; }
    if (this.player.y > h - this.player.r) { this.player.y = h - this.player.r; this.player.vy *= -0.3; }

    // Meteoroids movement and collision check
    for (const m of this.meteoroids) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rotation += m.spin * dt;

      if (this.collideCircle(this.player, m)) {
        this.running = false;
        this.flashT = 0.18;
        this.shakeT = 0.35;
        this.bgm.pause();
        this.gameOverSound.play().catch(() => { });
        if (this.elapsed > this.bestTime) {
          this.bestTime = this.elapsed;
          localStorage.setItem("meteoroid_best_time", String(this.bestTime));
        }
        break;
      }
    }

    // Particle update: Update lifetime and filter dead particles
    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 2.5;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    // Filter out off-screen meteoroids
    this.meteoroids = this.meteoroids.filter(m => 
      m.x > -300 && m.x < w + 300 && m.y > -300 && m.y < h + 300
    );

    // Update HUD display values
    if (this.scoreEl) this.scoreEl.textContent = this.elapsed.toFixed(2);
    if (this.meteoroidsEl) this.meteoroidsEl.textContent = String(this.meteoroids.length);
    if (this.bestEl) this.bestEl.textContent = this.bestTime.toFixed(2);
  }

  draw(ctx) {
    const w = this.getViewW();
    const h = this.getViewH();

    // Screen Shake effect
    if (this.shakeT > 0) {
      const strength = 6 * (this.shakeT / 0.35);
      ctx.save();
      ctx.translate(this.rand(-strength, strength), this.rand(-strength, strength));
    }

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Draw Stars
    ctx.save();
    for (let li = 0; li < this.stars.length; li++) {
      const layer = this.starLayers[li];
      ctx.globalAlpha = 0.35 + li * 0.2;
      for (const s of this.stars[li]) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, layer.size, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    }
    ctx.restore();

    // Draw Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life * 0.8;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2, 2);
      ctx.restore();
    });

    // Start Screen Overlay
    if (!this.started) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 48px Arial";
      ctx.fillText("DRIFT & SURVIVE", w / 2, h / 2 - 20);
      ctx.font = "24px Arial";
      ctx.fillText("PRESS ENTER TO START", w / 2, h / 2 + 30);
      ctx.restore();
      return;
    }

    // Draw Meteoroids
    for (const m of this.meteoroids) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rotation);
      ctx.drawImage(this.sprites.meteoroidImg, -this.meteoroidW / 2, -this.meteoroidH / 2, this.meteoroidW, this.meteoroidH);
      ctx.restore();
    }

    // Draw Ship
    const speed = Math.hypot(this.player.vx, this.player.vy);
    const shipImg = (this.isMoving || speed > 80) ? this.sprites.shipBoostImg : this.sprites.shipImg;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.lastShipAngle + this.SHIP_ROT_OFFSET);
    
    // Engine flame flicker effect during movement
    let drawH = this.shipH;
    if (this.isMoving) drawH += Math.sin(Date.now() * 0.05) * 8;

    ctx.drawImage(shipImg, -this.shipW / 2, -drawH / 2, this.shipW, drawH);
    ctx.restore();

    // Impact Flash effect
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.65, this.flashT / 0.18);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (!this.running) this.drawGameOverOverlay(ctx, w, h);
    if (this.shakeT > 0) ctx.restore();
  }

  drawGameOverOverlay(ctx, w, h) {
    this.gameOverOverlayAlpha = Math.min(0.6, this.gameOverOverlayAlpha + this.engine.clockTick * 1.5);
    ctx.save();
    ctx.globalAlpha = this.gameOverOverlayAlpha;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.font = "bold 72px Arial";
    ctx.fillText("GAME OVER", w / 2, h / 2 - 20);
    ctx.font = "24px Arial";
    ctx.fillText("Press R to Restart", w / 2, h / 2 + 35);
    ctx.restore();
  }
}