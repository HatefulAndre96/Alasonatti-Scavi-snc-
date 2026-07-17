(function () {
  'use strict';

  var openBtn = document.getElementById('easter-egg-btn');
  var modal = document.getElementById('game-modal');
  var closeBtn = document.getElementById('game-close-btn');
  var canvas = document.getElementById('game-canvas');
  var scoreEl = document.getElementById('game-score');
  var bestEl = document.getElementById('game-best');

  if (!openBtn || !modal || !canvas || !closeBtn) return;

  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;
  var GROUND_Y = H - 30;
  var BEST_KEY = 'alasonattiScaviGameBest';

  var best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;

  var player = { x: 55, y: 0, w: 44, h: 28, vy: 0, onGround: true };
  var obstacles = [];
  var speed = 6;
  var score = 0;
  var state = 'idle'; // idle | playing | over
  var rafId = null;
  var nextSpawnIn = 0;
  var groundOffset = 0;

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function resetGame() {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    obstacles = [];
    speed = 6;
    score = 0;
    nextSpawnIn = 60;
    groundOffset = 0;
    scoreEl.textContent = 'Punti: 0';
    bestEl.textContent = 'Record: ' + best;
  }

  function spawnObstacle() {
    var isRock = Math.random() > 0.45;
    if (isRock) {
      var h = 20 + Math.random() * 18;
      obstacles.push({ x: W + 10, w: 22 + Math.random() * 10, h: h, type: 'rock' });
    } else {
      obstacles.push({ x: W + 10, w: 40 + Math.random() * 40, h: 14, type: 'gap' });
    }
  }

  function gameOver() {
    state = 'over';
    var finalScore = Math.floor(score);
    if (finalScore > best) {
      best = finalScore;
      localStorage.setItem(BEST_KEY, String(best));
    }
    bestEl.textContent = 'Record: ' + best;
  }

  function update() {
    player.vy += 0.6;
    player.y += player.vy;
    if (player.y >= GROUND_Y - player.h) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    speed = 6 + Math.min(score / 400, 7);

    for (var i = 0; i < obstacles.length; i++) obstacles[i].x -= speed;
    obstacles = obstacles.filter(function (o) { return o.x + o.w > -10; });

    nextSpawnIn -= 1;
    if (nextSpawnIn <= 0) {
      spawnObstacle();
      nextSpawnIn = Math.max(30, 90 - speed * 5 + Math.random() * 40);
    }

    groundOffset = (groundOffset - speed) % 40;
    score += speed * 0.15;
    scoreEl.textContent = 'Punti: ' + Math.floor(score);

    var pBox = { x: player.x + 6, y: player.y + 4, w: player.w - 10, h: player.h - 6 };
    for (var j = 0; j < obstacles.length; j++) {
      var o = obstacles[j];
      var oBox = o.type === 'rock'
        ? { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h }
        : { x: o.x, y: GROUND_Y - 4, w: o.w, h: 10 };
      if (pBox.x < oBox.x + oBox.w && pBox.x + pBox.w > oBox.x &&
          pBox.y < oBox.y + oBox.h && pBox.y + pBox.h > oBox.y) {
        gameOver();
        return;
      }
    }
  }

  function drawExcavator(x, y, w, h) {
    ctx.fillStyle = '#2b2b2b';
    roundRect(x, y + h - 8, w, 8, 3); ctx.fill();

    ctx.fillStyle = '#FF6600';
    roundRect(x + 4, y + 6, w - 8, h - 14, 4); ctx.fill();

    ctx.fillStyle = '#0a0a0a';
    roundRect(x + 7, y + 9, 12, 10, 2); ctx.fill();

    ctx.strokeStyle = '#c14e00';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w - 10, y + 10);
    ctx.lineTo(x + w + 14, y - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w + 14, y - 6);
    ctx.lineTo(x + w + 6, y + 12);
    ctx.stroke();

    ctx.fillStyle = '#c14e00';
    roundRect(x + w, y + 9, 11, 9, 2); ctx.fill();
  }

  function overlayText(lines) {
    var boxH = lines.length > 1 ? 62 : 44;
    ctx.fillStyle = 'rgba(0,45,98,0.78)';
    ctx.fillRect(0, H / 2 - boxH / 2, W, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '700 17px Montserrat, sans-serif';
    ctx.fillText(lines[0], W / 2, H / 2 - (lines.length > 1 ? 6 : -6));
    if (lines[1]) {
      ctx.font = '400 13px "Open Sans", sans-serif';
      ctx.fillText(lines[1], W / 2, H / 2 + 18);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#dbe4ee';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 40);
    ctx.lineTo(90, GROUND_Y - 95);
    ctx.lineTo(180, GROUND_Y - 55);
    ctx.lineTo(290, GROUND_Y - 105);
    ctx.lineTo(400, GROUND_Y - 60);
    ctx.lineTo(510, GROUND_Y - 100);
    ctx.lineTo(620, GROUND_Y - 65);
    ctx.lineTo(W, GROUND_Y - 90);
    ctx.lineTo(W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#7cb342';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = '#5d8a2f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var gx = groundOffset; gx < W; gx += 40) {
      ctx.moveTo(gx, GROUND_Y + 1);
      ctx.lineTo(gx + 14, GROUND_Y + 1);
    }
    ctx.stroke();

    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      if (o.type === 'rock') {
        ctx.fillStyle = '#6b5b4a';
        roundRect(o.x, GROUND_Y - o.h, o.w, o.h, 4);
        ctx.fill();
      } else {
        ctx.fillStyle = '#241f1a';
        ctx.fillRect(o.x, GROUND_Y - 2, o.w, H - GROUND_Y + 2);
      }
    }

    drawExcavator(player.x, player.y, player.w, player.h);

    if (state === 'idle') {
      overlayText(['Tocca o premi SPAZIO per iniziare']);
    } else if (state === 'over') {
      overlayText(['Crepaccio! Punti: ' + Math.floor(score), 'Tocca o premi SPAZIO per ricominciare']);
    }
  }

  function loop() {
    update();
    render();
    if (state === 'playing') {
      rafId = requestAnimationFrame(loop);
    }
  }

  function jump() {
    if (state === 'idle' || state === 'over') {
      state = 'playing';
      resetGame();
      rafId = requestAnimationFrame(loop);
      return;
    }
    if (state === 'playing' && player.onGround) {
      player.vy = -11.5;
      player.onGround = false;
    }
  }

  function onKeyDown(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      jump();
    } else if (e.code === 'Escape') {
      closeModal();
    }
  }

  function openModal() {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    state = 'idle';
    resetGame();
    render();
    closeBtn.focus();
  }

  function closeModal() {
    modal.style.display = 'none';
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeyDown);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    state = 'idle';
    openBtn.focus();
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); jump(); }, { passive: false });
})();
