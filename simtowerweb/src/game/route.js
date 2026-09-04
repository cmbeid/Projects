// Port of OT::Route (source/Route.h/cpp).
// A route is a list of hops: nodes[0] = start item, last = destination.
// Middle nodes are transport items (elevator/stairs/escalator) with toFloor =
// the floor the person is on after that hop completes.
export class Route {
  constructor() {
    this.clear();
  }

  clear() {
    this.nodes = [];
    this.cached_score = 0;
    this.numStairs = 0;
    this.numEscalators = 0;
    this.numElevators = 0;
  }

  empty() {
    return this.nodes.length === 0;
  }

  add(item, floor) {
    const toFloor = floor === undefined ? item.position.y : floor;
    this.nodes.push({ item, toFloor });
    if (item.isElevator()) this.numElevators++;
    if (item.prototype.id === "stairs") this.numStairs++;
    if (item.prototype.id === "escalator") this.numEscalators++;
  }

  score() {
    return this.cached_score;
  }

  updateScore(s) {
    this.cached_score = s;
  }

  copyFrom(other) {
    this.clear();
    if (!other) return;
    this.nodes = other.nodes.map((n) => ({ item: n.item, toFloor: n.toFloor }));
    this.cached_score = other.cached_score;
    this.numStairs = other.numStairs;
    this.numEscalators = other.numEscalators;
    this.numElevators = other.numElevators;
  }
}
