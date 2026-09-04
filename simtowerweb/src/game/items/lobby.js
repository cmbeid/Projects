// Port of OT::Item::Lobby (source/Item/Lobby.h / Lobby.cpp).
// Ground lobby (y=0) is the main lobby; sky lobbies every 15 floors.
// Custom render: 256px tiled body + 56px overlay end cap, row by tower
// rating, segments for multi-story lobbies, entrance decorations.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { colorEqual } from "../sprite.js";

export class Lobby extends Item {
  init() {
    const groundLobby = this.position.y === 0;
    if (groundLobby && !this.game.mainLobby) {
      // C++ asserts no main lobby exists yet; keep the defensive variant so
      // headless reloads never throw.
      this.game.mainLobby = this;
    }

    this.background = new Sprite();
    this.overlay = new Sprite();
    this.entrances = [new Sprite(), new Sprite()];

    if (groundLobby) {
      for (let i = 0; i < 2; i++) {
        this.entrances[i]
          .setTexture("simtower/deco/entrances")
          .setOrigin(0, 36)
          .setPosition(this.position.x * 8, -this.position.y * 36)
          .setTextureRect({ x: i * 56, y: 0, w: 56, h: 36 });
        this.addSprite(this.entrances[i]);
      }
    }

    this.updateSprite();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("width", this.size.x);
    xml.PushAttribute("height", this.size.y);
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.size.x = el.attrs.width !== undefined ? parseInt(el.attrs.width, 10) : this.size.x;
    this.size.y = el.attrs.height !== undefined ? parseInt(el.attrs.height, 10) : (this.position.y === 0 ? 3 : 1);
    this.updateSprite();
  }

  updateSprite() {
    const groundLobby = this.position.y === 0;
    let p;
    if (this.size.y > 1) p = "simtower/lobby/high";
    else p = groundLobby ? "simtower/lobby/normal" : "simtower/lobby/sky";

    this.background.setTexture(p);
    this.overlay.setTexture(p);

    // Entrance decorations bound to the lobby's x-extent.
    this.entrances[0].setPosition(this.position.x * 8 - 16, -this.position.y * 36);
    this.entrances[1].setPosition(this.rectMaxX() * 8 - 40, -this.position.y * 36);
  }

  dailyMaintenanceCost() {
    return this.size.x * 20;
  }

  canHaulPeople() {
    return false;
  }

  addPerson(person) {
    super.addPerson(person);
  }

  render(draw) {
    // Entrance sprites (member sprites set) + people first, then the tiled
    // body on top — mirrors Lobby.cpp calling Item::render before tiling.
    super.render(draw);

    const game = this.game;
    const rect = this.getRect(); // minX = rect.x, maxX = rect.x+rect.w-1 (inclusive)
    const rectMinX = rect.x;
    const rectMaxX = this.rectMaxX();

    const tint = game.lighting.tint();
    const tinted = !colorEqual(tint, { r: 255, g: 255, b: 255, a: 255 });

    let color = null;
    if (game.statusMode === 3) {
      // kHotel: grey out the lobby body
      const composed = game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 });
      color = {
        r: (composed.r * 110) >> 8,
        g: (composed.g * 110) >> 8,
        b: (composed.b * 110) >> 8,
        a: (composed.a * 160) >> 8,
      };
    } else if (tinted) {
      color = game.lighting.compose({ r: 255, g: 255, b: 255, a: 255 });
    }

    let ratingY = 0;
    if (game.rating === 2) ratingY = 1;
    if (game.rating >= 3) ratingY = 2;

    const leftPx = this.position.x * 8;
    const rightPx = (this.position.x + this.size.x) * 8;
    const totalW = rightPx - leftPx;

    const segments = [];
    if (this.size.y === 3) {
      segments.push({ textureY: ratingY * 108, height: 108, screenYOffset: 0 });
    } else if (this.size.y === 2) {
      segments.push({ textureY: ratingY * 108 + 48, height: 60, screenYOffset: 0 });
      segments.push({ textureY: ratingY * 108, height: 12, screenYOffset: -60 });
    } else {
      segments.push({ textureY: ratingY * 36, height: 36, screenYOffset: 0 });
    }

    const tex = this.background.texture;
    for (const seg of segments) {
      // 1. Render left end-cap (56px with statue standing at the leftmost area)
      const capWidth = Math.min(56, totalW);
      if (capWidth > 0) {
        draw.image(
          tex,
          { x: 0, y: seg.textureY, w: capWidth, h: seg.height },
          leftPx,
          -this.position.y * 36 + seg.screenYOffset,
          { origin: { x: 0, y: seg.height }, tint: color },
        );
        game.drawnSprites++;
      }

      // 2. Tile the 256px body across the remainder of the lobby width
      const bodyStart = leftPx + capWidth;
      let curX = bodyStart;
      while (curX < rightPx) {
        const chunkOffset = (curX - bodyStart) % 256;
        const sliceWidth = Math.min(256 - chunkOffset, rightPx - curX);
        if (sliceWidth <= 0) break;
        draw.image(
          tex,
          { x: 56 + chunkOffset, y: seg.textureY, w: sliceWidth, h: seg.height },
          curX,
          -this.position.y * 36 + seg.screenYOffset,
          { origin: { x: 0, y: seg.height }, tint: color },
        );
        game.drawnSprites++;
        curX += sliceWidth;
      }
    }

    // 3. Render 2-frame animated flickering water fountain on the bottom floor of high/multi-story lobbies
    if (this.size.y >= 2) {
      const capWidth = Math.min(56, totalW);
      const frameIndex = Math.floor((game.time.absolute * 6) % 2);

      if (capWidth > 0) {
        draw.image(
          "simtower/lobby/fountain",
          { x: frameIndex * 312, y: 0, w: capWidth, h: 36 },
          leftPx,
          -this.position.y * 36,
          { origin: { x: 0, y: 36 }, tint: color },
        );
        game.drawnSprites++;
      }

      const bodyStart = leftPx + capWidth;
      let curX = bodyStart;
      while (curX < rightPx) {
        const chunkOffset = (curX - bodyStart) % 256;
        const sliceWidth = Math.min(256 - chunkOffset, rightPx - curX);
        if (sliceWidth <= 0) break;
        draw.image(
          "simtower/lobby/fountain",
          { x: frameIndex * 312 + 56 + chunkOffset, y: 0, w: sliceWidth, h: 36 },
          curX,
          -this.position.y * 36,
          { origin: { x: 0, y: 36 }, tint: color },
        );
        game.drawnSprites++;
        curX += sliceWidth;
      }
    }
  }
}

