// ==========================================
// SUPREME SLOTS - LUXURY CASINO ENGINE
// ==========================================

// シンボル定義 (重み・アイコン・名前・配当倍率)
const SYMBOLS = [
  { id: 'seven',   icon: '7️⃣', name: 'SEVEN',   payout: 200, weight: 2 },
  { id: 'diamond', icon: '💎', name: 'DIAMOND', payout: 50,  weight: 4 },
  { id: 'crown',   icon: '👑', name: 'CROWN',   payout: 30,  weight: 6 },
  { id: 'bell',    icon: '🔔', name: 'BELL',    payout: 15,  weight: 10 },
  { id: 'cherry',  icon: '🍒', name: 'CHERRY',  payout: 8,   weight: 16 },
  { id: 'grape',   icon: '🍇', name: 'GRAPE',   payout: 5,   weight: 20 }
];

// 重み付きプール生成
const WEIGHTED_SYMBOLS = [];
SYMBOLS.forEach(sym => {
  for (let i = 0; i < sym.weight; i++) {
    WEIGHTED_SYMBOLS.push(sym);
  }
});

function getRandomSymbol() {
  const idx = Math.floor(Math.random() * WEIGHTED_SYMBOLS.length);
  return WEIGHTED_SYMBOLS[idx];
}

// ゲーム状態管理
let credits = 1000;
let betAmount = 50;
let jackpotPool = 777777;
let lastWin = 0;
let isSpinning = false;
let autoSpin = false;
let autoSpinTimer = null;

// DOM要素の参照
const creditDisplay = document.getElementById('credit-display');
const jackpotDisplay = document.getElementById('jackpot-display');
const winDisplay = document.getElementById('win-display');
const betDisplay = document.getElementById('bet-display');
const announcement = document.getElementById('announcement');
const spinBtn = document.getElementById('spin-btn');
const autoSpinBtn = document.getElementById('auto-spin-btn');
const betMinusBtn = document.getElementById('bet-minus');
const betPlusBtn = document.getElementById('bet-plus');
const betMaxBtn = document.getElementById('bet-max');

// リールDOM
const reels = [
  document.getElementById('reel-0'),
  document.getElementById('reel-1'),
  document.getElementById('reel-2')
];

// リール状態: 現在の表示シンボル [上, 中, 下]
let currentReelState = [
  [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
  [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
  [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
];

// オーディオコンテキスト (Web Audio API)
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// サウンドエフェクトジェネレータ
const SoundFX = {
  spinClick() {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch(e) {}
  },
  reelStop() {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch(e) {}
  },
  winSound() {
    try {
      const ctx = getAudioContext();
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + idx * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.3);
      });
    } catch(e) {}
  },
  jackpotSound() {
    try {
      const ctx = getAudioContext();
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      for (let i = 0; i < 18; i++) {
        const freq = notes[i % notes.length];
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.08);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      }
    } catch(e) {}
  }
};

// UI描画リフレッシュ
function renderReelInitial(reelIdx) {
  const reelEl = reels[reelIdx];
  reelEl.innerHTML = '';
  currentReelState[reelIdx].forEach(sym => {
    const item = document.createElement('div');
    item.className = 'slot-item';
    item.textContent = sym.icon;
    reelEl.appendChild(item);
  });
  reelEl.style.transform = 'translateY(0px)';
}

function updateDisplays() {
  creditDisplay.textContent = Number(credits).toLocaleString();
  jackpotDisplay.textContent = Number(jackpotPool).toLocaleString();
  winDisplay.textContent = Number(lastWin).toLocaleString();
  betDisplay.textContent = betAmount;

  if (credits < betAmount && credits > 0) {
    betAmount = Math.max(10, Math.floor(credits / 10) * 10);
    betDisplay.textContent = betAmount;
  }
}

// 電飾マーキーのアニメーション
const bulbs = document.querySelectorAll('.bulb');
let lightTick = 0;
setInterval(() => {
  lightTick++;
  bulbs.forEach((bulb, idx) => {
    bulb.className = 'bulb';
    const state = (idx + lightTick) % 4;
    if (state === 1) bulb.classList.add('active-1');
    else if (state === 2) bulb.classList.add('active-2');
    else if (state === 3) bulb.classList.add('active-3');
  });
}, 120);

