// Port of OT::Item::Factory (source/Item/Factory.h/cpp).
// Prototypes are plain objects (no subclass generics needed in JS):
//   { id, name, price, size:{x,y}, icon, variant?, entrance_offset, exit_offset, make(game, proto) }
// Registration list mirrors Factory.cpp order — see items/catalog.js.

import { intAttr } from "../../core/xml.js";

export class Factory {
  constructor(game) {
    this.game = game;
    this.prototypes = [];
    this.prototypesById = {};
  }

  loadPrototypes(registrations) {
    // registrations: array of prototype objects (see items/catalog.js)
    for (const p of registrations) {
      this.prototypes.push(p);
      this.prototypesById[p.id] = p;
    }
  }

  make(prototypeOrId, position) {
    const p =
      typeof prototypeOrId === "string" ? this.prototypesById[prototypeOrId] : prototypeOrId;
    const item = p.make(this.game, p);
    item.setPosition(position);
    item.init();
    // Mark fresh placements as under construction. Saved games call make()
    // too, but their decodeXML() runs immediately afterwards and restores the
    // persisted underConstruction flag, overriding this.
    const duration = item.constructionDuration();
    if (duration > 0) {
      item.underConstruction = true;
      item.constructionEndTime = this.game.time.absolute + duration;
    }
    return item;
  }

  makeFromXML(el) {
    let type = el.attrs.type ?? "";
    // Legacy migration: older saves stored every hotel room under the single
    // "hotel" id and disambiguated with a "variant" attribute.
    if (type === "hotel") {
      switch (intAttr(el, "variant", 0)) {
        case 1:
          type = "hotel_double";
          break;
        case 2:
          type = "hotel_suite";
          break;
        default:
          type = "hotel_single";
          break;
      }
    }
    // C++ Factory::make(xml): make(type, pos) [which runs init()] then
    // decodeXML — init first so decode can rely on initialized state.
    const item = this.make(type, { x: parseInt(el.attrs.x, 10), y: parseInt(el.attrs.y, 10) });
    item.decodeXML(el);
    return item;
  }
}
