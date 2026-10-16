// Dialogue portraits for the four speakers (the narrator has none): hand-drawn canvas paintings, registered with
// ctx.dialogue.registerSpeaker(who, { portrait }). Dialogue draws a portrait once per speaker change into a 156 px
// canvas shown as a 78 px circle; each painter then keeps its own canvas alive (a cheap 12 fps timer, only while the
// canvas is in the page): the mouth moves while the dialog box has the cn-talk class, and the eyes blink.
//   lavinia      an oval painted portrait in a gilt frame, gold and lilac
//   lavinia_off  the same frame, a dark silhouette behind a door, a lilac glow under it
//   pike         a square sepia photograph: bowler, moustache, waistcoat
//   cat          round: a grey tabby with a white bib, amber eyes, a notched left ear
const TAU = Math.PI * 2;

/** Wrap a painter `(g, state)` (drawn in a 100×100 space) into a self-animating Dialogue portrait function. */
function animated(draw) {
  return (g, size = 156) => {
    const cv = g.canvas;
    const st = { mouth: 0, blink: 0, t: 0, talk: false };
    const render = () => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.save(); g.scale(size / 100, size / 100);
      draw(g, st);
      g.restore();
    };
    render();
    let born = performance.now(), nextBlink = born + 1500 + Math.random() * 2500, blinkUntil = 0, lastKey = '';
    const tick = () => {
      const now = performance.now();
      if (!cv.isConnected) { if (now - born > 3000) return; setTimeout(tick, 120); return; }
      born = now;
      if (cv.closest('.cn-hidden')) { setTimeout(tick, 250); return; }
      const talk = !!cv.parentElement?.classList.contains('cn-talk');
      st.t = now / 1000;
      st.talk = talk;
      st.mouth = talk ? 0.5 + 0.5 * Math.sin(st.t * 15) * Math.sin(st.t * 4.3 + 1) : 0;
      if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 2500 + Math.random() * 3500; }
      st.blink = now < blinkUntil ? 1 : 0;
      const key = `${Math.round(st.mouth * 4)}|${st.blink}|${talk ? Math.floor(st.t * 2) % 2 : 0}`;
      if (key !== lastKey) { lastKey = key; render(); }
      setTimeout(tick, 80);
    };
    setTimeout(tick, 80);
  };
}

const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); };
function grad(g, x, y, r0, r1, stops) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
function lin(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

// ---- Lavinia --------------------------------------------------------------------------------------------------

function gilt(g, dark = false) {
  // an oval gilt frame just inside the circle
  g.lineWidth = 7;
  g.strokeStyle = lin(g, 0, 0, 100, 100, dark
    ? [[0, '#6a5426'], [0.5, '#3a2c14'], [1, '#5a4620']]
    : [[0, '#f6dc8a'], [0.35, '#b58a32'], [0.6, '#f0d07a'], [1, '#8a6222']]);
  ell(g, 50, 50, 41, 46); g.stroke();
  g.lineWidth = 1.2; g.strokeStyle = dark ? 'rgba(255,220,160,0.15)' : 'rgba(255,240,190,0.7)';
  ell(g, 50, 50, 37.5, 42.5); g.stroke();
  g.strokeStyle = dark ? 'rgba(0,0,0,0.4)' : 'rgba(90,60,20,0.6)'; ell(g, 50, 50, 44.6, 49.6); g.stroke();
  // beading on the frame
  g.fillStyle = dark ? 'rgba(200,170,110,0.25)' : '#ffe9a8';
  for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; g.beginPath(); g.arc(50 + Math.cos(a) * 41, 50 + Math.sin(a) * 46, 0.9, 0, TAU); g.fill(); }
}

