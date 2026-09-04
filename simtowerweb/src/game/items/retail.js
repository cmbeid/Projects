// SimTower Retail Shop. The 288×288 `simtower/shops` sheet is 11 storefront
// rows (one per cosmetic name), each with three 96×24 activity frames. The
// first column is the normal empty-storefront state used by this simulation.

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { rand, randi } from "../../core/rand.js";

export const RETAIL_VARIANTS = [
  "Men's Clothing",
  "Pet Store",
  "Flower Shop",
  "Book Store",
  "Drug Store",
  "Boutique",
  "Electronics",
  "Bank",
  "Hair Salon",
  "Post Office",
  "Sports Gear",
];

const STOREFRONT_W = 96;
const STOREFRONT_H = 24;

export class RetailShop extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.variant = 0;
    this.openHour = 8;
    this.closeHour = 22;
    this.dailySales = 0;
    this.sprite = new Sprite();
  }

  // ISSUE-035: per-instance cosmetic identity (see restaurant.js).
  applyVariantName() {
    // Out-of-range variants (e.g. tampered saves) normalize to 0 — never a
    // stale name or undefined.
    const v =
      Number.isInteger(this.variant) && this.variant >= 0 && this.variant < RETAIL_VARIANTS.length
        ? this.variant
        : 0;
    this.prototype = { ...this.prototype, name: RETAIL_VARIANTS[v] };
  }

  init() {
    this.variant = rand() % RETAIL_VARIANTS.length;
    this.applyVariantName();
    this.evaluation = 60;
    this.sprite
      .setTexture("simtower/shops")
      .setOrigin(0, STOREFRONT_H)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.sprite);
    this.updateSprite();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("variant", this.variant);
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.variant = el.attrs.variant !== undefined ? parseInt(el.attrs.variant, 10) : 0;
    if (this.variant < 0 || this.variant >= RETAIL_VARIANTS.length) this.variant = 0;
    this.applyVariantName();
    this.updateSprite();
  }

  updateSprite() {
    // Sheet row 0 contains the generic closed/for-rent header. Retail
    // variants occupy rows 1..11; each is three 96px-wide activity frames.
    this.sprite
      .setTextureRect({ x: 0, y: (this.variant + 1) * STOREFRONT_H, w: STOREFRONT_W, h: STOREFRONT_H })
      .setPosition(this.position.x * 8, -this.position.y * 36);
  }

  dailyMaintenanceCost() {
    return 150;
  }

  isOpen() {
    const h = this.game.time.hour;
    return h >= this.openHour && h < this.closeHour;
  }

  advance(dt) {
    const time = this.game.time;
    if (this.isOpen() && time.checkTick(0.01)) {
      // Sales income scaled by building population and random shoppers
      const shoppers = Math.max(1, Math.floor((this.game.population || 10) * 0.05));
      const sale = shoppers * randi(20, 50);
      this.dailySales += sale;
      this.game.transferFunds(sale, "shop_income", `${this.prototype.name} customer purchase`);
    }
  }
}
