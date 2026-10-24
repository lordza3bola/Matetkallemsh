// Share card: draws the final scoreboard as a poster image and shares it (WhatsApp / Story).

const INK = '#1F1410', CREAM = '#FFF8EA', PAPER = '#F6E7C8', RED = '#C8321F', MUST = '#F3B62E';

function sunburst(g, cx, cy, r, a, b, n = 36) {
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.moveTo(cx, cy);
    g.arc(cx, cy, r, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
    g.closePath(); g.fillStyle = i % 2 ? a : b; g.fill();
  }
}

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export async function scoreCard(game, aw) {
  try { await document.fonts.ready; } catch {}
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  // poster panel
  g.save(); rr(g, 60, 60, W - 120, 760, 48); g.clip();
  sunburst(g, W / 2, 820, 1400, MUST, '#E7A51D');
  g.restore();
  g.lineWidth = 8; g.strokeStyle = INK; rr(g, 60, 60, W - 120, 760, 48); g.stroke();
  g.textAlign = 'center';
  g.fillStyle = INK; g.font = '72px Anton, Impact, sans-serif';
  g.fillText('MATETKALLEMSH!', W / 2, 170);
  const win = game.winner;
  const head = win === -1 ? 'TA3ADOL!' : `${game.teams[win].name.toUpperCase()} KESBO!`;
  g.font = '96px Anton, Impact, sans-serif'; g.fillText(head, W / 2, 290, W - 200);
  // podium
  const order = win === 1 ? [1, 0] : [0, 1];
  const hs = win === -1 ? [400, 400] : [420, 310];
  order.forEach((ti, k) => {
    const t = game.teams[ti], w = 300, h = hs[k], x = W / 2 - 330 + k * 360, y = 820 - h;
    g.fillStyle = t.color || RED; rr(g, x, y, w, h + 40, 32); g.fill();
    g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
    g.fillStyle = INK; g.font = '170px Anton, Impact, sans-serif'; g.fillText(String(t.score), x + w / 2 + 6, y + 200 + 6);
    g.fillStyle = CREAM; g.fillText(String(t.score), x + w / 2, y + 200);
    g.font = 'bold 46px Rubik, Arial, sans-serif'; g.fillText(t.name, x + w / 2, y + 270, w - 30);
  });
  // awards
  g.textAlign = 'left'; g.fillStyle = INK;
  g.font = '56px Anton, Impact, sans-serif'; g.fillText('GAWAYEZ EL LEILA', 80, 920);
  const lines = [];
  if (aw.best) lines.push(['A7san momassel', `${aw.best.name} · ${aw.best.correct} ${aw.best.correct === 1 ? '3onwan' : '3anaween'}`]);
  if (aw.fastest) lines.push(['Asra3 ta5meen', `${aw.fastest.title} · ${aw.fastest.secs} sanya`]);
  lines.push(['El adwar', `${game.history.length} dor · ${game.history.filter(h => h.result === 'correct').length} sa7`]);
  lines.forEach(([a, b], i) => {
    const y = 960 + i * 100;
    rr(g, 80, y, W - 160, 84, 20); g.fillStyle = CREAM; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#6B5444'; g.font = '600 30px Rubik, Arial, sans-serif'; g.fillText(a, 110, y + 53);
    g.fillStyle = INK; g.font = 'bold 36px Rubik, Lalezar, Arial, sans-serif'; g.textAlign = 'right';
    g.fillText(b, W - 110, y + 55, W - 480); g.textAlign = 'left';
  });
  g.textAlign = 'center'; g.fillStyle = INK; g.font = '600 28px Rubik, Arial, sans-serif';
  g.fillText('Etkallem bi2eedak… bas mat2olsh wala kelma', W / 2, H - 40);
  return new Promise(res => cv.toBlob(res, 'image/png'));
}

export function shareText(game) {
  const [a, b] = game.teams;
  const head = game.winner === -1 ? 'Ta3adol!' : `${game.teams[game.winner].name} kesbo!`;
  return `Matetkallemsh! ${head} ${a.name} ${a.score} – ${b.score} ${b.name}`;
}

export async function shareGame(game, aw) {
  const text = shareText(game);
  const blob = await scoreCard(game, aw);
  const file = blob && new File([blob], 'matetkallemsh.png', { type: 'image/png' });
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  // fallback: download the card + open WhatsApp with the text
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'matetkallemsh.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  return 'fallback';
}
