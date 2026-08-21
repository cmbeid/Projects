import { INDEX } from '../data/index';
import type { Element } from '../data/types';
import { progress, routesTo } from '../game/engine';
import { store } from '../state/store';
import type { Hint } from '../game/engine';
import { iconSpan } from './icons';

let dialog: HTMLDialogElement;
let content: HTMLElement;
let inspect: (elementId: string) => void = () => {};

export function initModal(
  dialogElement: HTMLDialogElement,
  contentElement: HTMLElement,
  onInspect: (elementId: string) => void,
): void {
  dialog = dialogElement;
  content = contentElement;
  inspect = onInspect;

  // Tapping the backdrop closes. The dialog element itself fills only the
  // panel, so a click landing on <dialog> directly means outside the panel.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function open(build: (body: HTMLElement) => void, title: string, subtitle: string, emoji: string) {
  const head = document.createElement('div');
  head.className = 'modal-head';

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'modal-emoji';
  emojiSpan.setAttribute('aria-hidden', 'true');
  emojiSpan.textContent = emoji;

  const titles = document.createElement('div');
  titles.className = 'modal-titles';
  const heading = document.createElement('h2');
  heading.className = 'modal-title';
  heading.textContent = title;
  const sub = document.createElement('p');
  sub.className = 'modal-sub';
  sub.textContent = subtitle;
  titles.append(heading, sub);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => dialog.close());

  head.append(emojiSpan, titles, close);

  const body = document.createElement('div');
  body.className = 'modal-body';
  build(body);

  content.replaceChildren(head, body);
  if (!dialog.open) dialog.showModal();
}

/** Element detail: what it is, and how the player got there. */
export function openElementDetail(elementId: string): void {
  const element = INDEX.byId.get(elementId);
  if (!element) return;

  const isFinal = INDEX.finalIds.has(element.id);
  const routes = routesTo(INDEX, store.discovered, element.id);
  const usedIn = INDEX.usedIn.get(element.id)?.length ?? 0;

  open(
    (body) => {
      const blurb = document.createElement('p');
      blurb.className = 'modal-blurb';
      blurb.textContent = element.blurb;
      body.append(blurb);

      if (isFinal) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-final';
        badge.textContent = '✦ Final element';
        badge.title = 'Nothing further can be made from this';
        body.append(badge);
      }

      body.append(sectionTitle('Made from'));
      if (routes.known.length === 0 && routes.hiddenCount === 0) {
        body.append(note('A starting element. It was always here.'));
      } else {
        const list = document.createElement('ul');
        list.className = 'recipe-list';

        for (const [a, b] of routes.known) {
          list.append(recipeRow(INDEX.byId.get(a), INDEX.byId.get(b)));
        }
        if (routes.hiddenCount > 0) {
          const hidden = document.createElement('li');
          hidden.className = 'recipe recipe-hidden';
          hidden.textContent =
            routes.hiddenCount === 1
              ? '1 other combination, not yet discovered'
              : `${routes.hiddenCount} other combinations, not yet discovered`;
          list.append(hidden);
        }
        body.append(list);
      }

      if (!isFinal) {
        body.append(sectionTitle('Leads to'));
        body.append(
          note(
            usedIn === 1
              ? 'It is an ingredient in 1 combination.'
              : `It is an ingredient in ${usedIn} combinations.`,
          ),
        );
      }
    },
    element.name,
    categoryLabel(element),
    element.emoji,
  );
}

/** Every discovered element, searchable. */
export function openEncyclopedia(): void {
  open(
    (body) => {
      const stats = progress(INDEX, store.discovered);

      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'search-input encyclopedia-search';
      search.placeholder = 'Search discovered elements…';
      search.autocomplete = 'off';

      const grid = document.createElement('div');
      grid.className = 'encyclopedia-grid';

      const draw = (query: string) => {
        const term = query.trim().toLowerCase();
        const items = store
          .get()
          .discovered.map((id) => INDEX.byId.get(id))
          .filter((element): element is Element => element !== undefined)
          .filter((element) => !term || element.name.toLowerCase().includes(term))
          .sort((a, b) => a.name.localeCompare(b.name));

        const fragment = document.createDocumentFragment();
        for (const element of items) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'inv-item';
          if (INDEX.finalIds.has(element.id)) button.classList.add('is-final');
          button.append(iconSpan(element, 'inv-emoji'));
          const name = document.createElement('span');
          name.className = 'inv-name';
          name.textContent = element.name;
          button.append(name);
          button.addEventListener('click', () => inspect(element.id));
          fragment.append(button);
        }
        grid.replaceChildren(fragment);
      };

      search.addEventListener('input', () => draw(search.value));
      draw('');

      body.append(search, grid);

      const footer = document.createElement('p');
      footer.className = 'modal-sub';
      footer.style.marginTop = '14px';
      footer.textContent = `${stats.found} of ${stats.total} found · ${stats.percent}%`;
      body.append(footer);
    },
    'Encyclopedia',
    'Everything you have found',
    '📖',
  );
}