function laviniaBust(g, st, { silhouette = false } = {}) {
  const S = silhouette;
  const fill = (c) => { g.fillStyle = S ? '#120a18' : c; };
  // gown + shoulders
  fill('#a898bc');
  g.beginPath(); g.moveTo(12, 100); g.bezierCurveTo(14, 82, 26, 76, 38, 74); g.lineTo(62, 74); g.bezierCurveTo(74, 76, 86, 82, 88, 100); g.closePath(); g.fill();
  if (!S) {
    // skin of the shoulders and décolletage
    g.fillStyle = '#f4e2da';
    g.beginPath(); g.moveTo(26, 79); g.bezierCurveTo(34, 72, 42, 70, 50, 70); g.bezierCurveTo(58, 70, 66, 72, 74, 79); g.bezierCurveTo(64, 86, 56, 88, 50, 90); g.bezierCurveTo(44, 88, 36, 86, 26, 79); g.fill();
    // lace bertha
    g.fillStyle = '#f5eee2';
    g.beginPath(); g.moveTo(20, 84);
    for (let x = 20; x <= 80; x += 5) g.quadraticCurveTo(x + 2.5, x < 50 ? 92 - (x - 20) * 0.15 : 92 - (80 - x) * 0.15, x + 5, 86 + Math.abs(x - 50) * -0.06);
    g.lineTo(80, 82); g.bezierCurveTo(66, 88, 58, 91, 50, 92); g.bezierCurveTo(42, 91, 34, 88, 20, 82); g.fill();
    g.fillStyle = '#e2c06a'; g.fillRect(36, 95, 28, 1.6);
    // pearls (a U from the neck)
    g.fillStyle = '#fbf6fb';
    for (let i = 0; i <= 18; i++) { const a = Math.PI * (i / 18); g.beginPath(); g.arc(50 - Math.cos(a) * 9, 66 + Math.sin(a) * 15, 1.25, 0, TAU); g.fill(); }
    // neck
    g.fillStyle = '#f2dfd6'; g.fillRect(44.5, 56, 11, 16);
    g.fillStyle = 'rgba(190,140,150,0.35)'; g.fillRect(44.5, 58, 11, 3);
  } else {
    fill(); g.fillRect(44.5, 56, 11, 16);
  }
  // hair behind (bun, big pompadour)
  fill('#9a4628');
  ell(g, 50, 26, 21, 15); g.fill();
  ell(g, 50, 15, 11, 7); g.fill();
  // face
  if (!S) { g.fillStyle = grad(g, 48, 44, 2, 18, [[0, '#fbece6'], [1, '#ecd2c8']]); }
  g.beginPath(); g.moveTo(37, 38); g.bezierCurveTo(37, 52, 43, 61, 50, 62); g.bezierCurveTo(57, 61, 63, 52, 63, 38); g.bezierCurveTo(63, 28, 37, 28, 37, 38); g.fill();
  // pompadour roll over the brow
  fill('#a5502e');
  g.beginPath(); g.moveTo(33, 40); g.bezierCurveTo(28, 22, 44, 16, 50, 21); g.bezierCurveTo(56, 16, 72, 22, 67, 40); g.bezierCurveTo(64, 32, 58, 30, 50, 31); g.bezierCurveTo(42, 30, 36, 32, 33, 40); g.fill();
  if (!S) {
    g.strokeStyle = 'rgba(80,30,15,0.5)'; g.lineWidth = 0.8;
    for (const k of [-1, 1]) for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(50 + k * (2 + i * 3.5), 23 + i); g.quadraticCurveTo(50 + k * (8 + i * 4), 26 + i, 50 + k * (13 + i * 1.8), 34 + i * 1.2); g.stroke(); }
    // gold band and jewel
    g.strokeStyle = '#e2bf62'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(36, 25); g.quadraticCurveTo(50, 17, 64, 24); g.stroke();
    g.fillStyle = '#e2bf62'; ell(g, 60, 21.5, 2.6, 3.2); g.fill(); g.fillStyle = '#b58ae0'; ell(g, 60, 21.5, 1.4, 1.9); g.fill();
  }
  // aigrette (white feathers) from the jewel: always drawn, it glows even in silhouette
  g.strokeStyle = S ? 'rgba(200,170,240,0.35)' : '#fffaff'; g.lineWidth = 0.9; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = -0.75 + i * 0.12;
    g.beginPath(); g.moveTo(60, 20);
    g.quadraticCurveTo(60 + Math.sin(a) * 8, 20 - 8, 60 + Math.sin(a) * 16 + 3, 20 - 17 + Math.abs(i - 3) * 1.4);
    g.stroke();
  }
  if (S) return;
  // eyes
  const eyeY = 43;
  for (const s of [-1, 1]) {
    const x = 50 + s * 6.3;
    g.fillStyle = 'rgba(150,110,200,0.45)'; ell(g, x, eyeY - 1.6, 3.6, 2.2); g.fill();
    if (st.blink) {
      g.strokeStyle = '#4a2030'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - 3, eyeY); g.quadraticCurveTo(x, eyeY + 1.4, x + 3, eyeY); g.stroke();
    } else {
      g.fillStyle = '#fbf8fc'; ell(g, x, eyeY, 3, 1.75); g.fill();
      g.fillStyle = '#5a4474'; ell(g, x + 0.3, eyeY, 1.45, 1.6); g.fill();
      g.fillStyle = '#1a0e1e'; ell(g, x + 0.3, eyeY, 0.7, 0.8); g.fill();
      g.fillStyle = '#fff'; ell(g, x + 0.8, eyeY - 0.6, 0.35, 0.35); g.fill();
      g.strokeStyle = '#3a1a24'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 3.2, eyeY - 0.2); g.quadraticCurveTo(x, eyeY - 2.4, x + 3.3, eyeY - 0.4); g.stroke();
    }
    // brows: a little arched, a little tragic
    g.strokeStyle = '#6a3220'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - 3.4 * s * -1 - (s > 0 ? 0 : 0), eyeY - 4); g.quadraticCurveTo(x, eyeY - 6.2, x + 3.4 * s, eyeY - 4.6); g.stroke();
  }
  // nose
  g.strokeStyle = 'rgba(170,110,100,0.6)'; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(50.5, 45); g.quadraticCurveTo(52, 50, 50.2, 51); g.stroke();
  // rouge
  g.fillStyle = 'rgba(240,130,150,0.28)'; ell(g, 42, 50, 3.4, 2.4); g.fill(); ell(g, 58, 50, 3.4, 2.4); g.fill();
  // mouth
  const m = st.mouth;
  g.fillStyle = '#c4566a';
  if (m > 0.08) {
    g.fillStyle = '#4a1a2a'; ell(g, 50, 55.4 + m * 0.5, 2.6, 0.6 + m * 1.6); g.fill();
    g.fillStyle = '#c4566a';
    g.beginPath(); g.moveTo(46.6, 55); g.quadraticCurveTo(48.5, 53.4, 50, 54.4); g.quadraticCurveTo(51.5, 53.4, 53.4, 55); g.quadraticCurveTo(50, 55.2, 46.6, 55); g.fill();
    g.beginPath(); g.moveTo(47.2, 56 + m * 2); g.quadraticCurveTo(50, 58.4 + m * 2, 52.8, 56 + m * 2); g.quadraticCurveTo(50, 56.6 + m * 2, 47.2, 56 + m * 2); g.fill();
  } else {
    g.beginPath(); g.moveTo(46.6, 55.3); g.quadraticCurveTo(48.5, 53.6, 50, 54.6); g.quadraticCurveTo(51.5, 53.6, 53.4, 55.3); g.quadraticCurveTo(50, 58.2, 46.6, 55.3); g.fill();
    g.strokeStyle = '#7a2a3a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(46.8, 55.3); g.quadraticCurveTo(50, 56.1, 53.2, 55.3); g.stroke();
  }
  // a pearl earring
  g.fillStyle = '#fbf6fb'; ell(g, 63.3, 50, 1.1, 1.4); g.fill(); ell(g, 36.7, 50, 1.1, 1.4); g.fill();
}

