// =====================
// PIRATE VR — CAÇA AO TESOURO
// main.js
// =====================

// =====================
// SELETORES DOM
// =====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const introScreen   = $('#intro-screen');
const victoryScreen = $('#victory-screen');
const hud           = $('#hud');
const scoreEl       = $('#score');
const messageBox    = $('#message-box');
const startBtn      = $('#start-btn');
const restartBtn    = $('#restart-btn');
const vrHint        = $('#vr-hint');

// =====================
// ESTADO DO JOGO
// =====================
const TOTAL_CHESTS = 5;

let gameState = {
  started: false,
  found: 0,
  opened: new Set(), // índices dos baús já abertos
};

// Mensagens ao encontrar cada baú
const CHEST_MESSAGES = [
  '💰 Ouro encontrado! O Capitão ficará furioso!',
  '💎 Jóias preciosas! Escondidas há 300 anos!',
  '🗡️ A espada do Barbanegra! Incrível!',
  '🦜 Uma pena rara… e moedas de ouro!',
  '👑 A COROA DO REI DOS PIRATAS! É tua!',
];

// =====================
// COMPONENTES A-FRAME PERSONALIZADOS
// =====================

/**
 * Componente: chest-interaction
 * Regista eventos de gaze/click num baú de tesouro
 */
AFRAME.registerComponent('chest-interaction', {
  init() {
    const el = this.el;

    // Obtém índice do baú pelo atributo do pai
    const parentEntity = el.closest('[data-index]') || el.parentElement;
    const chestIndex = parseInt(parentEntity?.dataset?.index ?? el.dataset?.index ?? '0');

    el.addEventListener('click', () => {
      if (!gameState.started) return;
      if (gameState.opened.has(chestIndex)) return;
      openChest(parentEntity || el, chestIndex);
    });

    // Feedback visual ao entrar no raycaster
    el.addEventListener('mouseenter', () => {
      if (!gameState.started) return;
      if (gameState.opened.has(chestIndex)) return;
      highlightChest(parentEntity || el, true);
    });

    el.addEventListener('mouseleave', () => {
      highlightChest(parentEntity || el, false);
    });
  }
});

/**
 * Componente: ambient-float
 * Faz um objeto flutuar suavemente (para partículas e detalhes)
 */
AFRAME.registerComponent('ambient-float', {
  schema: {
    speed:     { type: 'number', default: 1 },
    amplitude: { type: 'number', default: 0.15 },
    offset:    { type: 'number', default: 0 },
  },
  init() {
    this._baseY = this.el.object3D.position.y;
    this._t = this.data.offset;
  },
  tick(time, delta) {
    this._t += (delta / 1000) * this.data.speed;
    this.el.object3D.position.y = this._baseY + Math.sin(this._t) * this.data.amplitude;
  }
});

/**
 * Componente: wave-motion
 * Simula movimento de ondas no navio
 */
AFRAME.registerComponent('wave-motion', {
  schema: { speed: { type: 'number', default: 0.5 } },
  init() {
    this._basePos = { ...this.el.object3D.position };
    this._t = 0;
  },
  tick(time, delta) {
    this._t += (delta / 1000) * this.data.speed;
    this.el.object3D.position.y = this._basePos.y + Math.sin(this._t) * 0.8;
    this.el.object3D.rotation.z = Math.sin(this._t * 0.7) * 0.04;
  }
});

/**
 * Componente: gaze-teleport
 * Move o `#rig` para a posição onde o usuário fixa o olhar (fuse/click) — ideal para Cardboard.
 */
