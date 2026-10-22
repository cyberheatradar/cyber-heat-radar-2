
"use strict";

(function () {
  // Media pages are independent HTML files.
  // The native news router must always run on index.html.

  function newsUrl(view, query) {
    const url = new URL("./", window.location.href);

    if (view && view !== "overview") {
      url.searchParams.set("view", view);
    }

    if (query !== undefined && query !== null) {
      url.searchParams.set("q", query);
    }

    return url.href;
  }

  function resolveView(node) {
    const direct = node.getAttribute("data-nav-view");

    if (direct) {
      return direct;
    }

    if (
      node.id === "fe22OverviewTab" ||
      node.hasAttribute("data-mobile-overview")
    ) {
      return "overview";
    }

    const href = node.getAttribute("href");

    if (href) {
      try {
        const url = new URL(href, window.location.href);

        if (url.searchParams.has("view")) {
          return url.searchParams.get("view");
        }
      } catch (_) {
        return null;
      }
    }

    return null;
  }

  // Capture the navigation before app.js handles it as
  // an in-page news route on medium.html/qiita.html/zenn.html.
  document.addEventListener("click", function (event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const node = event.target.closest(
      "[data-nav-view], " +
      "#fe22OverviewTab, " +
      "[data-mobile-overview], " +
      'a[href*="?view="]'
    );

    if (!node || node.closest("[data-media-tab]")) {
      return;
    }

    const view = resolveView(node);

    if (!view) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    window.location.assign(newsUrl(view));
  }, true);

  // Search must also be executed by the news catalog,
  // rather than by the independent media page.
  document.addEventListener("submit", function (event) {
    const form = event.target;

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (form.id !== "headerSearchForm") {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const input =
      document.getElementById("headerSearchInput") ||
      form.querySelector('input[name="q"]');

    const query = input ? input.value.trim() : "";

    window.location.assign(
      query ? newsUrl("search", query) : newsUrl("overview")
    );
  }, true);
})();
