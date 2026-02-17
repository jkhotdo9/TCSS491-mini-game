"use strict";

/*
  Meteoroid Dodge

  TCSS 491

  Jin Kwak
*/

class MeteoroidGame {
  constructor(engine, sprites) {
    this.engine = engine;
    this.sprites = sprites;

    // ===== Start gating =====
    this.started = false; // wait for Enter

    // ===== Player =====
    this.player = { x: 0, y: 0, r: 18, speed: 320 };

    this.shipW = 120;
    this.shipH = 120;

    this.meteoroidW = 64;
    this.meteoroidH = 64;

    this.SHIP_ROT_OFFSET = Math.PI / 2;

    this.meteoroids = [];
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
    this.bgm.volume = 0.1;

    this.gameOverSound = new Audio("audio/gameover.mp3");
    this.gameOverSound.loop = false;
    this.gameOverSound.volume = 0.4;

    this.muted = false;
    this.applyMute();

    // Build initial stars for start screen
    this.initStars();

    // Show mute hint in the HUD area (top-left)
    this.updateHudStatus();
  }

  // ===== CSS pixel view (matches ctx.setTransform(dpr,...) in main.js) =====
  getViewW() {
    const c = this.engine.ctx?.canvas || document.getElementById("gameWorld");
    return c.getBoundingClientRect().width;
  }

  getViewH() {
    const c = this.engine.ctx?.canvas || document.getElementById("gameWorld");
    return c.getBoundingClientRect().height;
  }

  // ===== Key helper =====
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

  // HUD status (top-left) 
  updateHudStatus() {
    if (!this.statusEl) return;

    // Keep it short so it looks like the other HUD hints.
    // If you want it to say "Muted" when muted, we can swap this line.
    this.statusEl.textContent = "Mute: M";
  }

  // Mute control 
  applyMute() {
    const bgmBase = 0.1;
    const overBase = 0.4;
    this.bgm.volume = this.muted ? 0 : bgmBase;
    this.gameOverSound.volume = this.muted ? 0 : overBase;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyMute();
  }

  // Stars 
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

  // Start / restart 
  startRound() {
    this.started = true;
    this.restart();

    // Start BGM ONLY when the game starts (after Enter)
    this.bgm.pause();
    this.bgm.currentTime = 0;
    this.bgm.play().catch(() => {});
  }

  restart() {
    this.engine.updateViewSize();

    const w = this.getViewW();
    const h = this.getViewH();

    this.player.x = w / 2;
    this.player.y = h / 2;

    this.meteoroids = [];
    this.elapsed = 0;
    this.spawnTimer = 0;

    this.running = true;
    this.paused = false;

    this.flashT = 0;
    this.shakeT = 0;
    this.gameOverOverlayAlpha = 0;

    this.initStars();

    // Reset game over sound
    this.gameOverSound.pause();
    this.gameOverSound.currentTime = 0;

    // Don’t autoplay BGM here (only on Enter)
    this.bgm.pause();
    this.bgm.currentTime = 0;

    // Keep HUD hint visible
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

    // Stars always animate
    this.updateStars(dt);

    // Mute toggle always available
    if (this.consumeKey("m", "M")) this.toggleMute();

    // Start screen
    if (!this.started) {
      if (this.consumeKey("enter", "Enter")) {
        this.startRound();
      }

      if (this.scoreEl) this.scoreEl.textContent = "0.00";
      if (this.meteoroidsEl) this.meteoroidsEl.textContent = "0";
      if (this.bestEl) this.bestEl.textContent = this.bestTime.toFixed(2);

      // Keep HUD hint visible
      this.updateHudStatus();
      return;
    }

    // Restart
    if (this.engine.keys["r"]) {
      this.engine.keys["r"] = false;
      this.restart();

      // After restart (during gameplay), resume BGM
      this.bgm.play().catch(() => {});
      return;
    }

    // Pause toggle
    if (this.engine.keys["p"]) {
      this.engine.keys["p"] = false;
      if (this.running) {
        this.paused = !this.paused;
      }
    }

    // Keep HUD hint visible during play (and pause/game over)
    this.updateHudStatus();

    // Timers
    this.flashT = Math.max(0, this.flashT - dt);
    this.shakeT = Math.max(0, this.shakeT - dt);

    // Game over
    if (!this.running) {
      if (this.scoreEl) this.scoreEl.textContent = this.elapsed.toFixed(2);
      if (this.meteoroidsEl) this.meteoroidsEl.textContent = String(this.meteoroids.length);
      if (this.bestEl) this.bestEl.textContent = this.bestTime.toFixed(2);
      return;
    }

    // Pause
    if (this.paused) {
      if (this.scoreEl) this.scoreEl.textContent = this.elapsed.toFixed(2);
      if (this.meteoroidsEl) this.meteoroidsEl.textContent = String(this.meteoroids.length);
      if (this.bestEl) this.bestEl.textContent = this.bestTime.toFixed(2);
      return;
    }

    // Gameplay
    this.elapsed += dt;

    const difficulty = 1 + Math.min(3.0, this.elapsed / 25);
    const spawnInterval = Math.max(0.12, 0.7 / difficulty);

    this.spawnTimer += dt;
    while (this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval;
      this.spawnMeteoroid();
    }

    // Movement input
    let mx = 0, my = 0;
    if (this.engine.up) my -= 1;
    if (this.engine.down) my += 1;
    if (this.engine.left) mx -= 1;
    if (this.engine.right) mx += 1;

    this.isMoving = (mx !== 0 || my !== 0);

    if (this.isMoving) {
      const l = Math.hypot(mx, my) || 1;
      mx /= l;
      my /= l;

      this.lastShipAngle = Math.atan2(my, mx);
      this.player.x += mx * this.player.speed * dt;
      this.player.y += my * this.player.speed * dt;
    }

    // Clamp
    const w = this.getViewW();
    const h = this.getViewH();
    this.player.x = this.clamp(this.player.x, this.player.r, w - this.player.r);
    this.player.y = this.clamp(this.player.y, this.player.r, h - this.player.r);

    // Update meteoroids
    for (const m of this.meteoroids) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.rotation += m.spin * dt;
    }