AFRAME.registerComponent('gaze-teleport', {
  schema: {
    height: { type: 'number', default: 1.6 },
    fuseTimeout: { type: 'number', default: 1500 }
  },
  init() {
    const el = this.el;
    el.addEventListener('click', (evt) => {
      // preferência: usar a interseção fornecida pelo evento
      let point = null;
      if (evt && evt.detail && evt.detail.intersection && evt.detail.intersection.point) {
        point = evt.detail.intersection.point;
      } else {
        // fallback: elemento position
        const pos = el.getAttribute('position');
        if (pos) point = new AFRAME.THREE.Vector3(pos.x || pos[0] || 0, pos.y || pos[1] || 0, pos.z || pos[2] || 0);
      }
      if (!point) return;

      const rig = document.querySelector('#rig');
      if (!rig) return;

      const targetY = this.data.height;
      rig.setAttribute('position', `${point.x.toFixed(3)} ${targetY} ${point.z.toFixed(3)}`);
      // feedback
      const msg = '✨ Teletransportado!';
      if (typeof showMessage === 'function') showMessage(msg, 2200);
    });
  }
});

/**
 * Componente: teleport-marker
 * Efeito visual para pontos de teletransporte: pulsa e destaca ao ser apontado.
 */
AFRAME.registerComponent('teleport-marker', {
  schema: {
    color: { type: 'color', default: '#FFD700' },
    radiusInner: { type: 'number', default: 0.4 },
    radiusOuter: { type: 'number', default: 0.7 }
  },
  init() {
    const el = this.el;
    // cria ring central
    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', this.data.radiusInner);
    ring.setAttribute('radius-outer', this.data.radiusOuter);
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('color', this.data.color);
    ring.setAttribute('material', 'shader: flat; opacity: 0.85; side: double');
    ring.setAttribute('class', 'teleport-ring');
    el.appendChild(ring);

    // small marker cylinder for depth cue
    const cyl = document.createElement('a-cylinder');
    cyl.setAttribute('radius', '0.05');
    cyl.setAttribute('height', '0.02');
    cyl.setAttribute('rotation', '0 0 0');
    cyl.setAttribute('color', '#FFD700');
    cyl.setAttribute('position', `0 0.01 0`);
    el.appendChild(cyl);

    el.classList.add('teleportable');
    el.setAttribute('gaze-teleport', '');
    el.setAttribute('visible', 'true');

    el.addEventListener('mouseenter', () => {
      ring.setAttribute('animation__pulse', 'property: scale; to: 1.25 1.25 1; dur: 300; easing: easeOutCubic; dir: alternate; loop: 1');
    });
    el.addEventListener('mouseleave', () => {
      ring.removeAttribute('animation__pulse');
      ring.setAttribute('scale', '1 1 1');
    });
  }
});

// =====================
// INICIALIZAÇÃO
// =====================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  detectMobile();
  initSceneMovementHandlers();
});

function setupEventListeners() {
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', restartGame);
}

function detectMobile() {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobile) {
    vrHint.classList.remove('hidden');
    setTimeout(() => vrHint.classList.add('hidden'), 5000);
  }
}

// =====================
// INÍCIO DO JOGO
// =====================
function startGame() {
  try { getAudioCtx(); } catch (e) { /* ignore */ }
  // Esconde intro com fade out
  introScreen.style.animation = 'fadeOut 0.5s ease forwards';
  setTimeout(() => {
    introScreen.classList.add('hidden');
    hud.style.display = 'block';
    gameState.started = true;
    initChestInteractions();
    addWaveMotion();
    showMessage('⚓ A caça ao tesouro começou! Procura os 5 baús…', 3500);
    spawnAmbientParticles();
    // Tenta entrar em VR (split-screen/cardboard) após gesto do usuário
    try {
      const scene = document.querySelector('a-scene');
      if (scene && typeof scene.enterVR === 'function') {
        scene.enterVR();
      }
    } catch (e) {
      // ignorar se não for suportado
    }
  }, 500);
}

function restartGame() {
  // Repõe estado
  gameState.found = 0;
  gameState.opened.clear();

  // Esconde vitória
  victoryScreen.classList.add('hidden');
  victoryScreen.style.animation = '';

  // Restaura todos os baús
  $$('.treasure-chest').forEach((chest) => {
    chest.setAttribute('visible', 'true');
    chest.setAttribute('scale', '1 1 1');
    chest.style.opacity = '1';
  });

  // Atualiza HUD
  updateScore();
  showMessage('🔄 Nova expedição iniciada! Boa sorte, pirata!', 3000);
}

