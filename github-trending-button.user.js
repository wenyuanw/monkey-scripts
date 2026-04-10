// ==UserScript==
// @name         GitHub Trending Button
// @namespace    https://github.com/wenyuanw
// @version      1.2.0
// @description  Add a button to GitHub header to quickly access trending page
// @author       wenyuan
// @license      MIT
// @copyright    2025, wenyuan
// @match        https://github.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-end
// ==/UserScript==
//
// MIT License
//
// Copyright (c) 2025 wenyuan
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

(function() {
    'use strict';

    const BUTTON_ID = 'trending-button';
    const TOOLTIP_ID = 'trending-button-tooltip';

    function createIcon() {
        // 与当前顶栏 octicon 一致（无旧版 Button-visual）
        return `
            <svg aria-hidden="true" focusable="false" class="octicon octicon-graph" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom">
                <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
            </svg>
        `;
    }

    /** 新版 Primer 顶栏 vs 旧版 App Header */
    function findHeaderActionsContainer() {
        return (
            document.querySelector('[data-testid="top-nav-right"]') ||
            document.querySelector('.AppHeader-actions')
        );
    }

    /** 插入在通知图标前，与 Issues/PR 等并列 */
    function findInsertBefore(actionsContainer) {
        const notifications = actionsContainer.querySelector(
            'a[href="/notifications"], a[href$="/notifications"]'
        );
        if (notifications) return notifications;

        return (
            actionsContainer.querySelector('notification-indicator') ||
            actionsContainer.querySelector('.AppHeader-user') ||
            actionsContainer.querySelector('[data-testid="github-avatar"]')?.closest('button')?.parentElement ||
            null
        );
    }

    function addTrendingButton() {
        const actionsContainer = findHeaderActionsContainer();
        if (!actionsContainer) return false;

        if (document.getElementById(BUTTON_ID)) return true;

        const trendingButton = document.createElement('a');
        trendingButton.id = BUTTON_ID;
        trendingButton.href = '/trending';
        trendingButton.setAttribute('data-discover', 'true');

        const styleRef =
            actionsContainer.querySelector('a[href="/issues"], a[href$="/issues"]') ||
            actionsContainer.querySelector('a[data-component="IconButton"]');
        if (styleRef) {
            trendingButton.className = styleRef.className;
            Array.from(styleRef.attributes).forEach((attr) => {
                if (
                    attr.name === 'href' ||
                    attr.name === 'id' ||
                    attr.name === 'aria-labelledby'
                ) {
                    return;
                }
                if (!trendingButton.hasAttribute(attr.name)) {
                    trendingButton.setAttribute(attr.name, attr.value);
                }
            });
        } else {
            trendingButton.className =
                'Button Button--iconOnly Button--secondary Button--medium AppHeader-button color-fg-muted';
        }

        trendingButton.setAttribute('aria-labelledby', TOOLTIP_ID);
        trendingButton.innerHTML = createIcon();

        const isNewHeader = actionsContainer.hasAttribute('data-testid');
        let tooltip;
        if (isNewHeader) {
            tooltip = document.createElement('span');
            tooltip.id = TOOLTIP_ID;
            const issuesTip = styleRef?.nextElementSibling;
            if (
                issuesTip &&
                issuesTip.tagName === 'SPAN' &&
                issuesTip.hasAttribute('popover')
            ) {
                tooltip.className = issuesTip.className;
                const dir = issuesTip.getAttribute('data-direction');
                if (dir) tooltip.setAttribute('data-direction', dir);
            } else {
                tooltip.setAttribute('data-direction', 's');
            }
            tooltip.setAttribute('aria-hidden', 'true');
            tooltip.setAttribute('popover', 'auto');
            tooltip.textContent = 'Trending repositories';
        } else {
            tooltip = document.createElement('tool-tip');
            tooltip.id = TOOLTIP_ID;
            tooltip.setAttribute('for', BUTTON_ID);
            tooltip.setAttribute('popover', 'manual');
            tooltip.setAttribute('data-direction', 's');
            tooltip.setAttribute('data-type', 'label');
            tooltip.setAttribute('data-view-component', 'true');
            tooltip.className = 'sr-only position-absolute';
            tooltip.textContent = 'Trending repositories';
        }

        const refNode = findInsertBefore(actionsContainer);
        if (refNode) {
            actionsContainer.insertBefore(trendingButton, refNode);
            actionsContainer.insertBefore(tooltip, refNode);
        } else {
            actionsContainer.appendChild(trendingButton);
            actionsContainer.appendChild(tooltip);
        }

        return true;
    }

    // 主执行逻辑
    function main() {
        if (!addTrendingButton()) {
            // 如果首次失败，启动 Observer
            const observer = new MutationObserver((mutations, obs) => {
                if (addTrendingButton()) {
                    obs.disconnect();
                }
            });

            // 限制 Observer 的范围，尽量不监听整个 body，除非迫不得已
            // 但 header 通常是 body 的直接子元素或很浅的层级
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 5秒后停止监听，节省资源
            setTimeout(() => observer.disconnect(), 5000);
        }
    }

    // 立即运行
    main();

    // 适配 GitHub Turbo (SPA 导航)
    // 每次页面软导航结束时，重新检查按钮是否存在
    document.addEventListener('turbo:load', main);
    document.addEventListener('turbo:render', main); // 处理一些局部更新
})();