    // Remove off-screen meteoroids
    const pad = 300;
    this.meteoroids = this.meteoroids.filter(m =>
      m.x > -pad && m.x < w + pad &&
      m.y > -pad && m.y < h + pad
    );

    // Collision
    for (const m of this.meteoroids) {
      if (this.collideCircle(this.player, m)) {
        this.running = false;
        this.flashT = 0.18;
        this.shakeT = 0.35;

        // Stop BGM
        this.bgm.pause();
        this.bgm.currentTime = 0;

        // Game over SFX
        this.gameOverSound.pause();
        this.gameOverSound.currentTime = 0;
        this.gameOverSound.play().catch(() => {});

        // Best time
        if (this.elapsed > this.bestTime) {
          this.bestTime = this.elapsed;
          localStorage.setItem("meteoroid_best_time", String(this.bestTime));
        }

        break;
      }
    }

    // HUD
    if (this.scoreEl) this.scoreEl.textContent = this.elapsed.toFixed(2);
    if (this.meteoroidsEl) this.meteoroidsEl.textContent = String(this.meteoroids.length);
    if (this.bestEl) this.bestEl.textContent = this.bestTime.toFixed(2);
  }

  draw(ctx) {
    const w = this.getViewW();
    const h = this.getViewH();

    // Screen shake
    if (this.shakeT > 0) {
      const strength = 6 * (this.shakeT / 0.35);
      ctx.save();
      ctx.translate(this.rand(-strength, strength), this.rand(-strength, strength));
    }

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Stars
    ctx.save();
    for (let li = 0; li < this.stars.length; li++) {
      const layer = this.starLayers[li];
      const stars = this.stars[li];
      ctx.globalAlpha = 0.35 + li * 0.2;

      for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, layer.size, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    }
    ctx.restore();

    // Start overlay (ONLY Enter message, no mute line here)
    if (!this.started) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, w, h);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";

      ctx.font = "bold 48px Arial";
      ctx.fillText("PRESS ENTER TO START", w / 2, h / 2);

      ctx.restore();

      if (this.shakeT > 0) ctx.restore();
      return;
    }

    // Meteoroids
    for (const m of this.meteoroids) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rotation);
      ctx.drawImage(
        this.sprites.meteoroidImg,
        -this.meteoroidW / 2,
        -this.meteoroidH / 2,
        this.meteoroidW,
        this.meteoroidH
      );
      ctx.restore();
    }

    // Ship
    const shipImg = this.isMoving ? this.sprites.shipBoostImg : this.sprites.shipImg;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.lastShipAngle + this.SHIP_ROT_OFFSET);
    ctx.drawImage(
      shipImg,
      -this.shipW / 2,
      -this.shipH / 2,
      this.shipW,
      this.shipH
    );
    ctx.restore();

    // Flash
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.65, this.flashT / 0.18);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Game over overlay
    if (!this.running) {
      this.drawGameOverOverlay(ctx, w, h);
    }

    if (this.shakeT > 0) ctx.restore();
  }

  drawGameOverOverlay(ctx, w, h) {
    this.gameOverOverlayAlpha = Math.min(
      0.6,
      this.gameOverOverlayAlpha + this.engine.clockTick * 1.5
    );

    ctx.save();
    ctx.globalAlpha = this.gameOverOverlayAlpha;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 10;

    ctx.fillStyle = "#000";
    ctx.font = "bold 72px Arial";
    ctx.fillText("GAME OVER", w / 2, h / 2 - 20);

    ctx.font = "24px Arial";
    ctx.fillText("Press R to Restart", w / 2, h / 2 + 35);

    ctx.restore();
  }
}