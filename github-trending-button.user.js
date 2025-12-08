// ==UserScript==
// @name         GitHub Trending Button
// @namespace    https://github.com/wenyuanw
// @version      1.1.0
// @description  Add a button to GitHub header to quickly access trending page
// @author       wenyuan
// @match        https://github.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const BUTTON_ID = 'trending-button';
    const TOOLTIP_ID = 'trending-button-tooltip';

    function createIcon() {
        // 使用 GitHub 原生 Graph 图标
        return `
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-graph Button-visual">
                <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
            </svg>
        `;
    }

    function addTrendingButton() {
        // 1. 检查容器是否存在
        // GitHub Header 的结构可能会变，这里可以尝试多个选择器，或者保持现状
        const actionsContainer = document.querySelector('.AppHeader-actions');
        if (!actionsContainer) return false;

        // 2. 检查按钮是否已存在 (防止重复添加)
        if (document.getElementById(BUTTON_ID)) return true;

        // 3. 创建按钮
        const trendingButton = document.createElement('a');
        trendingButton.id = BUTTON_ID;
        trendingButton.href = '/trending';
        // 保持原有的样式类，确保视觉统一
        trendingButton.className = 'Button Button--iconOnly Button--secondary Button--medium AppHeader-button color-fg-muted';
        trendingButton.setAttribute('aria-label', 'Trending repositories');
        trendingButton.innerHTML = createIcon();

        // 4. 创建原生 Tooltip (可选，但为了完美还原)
        const tooltip = document.createElement('tool-tip');
        tooltip.id = TOOLTIP_ID;
        tooltip.setAttribute('for', BUTTON_ID);
        tooltip.setAttribute('popover', 'manual');
        tooltip.setAttribute('data-direction', 's');
        tooltip.setAttribute('data-type', 'label');
        tooltip.setAttribute('data-view-component', 'true');
        tooltip.className = 'sr-only position-absolute';
        tooltip.textContent = 'Trending repositories';

        // 5. 插入元素
        // 尝试插在通知图标前面 (notification-indicator) 或者头像前面
        const refNode = actionsContainer.querySelector('notification-indicator') || actionsContainer.querySelector('.AppHeader-user');

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