// =====================
// INTERAÇÕES COM BAÚS
// =====================
function initChestInteractions() {
  $$('.gaze-target').forEach((target) => {
    target.setAttribute('chest-interaction', '');
  });
}

function highlightChest(chestEl, active) {
  const glow = chestEl.querySelector('a-sphere');
  if (!glow) return;
  if (active) {
    glow.setAttribute('material', 'emissive: #FFD700; emissiveIntensity: 1.5; opacity: 0.9; transparent: true');
    glow.setAttribute('scale', '1.5 1.5 1.5');
  } else {
    glow.setAttribute('material', 'emissive: #FFD700; emissiveIntensity: 0.6; opacity: 0.6; transparent: true');
    glow.setAttribute('scale', '1 1 1');
  }
}

function openChest(chestEl, index) {
  if (gameState.opened.has(index)) return;
  gameState.opened.add(index);
  gameState.found++;

  // Animação de abertura — sobe e some
  chestEl.setAttribute('animation', 'property: position; to: ' +
    chestEl.getAttribute('position').x + ' 3 ' +
    chestEl.getAttribute('position').z +
    '; dur: 800; easing: easeOutCubic');

  chestEl.setAttribute('animation__fade', 'property: scale; to: 0 0 0; dur: 800; delay: 400; easing: easeInCubic');

  // Cria explosão de moedas
  createCoinBurst(chestEl);

  // Mensagem
  const msg = CHEST_MESSAGES[index] ?? '💰 Tesouro encontrado!';
  showMessage(msg, 3500);

  // Som (Web Audio API procedural)
  playCoinSound();

  // Atualiza HUD
  updateScore();

  // Verifica vitória
  setTimeout(() => {
    if (gameState.found >= TOTAL_CHESTS) {
      triggerVictory();
    }
  }, 1200);
}

// =====================
// EFEITO DE MOEDAS
// =====================
function createCoinBurst(chestEl) {
  const scene = $('a-scene');
  const pos = chestEl.getAttribute('position');
  const baseX = parseFloat(pos.x);
  const baseY = parseFloat(pos.y) + 1;
  const baseZ = parseFloat(pos.z);

  for (let i = 0; i < 12; i++) {
    const coin = document.createElement('a-cylinder');
    coin.setAttribute('color', '#FFD700');
    coin.setAttribute('radius', '0.12');
    coin.setAttribute('height', '0.04');
    coin.setAttribute('material', 'emissive: #FFD700; emissiveIntensity: 0.8; metalness: 0.8; roughness: 0.2');

    const angle = (i / 12) * Math.PI * 2;
    const dist  = 0.5 + Math.random() * 1.5;
    const tx    = baseX + Math.cos(angle) * dist;
    const tz    = baseZ + Math.sin(angle) * dist;
    const ty    = baseY + 1 + Math.random() * 1.5;

    coin.setAttribute('position', `${baseX} ${baseY} ${baseZ}`);
    coin.setAttribute('rotation', `${Math.random()*360} ${Math.random()*360} ${Math.random()*360}`);

    // Animação de voo
    coin.setAttribute('animation__fly', `property: position; to: ${tx} ${ty} ${tz}; dur: 600; easing: easeOutCubic`);
    coin.setAttribute('animation__fall', `property: position; to: ${tx} 0.2 ${tz}; dur: 500; delay: 600; easing: easeInCubic`);
    coin.setAttribute('animation__fade', 'property: material.opacity; to: 0; dur: 400; delay: 900; easing: easeInQuad');

    scene.appendChild(coin);

    // Remove após animação
    setTimeout(() => {
      if (coin.parentNode) coin.parentNode.removeChild(coin);
    }, 1400);
  }
}

