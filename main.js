"use strict";

/*
 Jin Kwak
 Extra Labor - mini game
 
*/

function fitCanvasToScreen(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  const ctx = canvas.getContext("2d");

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return ctx;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

window.addEventListener("load", async () => {
  const canvas = document.getElementById("gameWorld");
  const ctx = fitCanvasToScreen(canvas);

  const engine = new GameEngine();
  engine.init(ctx);

  // Load sprites (file names must match exactly)
  const [shipImg, shipBoostImg, meteoroidImg] = await Promise.all([
    loadImage("./image/Spaceship.png"),
    loadImage("./image/Spaceshipbooster.png"),
    loadImage("./image/Meteoroid.png")
  ]);

  const game = new MeteoroidGame(engine, {
    shipImg,
    shipBoostImg,
    meteoroidImg
  });

  /*
    Start the game:
    - restart() will set player position, clear meteoroids, reset timers
    - restart() will also initialize the parallax starfield based on the viewport size
  */
  game.restart();
  engine.addEntity(game);

  // Helps ensure keyboard input is captured if your engine relies on canvas focus
  canvas.setAttribute("tabindex", "0");
  canvas.focus();

  window.addEventListener("resize", () => {
    // Refit canvas and update engine context/viewport
    const newCtx = fitCanvasToScreen(canvas);
    engine.ctx = newCtx;
    engine.updateViewSize();

    // Keep the player inside bounds after resizing
    game.player.x = Math.min(
      Math.max(game.player.x, game.player.r),
      engine.viewW - game.player.r
    );
    game.player.y = Math.min(
      Math.max(game.player.y, game.player.r),
      engine.viewH - game.player.r
    );

    /*
      Rebuild starfield so the parallax background fills the new viewport cleanly.
      This avoids empty areas or weird star density after resizing.
    */
    if (typeof game.initStars === "function") {
      game.initStars();
    }
  });

  engine.start();
});