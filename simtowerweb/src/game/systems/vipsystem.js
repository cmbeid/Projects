// Port of OT::VipSystem (source/VipSystem.h / VipSystem.cpp), retuned to the
// authentic trigger model (ISSUE-036, docs/research/event-triggers.md):
// VIP visits are NOT random — the VIP arrives when the next star promotion
// requires a VIP rating and every other requirement is already met. A good
// review completes the promotion (via game.ratingMayIncrease); a bad review
// schedules a retry cooldown.

import { hourToAbsolute } from "../../core/time.js";
import { doubleAttr, boolAttr, intAttr } from "../../core/xml.js";
import { LevelUp } from "./levelup.js";

// Tunables.
const K_VISIT_DURATION_ABS = 2.0 / 24; // ~2 game-hours on premises
const K_SATISFIED_REWARD = 50000;
const K_GOOD_EVAL_THRESHOLD = 55.0;
const K_EXCELLENT_EVAL_THRESHOLD = 75.0;
const K_RETRY_DAYS = 14.0; // cooldown after an "uncomfortable stay"

export class VipSystem {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.nextVisitTime = 0;
    this.visitEndTime = 0;
    this.visiting = false;
    this.goodReviews = 0;
    this.badReviews = 0;
  }

  // Force a visit as soon as possible (dev keys / tests).
  scheduleNow() {
    this.nextVisitTime = this.game.time.absolute;
  }

  // The next promotion requires a VIP rating and everything else is already
  // satisfied — the VIP comes to inspect (ISSUE-036).
  promotionNeedsVisit() {
    const req = LevelUp.advancementRequirements(this.game.rating);
    if (!req || !req.needsVip) return false;
    const c = this.game.judgeSystem.counts();
    return (
      this.game.population >= req.population &&
      (!req.needsSecurity || c.securityOffices > 0) &&
      (!req.needsMedical || c.medicalCenters > 0) &&
      (!req.needsMetro || c.metroStations > 0)
    );
  }

  beginVisit() {
    this.visiting = true;
    this.visitEndTime = this.game.time.absolute + K_VISIT_DURATION_ABS;
    this.game.ui.showMessage("A VIP is visiting the tower!");
  }

  endVisit() {
    this.visiting = false;

    // Evaluate the tower state from the most recent judge pass.
    const c = this.game.judgeSystem.counts();
    const avgEval = c.hotelAvgEval > 0.0
      ? c.hotelAvgEval * 0.4 + 50.0 * 0.6 // weight hotels slightly
      : 50.0;

    // Penalties for dirty rooms and critical tenants; bonuses for facility
    // coverage.
    let score = avgEval;
    score -= c.hotelsDirty * 3.0;
    score -= c.criticalTenants * 2.0;
    if (c.securityOffices > 0) score += 3;
    if (c.medicalCenters > 0) score += 3;
    if (c.foodOutlets > 0) score += 2;

    let verdict = "Unimpressed";
    let reward = 0;

    if (score >= K_EXCELLENT_EVAL_THRESHOLD) {
      this.goodReviews++;
      reward = K_SATISFIED_REWARD;
      verdict = "Delighted & Impressed";
      this.game.transferFunds(K_SATISFIED_REWARD, "vip", "VIP impressed - bonus granted");
      this.game.ui.showMessage("VIP delighted! Bonus $" + K_SATISFIED_REWARD + " granted.");
    } else if (score >= K_GOOD_EVAL_THRESHOLD) {
      this.goodReviews++;
      reward = Math.trunc(K_SATISFIED_REWARD / 2); // half bonus
      verdict = "Content with Accommodations";
      this.game.transferFunds(reward, "vip", "VIP content - small bonus");
      this.game.ui.showMessage("VIP content with the tower. $" + reward + " bonus.");
    } else {
      this.badReviews++;
      this.game.ui.showMessage(
        "Sorry! The VIP seems to have had an uncomfortable stay. They are not pleased with your tower.",
      );
    }

    this.game.ui.showVipReview?.({
      score,
      verdict,
      reward,
      breakdown: {
        cleanliness: c.hotelsDirty === 0 ? "Impeccable" : (c.hotelsDirty < 3 ? "Minor issues" : "Needs attention"),
        facilities: c.securityOffices > 0 && c.medicalCenters > 0 ? "Comprehensive" : "Basic",
        elevators: c.criticalTenants === 0 ? "Smooth Transit" : `${c.criticalTenants} Congestion Reports`,
      },
    });

    // A disappointed VIP needs time before re-inspecting; a satisfied one
    // completed the promotion gate (ratingMayIncrease below consumes it).
    this.nextVisitTime = score < K_GOOD_EVAL_THRESHOLD
      ? this.game.time.absolute + K_RETRY_DAYS // absolute is day-based
      : 0;

    this.game.ratingMayIncrease();
  }

  advance(dt) {
    if (this.visiting) {
      if (this.game.time.absolute >= this.visitEndTime) {
        this.endVisit();
      }
      return;
    }

    // Cooldown / forced visit (scheduleNow) pending.
    if (this.nextVisitTime > 0) {
      if (this.game.time.absolute >= this.nextVisitTime) {
        this.nextVisitTime = 0;
        this.beginVisit();
      }
      return;
    }

    // Promotion gate: the next star needs a VIP rating and the tower already
    // satisfies every other requirement (ISSUE-036).
    if (this.promotionNeedsVisit()) {
      this.beginVisit();
    }
  }

  isVisiting() {
    return this.visiting;
  }

  nextVisitAt() {
    return this.nextVisitTime;
  }

  positiveReviews() {
    return this.goodReviews;
  }

  encodeXML(xml) {
    xml.PushAttribute("vipNextVisit", this.nextVisitTime);
    xml.PushAttribute("vipVisiting", this.visiting);
    xml.PushAttribute("vipVisitEnd", this.visitEndTime);
    xml.PushAttribute("vipGoodReviews", this.goodReviews);
    xml.PushAttribute("vipBadReviews", this.badReviews);
  }

  decodeXML(el) {
    this.nextVisitTime = doubleAttr(el, "vipNextVisit", 0.0);
    this.visitEndTime = doubleAttr(el, "vipVisitEnd", 0.0);
    this.visiting = boolAttr(el, "vipVisiting", false);
    this.goodReviews = intAttr(el, "vipGoodReviews", 0);
    this.badReviews = intAttr(el, "vipBadReviews", 0);
  }
}
