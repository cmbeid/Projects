// Port of OT::PathFinder + MapSearchNode + the stlastar A* framework
// (source/PathFinder/PathFinder.{h,cpp}, MapSearchNode.{h,cpp},
// thirdparty/astar-search/stlastar.h).
//
// A* over the GameMap node graph with exact C++ costs: walking 1/tile (free
// on floor 0), FLOOR_COST 5 per floor, stairs 30+5, escalator 10+5, standard
// elevator 170 + 5/floor, service/express 20 + 5/floor. Transfer limits and
// the 80-tile inhibitory overage penalty are 1:1 with MapSearchNode.cpp,
// EXCEPT the stairlike budget is measured per transport segment (see
// stairsSinceTransport / PORT NOTE 1 below).

import { Route } from "../route.js";
import { UP, DOWN, LEFT, RIGHT, INT_MIN } from "./gamemap.js";

// MapSearchNode.h:38-46
export const MAX_WALKING_DIST = 80;
export const WALKING_COST = 1;
export const FLOOR_COST = 5;
export const ESCALATOR_COST = 10;
export const STAIRS_COST = 30;
export const ELEVATOR_COST = STAIRS_COST * 3 + WALKING_COST * MAX_WALKING_DIST; // 170
export const EXPRESS_COST = 20;
export const INHIBITORY_COST = 10000;

const SEARCH_STATE_SEARCHING = 1;
const SEARCH_STATE_SUCCEEDED = 2;
const SEARCH_STATE_FAILED = 3;

// The C++ distinguishes stairs by prototype icon 2 and standard elevators by
// icon 4; the JS catalog renumbers icons, so use ids (same semantics — see
// docs/specs/elevators.md PORT NOTES).
function isStairsItem(item) {
  return item.prototype.id === "stairs";
}
function isStandardElevatorItem(item) {
  return item.prototype.id === "elevator-standard";
}

function makeState(mapNode) {
  return {
    mapNode,
    parent_item: null,
    numStairs: 0,
    numEscalators: 0,
    numElevators: 0,
    // Stairlike usage since the last lobby/elevator contact (PORT NOTE 1):
    // the C++ measures the 4-stairs/6-escalators budget cumulatively over the
    // whole journey, which marks tower tops unreachable when stairs are also
    // used BELOW the elevator that serves them. Web semantics: the budget
    // refills on every elevator node arrival and multi-story lobby traversal.
    stairsSinceTransport: 0,
    escalatorsSinceTransport: 0,
    g: 0,
    h: 0,
    start_point: { x: INT_MIN, y: INT_MIN },
    end_point: { x: INT_MIN, y: INT_MIN },
    serviceRoute: false,
  };
}

// stlastar.h Node: user state + A* bookkeeping.
class Node {
  constructor(state) {
    this.state = state;
    this.parent = null;
    this.child = null;
    this.g = 0;
    this.h = 0;
    this.f = 0;
  }
}

// --- binary min-heap on f (stlastar push_heap/pop_heap with the f> f
// comparator; ties keep deterministic insertion-ish order) -------------------

function heapPush(heap, node) {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].f > heap[i].f) {
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    } else break;
  }
}

function makeHeap(heap) {
  for (let i = (heap.length >> 1) - 1; i >= 0; i--) heapSiftDown(heap, i);
}

function heapSiftDown(heap, i) {
  const n = heap.length;
  for (;;) {
    let smallest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < n && heap[l].f < heap[smallest].f) smallest = l;
    if (r < n && heap[r].f < heap[smallest].f) smallest = r;
    if (smallest === i) break;
    [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
    i = smallest;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    heapSiftDown(heap, 0);
  }
  return top;
}

// --- MapSearchNode logic (MapSearchNode.cpp) ---------------------------------

// Which transport item connects this node to the successor's node.
function getItemOnRoute(nodeState, succMapNode) {
  const mn = nodeState.mapNode;
  if (!succMapNode) return null;

  if (mn.neighbours[UP] === succMapNode) return mn.transportItems[UP];
  else if (mn.neighbours[DOWN] === succMapNode) return mn.transportItems[DOWN];
  else if (mn.transportItems[UP] && mn.transportItems[UP] === succMapNode.transportItems[DOWN])
    return mn.transportItems[UP];
  else if (mn.transportItems[DOWN] && mn.transportItems[DOWN] === succMapNode.transportItems[UP])
    return mn.transportItems[DOWN];
  return null;
}