const laviniaPortrait = animated((g, st) => {
  // ground: plum to gold, the painting glowing from within
  g.fillStyle = grad(g, 50, 42, 4, 70, [[0, '#f3d79a'], [0.35, '#b590d0'], [0.75, '#4a2c62'], [1, '#22142e']]);
  g.fillRect(0, 0, 100, 100);
  g.save(); ell(g, 50, 50, 39, 44); g.clip();
  g.fillStyle = grad(g, 50, 40, 2, 48, [[0, 'rgba(255,236,190,0.85)'], [0.5, 'rgba(190,150,225,0.6)'], [1, 'rgba(60,34,84,0.9)']]);
  g.fillRect(0, 0, 100, 100);
  laviniaBust(g, st);
  // varnish glow
  g.fillStyle = grad(g, 40, 30, 0, 40, [[0, 'rgba(255,250,230,0.18)'], [1, 'rgba(255,250,230,0)']]); g.fillRect(0, 0, 100, 100);
  g.restore();
  gilt(g);
});

const laviniaOffPortrait = animated((g, st) => {
  // a dark door: panels, and a lilac glow under it (brighter while she speaks)
  g.fillStyle = '#140d18'; g.fillRect(0, 0, 100, 100);
  g.save(); ell(g, 50, 50, 39, 44); g.clip();
  g.fillStyle = lin(g, 0, 0, 0, 100, [[0, '#2a1c2a'], [1, '#1a1018']]); g.fillRect(0, 0, 100, 100);
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4;
  g.strokeRect(24, 10, 52, 32); g.strokeRect(24, 48, 52, 36);
  g.strokeStyle = 'rgba(255,220,240,0.06)'; g.strokeRect(25, 11, 50, 30); g.strokeRect(25, 49, 50, 34);
  const pulse = st.talk ? 0.75 + 0.25 * st.mouth : 0.6;
  // the silhouette, seen as if through the door
  g.globalAlpha = 0.55;
  g.save(); g.translate(50, 54); g.scale(0.8, 0.8); g.translate(-50, -50); laviniaBust(g, st, { silhouette: true }); g.restore();
  g.globalAlpha = 1;
  g.fillStyle = grad(g, 50, 96, 0, 40, [[0, `rgba(200,160,255,${0.75 * pulse})`], [0.4, `rgba(150,110,220,${0.25 * pulse})`], [1, 'rgba(80,50,120,0)']]);
  g.fillRect(0, 50, 100, 50);
  g.fillStyle = `rgba(230,210,255,${0.9 * pulse})`; g.fillRect(14, 90, 72, 1.6);
  g.restore();
  gilt(g, true);
});

