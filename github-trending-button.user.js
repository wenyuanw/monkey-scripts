// ==UserScript==
// @name         GitHub Trending Button
// @namespace    https://github.com/wenyuanw
// @version      1.0.0
// @description  Add a button to GitHub header to quickly access trending page
// @author       wenyuan
// @match        https://github.com/*
// @icon         https://github.githubassets.com/favicons/favicon.svg
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    function addTrendingButton() {
        // Find the AppHeader-actions container (where issues, PRs, notifications are)
        const actionsContainer = document.querySelector('.AppHeader-actions');

        if (!actionsContainer) {
            return false;
        }

        // Check if button already exists
        if (document.getElementById('trending-button')) {
            return true;
        }

        // Create the trending button
        const trendingButton = document.createElement('a');
        trendingButton.id = 'trending-button';
        trendingButton.href = '/trending';
        trendingButton.className = 'Button Button--iconOnly Button--secondary Button--medium AppHeader-button color-fg-muted';
        trendingButton.setAttribute('aria-label', 'Trending repositories');
        trendingButton.setAttribute('data-analytics-event', '{"category":"Global navigation","action":"TRENDING_HEADER","label":null}');

        // Create the SVG icon (using a graph/trending icon)
        trendingButton.innerHTML = `
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-graph Button-visual">
                <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
            </svg>
        `;

        // Add tooltip
        const tooltip = document.createElement('tool-tip');
        tooltip.id = 'trending-button-tooltip';
        tooltip.setAttribute('for', 'trending-button');
        tooltip.setAttribute('popover', 'manual');
        tooltip.setAttribute('data-direction', 's');
        tooltip.setAttribute('data-type', 'label');
        tooltip.setAttribute('data-view-component', 'true');
        tooltip.className = 'sr-only position-absolute';
        tooltip.setAttribute('aria-hidden', 'true');
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = 'Trending repositories';

        // Find the notification indicator to insert before it
        const notificationIndicator = actionsContainer.querySelector('notification-indicator');

        if (notificationIndicator) {
            // Insert the button before notifications
            actionsContainer.insertBefore(trendingButton, notificationIndicator);
            actionsContainer.insertBefore(tooltip, notificationIndicator);
        } else {
            // Fallback: append to the end of actions container
            actionsContainer.appendChild(trendingButton);
            actionsContainer.appendChild(tooltip);
        }

        return true;
    }

    // Try to add the button immediately
    if (!addTrendingButton()) {
        // If it fails, wait for the DOM to be ready and try again
        const observer = new MutationObserver((mutations, obs) => {
            if (addTrendingButton()) {
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Stop observing after 10 seconds to prevent infinite observation
        setTimeout(() => {
            observer.disconnect();
        }, 10000);
    }
})();