/** Settings and stats. */
export function openSettings(onReset: () => void): void {
  open(
    (body) => {
      const stats = progress(INDEX, store.discovered);

      body.append(sectionTitle('Progress'));
      const grid = document.createElement('div');
      grid.className = 'stat-grid';
      grid.append(
        stat(`${stats.found}`, `of ${stats.total} found`),
        stat(`${stats.percent}%`, 'complete'),
        stat(`${stats.finalsFound}/${stats.finalsTotal}`, 'final elements'),
        stat(`${store.get().hintsUsed}`, 'hints used'),
      );
      body.append(grid);

      body.append(sectionTitle('Settings'));

      const soundRow = document.createElement('div');
      soundRow.className = 'setting-row';
      const soundLabel = document.createElement('div');
      const soundText = document.createElement('div');
      soundText.className = 'setting-label';
      soundText.textContent = 'Sound effects';
      const soundNote = document.createElement('p');
      soundNote.className = 'setting-note';
      soundNote.textContent = 'Short synthesised tones. No audio files.';
      soundLabel.append(soundText, soundNote);

      const soundToggle = document.createElement('button');
      soundToggle.type = 'button';
      soundToggle.className = 'button';
      const paintToggle = () => {
        const on = store.get().settings.sound;
        soundToggle.textContent = on ? 'On' : 'Off';
        soundToggle.setAttribute('aria-pressed', String(on));
      };
      soundToggle.addEventListener('click', () => {
        store.setSound(!store.get().settings.sound);
        paintToggle();
      });
      paintToggle();

      soundRow.append(soundLabel, soundToggle);
      body.append(soundRow);

      const resetRow = document.createElement('div');
      resetRow.className = 'setting-row';
      const resetLabel = document.createElement('div');
      const resetText = document.createElement('div');
      resetText.className = 'setting-label';
      resetText.textContent = 'Reset progress';
      const resetNote = document.createElement('p');
      resetNote.className = 'setting-note';
      resetNote.textContent = 'Clears every discovery. This cannot be undone.';
      resetLabel.append(resetText, resetNote);

      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'button button-danger';
      resetButton.textContent = 'Reset';
      resetButton.addEventListener('click', () => {
        // Two steps, because one stray tap should not delete hours of play.
        if (resetButton.dataset['armed'] === 'yes') {
          onReset();
          dialog.close();
          return;
        }
        resetButton.dataset['armed'] = 'yes';
        resetButton.textContent = 'Tap again to confirm';
      });

      resetRow.append(resetLabel, resetButton);
      body.append(resetRow);
    },
    'Settings',
    'Progress and preferences',
    '⚙️',
  );
}

/** Shows a hint without giving away the result. */
export function openHint(hint: Hint | null): void {
  open(
    (body) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'hint-body';

      if (!hint) {
        wrapper.append(
          note('Nothing left to find with what you have. That is the whole tree — well done.'),
        );
        body.append(wrapper);
        return;
      }

      const intro = document.createElement('p');
      intro.className = 'modal-blurb';
      intro.textContent = 'Try putting these two together:';
      wrapper.append(intro);

      const pair = document.createElement('div');
      pair.className = 'hint-pair';
      pair.append(hintChip(INDEX.byId.get(hint.inputs[0])));
      const plus = document.createElement('span');
      plus.className = 'recipe-op';
      plus.textContent = '+';
      pair.append(plus, hintChip(INDEX.byId.get(hint.inputs[1])));
      wrapper.append(pair);

      wrapper.append(
        note(
          hint.newCount === 1
            ? 'It makes something you have not seen yet.'
            : `It makes ${hint.newCount} things you have not seen yet.`,
        ),
      );

      body.append(wrapper);
    },
    'Hint',
    'A combination you can make now',
    '💡',
  );
}

// --- Small builders --------------------------------------------------------

function sectionTitle(text: string): HTMLElement {
  const heading = document.createElement('h3');
  heading.className = 'modal-section-title';
  heading.textContent = text;
  return heading;
}

function note(text: string): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'setting-note';
  paragraph.style.fontSize = '14px';
  paragraph.textContent = text;
  return paragraph;
}

function stat(value: string, label: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'stat';
  const valueEl = document.createElement('span');
  valueEl.className = 'stat-value';
  valueEl.textContent = value;
  const labelEl = document.createElement('span');
  labelEl.className = 'stat-label';
  labelEl.textContent = label;
  wrapper.append(valueEl, labelEl);
  return wrapper;
}

function recipeRow(a: Element | undefined, b: Element | undefined): HTMLElement {
  const row = document.createElement('li');
  row.className = 'recipe';
  row.append(inlineElement(a), operator('+'), inlineElement(b));
  return row;
}

function inlineElement(element: Element | undefined): HTMLElement {
  const span = document.createElement('span');
  if (!element) {
    span.textContent = '???';
    return span;
  }
  span.append(iconSpan(element, 'recipe-emoji'), document.createTextNode(` ${element.name}`));
  return span;
}

function operator(symbol: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'recipe-op';
  span.textContent = symbol;
  return span;
}

function hintChip(element: Element | undefined): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'hint-chip';
  if (!element) {
    chip.classList.add('is-hidden');
    chip.textContent = '???';
    return chip;
  }
  chip.append(iconSpan(element, 'inv-emoji'), document.createTextNode(element.name));
  return chip;
}

function categoryLabel(element: Element): string {
  const labels: Record<Element['category'], string> = {
    base: 'Starting element',
    primordial: 'Primordial',
    nature: 'Nature',
    life: 'Life',
    civilization: 'Civilization',
    technology: 'Technology',
    culture: 'Culture & Myth',
    cosmos: 'Cosmos',
  };
  return labels[element.category];
}
