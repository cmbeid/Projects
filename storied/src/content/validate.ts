/**
 * "Is this story internally consistent, and can a player actually reach
 * everything in it?" — pure and disk-free, so it can run against a fixture
 * in a test with no filesystem at all. Image *existence* is the one check
 * that needs disk; it's injected via `AssetChecker` rather than baked in, so
 * `scripts/validate-content.ts` supplies a real one and tests can omit it.
 *
 * Every check here corresponds to a rule in `format.md`, mostly §11-13.
 */
import type {
  Condition,
  Manifest,
  Mutation,
  Story,
  StoryNode,
  VarCondition,
  VarValue,
} from './types';

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

export interface AssetChecker {
  /** True if `relativeSrc` (relative to the story's own folder) exists on disk. */
  imageExists(relativeSrc: string): boolean;
}

type VarType = 'boolean' | 'number' | 'string' | 'list';

function typeOfValue(value: VarValue): VarType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'list';
}

function variableTypes(variables: Story['variables']): Map<string, VarType> {
  const out = new Map<string, VarType>();
  for (const [name, value] of Object.entries(variables)) out.set(name, typeOfValue(value));
  return out;
}

function serializeValue(value: VarValue): string {
  return JSON.stringify(value);
}

/** §6: a `to`/`visited` names a real node id. */
function checkCondition(
  condition: Condition,
  path: string,
  nodeIds: ReadonlySet<string>,
  varTypes: ReadonlyMap<string, VarType>,
  errors: string[],
): void {
  if ('all' in condition) {
    condition.all.forEach((c, i) => checkCondition(c, `${path}.all[${i}]`, nodeIds, varTypes, errors));
    return;
  }
  if ('any' in condition) {
    condition.any.forEach((c, i) => checkCondition(c, `${path}.any[${i}]`, nodeIds, varTypes, errors));
    return;
  }
  if ('not' in condition) {
    checkCondition(condition.not, `${path}.not`, nodeIds, varTypes, errors);
    return;
  }
  if ('visited' in condition) {
    if (!nodeIds.has(condition.visited)) {
      errors.push(`${path}.visited: node "${condition.visited}" does not exist`);
    }
    return;
  }

  const type = varTypes.get(condition.var);
  if (type === undefined) {
    errors.push(`${path}.var: variable "${condition.var}" is not declared`);
    return;
  }
  if ('eq' in condition || 'ne' in condition) {
    const value = 'eq' in condition ? condition.eq : condition.ne;
    if (typeOfValue(value) !== type) {
      errors.push(`${path}: variable "${condition.var}" is ${type}, compared against a ${typeOfValue(value)}`);
    }
    return;
  }
  if ('gt' in condition || 'gte' in condition || 'lt' in condition || 'lte' in condition) {
    if (type !== 'number') {
      errors.push(`${path}: variable "${condition.var}" is ${type}, not a number — numeric comparison doesn't apply`);
    }
    return;
  }
  // 'has' in condition
  if (type !== 'list') {
    errors.push(`${path}: variable "${condition.var}" is ${type}, not a list — "has" doesn't apply`);
  }
}

/** §7: op matches the variable's declared type. */
function checkMutations(
  mutations: readonly Mutation[],
  path: string,
  varTypes: ReadonlyMap<string, VarType>,
  errors: string[],
): void {
  mutations.forEach((m, i) => {
    const mp = `${path}[${i}]`;
    const type = varTypes.get(m.var);
    if (type === undefined) {
      errors.push(`${mp}.var: variable "${m.var}" is not declared`);
      return;
    }
    if (m.op === 'set') {
      if (typeOfValue(m.value) !== type) {
        errors.push(`${mp}: "set" on "${m.var}" (${type}) given a ${typeOfValue(m.value)} value`);
      }
      return;
    }
    if (m.op === 'add' || m.op === 'sub') {
      if (type !== 'number') errors.push(`${mp}: "${m.op}" needs a number variable, "${m.var}" is ${type}`);
      return;
    }
    if (m.op === 'toggle') {
      if (type !== 'boolean') errors.push(`${mp}: "toggle" needs a boolean variable, "${m.var}" is ${type}`);
      return;
    }
    // push / remove
    if (type !== 'list') errors.push(`${mp}: "${m.op}" needs a list variable, "${m.var}" is ${type}`);
  });
}

/** §9: every `{name}` in rendered text names a declared variable. Escaped `\{` is skipped. */
const INTERP_RE = /(\\?)\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