// GetCost (MapSearchNode.cpp:20-72). Copies the transfer counters and g onto
// the successor state, adds the edge cost, returns it.
function getCost(nodeState, succState) {
  const i = getItemOnRoute(nodeState, succState.mapNode);
  succState.parent_item = i;
  succState.numStairs = nodeState.numStairs;
  succState.numEscalators = nodeState.numEscalators;
  succState.stairsSinceTransport = nodeState.stairsSinceTransport;
  succState.escalatorsSinceTransport = nodeState.escalatorsSinceTransport;
  succState.numElevators = nodeState.numElevators;
  succState.g = nodeState.g;

  let traverse_cost = 0;
  if (!i) {
    // NULL item: plain floor traversal.
    if (nodeState.mapNode.position.y === 0 && succState.mapNode.position.y === 0) {
      traverse_cost = 0; // movement in the main lobby is free
    } else if (!nodeState.mapNode.floorNode && nodeState.start_point.x > INT_MIN) {
      // Leaving the start FloorNode: measure from the start item's position.
      traverse_cost = Math.abs(succState.mapNode.position.x - nodeState.start_point.x) * WALKING_COST;
    } else if (!succState.mapNode.floorNode && nodeState.mapNode.position.y === nodeState.end_point.y) {
      // Entering the goal FloorNode: measure to the destination item, with
      // the inhibitory overage penalty beyond MAX_WALKING_DIST.
      const end_walking_dist = Math.abs(nodeState.end_point.x - nodeState.mapNode.position.x);
      if (end_walking_dist > MAX_WALKING_DIST) {
        traverse_cost = Math.trunc(
          MAX_WALKING_DIST * WALKING_COST + (end_walking_dist / MAX_WALKING_DIST) * INHIBITORY_COST,
        );
      } else {
        traverse_cost = end_walking_dist * WALKING_COST;
      }
    } else {
      traverse_cost =
        Math.abs(succState.mapNode.position.x - nodeState.mapNode.position.x) * WALKING_COST;
    }
  } else if (i.isStairlike()) {
    if (isStairsItem(i)) {
      traverse_cost += STAIRS_COST;
      succState.numStairs++;
      succState.stairsSinceTransport++;
    } else {
      traverse_cost += ESCALATOR_COST;
      succState.numEscalators++;
      succState.escalatorsSinceTransport++;
    }
    traverse_cost += FLOOR_COST;
  } else if (i.isElevator()) {
    if (i !== nodeState.parent_item) {
      // First boarding of this shaft.
      if (isStandardElevatorItem(i)) traverse_cost += ELEVATOR_COST;
      else traverse_cost += EXPRESS_COST;
      succState.numElevators++;
    }
    // Riding an elevator refills the stairlike budget (PORT NOTE 1).
    succState.stairsSinceTransport = 0;
    succState.escalatorsSinceTransport = 0;
    traverse_cost += Math.abs(succState.mapNode.position.y - nodeState.mapNode.position.y) * FLOOR_COST;
  } else if (i.prototype?.icon === 1 /* Lobby */) {
    // Multi-story lobby vertical traversal (spiral stairs / open mezzanine)
    traverse_cost = Math.abs(succState.mapNode.position.y - nodeState.mapNode.position.y) * 10;
    // The lobby is a lobby contact: budget refills here too (PORT NOTE 1).
    succState.stairsSinceTransport = 0;
    succState.escalatorsSinceTransport = 0;
  } else {
    traverse_cost = INHIBITORY_COST; // should not happen; deters expansion
  }

  // Arriving on any elevator node (even just walking onto its tile) counts as
  // elevator contact and refills the stairlike budget (PORT NOTE 1).
  if (succState.mapNode.hasElevator) {
    succState.stairsSinceTransport = 0;
    succState.escalatorsSinceTransport = 0;
  }

  succState.g += traverse_cost;
  return traverse_cost;
}

