// Port of OT::GameMap / MapNode / FloorNode
// (source/PathFinder/GameMap.{h,cpp}, MapNode.{h,cpp}, FloorNode.h).
//
// Transport node graph: one MapNode per (x, y) where a transport item sits
// (x = item.x + size.x/2), x-sorted chains per floor, UP/DOWN links along
// shafts and stair pairs. FloorNode is the per-floor aggregate used as A*
// start/end for non-transport items.

export const UP = 0;
export const DOWN = 1;
export const LEFT = 2;
export const RIGHT = 3;

export const INT_MIN = -2147483648;

export class MapNode {
  constructor(floor) {
    this.position = { x: 0, y: 0 };
    this.neighbours = [null, null, null, null]; // UP, DOWN, LEFT, RIGHT
    this.hasElevator = false;
    this.hasServiceElevator = false;
    this.transportItems = [null, null]; // UP, DOWN
    this.floorNode = floor; // null when this node IS a FloorNode
    this.nodesOnFloor = null;
  }
}

export class FloorNode extends MapNode {
  constructor(nodeList) {
    super(null);
    this.nodesOnFloor = nodeList;
  }
}

const key = (x, y) => x + "," + y;

function isServiceElevatorItem(item) {
  // C++ checks prototype->icon == 5; the JS catalog gives all elevators
  // icon 5, so distinguish by id (see docs/specs/elevators.md PORT NOTES).
  return item.prototype.id === "elevator-service";
}

export class GameMap {
  constructor(game) {
    this.game = game;
    this.gameMap = new Map(); // "x,y" -> MapNode
    this.mapNodesByFloor = new Map(); // int -> MapNode[] (x-sorted)
    this.floorNodes = new Map(); // int -> FloorNode
    this._resize = null; // handleElevatorResize anchor tracking (see below)
  }

  _floorList(y) {
    let list = this.mapNodesByFloor.get(y);
    if (!list) this.mapNodesByFloor.set(y, (list = []));
    return list;
  }

  // GameMap.cpp:25-142
  addNode(p, item) {
    if (!item) return null;

    // Create the FloorNode for this floor on demand.
    let f = this.floorNodes.get(p.y);
    if (!f) {
      f = new FloorNode(this._floorList(p.y));
      this.floorNodes.set(p.y, f);
      f.position.x = INT_MIN;
      f.position.y = p.y;
    }

    if (!item.canHaulPeople()) return f; // building item: no transport node

    let n = this.gameMap.get(key(p.x, p.y));
    if (!n) {
      n = new MapNode(f);
      this.gameMap.set(key(p.x, p.y), n);
      n.position = { x: p.x, y: p.y };

      // Splice into the floor's x-sorted chain (GameMap.cpp:47-72).
      const list = this.mapNodesByFloor.get(p.y);
      if (list.length === 0) {
        list.push(n);
      } else {
        let left = null;
        let right = null;
        for (let i = 0; i < list.length; i++) {
          const node = list[i];
          if (node.position.x <= p.x) {
            left = node;
          } else {
            right = node;
            list.splice(i, 0, n);
            break;
          }
        }

        if (left) {
          if (!right) list.push(n); // insert as last node
          n.neighbours[LEFT] = left;
          left.neighbours[RIGHT] = n;
        }
        if (right) {
          n.neighbours[RIGHT] = right;
          right.neighbours[LEFT] = n;
        }
      }
    }

    if (item.isStairlike() && p.y === item.position.y) {
      // Create the pair node at the top of the stair's footprint (spiral
      // stairs skip intermediate floors) and cross-link UP/DOWN.
      const upperY = p.y + item.size.y - 1;
      const nUpper = this.addNode({ x: p.x, y: upperY }, item);

      n.neighbours[UP] = nUpper;
      n.transportItems[UP] = item;

      nUpper.neighbours[DOWN] = n;
      nUpper.transportItems[DOWN] = item;
    } else if (item.prototype?.icon === 1 && item.size.y > 1 && p.y === item.position.y) {
      // Multi-story lobby vertical connections between mezzanine floors
      let prevNode = n;
      for (let fy = p.y + 1; fy < p.y + item.size.y; fy++) {
        const nUpper = this.addNode({ x: p.x, y: fy }, item);
        prevNode.neighbours[UP] = nUpper;
        prevNode.transportItems[UP] = item;

        nUpper.neighbours[DOWN] = prevNode;
        nUpper.transportItems[DOWN] = item;
        prevNode = nUpper;
      }
    } else if (item.isElevator()) {
      n.hasElevator = true;
      if (isServiceElevatorItem(item)) n.hasServiceElevator = true;

      // Link toward the first serviced floor above (GameMap.cpp:101-120);
      // recursion builds/links the rest of the chain.
      for (let i = p.y + 1; i < item.position.y + item.size.y; i++) {
        if (item.connectsFloor(i)) {
          if (!this.gameMap.has(key(p.x, i))) {
            this.addNode({ x: p.x, y: i }, item);
          } else {
            const upper = this.gameMap.get(key(p.x, i));
            n.neighbours[UP] = upper;
            n.transportItems[UP] = item;

            if (upper.neighbours[DOWN]) {
              n.neighbours[DOWN] = upper.neighbours[DOWN];
              n.transportItems[DOWN] = item;
            }

            upper.neighbours[DOWN] = n;
            upper.transportItems[DOWN] = item;
          }
          break;
        }
      }

      // Link toward the first serviced floor below (GameMap.cpp:122-138).
      // The C++ asserts the lower node exists; guard instead (a load with an
      // unserviced bottom floor can hit this without UB in JS).
      for (let i = p.y - 1; i >= item.position.y; i--) {
        if (item.connectsFloor(i)) {
          const lower = this.gameMap.get(key(p.x, i));
          if (lower) {
            n.neighbours[DOWN] = lower;
            n.transportItems[DOWN] = item;

            if (lower.neighbours[UP]) {
              n.neighbours[UP] = lower.neighbours[UP];
              n.transportItems[UP] = item;
            }

            lower.neighbours[UP] = n;
            lower.transportItems[UP] = item;
          }
          break;
        }
      }
    }

    return n;
  }

