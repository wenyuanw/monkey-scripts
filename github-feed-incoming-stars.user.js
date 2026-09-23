// ==UserScript==
// @name         GitHub Feed: Incoming Repository Stars
// @namespace    https://github.com/wenyuanw
// @version      1.4.0
// @description  Filter GitHub Feed to incoming repository stars and load more as you scroll.
// @author       wenyuan
// @license      MIT
// @copyright    2026, wenyuan
// @match        https://github.com/feed
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// MIT License
//
// Copyright (c) 2026 wenyuan
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

(() => {
  'use strict';

  const STYLE_ID = 'gh-incoming-stars-filter-style';
  const BUTTON_ID = 'gh-incoming-stars-filter-button';
  const HIDDEN_CLASS = 'gh-incoming-stars-hidden';
  const CARD_SELECTOR = '[id^="feed-item-"], [data-testid^="feed-item-"], [data-testid*="feed-item"]';
  const MATCH = /\bstarred\s+your\s+repository\b/i;
  const MAX_AUTO_MORE_CLICKS = 25;
  let showAll = true;
  let scheduled = false;
  let loadingMore = false;
  let autoMoreClicks = 0;
  let moreObserver = null;
  let observedMoreButton = null;
  let scrollVersion = 0;
  let lastLoadScrollVersion = -1;
  let lastScrollY = window.scrollY;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_CLASS}{display:none!important}
      #${BUTTON_ID}{color:var(--fgColor-muted,#59636e)!important;background:var(--button-default-bgColor-rest,#f6f8fa)!important;border:1px solid var(--borderColor-default,#d0d7de)!important;transition:background-color .12s ease,color .12s ease,border-color .12s ease}
      #${BUTTON_ID}[aria-pressed="true"]{color:var(--fgColor-attention,#9a6700)!important;background:var(--bgColor-attention-muted,#fff8c5)!important;border-color:var(--borderColor-attention-emphasis,#bf8700)!important}
      #${BUTTON_ID}[aria-pressed="true"] svg path{fill:currentColor}
    `;
    document.head.appendChild(style);
  }

  function findCards() {
    const cards = [...document.querySelectorAll(CARD_SELECTOR)];
    if (cards.length) return cards;

    // Fallback for a future GitHub markup change: find activity headings, then
    // climb to the nearest ancestor that also contains a repository link.
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')];
    const found = new Set();
    for (const heading of headings) {
      if (!MATCH.test(heading.innerText || heading.textContent || '')) continue;
      let node = heading;
      for (let depth = 0; node && depth < 9; depth++, node = node.parentElement) {
        if (node.querySelector?.('a[href*="/"]') && (node.innerText || '').length > 40) {
          found.add(node);
          break;
        }
      }
    }
    return [...found];
  }

  function findFilterControl() {
    const filterMenu = document.querySelector('#feed-filter-menu, details[data-menu-trigger="feed-filter-menu"]');
    if (filterMenu) {
      return {
        anchor: filterMenu,
        styleRef: filterMenu.querySelector(':scope > summary') || filterMenu,
      };
    }

    const control = [...document.querySelectorAll('button, [role="button"], summary')].find((element) => {
      const labels = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.innerText,
        element.textContent,
      ];
      return labels.some((label) => /^filter(?:\b|$)/i.test((label || '').trim()));
    });
    if (!control) return null;
    return { anchor: control.closest('details') || control, styleRef: control };
  }

  function ensureButton() {
    const filterControl = findFilterControl();
    if (!filterControl) return null;

    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.className = filterControl.styleRef.className || 'Button Button--iconOnly Button--secondary Button--medium color-fg-muted';
      button.style.cssText = 'display:inline-flex!important;align-items:center!important;justify-content:center!important;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;padding:0!important;margin-inline-start:8px!important;';
      button.setAttribute('aria-label', '只看收到的 Star');
      button.title = '只看收到的 Star';
      button.innerHTML = '<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.25 9.9 5.1l4.25.62-3.08 3 .73 4.23L8 10.95l-3.8 2 .73-4.23-3.08-3L6.1 5.1 8 1.25Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      button.addEventListener('click', () => {
        showAll = !showAll;
        if (showAll) stopObservingMore();
        scheduleUpdate();
      });
    }

    // Keep both controls in the same horizontal row beside GitHub's Filter menu.
    const controls = filterControl.anchor.parentElement;
    if (controls) {
      controls.style.setProperty('display', 'flex', 'important');
      controls.style.setProperty('align-items', 'center', 'important');
      controls.style.setProperty('flex-direction', 'row', 'important');
      controls.style.setProperty('flex-wrap', 'nowrap', 'important');
      controls.style.setProperty('gap', '8px', 'important');
      filterControl.anchor.style.setProperty('flex', '0 0 auto', 'important');
      filterControl.anchor.style.setProperty('width', 'auto', 'important');
    }

    // Reposition it if GitHub re-renders the toolbar during client navigation.
    if (filterControl.anchor.nextElementSibling !== button) {
      filterControl.anchor.insertAdjacentElement('afterend', button);
    }
    return button;
  }

  function findMoreButton() {
    return [...document.querySelectorAll('button, [role="button"]')].find((button) =>
      (button.innerText || button.textContent || '').trim() === 'More'
    );
  }

  function stopObservingMore() {
    moreObserver?.disconnect();
    moreObserver = null;
    observedMoreButton = null;
  }

  function isInViewport(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function loadMore(button = findMoreButton()) {
    const firstViewportLoad = autoMoreClicks === 0 && isInViewport(button);
    if (showAll || loadingMore || (!firstViewportLoad && scrollVersion <= lastLoadScrollVersion) || autoMoreClicks >= MAX_AUTO_MORE_CLICKS) return;
    if (!button || button.disabled) return;

    const moreButton = findMoreButton();
    if (!moreButton || moreButton.disabled) return;

    const beforeCount = document.querySelectorAll(CARD_SELECTOR).length;
    loadingMore = true;
    lastLoadScrollVersion = scrollVersion;
    moreObserver?.unobserve(moreButton);
    moreButton.click();

    let checks = 0;
    const poll = setInterval(() => {
      checks++;
      const currentCount = document.querySelectorAll(CARD_SELECTOR).length;
      const currentMoreButton = findMoreButton();
      const loaded = currentCount > beforeCount || !currentMoreButton || currentMoreButton.disabled;

      if (loaded || checks >= 30) {
        clearInterval(poll);
        loadingMore = false;
        if (loaded) autoMoreClicks++;
        scheduleUpdate();
      }
    }, 500);
  }

  function observeMore() {
    if (showAll || autoMoreClicks >= MAX_AUTO_MORE_CLICKS) {
      stopObservingMore();
      return;
    }

    const moreButton = findMoreButton();
    if (!moreButton) {
      stopObservingMore();
      return;
    }

    if (!moreObserver) {
      moreObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) loadMore(entry.target);
        }
      }, { root: null, threshold: 0.01 });
    }

    if (observedMoreButton !== moreButton) {
      if (observedMoreButton) moreObserver.unobserve(observedMoreButton);
      observedMoreButton = moreButton;
      moreObserver.observe(moreButton);
    }

    // If the button stayed in view while a batch loaded, wait for another
    // downward scroll before loading the next batch.
    if (isInViewport(moreButton) && (autoMoreClicks === 0 || scrollVersion > lastLoadScrollVersion)) {
      loadMore(moreButton);
    }
  }

  function update() {
    scheduled = false;
    addStyle();
    const cards = findCards();
    for (const card of cards) {
      // Ignore nested matching wrappers if GitHub introduces them.
      if (card.parentElement?.closest(CARD_SELECTOR)) continue;
      const isIncomingStar = MATCH.test(card.innerText || card.textContent || '');
      card.classList.toggle(HIDDEN_CLASS, !showAll && !isIncomingStar);
    }

    const button = ensureButton();
    if (button) {
      const label = showAll ? '只看收到的 Star' : '显示全部 Feed';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(!showAll));
    }
    observeMore();
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY) {
      scrollVersion++;
      const moreButton = findMoreButton();
      if (isInViewport(moreButton)) loadMore(moreButton);
    }
    lastScrollY = currentScrollY;
  }, { passive: true });

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleUpdate();
})();