// GoalDistanceEstimate (MapSearchNode.cpp:74-88): Manhattan |dx|*1 + |dy|*5.
function goalDistanceEstimate(nodeState, goalState) {
  let h;
  if (!goalState.mapNode.floorNode) {
    // Goal is a FloorNode ("anywhere on floor y").
    if (!nodeState.mapNode.floorNode) {
      h = Math.abs(nodeState.end_point.y - nodeState.mapNode.position.y) * FLOOR_COST;
    } else {
      h =
        Math.abs(nodeState.end_point.x - nodeState.mapNode.position.x) * WALKING_COST +
        Math.abs(nodeState.end_point.y - nodeState.mapNode.position.y) * FLOOR_COST;
    }
  } else {
    // Goal is a transport node.
    if (!nodeState.mapNode.floorNode) {
      h =
        Math.abs(goalState.mapNode.position.x - nodeState.start_point.x) * WALKING_COST +
        Math.abs(goalState.mapNode.position.y - nodeState.start_point.y) * FLOOR_COST;
    } else {
      h =
        Math.abs(goalState.mapNode.position.x - nodeState.mapNode.position.x) * WALKING_COST +
        Math.abs(goalState.mapNode.position.y - nodeState.mapNode.position.y) * FLOOR_COST;
    }
  }
  nodeState.h = h;
  return h;
}

// canTransfer (MapSearchNode.cpp:236-269).
// UP/DOWN limits match the C++ ("4 stairs; 6 escalators; 1 stair + 2
// escalators OR 2 stairs + 1 escalator") but are measured against the
// per-segment counters (stairsSinceTransport / escalatorsSinceTransport —
// PORT NOTE 1), so stairs below an elevator do not consume the budget
// needed for stairs above it.
function canTransfer(start, dest, dir) {
  if (dir === UP || dir === DOWN) {
    // Once in an elevator node, travel is allowed for the whole shaft.
    if (start.mapNode.hasElevator) return true;

    const item = start.mapNode.transportItems[dir];
    if (!item) return true; // unreachable in practice; avoids a JS TypeError
    if (isStairsItem(item)) {
      if (start.stairsSinceTransport > 3 - start.escalatorsSinceTransport) return false;
    } else {
      if (start.escalatorsSinceTransport > 5) return false;
      if (
        start.stairsSinceTransport > 0 &&
        start.escalatorsSinceTransport > 2 - start.stairsSinceTransport
      ) {
        return false;
      }
    }
  } else {
    if (dest.hasElevator) {
      if (
        (!start.serviceRoute && dest.hasServiceElevator) ||
        (start.serviceRoute && !dest.hasServiceElevator)
      ) {
        return false;
      }
      if (start.numElevators > 1) return false;
      if (
        start.numElevators === 1 &&
        (start.mapNode.position.y % 15 !== 0 || start.numStairs > 0 || start.numEscalators > 0)
      ) {
        return false;
      }
    }
    // Walking past stairlike nodes laterally has no limits.
  }
  return true;
}

// createNode (MapSearchNode.cpp:271-275): fresh state carrying end_point and
// serviceRoute (start_point intentionally NOT copied — 1:1 with the C++).
function createNode(nodeState, mapNode) {
  const n = makeState(mapNode);
  n.end_point = nodeState.end_point;
  n.serviceRoute = nodeState.serviceRoute;
  return n;
}

// GetSuccessors (MapSearchNode.cpp:90-201).
function getSuccessors(nodeState, parentNodeState, goalMapNode, addSuccessor) {
  let left = null;
  let right = null;

  if (!parentNodeState && !nodeState.mapNode.floorNode) {
    // Start node which is also a FloorNode: add the nearest transferable
    // transport nodes left/right of the start item.
    const nodesOnFloor = nodeState.mapNode.nodesOnFloor;
    for (const node of nodesOnFloor) {
      if (node.position.x <= nodeState.start_point.x && canTransfer(nodeState, node, LEFT)) {
        left = node;
      } else if (canTransfer(nodeState, node, RIGHT)) {
        right = node;
        break;
      }
    }

    if (left) addSuccessor(createNode(nodeState, left));
    if (right) addSuccessor(createNode(nodeState, right));
    return true;
  }

  if (nodeState.mapNode.position.y === nodeState.end_point.y && !goalMapNode.floorNode) {
    // On the goal floor with a FloorNode goal: the floor node is the only
    // successor.
    if (!nodeState.mapNode.floorNode) return false; // error guard (C++ assert)
    addSuccessor(createNode(nodeState, nodeState.mapNode.floorNode));
    return true;
  }

  // LEFT/RIGHT: walk the chain to the FIRST transferable node each way.
  let node = nodeState.mapNode.neighbours[LEFT];
  while (node && !left) {
    if (!canTransfer(nodeState, node, LEFT)) {
      node = node.neighbours[LEFT];
      continue;
    }
    left = node;
  }

  node = nodeState.mapNode.neighbours[RIGHT];
  while (node && !right) {
    if (!canTransfer(nodeState, node, RIGHT)) {
      node = node.neighbours[RIGHT];
      continue;
    }
    right = node;
  }

  if (left) addSuccessor(createNode(nodeState, left));
  if (right) addSuccessor(createNode(nodeState, right));

  // UP/DOWN: elevators add every node along the shaft chain (cost is
  // per-floor); stairs add the single endpoint.
  if (nodeState.mapNode.neighbours[UP]) {
    node = nodeState.mapNode.neighbours[UP];
    if (nodeState.mapNode.hasElevator) {
      while (node) {
        addSuccessor(createNode(nodeState, node));
        node = node.neighbours[UP];
      }
    } else if (canTransfer(nodeState, node, UP)) {
      addSuccessor(createNode(nodeState, node));
    }
  }

  if (nodeState.mapNode.neighbours[DOWN]) {
    node = nodeState.mapNode.neighbours[DOWN];
    if (nodeState.mapNode.hasElevator) {
      while (node) {
        addSuccessor(createNode(nodeState, node));
        node = node.neighbours[DOWN];
      }
    } else if (canTransfer(nodeState, node, DOWN)) {
      addSuccessor(createNode(nodeState, node));
    }
  }

  return true;
}

