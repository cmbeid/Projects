/**
 * Renders one playthrough: node blocks, the choice deck, and the back
 * stack. The only stateful piece in the app — everything it calls into
 * (`engine/session.ts`) is pure, so this module's whole job is turning that
 * state into DOM and turning DOM events back into calls to `choose`.
 */
import type { Block, ImageBlock, Story, VariableTable } from '../content/types';
import { renderInline } from '../content/inline';
import { allowsBack, available, choose, currentNode, startSession } from '../engine/session';
import type { PlayState } from '../engine/types';
import type { LayoutMode } from './layout';
import { watchLayout } from './layout';
import { applyTheme, mergeTheme } from './theme';
import type { AssetResolver } from './theme';

function isImageBlock(block: Block): block is ImageBlock {
  return block.type === 'image';
}

function renderBlock(block: Block, vars: VariableTable, resolveAsset: AssetResolver): HTMLElement {
  if (block.type === 'text') {
    const p = document.createElement('p');
    p.className = `sy-text sy-text--${block.style ?? 'plain'}`;
    p.append(renderInline(block.text, vars));
    return p;
  }

  const figure = document.createElement('figure');
  figure.className = 'sy-image';
  const img = document.createElement('img');
  img.src = resolveAsset(block.src);
  img.alt = block.alt;
  img.loading = 'lazy';
  // Reserved as soon as the real size is known, so the node never reflows
  // under the reader's thumb mid-sentence (PLAN.md §4).
  img.addEventListener('load', () => {
    figure.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  });
  figure.append(img);

  if (block.caption) {
    const caption = document.createElement('figcaption');
    caption.textContent = block.caption;
    figure.append(caption);
  }
  return figure;
}

/**
 * Mounts a playthrough of `story` into `root` and wires it up end to end.
 * Returns a cleanup function that stops the layout watcher — callers don't
 * need to know it exists otherwise.
 */
export function mountReader(root: HTMLElement, story: Story, resolveAsset: AssetResolver): () => void {
  const shell = document.createElement('div');
  shell.className = 'sy-reader';

  const bgLayer = document.createElement('div');
  bgLayer.className = 'sy-bg-layer';

  const header = document.createElement('header');
  header.className = 'sy-header';
  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'sy-back';
  backButton.setAttribute('aria-label', 'Back');
  backButton.textContent = '←';
  const titleEl = document.createElement('h1');
  titleEl.className = 'sy-title';
  titleEl.textContent = story.title;
  header.append(backButton, titleEl);

  // Wide mode only: the current node's first image, shown as a scene panel
  // to the left of the prose rather than inline within it. Empty and
  // display:none everywhere else, where that same image renders inline in
  // `.sy-node` in its original place among the other blocks.
  const scene = document.createElement('aside');
  scene.className = 'sy-scene';

  const main = document.createElement('main');
  main.className = 'sy-node';

  const choiceDeck = document.createElement('nav');
  choiceDeck.className = 'sy-choices';
  choiceDeck.setAttribute('aria-label', 'Choices');

  shell.append(bgLayer, header, scene, main, choiceDeck);
  root.replaceChildren(shell);

  let state: PlayState = startSession(story);
  let layoutMode: LayoutMode = 'compact';
  const backStack: PlayState[] = [];
  const canGoBack = allowsBack(story);
  backButton.classList.toggle('is-hidden', !canGoBack);

  function render(): void {
    const node = currentNode(story, state);
    applyTheme(shell, mergeTheme(story.theme ?? {}, node.theme), resolveAsset);

    backButton.disabled = backStack.length === 0;

    const sceneBlock = layoutMode === 'wide' ? node.blocks.find(isImageBlock) : undefined;

    scene.replaceChildren();
    if (sceneBlock) scene.append(renderBlock(sceneBlock, state.vars, resolveAsset));
    scene.classList.toggle('is-empty', !sceneBlock);

    main.replaceChildren();
    for (const block of node.blocks) {
      if (block === sceneBlock) continue; // shown in the scene panel instead
      main.append(renderBlock(block, state.vars, resolveAsset));
    }

    if (node.ending) {
      const card = document.createElement('div');
      card.className = `sy-ending sy-ending--${node.ending.kind}`;
      const title = document.createElement('p');
      title.className = 'sy-ending-title';
      title.textContent = node.ending.title;
      card.append(title);
      main.append(card);
    }

    choiceDeck.replaceChildren();
    const choices = available(story, state);
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sy-choice';
      button.append(renderInline(choice.text, state.vars));

      if (choice.locked) {
        button.disabled = true;
        button.classList.add('is-locked');
        if (choice.lockedText) {
          const hint = document.createElement('span');
          hint.className = 'sy-choice-hint';
          hint.textContent = choice.lockedText;
          button.append(hint);
        }
      } else {
        button.addEventListener('click', () => {
          backStack.push(state);
          state = choose(story, state, choice.index);
          render();
        });
      }
      choiceDeck.append(button);
    }
    choiceDeck.classList.toggle('is-empty', choices.length === 0);
  }

  backButton.addEventListener('click', () => {
    const previous = backStack.pop();
    if (!previous) return;
    state = previous;
    render();
  });

  const unwatchLayout = watchLayout((mode) => {
    layoutMode = mode;
    shell.dataset['layout'] = mode;
    render();
  });

  return () => unwatchLayout();
}