// ---- Pike -----------------------------------------------------------------------------------------------------

const pikePortrait = animated((g, st) => {
  g.fillStyle = '#2a2018'; g.fillRect(0, 0, 100, 100);
  // the photograph: a square card, slightly turned
  g.save(); g.translate(50, 50); g.rotate(-0.04); g.translate(-50, -50);
  g.fillStyle = '#e8dcc0'; g.fillRect(9, 9, 82, 82);
  g.save(); g.beginPath(); g.rect(13, 13, 74, 74); g.clip();
  g.fillStyle = grad(g, 50, 42, 5, 60, [[0, '#d8c39a'], [0.7, '#a88c62'], [1, '#6a5438']]); g.fillRect(0, 0, 100, 100);
  // waistcoat and shirt
  g.fillStyle = '#efe3c8';
  g.beginPath(); g.moveTo(18, 100); g.bezierCurveTo(20, 80, 30, 74, 40, 72); g.lineTo(60, 72); g.bezierCurveTo(70, 74, 80, 80, 82, 100); g.fill();
  g.fillStyle = '#6a4a2e';
  g.beginPath(); g.moveTo(30, 100); g.lineTo(32, 78); g.lineTo(44, 74); g.lineTo(50, 92); g.lineTo(56, 74); g.lineTo(68, 78); g.lineTo(70, 100); g.fill();
  g.fillStyle = '#d8c08a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(52.5 - i * 0.6, 93 + i * 3, 0.9, 0, TAU); g.fill(); }
  // watch chain
  g.strokeStyle = '#e0cc90'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(40, 92); g.quadraticCurveTo(46, 97, 52, 94); g.stroke();
  // collarless shirt band and neck
  g.fillStyle = '#c9ae86'; g.fillRect(44, 60, 12, 14);
  g.fillStyle = '#f2e8d2'; g.fillRect(42.5, 70, 15, 3.4);
  // face
  g.fillStyle = grad(g, 49, 48, 2, 16, [[0, '#e2cba2'], [1, '#bfa47a']]);
  g.beginPath(); g.moveTo(38, 42); g.bezierCurveTo(37, 56, 43, 64, 50, 64); g.bezierCurveTo(57, 64, 63, 56, 62, 42); g.bezierCurveTo(62, 34, 38, 34, 38, 42); g.fill();
  // ears
  g.fillStyle = '#c8ad84'; ell(g, 37.4, 47, 2.4, 4); g.fill(); ell(g, 62.6, 47, 2.4, 4); g.fill();
  // pencil behind the right ear (viewer's left)
  g.strokeStyle = '#8a6a2a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(31, 46); g.lineTo(41, 37); g.stroke();
  g.strokeStyle = '#3a2a18'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(31, 46); g.lineTo(32.4, 44.8); g.stroke();
  // eyes (deep set, patient)
  for (const s of [-1, 1]) {
    const x = 50 + s * 6;
    g.fillStyle = 'rgba(90,70,50,0.35)'; ell(g, x, 46, 3.6, 2); g.fill();
    if (st.blink) { g.strokeStyle = '#3a2a1a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 2.4, 46.4); g.lineTo(x + 2.4, 46.4); g.stroke(); }
    else { g.fillStyle = '#f0e6d0'; ell(g, x, 46.4, 2.3, 1.3); g.fill(); g.fillStyle = '#2a2018'; ell(g, x, 46.5, 1.05, 1.15); g.fill(); }
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x - 3, 42.6 + (s > 0 ? 0.3 : 0)); g.lineTo(x + 3, 42.4 + (s > 0 ? 0 : 0.3)); g.stroke();
  }
  // nose
  g.strokeStyle = 'rgba(110,80,50,0.7)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(50, 47); g.quadraticCurveTo(52.4, 53, 50, 54); g.stroke();
  // mouth under the moustache
  const m = st.mouth;
  g.fillStyle = '#4a3020'; ell(g, 50, 58.6 + m * 0.4, 2.4, 0.4 + m * 1.2); g.fill();
  // moustache (bobs as he talks)
  g.fillStyle = '#4a3624';
  const my = 55.6 - m * 0.5;
  g.beginPath(); g.moveTo(50, my - 0.6); g.bezierCurveTo(46, my - 2, 42, my - 0.4, 40.5, my + 2.2); g.bezierCurveTo(44, my + 1.4, 47, my + 1.6, 50, my + 1);
  g.bezierCurveTo(53, my + 1.6, 56, my + 1.4, 59.5, my + 2.2); g.bezierCurveTo(58, my - 0.4, 54, my - 2, 50, my - 0.6); g.fill();
  // bowler
  g.fillStyle = '#2e241a';
  g.beginPath(); g.ellipse(50, 36, 20, 3.6, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(36, 36); g.bezierCurveTo(35, 18, 65, 18, 64, 36); g.fill();
  g.fillStyle = '#1e1810'; g.fillRect(36.4, 32.4, 27.2, 3);
  g.fillStyle = 'rgba(255,240,210,0.16)'; ell(g, 45, 24, 5, 2.4, -0.4); g.fill();
  g.restore();
  // grain and vignette
  let s = 9;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,28,14,0.18)' : 'rgba(255,245,220,0.15)'; g.fillRect(13 + r() * 74, 13 + r() * 74, 0.7, 0.7); }
  g.fillStyle = grad(g, 50, 50, 26, 54, [[0, 'rgba(60,40,20,0)'], [1, 'rgba(60,40,20,0.5)']]); g.fillRect(13, 13, 74, 74);
  g.restore();
});

