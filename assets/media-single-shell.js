
"use strict";

(function () {
  const media = new Set(["zenn", "qiita", "medium"]);

  function currentView() {
    const url = new URL(window.location.href);
    return url.searchParams.get("view") || "";
  }

  function closeMobileMenu() {
    const menu = document.getElementById("mobileTopicMenu");
    if (menu && "open" in menu) {
      menu.open = false;
    }
  }

  function applyRoute() {
    const view = currentView();
    const active = media.has(view);

    document.body.classList.toggle("m4-spa-active", active);
    document.body.classList.toggle("m4-native-page", active);

    document.querySelectorAll(
      "[data-m4-source]"
    ).forEach(function (pane) {
      const selected =
        active && pane.dataset.m4Source === view;

      pane.hidden = !selected;
      pane.classList.toggle("m4-spa-current", selected);
    });

    document.querySelectorAll(
      "[data-media-tab]"
    ).forEach(function (link) {
      const selected =
        active && link.dataset.mediaTab === view;

      link.classList.toggle("active", selected);

      if (selected) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (active) {
      document.querySelectorAll(
        "[data-nav-view]"
      ).forEach(function (node) {
        node.classList.remove("active");
      });

      const overview = document.getElementById(
        "fe22OverviewTab"
      );

      if (overview) {
        overview.classList.remove("active");
      }
    }

    return active;
  }

  function navigateMedia(view) {
    const url = new URL("./", window.location.href);
    url.searchParams.set("view", view);

    window.history.pushState({}, "", url.href);
    applyRoute();
    closeMobileMenu();
    window.scrollTo(0, 0);
  }

  // Capture media navigation before the native news router.
  document.addEventListener(
    "click",
    function (event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("[data-media-tab]");

      if (link) {
        const source = link.getAttribute("data-media-tab");

        if (!media.has(source)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        navigateMedia(source);
        return;
      }

      // Leave media mode before the existing news handlers
      // process a normal news tab or Overview click.
      const news = target.closest(
        "[data-nav-view], #fe22OverviewTab, " +
        "[data-mobile-overview]"
      );

      if (news && document.body.classList.contains(
        "m4-spa-active"
      )) {
        document.body.classList.remove(
          "m4-spa-active",
          "m4-native-page"
        );

        document.querySelectorAll(
          "[data-m4-source]"
        ).forEach(function (pane) {
          pane.hidden = true;
          pane.classList.remove("m4-spa-current");
        });
      }
    },
    true
  );

  // Native app.js handles the search submission.
  // Only clear the media overlay before it runs.
  document.addEventListener(
    "submit",
    function (event) {
      if (
        event.target &&
        event.target.id === "headerSearchForm"
      ) {
        document.body.classList.remove(
          "m4-spa-active",
          "m4-native-page"
        );
      }
    },
    true
  );

  window.addEventListener("popstate", applyRoute);

  function boot() {
    applyRoute();

    if (media.has(currentView()) && location.hash) {
      const id = decodeURIComponent(
        location.hash.substring(1)
      );
      const article = document.getElementById(id);

      if (article) {
        article.scrollIntoView();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();


/* RC13_NAV_SELECTION */
(function () {
  "use strict";

  const media = new Set(["zenn", "qiita", "medium"]);

  function reconcile() {
    const url = new URL(window.location.href);
    const view = url.searchParams.get("view") || "";
    const isMedia = media.has(view);

    document.querySelectorAll("[data-nav-view]").forEach(
      function (node) {
        const selected = !isMedia &&
          node.getAttribute("data-nav-view") === view;

        node.classList.toggle("active", selected);

        if (selected) {
          node.setAttribute("aria-current", "page");
        } else {
          node.removeAttribute("aria-current");
        }
      }
    );

    document.querySelectorAll("[data-media-tab]").forEach(
      function (node) {
        const selected = isMedia &&
          node.getAttribute("data-media-tab") === view;

        node.classList.toggle("active", selected);

        if (selected) {
          node.setAttribute("aria-current", "page");
        } else {
          node.removeAttribute("aria-current");
        }
      }
    );
  }

  function schedule() {
    queueMicrotask(reconcile);
  }

  document.addEventListener("click", function (event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (target.closest(
      "[data-nav-view], #fe22OverviewTab, [data-media-tab]"
    )) {
      schedule();
    }
  }, true);

  document.addEventListener("submit", function (event) {
    if (
      event.target &&
      event.target.id === "headerSearchForm"
    ) {
      schedule();
    }
  }, true);

  window.addEventListener("popstate", schedule);

  const articleList = document.getElementById("articleList");

  if (articleList) {
    new MutationObserver(schedule).observe(
      articleList,
      { childList: true }
    );
  }

  schedule();
})();


;/* CHR_RC32_SINGLE_ACTIVE_NAV */
(function () {
  "use strict";
  const blogs = new Set(["zenn", "qiita", "medium"]);
  const selector =
    "[data-nav-view], [data-media-tab], #fe22OverviewTab";
  let pending = false;

  function normalize() {
    pending = false;
    const view = new URL(window.location.href)
      .searchParams.get("view");
    if (!blogs.has(view)) return;

    document.querySelectorAll(selector).forEach(function (node) {
      const selected =
        node.getAttribute("data-media-tab") === view;
      if (node.classList.contains("active") !== selected) {
        node.classList.toggle("active", selected);
      }
      if (selected) {
        if (node.getAttribute("aria-current") !== "page") {
          node.setAttribute("aria-current", "page");
        }
      } else if (node.hasAttribute("aria-current")) {
        node.removeAttribute("aria-current");
      }
    });
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(normalize);
  }

  function start() {
    const observer = new MutationObserver(schedule);
    document.querySelectorAll(selector).forEach(function (node) {
      observer.observe(node, {
        attributes: true,
        attributeFilter: ["class", "aria-current"]
      });
    });
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
    document.addEventListener("click", function (event) {
      if (event.target.closest(selector)) {
        requestAnimationFrame(schedule);
      }
    }, true);
    schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();
