// Tiny priority queue mirroring C++ std::priority_queue with a "laterThan"
// comparator (i.e. a min-heap on the caller's key). Items agent internal
// helper — populations here are tiny (<= 50), so insertion sort suffices.

export class PriorityQueue {
  constructor(keyFn) {
    this.keyFn = keyFn;
    this.items = [];
  }

  push(t) {
    const k = this.keyFn(t);
    let i = this.items.length;
    while (i > 0 && this.keyFn(this.items[i - 1]) > k) i--;
    this.items.splice(i, 0, t);
  }

  pop() {
    return this.items.shift();
  }

  top() {
    return this.items[0];
  }

  empty() {
    return this.items.length === 0;
  }

  clear() {
    while (this.items.length) this.items.pop();
  }
}