// ---- the cat --------------------------------------------------------------------------------------------------

const catPortrait = animated((g, st) => {
  g.fillStyle = grad(g, 50, 44, 4, 66, [[0, '#9a3a40'], [0.6, '#5e1c24'], [1, '#2a0c10']]); g.fillRect(0, 0, 100, 100);
  // body / bib
  g.fillStyle = '#7d7a76';
  g.beginPath(); g.moveTo(16, 100); g.bezierCurveTo(18, 76, 34, 66, 50, 66); g.bezierCurveTo(66, 66, 82, 76, 84, 100); g.fill();
  g.fillStyle = '#f2efe8';
  g.beginPath(); g.moveTo(36, 100); g.bezierCurveTo(36, 80, 44, 70, 50, 70); g.bezierCurveTo(56, 70, 64, 80, 64, 100); g.fill();
  // ears: the cat's left ear (the viewer's right) has a notch
  const ear = (s, notch) => {
    g.fillStyle = '#7d7a76';
    g.beginPath(); g.moveTo(50 + s * 10, 30); g.lineTo(50 + s * 23, 12); g.lineTo(50 + s * 27, 36); g.closePath(); g.fill();
    g.fillStyle = '#d8a0a0';
    g.beginPath(); g.moveTo(50 + s * 13.5, 30.5); g.lineTo(50 + s * 22.5, 17); g.lineTo(50 + s * 24.5, 33); g.closePath(); g.fill();
    if (notch) {
      g.fillStyle = grad(g, 50, 44, 4, 66, [[0, '#9a3a40'], [0.6, '#5e1c24'], [1, '#2a0c10']]);
      g.beginPath(); g.moveTo(50 + s * 24.4, 19); g.lineTo(50 + s * 22, 22.5); g.lineTo(50 + s * 25.4, 24.5); g.closePath(); g.fill();
    }
  };
  ear(-1, false); ear(1, true);
  // head
  g.fillStyle = '#86837e';
  g.beginPath(); g.moveTo(24, 46); g.bezierCurveTo(22, 28, 38, 22, 50, 22); g.bezierCurveTo(62, 22, 78, 28, 76, 46); g.bezierCurveTo(78, 60, 64, 70, 50, 70); g.bezierCurveTo(36, 70, 22, 60, 24, 46); g.fill();
  // tabby stripes: the M on the brow, cheek bars
  g.strokeStyle = '#4e4b48'; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(42, 34); g.lineTo(45, 27); g.lineTo(50, 33); g.lineTo(55, 27); g.lineTo(58, 34); g.stroke();
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(50 + s * 22, 46); g.quadraticCurveTo(50 + s * 18, 47, 50 + s * 15, 50); g.stroke();
    g.beginPath(); g.moveTo(50 + s * 22, 52); g.quadraticCurveTo(50 + s * 19, 53, 50 + s * 16, 55); g.stroke();
    g.beginPath(); g.moveTo(50 + s * 8, 26); g.lineTo(50 + s * 9, 31); g.stroke();
  }
  // muzzle
  g.fillStyle = '#f2efe8'; ell(g, 45.5, 57, 6, 5); g.fill(); ell(g, 54.5, 57, 6, 5); g.fill(); ell(g, 50, 61.5, 5, 4); g.fill();
  // eyes: amber, vertical pupils, a slow blink
  for (const s of [-1, 1]) {
    const x = 50 + s * 10, y = 44;
    if (st.blink) {
      g.strokeStyle = '#2a2420'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 4.5, y); g.quadraticCurveTo(x, y + 2, x + 4.5, y); g.stroke();
    } else {
      g.fillStyle = grad(g, x, y, 0.5, 5, [[0, '#ffd27a'], [0.7, '#e09a2a'], [1, '#a8661a']]);
      ell(g, x, y, 4.8, 4.2); g.fill();
      g.fillStyle = '#140c08'; ell(g, x, y, 1.1, 3.6); g.fill();
      g.fillStyle = '#fff'; ell(g, x + 1.6, y - 1.7, 0.7, 0.7); g.fill();
      g.strokeStyle = '#2a2420'; g.lineWidth = 0.9; ell(g, x, y, 4.8, 4.2); g.stroke();
    }
  }
  // nose and mouth
  g.fillStyle = '#d88a8e';
  g.beginPath(); g.moveTo(47.4, 53.6); g.lineTo(52.6, 53.6); g.lineTo(50, 56.6); g.closePath(); g.fill();
  g.strokeStyle = '#3a2a28'; g.lineWidth = 0.8;
  const m = st.mouth;
  if (m > 0.1) { g.fillStyle = '#5a2228'; ell(g, 50, 60 + m, 2.2, 0.6 + m * 1.6); g.fill(); }
  g.beginPath(); g.moveTo(50, 56.6); g.lineTo(50, 58.4); g.quadraticCurveTo(47.5, 60.4, 45.5, 59); g.moveTo(50, 58.4); g.quadraticCurveTo(52.5, 60.4, 54.5, 59); g.stroke();
  // whiskers
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.5;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(50 + s * 7, 58 + i * 1.4); g.quadraticCurveTo(50 + s * 18, 56 + i * 2.4, 50 + s * 30, 55 + i * 4); g.stroke(); }
});

export const PORTRAITS = {
  lavinia: laviniaPortrait,
  lavinia_off: laviniaOffPortrait,
  pike: pikePortrait,
  cat: catPortrait,
};

const _done = new WeakSet();
/** Register the four portraits with ctx.dialogue (once per ctx). Keeps each speaker's name, blip and style. */
export function registerPortraits(ctx) {
  const d = ctx?.dialogue;
  if (!d?.registerSpeaker || _done.has(ctx)) return;
  _done.add(ctx);
  for (const [who, portrait] of Object.entries(PORTRAITS)) d.registerSpeaker(who, { portrait });
}
