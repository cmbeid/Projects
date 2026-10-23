import type { AreaKind, SkillId } from '../data/types';

export type View =
  | 'skills' | 'skill' | 'bank' | 'combat' | 'guilds' | 'more' | 'shop' | 'quests' | 'raid' | 'pets' | 'completion' | 'museum' | 'stats' | 'settings' | 'log';

export type CombatTab = 'areas' | 'gear' | 'prayer' | 'magic' | 'slayer';

/** What the screen is showing. Not saved with the game. */
export interface Ui {
  view: View;
  skill: SkillId;
  drawer: boolean;
  combatTab: CombatTab;
  areaKind: AreaKind;
  openArea: string | null;
  bankCat: string;
  bankSearch: string;
  bankSort: 'order' | 'name' | 'value' | 'qty';
  openGuild: string | null;
  openGroups: string[];
  shopTab: string;
  compost: 0 | 1 | 2;
  sellQty: number;
}

export function newUi(): Ui {
  return {
    view: 'skills', skill: 'woodcutting', drawer: false, combatTab: 'areas', areaKind: 'combat', openArea: 'farms', bankCat: 'all', bankSearch: '', bankSort: 'order',
    openGuild: null, openGroups: [], shopTab: 'general', compost: 0, sellQty: 1,
  };
}
