// DrawList — pure-data draw-command accumulator (RENDER agent).
// Positions are in world-render space: x grows right, y grows DOWN.
// (World/sim space has y UP; drawing code negates y itself — see Item::render
// in the C++ source. The renderer applies the camera transform to these ops.)
//
// No canvas dependency — safe to use headless (bun tests, item.render tests).
//
// Op shapes (plain objects, inspectable in tests):
//   sprite  : { op:"sprite", sprite:Sprite, color:{r,g,b,a}|null }
//   image   : { op:"image", key:string, srcRect:{x,y,w,h}|null, x:number, y:number,
//              opts:{ origin?:{x,y}, tint?:{r,g,b,a}, flipX?:boolean } }
//   rect    : { op:"rect", x:number, y:number, w:number, h:number,
//              opts:{ fill?:{r,g,b,a}, outline?:{r,g,b,a}, outlineWidth?:number } }
//   polyline: { op:"polyline", points:[{x,y}...], opts:{ color?:{r,g,b,a}, width?:number } }
//              (extension beyond CONTRACTS.md — used for the inspector route
//              overlay, the GL_LINE_STRIP port; harmless to consumers)

export class DrawList {
  constructor() {
    this.ops = [];
    // Optional render-space view bounds {min:{x,y}, max:{x,y}} assigned by the
    // Renderer each frame; background renderers (sky/decorations) use it for
    // culling (see viewBounds() in systems/sky.js). Null when unused.
    this.view = null;
  }

  // Emit a Sprite with an optional composed color override (lighting/status
  // tints). Mirrors sf::Sprite draw with sprite.setColor applied.
  sprite(sprite, color = null) {
    this.ops.push({ op: "sprite", sprite, color });
    return this;
  }

  // Emit a bitmap sub-image at render-space position (x, y).
  // opts.origin shifts the draw anchor (sf::Sprite setOrigin); srcRect null
  // means the whole bitmap.
  image(key, srcRect, x, y, opts = {}) {
    this.ops.push({ op: "image", key, srcRect, x, y, opts });
    return this;
  }

  // Emit a rectangle (fill and/or outline). Colors are {r,g,b,a} 0..255.
  rect(x, y, w, h, opts = {}) {
    this.ops.push({ op: "rect", x, y, w, h, opts });
    return this;
  }

  // Route-overlay line strip (see Renderer.buildFrame step 10).
  polyline(points, opts = {}) {
    this.ops.push({ op: "polyline", points, opts });
    return this;
  }

  reset() {
    this.ops.length = 0;
  }

  get length() {
    return this.ops.length;
  }
}
