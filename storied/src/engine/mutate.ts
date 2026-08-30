/**
 * Applies the mutation ops from format.md §7 to a variable table, immutably.
 * `applyMutations` runs an array in order — the one place composition
 * happens, per §7 — and each op is defensive about a variable being the
 * wrong type for it, since well-formed content is `validate.ts`'s job, not
 * this one's.
 */
import type { Mutation, VariableTable } from '../content/types';

function applyOne(mutation: Mutation, vars: VariableTable): VariableTable {
  const current = vars[mutation.var];

  switch (mutation.op) {
    case 'set':
      return { ...vars, [mutation.var]: mutation.value };

    case 'add': {
      const n = typeof current === 'number' ? current : 0;
      return { ...vars, [mutation.var]: n + mutation.value };
    }

    case 'sub': {
      const n = typeof current === 'number' ? current : 0;
      return { ...vars, [mutation.var]: n - mutation.value };
    }

    case 'toggle': {
      const b = typeof current === 'boolean' ? current : false;
      return { ...vars, [mutation.var]: !b };
    }

    case 'push': {
      const list = Array.isArray(current) ? current : [];
      // format.md §7: a list holds each string at most once.
      if (list.includes(mutation.value)) return vars;
      return { ...vars, [mutation.var]: [...list, mutation.value] };
    }

    case 'remove': {
      const list = Array.isArray(current) ? current : [];
      if (!list.includes(mutation.value)) return vars;
      return { ...vars, [mutation.var]: list.filter((item) => item !== mutation.value) };
    }
  }
}

export function applyMutations(mutations: readonly Mutation[], vars: VariableTable): VariableTable {
  return mutations.reduce((acc, mutation) => applyOne(mutation, acc), vars);
}
