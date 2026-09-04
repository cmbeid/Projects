// Port of OT::Item::Stairs (source/Item/Stairs.h / Stairs.cpp).
// 14-frame straight stairs; placed inside a multi-story lobby they become a
// spiral stair (11 frames, taller footprint) — persisted via `spiral` attr.

import { Stairlike } from "./stairlike.js";
import { ICON } from "../game.js";

export class Stairs extends Stairlike {
  init() {
    // Stairs.cpp:7-11 — configure the texture/footprint before the base init
    // wires the sprite.
    this.configureForLobby();
    super.init();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    if (this.frameCount === 11) {
      xml.PushAttribute("spiral", this.size.y === 4 ? 3 : 2);
    }
  }

  decodeXML(el) {
    super.decodeXML(el);
    const spiral = el.attrs.spiral !== undefined ? parseInt(el.attrs.spiral, 10) : 0;
    if (spiral === 2) {
      this.frameCount = 11;
      this.size.y = 3;
      this.sprite.setTexture("simtower/stairs/spiral_2");
    } else if (spiral === 3) {
      this.frameCount = 11;
      this.size.y = 4;
      this.sprite.setTexture("simtower/stairs/spiral_3");
    } else if (spiral === 0) {
      this.configureForLobby();
    }
    this.updateSprite();
  }

  dailyMaintenanceCost() {
    return 25;
  }

  // Stairs.cpp:38-64 — when placed onto a lobby, pick the spiral variant by
  // the lobby's height (2-story -> spiral_2/size.y=3, >=3-story ->
  // spiral_3/size.y=4). Note the placement rules only ever place stairs on
  // the lobby's bottom floor, so position.y locates the lobby.
  configureForLobby() {
    let lobbyHeight = 0;
    const allLobbies = this.game.itemsByType?.get("lobby") || this.game.items || [];
    for (const item of allLobbies) {
      if (item.prototype?.icon === ICON.LOBBY || item.prototype?.id === "lobby") {
        if (
          this.position.y >= item.position.y &&
          this.position.y < item.position.y + item.size.y
        ) {
          const stairsLeft = this.position.x;
          const stairsRight = this.position.x + this.size.x;
          const lobbyLeft = item.position.x;
          const lobbyRight = item.position.x + item.size.x;
          if (stairsRight > lobbyLeft && stairsLeft < lobbyRight) {
            lobbyHeight = item.size.y;
            this.position.y = item.position.y;
            break;
          }
        }
      }
    }

    if (lobbyHeight === 2) {
      this.frameCount = 11;
      this.size.y = 3;
      this.sprite.setTexture("simtower/stairs/spiral_2");
    } else if (lobbyHeight >= 3) {
      this.frameCount = 11;
      this.size.y = 4;
      this.sprite.setTexture("simtower/stairs/spiral_3");
    } else {
      this.frameCount = 14;
      this.size.y = 2;
      this.sprite.setTexture("simtower/stairs");
    }
  }
}
