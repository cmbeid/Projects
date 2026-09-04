// Port of OT::Item::Cinema (source/Item/Cinema.h / Cinema.cpp).
// Two screenings/day: doors 13/19 (50 customers stream in immediately), show
// 15/21, intermission 16/22 (+15 eval, -15 stress, doorbell), close 17/23
// with income attendees*80 - 2000. Runs every day (no day-2 guard).

import { Item } from "./item.js";
import { Sprite } from "../sprite.js";
import { Person, K_MAN, K_WOMAN1, K_WOMAN2, K_WOMAN_WITH_CHILD1, KSHOPPING, KRETURNING } from "../person.js";
import { rand } from "../../core/rand.js";

// Full-key literals (the asset registry scanner matches whole strings only).
const MOVIE_SOUNDS = [
  "simtower/cinema/movie0", "simtower/cinema/movie1", "simtower/cinema/movie2",
  "simtower/cinema/movie3", "simtower/cinema/movie4", "simtower/cinema/movie5",
  "simtower/cinema/movie6", "simtower/cinema/movie7", "simtower/cinema/movie8",
  "simtower/cinema/movie9", "simtower/cinema/movie10", "simtower/cinema/movie11",
  "simtower/cinema/movie12", "simtower/cinema/movie13", "simtower/cinema/movie14",
];

export class CinemaCustomer extends Person {
  constructor(item) {
    super(item.game);
    const types = [K_MAN, K_WOMAN1, K_WOMAN2, K_WOMAN_WITH_CHILD1];
    this.type = types[rand() % 4];
    this.from = "City";
    this.goingTo = item.prototype.name;
  }
}

export class Cinema extends Item {
  constructor(game, prototype) {
    super(game, prototype);
    this.open = false;
    this.playing = false;
    this.intermission = false;
    this.movieType = 0;
    this.animation = 0;
    this.animationFrame = 0;
    this.hallSprite = new Sprite();
    this.screenSprite = new Sprite();
    this.spriteNeedsUpdate = false;
    this.customers = new Set();
  }

  destroy() {
    this.clearCustomers();
    super.destroy();
  }

  init() {
    this.open = false;
    this.playing = false;
    this.intermission = false;
    this.movieType = rand() % 15;
    this.animation = 0;
    this.animationFrame = 0;

    this.hallSprite
      .setTexture("simtower/cinema/hall")
      .setOrigin(0, 60)
      .setPosition(this.position.x * 8 + 56, -this.position.y * 36);
    this.screenSprite
      .setTexture("simtower/cinema/screens")
      .setOrigin(0, 60)
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.addSprite(this.screenSprite);
    this.addSprite(this.hallSprite);
    this.updateSprite();
  }

  encodeXML(xml) {
    super.encodeXML(xml);
    xml.PushAttribute("open", this.open);
    xml.PushAttribute("playing", this.playing);
    xml.PushAttribute("intermission", this.intermission);
    xml.PushAttribute("movie", this.movieType);

    for (const customer of this.customers) {
      if (customer.at !== this) continue;

      xml.OpenElement("customer");
      xml.PushAttribute("type", customer.type);
      xml.PushAttribute("state", customer.state);
      xml.PushAttribute("stress", customer.stress);
      xml.PushAttribute("eval", customer.eval);
      xml.PushAttribute("name", customer.name);
      xml.PushAttribute("from", customer.from);
      xml.PushAttribute("goingTo", customer.goingTo);
      xml.CloseElement();
    }
  }

  decodeXML(el) {
    super.decodeXML(el);
    this.open = el.attrs.open === "true" || el.attrs.open === "1";
    this.playing = el.attrs.playing === "true" || el.attrs.playing === "1";
    this.intermission = el.attrs.intermission === "true" || el.attrs.intermission === "1";
    this.movieType = el.attrs.movie !== undefined ? parseInt(el.attrs.movie, 10) : 0;
    this.clearCustomers();

    for (const e of el.children) {
      if (e.name !== "customer") continue;
      const c = new CinemaCustomer(this);
      c.type = e.attrs.type !== undefined ? parseInt(e.attrs.type, 10) : K_MAN;
      c.state = e.attrs.state !== undefined ? parseInt(e.attrs.state, 10) : KSHOPPING;
      c.stress = e.attrs.stress !== undefined ? parseFloat(e.attrs.stress) : 0.0;
      c.eval = e.attrs.eval !== undefined ? parseFloat(e.attrs.eval) : 0.0;
      c.name = e.attrs.name ?? "";
      c.from = e.attrs.from ?? "";
      c.goingTo = e.attrs.goingTo ?? "";

      this.customers.add(c);
      if (this.open) this.addPerson(c);
    }

    this.updateSprite();
  }

