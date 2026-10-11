import { SECTORS } from '../data/sectors';
import { canJump, node } from '../game/galaxy';
import { activeQuests } from '../game/station';
import { missionNode } from '../game/story';
import { drawSprite, frameOf } from '../sprites/atlas';
import type { GameState } from '../state/types';
import { drawStarfield } from './starfield';

export interface MapLayout {
  pad: number;
  scale: number;
  w: number;
  h: number;
}

export function mapLayout(w: number, h: number): MapLayout {
  const scale = Math.max(2, Math.round(Math.min(w, h * 0.8) / 130));
  return { pad: scale * 14, scale, w, h };
}

export function nodePos(L: MapLayout, n: { x: number; y: number }): [number, number] {
  return [L.pad + n.x * (L.w - 2 * L.pad), L.pad + n.y * (L.h - 2 * L.pad)];
}

export function hitNode(s: GameState, L: MapLayout, x: number, y: number): number | null {
  let best: number | null = null;
  let bd = L.scale * 14;
  for (const n of s.sector.nodes) {
    const [nx, ny] = nodePos(L, n);
    const d = Math.hypot(nx - x, ny - y);
    if (d < bd) {
      bd = d;
      best = n.id;
    }
  }
  return best;
}

export function drawMap(ctx: CanvasRenderingContext2D, w: number, h: number, s: GameState, selected: number | null, t: number): void {
  const sec = SECTORS[s.sector.index]!;
  drawStarfield(ctx, w, h, t, sec.color, 0.004);
  const L = mapLayout(w, h);
  const here = node(s);
  const target = missionNode(s);
  const quests = new Set(activeQuests(s).map((q) => q.target));
  // Links.
  ctx.lineWidth = Math.max(1, L.scale * 0.6);
  for (const n of s.sector.nodes) {
    for (const l of n.links) {
      if (l < n.id) continue;
      const m = s.sector.nodes[l]!;
      const fromHere = n.id === here.id || m.id === here.id;
      ctx.strokeStyle = fromHere ? 'rgba(90,208,240,0.85)' : n.visited && m.visited ? 'rgba(140,160,210,0.45)' : 'rgba(90,110,160,0.25)';
      ctx.setLineDash(fromHere ? [] : [L.scale * 2, L.scale * 2]);
      const [ax, ay] = nodePos(L, n);
      const [bx, by] = nodePos(L, m);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Nodes.
  for (const n of s.sector.nodes) {
    const [x, y] = nodePos(L, n);
    const reachable = here.links.includes(n.id) && canJump(s, n.id);
    if (n.id === selected) {
      ctx.strokeStyle = reachable ? '#5ad0f0' : '#8e9bbd';
      ctx.lineWidth = L.scale;
      ctx.beginPath();
      ctx.arc(x, y, L.scale * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (target && target.id === n.id) {
      const pulse = 1 + 0.15 * Math.sin(t * 4);
      ctx.strokeStyle = '#f0c048';
      ctx.lineWidth = L.scale * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, L.scale * 8 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (quests.has(n.id)) {
      ctx.fillStyle = '#5ad0f0';
      ctx.fillRect(x + L.scale * 5, y - L.scale * 8, L.scale * 3, L.scale * 3);
    }
    if (n.revealed || n.visited || (target && target.id === n.id)) {
      const name = `node-${n.kind}`;
      const [, , fw, fh] = frameOf(name);
      ctx.globalAlpha = n.visited || n.id === here.id ? 1 : 0.75;
      drawSprite(ctx, name, x - (fw * L.scale) / 2, y - (fh * L.scale) / 2, L.scale);
      ctx.globalAlpha = 1;
      if (n.cleared && n.kind !== 'station' && n.kind !== 'system' && n.kind !== 'gate' && n.kind !== 'entry') {
        ctx.fillStyle = 'rgba(5,7,14,0.45)';
        ctx.beginPath();
        ctx.arc(x, y, L.scale * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(140,160,210,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, L.scale * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The ship.
  const [sx, sy] = nodePos(L, here);
  const [, , ww, wh] = frameOf('ship-wren');
  const k = Math.max(1, Math.round(L.scale * 0.6));
  const bob = Math.sin(t * 2) * k;
  drawSprite(ctx, 'ship-wren', sx - (ww * k) / 2, sy - wh * k - L.scale * 6 + bob, k);
}