function checkInterpolatedVars(
  text: string,
  path: string,
  varTypes: ReadonlyMap<string, VarType>,
  errors: string[],
): void {
  for (const match of text.matchAll(INTERP_RE)) {
    if (match[1] === '\\') continue;
    const name = match[2]!;
    if (!varTypes.has(name)) errors.push(`${path}: "{${name}}" references an undeclared variable`);
  }
}

function checkNodeText(
  node: StoryNode,
  path: string,
  varTypes: ReadonlyMap<string, VarType>,
  errors: string[],
): void {
  node.blocks.forEach((block, i) => {
    if (block.type === 'text') checkInterpolatedVars(block.text, `${path}.blocks[${i}].text`, varTypes, errors);
  });
  (node.choices ?? []).forEach((choice, i) => {
    checkInterpolatedVars(choice.text, `${path}.choices[${i}].text`, varTypes, errors);
  });
}

/**
 * §13: every node reachable from `start`, walking through every choice
 * including ones behind a condition. Conditions are deliberately ignored
 * here — a choice a player can never actually unlock is still a path the
 * validator must credit, so this never reports a false "unreachable" error.
 * The narrower question, "can this condition ever be true at all", is a
 * warning (`unsatisfiableChoiceWarnings`), not an error.
 */
function reachableNodes(story: Story): Set<string> {
  const reachable = new Set<string>();
  if (!(story.start in story.nodes)) return reachable;
  const stack: string[] = [story.start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = story.nodes[id];
    if (!node) continue;
    for (const choice of node.choices ?? []) {
      if (choice.to in story.nodes) stack.push(choice.to);
    }
  }
  return reachable;
}

type PossibleInfo =
  | { kind: 'scalar'; values: Set<string> | 'any' }
  | { kind: 'list'; members: Set<string> | 'any' };

/**
 * A deliberately coarse, sound-in-one-direction model of "what could this
 * variable be at some point in the story": the initial value, plus every
 * literal a `set` (or `push`, for lists) ever assigns it anywhere in the
 * story — regardless of path. A relative op (`add`/`sub`/`toggle`, or `set`
 * on a list) makes a variable's future values untrackable, so it's marked
 * `'any'` rather than guessed at.
 *
 * This never claims a value is *impossible* when it actually isn't — the
 * only way to keep the warning below from ever firing on a condition that
 * could genuinely be true on some real playthrough.
 */
function computePossibleValues(story: Story): Map<string, PossibleInfo> {
  const possible = new Map<string, PossibleInfo>();
  for (const [name, value] of Object.entries(story.variables)) {
    possible.set(
      name,
      Array.isArray(value) ? { kind: 'list', members: new Set(value) } : { kind: 'scalar', values: new Set([serializeValue(value)]) },
    );
  }

  const allMutations: Mutation[] = [];
  for (const node of Object.values(story.nodes)) {
    if (node.onEnter) allMutations.push(...node.onEnter);
    for (const choice of node.choices ?? []) {
      if (choice.set) allMutations.push(...choice.set);
    }
  }

  for (const m of allMutations) {
    const info = possible.get(m.var);
    if (!info) continue; // undeclared — already reported by checkMutations
    if (info.kind === 'scalar') {
      if (m.op === 'set' && info.values !== 'any') info.values.add(serializeValue(m.value));
      else if (m.op === 'add' || m.op === 'sub' || m.op === 'toggle') possible.set(m.var, { kind: 'scalar', values: 'any' });
    } else {
      if (m.op === 'push' && info.members !== 'any') info.members.add(m.value);
      else if (m.op === 'set') possible.set(m.var, { kind: 'list', members: 'any' });
    }
  }

  return possible;
}

function leafSatisfiable(condition: VarCondition, possible: ReadonlyMap<string, PossibleInfo>): boolean {
  const info = possible.get(condition.var);
  if (!info) return true; // undeclared — already reported elsewhere

  if (info.kind === 'list') {
    if (info.members === 'any') return true;
    if ('has' in condition) return info.members.has(condition.has);
    return true;
  }

  if (info.values === 'any') return true;
  if ('eq' in condition) return info.values.has(serializeValue(condition.eq));
  if ('ne' in condition) return true; // proving a `ne` impossible needs the full domain; not attempted
  const numbers = [...info.values].map((s) => JSON.parse(s) as unknown).filter((n): n is number => typeof n === 'number');
  if (numbers.length === 0) return true;
  if ('gt' in condition) return numbers.some((n) => n > condition.gt);
  if ('gte' in condition) return numbers.some((n) => n >= condition.gte);
  if ('lt' in condition) return numbers.some((n) => n < condition.lt);
  if ('lte' in condition) return numbers.some((n) => n <= condition.lte);
  return true;
}