// =====================
// PARTÍCULAS AMBIENTE
// =====================
function spawnAmbientParticles() {
  const scene  = $('a-scene');
  const parent = $('#particles');

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('a-sphere');
    const x = (Math.random() - 0.5) * 80;
    const y = 0.5 + Math.random() * 4;
    const z = (Math.random() - 0.5) * 80;

    particle.setAttribute('radius', (0.02 + Math.random() * 0.06).toString());
    particle.setAttribute('position', `${x} ${y} ${z}`);
    particle.setAttribute('material', `
      color: #FFD700;
      emissive: #FF9900;
      emissiveIntensity: ${0.3 + Math.random() * 0.4};
      opacity: ${0.2 + Math.random() * 0.4};
      transparent: true;
      shader: flat
    `);
    particle.setAttribute('ambient-float', `speed: ${0.4 + Math.random() * 0.8}; amplitude: ${0.1 + Math.random() * 0.25}; offset: ${Math.random() * 6.28}`);

    parent.appendChild(particle);
  }
}

// =====================
// WAVE MOTION NO NAVIO
// =====================
function addWaveMotion() {
  const ship = $('#ship');
  if (ship) ship.setAttribute('wave-motion', 'speed: 0.6');
}

// =====================
// SOM PROCEDURAL (Web Audio API)
// =====================
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume se suspenso (política autoplay)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playCoinSound() {
  try {
    const ctx = getAudioCtx();

    // Sequência de tons metálicos
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc   = ctx.createOscillator();
      const gain  = ctx.createGain();
      const start = ctx.currentTime + i * 0.08;

      osc.type      = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, start + 0.15);

      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch (e) {
    // Silencia erros de áudio
  }
}

function playVictorySound() {
  try {
    const ctx = getAudioCtx();

    // Fanfarra pirata simplificada
    const melody = [
      { freq: 523,  dur: 0.15 },
      { freq: 659,  dur: 0.15 },
      { freq: 784,  dur: 0.15 },
      { freq: 1047, dur: 0.35 },
      { freq: 784,  dur: 0.15 },
      { freq: 1047, dur: 0.6  },
    ];

    let t = ctx.currentTime + 0.05;
    melody.forEach(({ freq, dur }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.setValueAtTime(0.2, t + dur - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  } catch (e) {
    // Silencia
  }
}

// =====================
// HUD — PONTUAÇÃO
// =====================
function updateScore() {
  if (scoreEl) {
    scoreEl.textContent = `${gameState.found} / ${TOTAL_CHESTS}`;
  }
}

// =====================
// MENSAGENS CONTEXTUAIS
// =====================
let _messageTimer = null;

function showMessage(text, duration = 3000) {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.classList.remove('hidden');
  messageBox.style.animation = 'none';
  // Força reflow para reiniciar animação
  void messageBox.offsetWidth;
  messageBox.style.animation = 'fadeInUp 0.4s ease';

  if (_messageTimer) clearTimeout(_messageTimer);
  _messageTimer = setTimeout(() => {
    messageBox.classList.add('hidden');
  }, duration);
}

// =====================
// VITÓRIA
// =====================
function triggerVictory() {
  gameState.started = false;
  playVictorySound();

  setTimeout(() => {
    victoryScreen.classList.remove('hidden');
    victoryScreen.style.animation = 'fadeIn 0.8s ease';
  }, 600);
}

// =====================
// MOVIMENTO WASD / TOUCH ALTERNATIVO
// =====================
// Garante que o rig de câmara recebe movimento correto em mobile
function initSceneMovementHandlers() {
  const scene = $('a-scene');
  if (!scene) return;

  scene.addEventListener('loaded', () => {
    const rig = $('#rig');
    if (!rig) return;

    // Keyboard WASD (desktop)
    const keys = { w: false, a: false, s: false, d: false };
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) keys[k] = true;
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) keys[k] = false;
    });

    // Tick de movimento manual (complementa wasd-controls do A-Frame)
    // Não anula o sistema nativo; apenas serve como fallback
  });
}

// =====================
// TOUCH SWIPE PARA AVANÇAR (mobile sem Cardboard)
// =====================
(function setupTouchMove() {
  let touchStartX = null;
  let touchStartY = null;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // Swipe rápido curto = tap (ignorar)
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      touchStartX = null;
      touchStartY = null;
      return;
    }
    touchStartX = null;
    touchStartY = null;
  }, { passive: true });
})();