  // GameMap.cpp:144-206
  removeNode(p, item) {
    if (!item) return;
    if (!item.canHaulPeople()) return;
    const n = this.gameMap.get(key(p.x, p.y));
    if (!n) return;

    if (item.isStairlike() && p.y === item.position.y) {
      // Unlink the UP pair, then recurse on the pair node (which falls
      // through to the delete-if-unused cleanup).
      const upper = n.neighbours[UP];
      if (upper) {
        upper.neighbours[DOWN] = null;
        upper.transportItems[DOWN] = null;
      }
      n.neighbours[UP] = null;
      n.transportItems[UP] = null;

      this.removeNode({ x: p.x, y: p.y + item.size.y - 1 }, item);
    } else if (item.isElevator()) {
      n.hasElevator = false;
      if (isServiceElevatorItem(item)) n.hasServiceElevator = false;

      // Relink upper/lower neighbours to skip this node.
      if (n.neighbours[UP]) {
        n.neighbours[UP].neighbours[DOWN] = n.neighbours[DOWN];
        if (!n.neighbours[DOWN]) n.neighbours[UP].transportItems[DOWN] = null;
      }
      if (n.neighbours[DOWN]) {
        n.neighbours[DOWN].neighbours[UP] = n.neighbours[UP];
        if (!n.neighbours[UP]) n.neighbours[DOWN].transportItems[UP] = null;
      }

      n.neighbours[UP] = null;
      n.transportItems[UP] = null;
      n.neighbours[DOWN] = null;
      n.transportItems[DOWN] = null;
    }

    // Delete and erase only if no other overlapping item still uses the node.
    if (
      !n.hasElevator &&
      !n.hasServiceElevator &&
      !n.transportItems[UP] &&
      !n.transportItems[DOWN]
    ) {
      if (n.neighbours[LEFT]) n.neighbours[LEFT].neighbours[RIGHT] = n.neighbours[RIGHT];
      if (n.neighbours[RIGHT]) n.neighbours[RIGHT].neighbours[LEFT] = n.neighbours[LEFT];

      this.gameMap.delete(key(p.x, p.y));
      const list = this.mapNodesByFloor.get(p.y);
      if (list) {
        const i = list.indexOf(n);
        if (i >= 0) list.splice(i, 1);
      }
    }
  }

  // GameMap.cpp:208-225
  findNode(p, item) {
    if (!item) return null;
    if (!item.canHaulPeople()) {
      return this.floorNodes.get(p.y) ?? null;
    }

    const n = this.gameMap.get(key(p.x, p.y));
    if (!n) return null;

    if (
      item.isElevator() &&
      (!n.hasElevator || (n.transportItems[UP] !== item && n.transportItems[DOWN] !== item))
    ) {
      return null;
    } else if (item.isStairlike() && n.transportItems[UP] !== item) {
      return null;
    }
    return n;
  }

  // GameMap.cpp:227-272. The C++ takes `int& draggingElevatorStart` and
  // mutates it after every call; game.js passes the immutable pointer-down
  // value, so the mutated anchor is tracked here. The anchor resets whenever
  // a new drag tuple (elevator, lower, start) appears — two consecutive drags
  // with the exact same tuple would continue the previous anchor (harmless;
  // the removal loops are findNode-guarded). See PORT NOTES.
  handleElevatorResize(e, lower, startFloor) {
    const px = e.position.x + Math.floor(e.size.x / 2);
    let start = startFloor;
    if (
      !this._resize ||
      this._resize.elevator !== e ||
      this._resize.lower !== lower ||
      this._resize.start !== startFloor
    ) {
      this._resize = { elevator: e, lower, start: startFloor, anchor: startFloor };
    } else {
      start = this._resize.anchor;
    }

    if (lower) {
      if (start <= e.position.y) {
        // Elevator bottom shifted up: remove abandoned floor nodes.
        let prev = start;
        while (prev < e.position.y) {
          const p = { x: px, y: prev };
          if (this.findNode(p, e)) this.removeNode(p, e);
          prev++;
        }
      } else {
        // Elevator bottom shifted down: add the first serviced floor node.
        let y = e.position.y;
        while (y < start) {
          if (e.connectsFloor(y)) {
            this.addNode({ x: px, y }, e);
            break;
          }
          y++;
        }
      }
      this._resize.anchor = e.position.y;
    } else {
      if (start >= e.position.y + e.size.y - 1) {
        // Elevator top shifted down: remove abandoned floor nodes.
        let prev = start;
        while (prev >= e.position.y + e.size.y) {
          const p = { x: px, y: prev };
          if (this.findNode(p, e)) this.removeNode(p, e);
          prev--;
        }
      } else {
        // Elevator top shifted up: add the first serviced floor node.
        let y = start + 1;
        while (y < e.position.y + e.size.y) {
          if (e.connectsFloor(y)) {
            this.addNode({ x: px, y }, e);
            break;
          }
          y++;
        }
      }
      this._resize.anchor = e.position.y + e.size.y - 1;
    }
  }

  clear() {
    this.gameMap.clear();
    this.mapNodesByFloor.clear();
    this.floorNodes.clear();
    this._resize = null;
  }
}
