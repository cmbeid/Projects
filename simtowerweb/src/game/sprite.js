// Pure-data Sprite mirroring sf::Sprite usage in the C++ code.
// Positions are in world screen space (y DOWN, matching SFML); the renderer
// applies camera transform. No canvas dependency — safe for headless sim.
export class Sprite {
  constructor(texture = null) {
    this.texture = texture; // bitmap key, e.g. "simtower/office"
    this.textureRect = null; // {x,y,w,h} or null = whole texture
    this.position = { x: 0, y: 0 };
    this.origin = { x: 0, y: 0 };
    this.color = { r: 255, g: 255, b: 255, a: 255 };
    this.flipX = false;
  }

  setTexture(t) {
    this.texture = t;
    this.textureRect = null;
    return this;
  }

  setTextureRect(r) {
    this.textureRect = r;
    return this;
  }

  setPosition(x, y) {
    this.position = { x, y };
    return this;
  }

  setOrigin(x, y) {
    this.origin = { x, y };
    return this;
  }

  setColor(c) {
    this.color = c;
    return this;
  }

  setFlipX(f) {
    this.flipX = f;
    return this;
  }
}

export function colorEqual(a, b) {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}
