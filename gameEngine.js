"use strict";

/*
  Minimal Canvas Game Engine
  - Manages: entities, loop, dt (clockTick), keyboard state
  - Entities must implement: update() and draw(ctx)
*/

class GameEngine {
  constructor() {
    this.ctx = null;
    this.entities = [];

    // Delta time in seconds
    this.clockTick = 0;

    // View size in CSS pixels (not device pixels)
    this.viewW = 0;
    this.viewH = 0;

    // Direction flags for movement
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;

    // Raw key map
    this.keys = Object.create(null);

    this._lastTimestamp = 0;
    this._running = false;
  }

  init(ctx) {
    this.ctx = ctx;
    this.updateViewSize();
    this.startInput();
  }

  updateViewSize() {
    // Use the CSS pixel size (client rect), this matches our drawing coordinates
    const rect = this.ctx.canvas.getBoundingClientRect();
    this.viewW = rect.width;
    this.viewH = rect.height;
  }

  startInput() {
    const canvas = this.ctx.canvas;

    // Ensure canvas can receive focus for key events
    canvas.setAttribute("tabindex", "0");

    const setKey = (key, isDown) => {
      this.keys[key] = isDown;

      // Map movement keys to direction flags
      if (key === "arrowup" || key === "w") this.up = isDown;
      if (key === "arrowdown" || key === "s") this.down = isDown;
      if (key === "arrowleft" || key === "a") this.left = isDown;
      if (key === "arrowright" || key === "d") this.right = isDown;
    };

    canvas.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      setKey(k, true);

      // Prevent page scrolling with arrow keys
      if (k.startsWith("arrow")) e.preventDefault();
    });

    canvas.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      setKey(k, false);

      if (k.startsWith("arrow")) e.preventDefault();
    });

    // Click to focus so keyboard input works immediately
    canvas.addEventListener("mousedown", () => canvas.focus());
  }

  addEntity(entity) {
    this.entities.push(entity);
  }

  start() {
    this._running = true;
    this._lastTimestamp = performance.now();

    const frame = (now) => {
      if (!this._running) return;

      // Cap dt to keep things stable if the tab lags
      const dt = Math.min(0.033, (now - this._lastTimestamp) / 1000);
      this._lastTimestamp = now;
      this.clockTick = dt;

      this.update();
      this.draw();

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }

  update() {
    for (const e of this.entities) e.update();
  }

  draw() {
    for (const e of this.entities) e.draw(this.ctx);
  }
}