// --- stlastar AStarSearch (SearchStep semantics) ------------------------------

class AStarSearch {
  constructor() {
    this.open = [];
    this.closed = [];
    this.start = null;
    this.goal = null;
    this.state = SEARCH_STATE_SEARCHING;
    this._current = null; // solution iterator
  }

  setStartAndGoalStates(startState, goalState) {
    this.start = new Node(startState);
    this.goal = new Node(goalState);

    this.start.g = 0;
    this.start.h = goalDistanceEstimate(this.start.state, this.goal.state);
    this.start.f = this.start.g + this.start.h;
    this.start.parent = null;

    heapPush(this.open, this.start);
  }

  searchStep() {
    if (this.state === SEARCH_STATE_SUCCEEDED || this.state === SEARCH_STATE_FAILED) {
      return this.state;
    }
    if (this.open.length === 0) {
      this.state = SEARCH_STATE_FAILED;
      return this.state;
    }

    // Pop the lowest-f node.
    const n = heapPop(this.open);

    // Goal test on pop; copies g/h into the goal state (IsGoal).
    if (n.state.mapNode === this.goal.state.mapNode) {
      this.goal.state.g = n.g;
      this.goal.state.h = n.h;
      this.goal.parent = n.parent;

      if (n.state.mapNode !== this.start.state.mapNode) {
        // Build the child chain from goal back to start.
        let nodeChild = this.goal;
        let nodeParent = this.goal.parent;
        while (nodeParent && nodeChild !== this.start) {
          nodeParent.child = nodeChild;
          nodeChild = nodeParent;
          nodeParent = nodeParent.parent;
        }
      }

      this.state = SEARCH_STATE_SUCCEEDED;
      return this.state;
    }

    // Generate successors.
    const successors = [];
    const ok = getSuccessors(
      n.state,
      n.parent ? n.parent.state : null,
      this.goal.state.mapNode,
      (s) => successors.push(new Node(s)),
    );
    if (!ok) {
      this.open.length = 0;
      this.closed.length = 0;
      this.state = SEARCH_STATE_FAILED;
      return this.state;
    }

    for (const succ of successors) {
      const newg = n.g + getCost(n.state, succ.state);

      // State equivalence includes map location and transfer stamina counters so
      // that a cheaper path with exhausted stair/escalator stamina does not
      // falsely prune a valid elevator path that has refilled stamina.
      const isSameState = (s1, s2) =>
        s1.mapNode === s2.mapNode &&
        s1.stairsSinceTransport === s2.stairsSinceTransport &&
        s1.escalatorsSinceTransport === s2.escalatorsSinceTransport &&
        s1.numElevators === s2.numElevators;

      const isDominating = (existing, s, g) =>
        existing.state.mapNode === s.mapNode &&
        existing.g <= g &&
        existing.state.stairsSinceTransport <= s.stairsSinceTransport &&
        existing.state.escalatorsSinceTransport <= s.escalatorsSinceTransport &&
        existing.state.numElevators <= s.numElevators;

      // Check open list: if a dominating node exists, skip; if same state with higher cost, replace.
      let openIdx = -1;
      let dominated = false;
      for (let i = 0; i < this.open.length; i++) {
        if (isDominating(this.open[i], succ.state, newg)) {
          dominated = true;
          break;
        }
        if (isSameState(this.open[i].state, succ.state)) {
          openIdx = i;
          break;
        }
      }
      if (dominated) continue;

      // Check closed list: if a dominating node exists, skip; if same state with higher cost, reopen.
      let closedIdx = -1;
      for (let i = 0; i < this.closed.length; i++) {
        if (isDominating(this.closed[i], succ.state, newg)) {
          dominated = true;
          break;
        }
        if (isSameState(this.closed[i].state, succ.state)) {
          closedIdx = i;
          break;
        }
      }
      if (dominated) continue;

      // Best node with this state so far.
      succ.parent = n;
      succ.g = newg;
      succ.h = goalDistanceEstimate(succ.state, this.goal.state);
      succ.f = succ.g + succ.h;

      // Re-open when a cheaper path to a closed state was found.
      if (closedIdx >= 0) this.closed.splice(closedIdx, 1);

      // Replace the stale open-list entry (re-make the heap, as stlastar).
      if (openIdx >= 0) {
        this.open.splice(openIdx, 1);
        makeHeap(this.open);
      }

      heapPush(this.open, succ);
    }

    this.closed.push(n);
    return this.state;
  }