// スピン演出処理
function spin() {
  if (isSpinning) return;

  if (credits < betAmount) {
    announcement.textContent = "INSUFFICIENT CREDITS!";
    announcement.className = "announcement-screen";
    stopAutoSpin();
    return;
  }

  // クレジット消費 & ジャックポットプール増加
  credits -= betAmount;
  jackpotPool += Math.floor(betAmount * 0.15);
  lastWin = 0;
  updateDisplays();

  isSpinning = true;
  spinBtn.disabled = true;
  announcement.textContent = "SPINNING...";
  announcement.className = "announcement-screen";

  // 全てのスロットアイテムからwinningクラスを除去
  document.querySelectorAll('.slot-item').forEach(el => el.classList.remove('winning'));

  // 決定された結果シンボル [3リール分]
  const targetReelState = [
    [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
    [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
    [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
  ];

  // リールごとにアニメーション
  const reelPromises = reels.map((reelEl, idx) => {
    return new Promise(resolve => {
      const spinCount = 18 + idx * 8; // 下に流すシンボル数
      const itemHeight = 80;

      // 現在の3シンボルの下に、大量のランダムシンボル + 最終3シンボルを追加
      const sequence = [...currentReelState[idx]];
      for (let i = 0; i < spinCount; i++) {
        sequence.push(getRandomSymbol());
      }
      sequence.push(...targetReelState[idx]);

      reelEl.innerHTML = '';
      sequence.forEach(sym => {
        const item = document.createElement('div');
        item.className = 'slot-item';
        item.textContent = sym.icon;
        reelEl.appendChild(item);
      });

      const totalDistance = (sequence.length - 3) * itemHeight;
      const duration = 1200 + idx * 500;

      reelEl.style.transition = 'none';
      reelEl.style.transform = 'translateY(0px)';

      // 短時間のサウンド反復
      const soundInterval = setInterval(() => {
        SoundFX.spinClick();
      }, 90);

      // requestAnimationFrame でスムーズに開始
      requestAnimationFrame(() => {
        reelEl.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.8, 0.32, 1)`;
        reelEl.style.transform = `translateY(-${totalDistance}px)`;
      });

      setTimeout(() => {
        clearInterval(soundInterval);
        SoundFX.reelStop();
        currentReelState[idx] = targetReelState[idx];
        renderReelInitial(idx);
        resolve();
      }, duration + 50);
    });
  });

  Promise.all(reelPromises).then(() => {
    isSpinning = false;
    spinBtn.disabled = false;
    evaluateOutcome(targetReelState);
  });
}

// 当たり判定
function evaluateOutcome(finalState) {
  // ペイラインは中央シンボル (index: 1)
  const line = [finalState[0][1], finalState[1][1], finalState[2][1]];

  let winRatio = 0;
  let isJackpot = false;
  let winType = '';

  if (line[0].id === line[1].id && line[1].id === line[2].id) {
    // 3つ揃った
    const sym = line[0];
    if (sym.id === 'seven') {
      isJackpot = true;
      winRatio = 200;
      winType = '★ MEGA JACKPOT 777 ★';
    } else {
      winRatio = sym.payout;
      winType = `★ ${sym.name} MATCH 3 ★`;
    }
  } else if (line[0].id === 'cherry' && line[1].id === 'cherry') {
    // チェリー2つ
    winRatio = 2;
    winType = 'CHERRY PAIR WIN';
  }

  if (winRatio > 0) {
    let winVal = betAmount * winRatio;
    if (isJackpot) {
      winVal += jackpotPool;
      jackpotPool = 100000; // リセット
      triggerJackpotCelebration();
      SoundFX.jackpotSound();
    } else {
      triggerWinCelebration();
      SoundFX.winSound();
    }

    credits += winVal;
    lastWin = winVal;
    updateDisplays();

    announcement.textContent = `${winType}! +${winVal.toLocaleString()} CREDITS!`;
    announcement.className = isJackpot ? "announcement-screen jackpot-text" : "announcement-screen";

    // 中央シンボルにフラッシュ演出
    reels.forEach(r => {
      const items = r.querySelectorAll('.slot-item');
      if (items[1]) items[1].classList.add('winning');
    });
  } else {
    announcement.textContent = "TRY AGAIN! GOOD LUCK!";
    announcement.className = "announcement-screen";
  }

  // オートスピン継続チェック
  if (autoSpin) {
    if (credits >= betAmount) {
      autoSpinTimer = setTimeout(() => {
        if (autoSpin) spin();
      }, 1200);
    } else {
      stopAutoSpin();
      announcement.textContent = "OUT OF CREDITS FOR AUTO SPIN";
    }
  }
}

// オートスピン切り替え
function toggleAutoSpin() {
  if (autoSpin) {
    stopAutoSpin();
  } else {
    autoSpin = true;
    autoSpinBtn.classList.add('active');
    autoSpinBtn.textContent = 'AUTO: ON';
    if (!isSpinning) {
      spin();
    }
  }
}

function stopAutoSpin() {
  autoSpin = false;
  autoSpinBtn.classList.remove('active');
  autoSpinBtn.textContent = 'AUTO: OFF';
  clearTimeout(autoSpinTimer);
}

// イベントリスナー
spinBtn.addEventListener('click', () => {
  getAudioContext();
  spin();
});

autoSpinBtn.addEventListener('click', () => {
  getAudioContext();
  toggleAutoSpin();
});

betMinusBtn.addEventListener('click', () => {
  if (isSpinning) return;
  betAmount = Math.max(10, betAmount - 10);
  updateDisplays();
});

betPlusBtn.addEventListener('click', () => {
  if (isSpinning) return;
  if (betAmount + 10 <= credits) {
    betAmount += 10;
  }
  updateDisplays();
});

betMaxBtn.addEventListener('click', () => {
  if (isSpinning) return;
  betAmount = Math.max(10, Math.min(credits, 500));
  updateDisplays();
});

// キーボードスペースキーでスピン
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    getAudioContext();
    spin();
  }
});

// ==========================================
// パーティクル & 花火キャンバス演出
// ==========================================

// 背景の星・金粉キャンバス
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
let bgParticles = [];

function resizeBgCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBgCanvas);
resizeBgCanvas();

class GoldDust {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * bgCanvas.width;
    this.y = Math.random() * bgCanvas.height;
    this.size = Math.random() * 2.5 + 0.5;
    this.speedY = -(Math.random() * 0.6 + 0.2);
    this.speedX = (Math.random() - 0.5) * 0.4;
    this.alpha = Math.random() * 0.7 + 0.3;
  }
  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    if (this.y < 0) this.y = bgCanvas.height;
    if (this.x < 0) this.x = bgCanvas.width;
    if (this.x > bgCanvas.width) this.x = 0;
  }
  draw() {
    bgCtx.save();
    bgCtx.globalAlpha = this.alpha;
    bgCtx.fillStyle = '#ffd700';
    bgCtx.shadowBlur = 8;
    bgCtx.shadowColor = '#ffaa00';
    bgCtx.beginPath();
    bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    bgCtx.fill();
    bgCtx.restore();
  }
}

for (let i = 0; i < 60; i++) {
  bgParticles.push(new GoldDust());
}

function renderBg() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgParticles.forEach(p => {
    p.update();
    p.draw();
  });
  requestAnimationFrame(renderBg);
}
renderBg();

// 大当たり時の花火・コイン吹雪演出
const fwCanvas = document.getElementById('fireworks-canvas');
const fwCtx = fwCanvas.getContext('2d');
let fwParticles = [];

function resizeFwCanvas() {
  fwCanvas.width = window.innerWidth;
  fwCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeFwCanvas);
resizeFwCanvas();

class FireworksParticle {
  constructor(x, y, color, isCoin = false) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.isCoin = isCoin;
    const angle = Math.random() * Math.PI * 2;
    const speed = isCoin ? (Math.random() * 6 + 2) : (Math.random() * 8 + 3);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - (isCoin ? 5 : 0);
    this.alpha = 1;
    this.decay = Math.random() * 0.015 + 0.01;
    this.gravity = 0.2;
    this.size = isCoin ? Math.random() * 7 + 5 : Math.random() * 4 + 2;
    this.rotation = 0;
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
  }
  update() {
    this.vx *= 0.98;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
    this.rotation += this.rotSpeed;
  }
  draw() {
    fwCtx.save();
    fwCtx.globalAlpha = Math.max(0, this.alpha);
    if (this.isCoin) {
      fwCtx.translate(this.x, this.y);
      fwCtx.rotate(this.rotation);
      fwCtx.fillStyle = '#ffd700';
      fwCtx.shadowBlur = 10;
      fwCtx.shadowColor = '#fff';
      fwCtx.beginPath();
      fwCtx.arc(0, 0, this.size, 0, Math.PI * 2);
      fwCtx.fill();
      fwCtx.fillStyle = '#cc8800';
      fwCtx.beginPath();
      fwCtx.arc(0, 0, this.size * 0.65, 0, Math.PI * 2);
      fwCtx.fill();
    } else {
      fwCtx.fillStyle = this.color;
      fwCtx.shadowBlur = 12;
      fwCtx.shadowColor = this.color;
      fwCtx.beginPath();
      fwCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      fwCtx.fill();
    }
    fwCtx.restore();
  }
}

function triggerWinCelebration() {
  const colors = ['#ffd700', '#ff3366', '#00e5ff', '#fff', '#ff9900'];
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight * 0.45;
  for (let i = 0; i < 90; i++) {
    const col = colors[Math.floor(Math.random() * colors.length)];
    fwParticles.push(new FireworksParticle(centerX, centerY, col, Math.random() < 0.4));
  }
}

function triggerJackpotCelebration() {
  const colors = ['#ffd700', '#ff0055', '#ffea00', '#ffffff', '#ff00e1', '#00f6ff'];
  let burstCount = 0;
  const interval = setInterval(() => {
    const burstX = Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1;
    const burstY = Math.random() * window.innerHeight * 0.5 + window.innerHeight * 0.15;
    for (let i = 0; i < 70; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      fwParticles.push(new FireworksParticle(burstX, burstY, col, Math.random() < 0.6));
    }
    burstCount++;
    if (burstCount > 8) clearInterval(interval);
  }, 220);
}

function renderFireworks() {
  fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
  for (let i = fwParticles.length - 1; i >= 0; i--) {
    const p = fwParticles[i];
    p.update();
    p.draw();
    if (p.alpha <= 0 || p.y > fwCanvas.height + 50) {
      fwParticles.splice(i, 1);
    }
  }
  requestAnimationFrame(renderFireworks);
}
renderFireworks();

// 初期化処理
for (let i = 0; i < 3; i++) {
  renderReelInitial(i);
}
updateDisplays();