/**
 * `all` requires every branch individually satisfiable — necessary, not
 * sufficient, given the independent per-variable domains above, so this
 * still only ever under-reports. `not` and `visited` aren't modeled at all
 * and are always treated as satisfiable, for the same reason.
 */
function conditionPossiblySatisfiable(condition: Condition, possible: ReadonlyMap<string, PossibleInfo>): boolean {
  if ('all' in condition) return condition.all.every((c) => conditionPossiblySatisfiable(c, possible));
  if ('any' in condition) return condition.any.some((c) => conditionPossiblySatisfiable(c, possible));
  if ('not' in condition) return true;
  if ('visited' in condition) return true;
  return leafSatisfiable(condition, possible);
}

function unsatisfiableChoiceWarnings(story: Story): string[] {
  const possible = computePossibleValues(story);
  const warnings: string[] = [];
  for (const [nodeId, node] of Object.entries(story.nodes)) {
    (node.choices ?? []).forEach((choice, i) => {
      if (choice.if && !conditionPossiblySatisfiable(choice.if, possible)) {
        warnings.push(`nodes.${nodeId}.choices[${i}].if: can never be true given this story's variables — check for a typo`);
      }
    });
  }
  return warnings;
}

const MAX_NODE_CHARS = 1200;

export function validateStory(story: Story, assets?: AssetChecker): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(Object.keys(story.nodes));
  const varTypes = variableTypes(story.variables);

  if (!nodeIds.has(story.start)) {
    errors.push(`start: node "${story.start}" does not exist`);
  }

  for (const [nodeId, node] of Object.entries(story.nodes)) {
    const nodePath = `nodes.${nodeId}`;
    checkNodeText(node, nodePath, varTypes, errors);
    if (node.onEnter) checkMutations(node.onEnter, `${nodePath}.onEnter`, varTypes, errors);

    (node.choices ?? []).forEach((choice, i) => {
      const choicePath = `${nodePath}.choices[${i}]`;
      if (!nodeIds.has(choice.to)) errors.push(`${choicePath}.to: node "${choice.to}" does not exist`);
      if (choice.if) checkCondition(choice.if, `${choicePath}.if`, nodeIds, varTypes, errors);
      if (choice.set) checkMutations(choice.set, `${choicePath}.set`, varTypes, errors);
    });

    if (assets) {
      node.blocks.forEach((block, i) => {
        // A data: URI is self-contained — see format.md §14 — so there is no
        // folder to check it against; it's valid by construction.
        if (block.type === 'image' && !block.src.startsWith('data:') && !assets.imageExists(block.src)) {
          errors.push(`${nodePath}.blocks[${i}].src: image "${block.src}" not found`);
        }
      });
    }
  }

  const bgImage = story.theme?.background?.image;
  if (assets && bgImage && !bgImage.startsWith('data:') && !assets.imageExists(bgImage)) {
    errors.push(`theme.background.image: image "${bgImage}" not found`);
  }

  const reachable = reachableNodes(story);
  for (const nodeId of nodeIds) {
    if (!reachable.has(nodeId)) errors.push(`nodes.${nodeId}: unreachable from "${story.start}"`);
  }

  warnings.push(...unsatisfiableChoiceWarnings(story));

  for (const [nodeId, node] of Object.entries(story.nodes)) {
    const chars = node.blocks.reduce((sum, b) => sum + (b.type === 'text' ? b.text.length : 0), 0);
    if (chars > MAX_NODE_CHARS) {
      warnings.push(`nodes.${nodeId}: ${chars} characters of text — more than a phone screen comfortably holds`);
    }
  }

  return { errors, warnings };
}

export function validateManifest(manifest: Manifest): ValidationReport {
  const errors: string[] = [];
  const seen = new Set<string>();
  manifest.stories.forEach((entry, i) => {
    if (seen.has(entry.id)) errors.push(`stories[${i}].id: duplicate story id "${entry.id}"`);
    seen.add(entry.id);
  });
  return { errors, warnings: [] };
}