  updateSprite() {
    this.spriteNeedsUpdate = false;
    let hallIndex = 0;
    let screenIndex = 0;
    if (this.open) {
      if (this.playing) {
        if (this.intermission) {
          hallIndex = 2;
          screenIndex = 2;
        } else {
          hallIndex = 3 + this.animationFrame;
          screenIndex = 3 + this.movieType;
        }
      } else {
        hallIndex = this.people.size > 0 ? 2 : 1;
        screenIndex = hallIndex;
      }
    }
    this.screenSprite
      .setTextureRect({ x: screenIndex * 56, y: 0, w: 56, h: 60 })
      .setPosition(this.position.x * 8, -this.position.y * 36);
    this.hallSprite
      .setTextureRect({ x: hallIndex * 192, y: 0, w: 192, h: 60 })
      .setPosition(this.position.x * 8 + 56, -this.position.y * 36);
  }

  advance(dt) {
    const time = this.game.time;

    // Open
    if (time.checkHour(13) || time.checkHour(19)) {
      this.open = true;
      this.playing = false;
      this.intermission = false;
      this.spriteNeedsUpdate = true;

      // Fill in the customers for this screening.
      this.clearCustomers();
      const numCustomers = 50;
      for (let i = 0; i < numCustomers; i++) {
        const p = new CinemaCustomer(this);
        this.customers.add(p);

        // Make the customer journey to the cinema immediately.
        p.journey.set(this.lobbyRoute);
      }
    }

    // Start Screening
    if ((time.checkHour(15) || time.checkHour(21)) && this.open) {
      this.playing = true;
      this.intermission = false;
      this.spriteNeedsUpdate = true;
    }

    // Intermission
    if ((time.checkHour(16) || time.checkHour(22)) && this.open && this.playing) {
      if (!this.intermission) {
        this.intermission = true;
        this.spriteNeedsUpdate = true;
        this.game.playOnce("simtower/doorbell");

        for (const p of this.customers) {
          if (p.at === this) {
            p.eval = Math.min(p.eval + 15.0, 100.0);
            p.addStress(-15.0);
          }
        }
      }
    }

    // Close
    if ((time.checkHour(17) || time.checkHour(23)) && this.open) {
      this.open = false;
      this.playing = false;
      this.intermission = false;
      this.spriteNeedsUpdate = true;

      // Attendance-based income: customers who actually reached the theatre.
      const kTicketPrice = 80;
      const kScreeningFee = 2000;
      const attendees = this.people.size;
      const net = attendees * kTicketPrice - kScreeningFee;
      this.game.transferFunds(net, "entertainment_income", "Income from Movie Theatre");

      // Make the customers leave.
      const r = this.game.findRoute(this, this.game.mainLobby);
      for (const p of this.customers) {
        if (r.empty()) {
          // no route to leave
        } else {
          p.state = KRETURNING;
          p.from = this.prototype.name;
          p.goingTo = "Exit";
          if (p.at === this) {
            this.removePerson(p);
          }
          p.journey.set(r);
        }
      }
    }

    // Animate the sprite.
    this.animation = (this.animation + dt) % 1;
    const af = Math.floor(this.animation * 2);
    if (af !== this.animationFrame) {
      this.animationFrame = af;
      this.spriteNeedsUpdate = true;
    }

    if (this.spriteNeedsUpdate) this.updateSprite();
  }

  addPerson(p) {
    super.addPerson(p);
    p.state = KSHOPPING;
    p.eval = 60;
    p.addStress(-20);
    this.spriteNeedsUpdate = true;
  }

  removePerson(p) {
    super.removePerson(p);
    this.spriteNeedsUpdate = true;
  }

  // Removes all customers from the item.
  clearCustomers() {
    for (const c of this.customers) c.destroy();
    this.customers.clear();
  }

  dailyMaintenanceCost() {
    return 1500;
  }

  getRandomBackgroundSoundPath() {
    if (!this.open || !this.playing || this.intermission) return "";
    return MOVIE_SOUNDS[this.movieType];
  }
}
