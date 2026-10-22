"use strict";

(function () {
  const PAGE_SIZE = 25;

  function button(label, disabled, callback) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.disabled = disabled;
    node.addEventListener("click", callback);
    return node;
  }

  function paint(nav, page, total, navigate) {
    nav.replaceChildren();
    nav.hidden = total <= 1;

    if (nav.hidden) return;

    const indicator = document.createElement("span");
    indicator.className = "page-indicator";
    indicator.textContent = "Page " + page + " / " + total;

    nav.append(
      button("First", page === 1, function () {
        navigate(1);
      }),
      button("Previous", page === 1, function () {
        navigate(page - 1);
      }),
      indicator,
      button("Next", page === total, function () {
        navigate(page + 1);
      }),
      button("Last", page === total, function () {
        navigate(total);
      })
    );
  }

  window.CHRMediaPagination = {
    pageSize: PAGE_SIZE,
    paint: paint
  };

  const sources = ["zenn", "qiita", "medium"];
  const panes = new Map();

  function boot() {
    for (const source of sources) {
      const name = source.charAt(0).toUpperCase()
        + source.slice(1);

      const section = document.getElementById(
        "m4Single" + name
      );
      const nav = document.getElementById(
        "m4Pager" + name
      );

      if (!section || !nav) {
        throw new Error("Missing media pagination DOM: " + source);
      }

      const list = section.querySelector(
        ".m4-native-list"
      );

      if (!list) {
        throw new Error("Missing media article list: " + source);
      }

      const cards = Array.from(
        list.querySelectorAll(":scope > article.article-card")
      );

      panes.set(source, {
        section: section,
        list: list,
        nav: nav,
        cards: cards,
        page: 1
      });
    }

    let lastAnchor = "";

    function render() {
      const params = new URL(
        window.location.href
      ).searchParams;

      const active = params.get("view");
      const hash = window.location.hash;

      let id = "";

      if (hash) {
        try {
          id = decodeURIComponent(hash.substring(1));
        } catch (_) {
          id = "";
        }
      }

      for (const [source, pane] of panes) {
        const cards = pane.cards;
        const pages = Math.max(
          1,
          Math.ceil(cards.length / PAGE_SIZE)
        );

        if (active === source && id) {
          const index = cards.findIndex(
            function (card) {
              return card.id === id;
            }
          );

          if (index >= 0) {
            pane.page = Math.floor(
              index / PAGE_SIZE
            ) + 1;
          }
        }

        pane.page = Math.max(
          1,
          Math.min(pages, pane.page)
        );

        const start = (pane.page - 1) * PAGE_SIZE;

        cards.forEach(function (card, index) {
          card.hidden = (
            index < start ||
            index >= start + PAGE_SIZE
          );
        });

        paint(
          pane.nav,
          pane.page,
          pages,
          function (next) {
            pane.page = next;

            if (location.hash) {
              history.replaceState(
                history.state,
                "",
                location.pathname + location.search
              );
            }

            render();

            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        );
      }

      const anchorKey = (
        sources.includes(active) && id
      ) ? location.search + location.hash : "";

      if (anchorKey && anchorKey !== lastAnchor) {
        const target = document.getElementById(id);

        if (target && !target.hidden) {
          requestAnimationFrame(function () {
            target.scrollIntoView({
              block: "start"
            });
          });
        }
      }

      lastAnchor = anchorKey;
    }

    render();

    // Existing media navigation uses pushState and changes the
    // active pane without emitting popstate. Observe only route
    // attributes, not article visibility or pager contents.
    const observer = new MutationObserver(render);

    for (const pane of panes.values()) {
      observer.observe(pane.section, {
        attributes: true,
        attributeFilter: ["hidden"]
      });
    }

    window.addEventListener("popstate", render);
    window.addEventListener("hashchange", render);
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