  // Solution traversal (child chain).
  getSolutionStart() {
    this._current = this.start;
    return this.start;
  }

  getSolutionNext() {
    if (this._current && this._current.child) {
      this._current = this._current.child;
      return this._current;
    }
    return null;
  }
}

// --- PathFinder (PathFinder.cpp) ----------------------------------------------

export class PathFinder {
  constructor(gameMap, game) {
    this.gameMap = gameMap;
    this.game = game;
  }

  findRoute(startNode, endNode, startItem, destinationItem, serviceRoute = false) {
    const r = new Route();
    // Guard: the C++ would dereference NULL here (crash) when a floor has no
    // FloorNode; return the empty route instead (see PORT NOTES).
    if (!startNode || !endNode || !startItem || !destinationItem) return r;

    const start_point = {
      x: startItem.position.x + Math.floor(startItem.size.x / 2),
      y: startNode.position.y,
    };
    const end_point = {
      x: destinationItem.position.x + Math.floor(destinationItem.size.x / 2),
      y: endNode.position.y,
    };

    const nodeStart = makeState(startNode);
    nodeStart.parent_item = startItem;
    nodeStart.start_point = start_point;
    nodeStart.end_point = end_point;
    nodeStart.serviceRoute = serviceRoute;
    const nodeEnd = makeState(endNode);

    const astar = new AStarSearch();
    astar.setStartAndGoalStates(nodeStart, nodeEnd);

    let state;
    do {
      state = astar.searchStep();
    } while (state === SEARCH_STATE_SEARCHING);

    this.buildRoute(r, astar, startItem, destinationItem);
    return r;
  }

  // PathFinder.cpp:46-88 — reconstruct the Route from the solution chain,
  // merging consecutive legs of the same elevator into one node.
  buildRoute(r, astar, start_item, end_item) {
    if (astar.state !== SEARCH_STATE_SUCCEEDED) {
      r.clear();
      return;
    }
    if (!start_item || !end_item) {
      r.clear();
      return;
    }

    const startNode = astar.start;
    const endNode = astar.goal;

    if (startNode.state.mapNode === endNode.state.mapNode) {
      r.add(start_item, startNode.state.mapNode.position.y);
      r.add(end_item, endNode.state.mapNode.position.y);
    } else {
      astar.getSolutionStart();
      let n = astar.getSolutionNext();
      r.add(start_item, startNode.state.mapNode.position.y);
      while (n && n !== endNode) {
        const nChild = astar.getSolutionNext();
        if (!nChild) break; // safety (C++ would deref null)
        const i = nChild.state.parent_item;
        if (i) {
          let toFloor;
          if (i.canHaulPeople()) toFloor = nChild.state.mapNode.position.y;
          else toFloor = n.state.mapNode.position.y;

          const rnPrev = r.nodes[r.nodes.length - 1];
          if (i.isElevator() && rnPrev.item.isElevator() && i === rnPrev.item) {
            // Moving along the same elevator: one node per ride.
            rnPrev.toFloor = toFloor;
          } else {
            r.add(i, toFloor);
          }
        }
        n = nChild;
      }
      r.add(end_item, endNode.state.mapNode.position.y);
    }
    r.updateScore(Math.trunc(Math.abs(endNode.state.g + endNode.state.h)));
  }
}
