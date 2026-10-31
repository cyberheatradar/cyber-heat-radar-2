(() => {
  "use strict";

  const OVERVIEW_URL =
    "./data/overview.json";

  const CONFIG_URL =
    "./data/site-config.json";

  const TICKER_PIXELS_PER_SECOND = 32;

  function make(tag, cls, text) {
    const n =
      document.createElement(tag);

    if (cls) {
      n.className = cls;
    }

    if (text !== undefined) {
      n.textContent = text;
    }

    return n;
  }

  async function getJson(url) {
    const r = await fetch(
      url,
      {cache: "no-store"}
    );

    if (!r.ok) {
      throw new Error(
        url
        + " HTTP "
        + r.status
      );
    }

    return r.json();
  }

  function isOverviewRoute() {
    const p =
      new URLSearchParams(
        window.location.search
      );

    const view = p.get("view");

    return (
      !view
      || view === "overview"
    );
  }

  function commonCard(row) {
    const authority =
      window.CyberHeatRadarUI;

    if (
      !authority
      || typeof authority.buildCard
        !== "function"
    ) {
      throw new Error(
        "COMMON_CARD_RENDERER_UNAVAILABLE"
      );
    }

    const card =
      authority.buildCard(row);

    /*
     * The same article can appear in both
     * LATEST and HOTTEST on Overview.
     * Avoid duplicate DOM IDs while keeping
     * shareUrlFor() semantics intact.
     */
    card.removeAttribute("id");

    return card;
  }

  function lane(
    title,
    description,
    rows
  ) {
    const section =
      make(
        "section",
        "fe22-lane"
      );

    const header =
      make(
        "div",
        "fe22-lane-header"
      );

    header.appendChild(
      make("h2", "", title)
    );

    header.appendChild(
      make(
        "p",
        "",
        description
      )
    );

    section.appendChild(header);

    const list =
      make(
        "div",
        "fe22-common-card-list"
      );

    for (const row of rows) {
      list.appendChild(
        commonCard(row)
      );
    }

    section.appendChild(list);

    return section;
  }

  function collectingLane(
    title,
    description
  ) {
    const section =
      make(
        "section",
        "fe22-collecting-lane"
      );

    section.appendChild(
      make("h2", "", title)
    );

    section.appendChild(
      make(
        "p",
        "fe22-collecting-description",
        description
      )
    );

    section.appendChild(
      make(
        "div",
        "fe22-collecting-box",
        "観測蓄積中"
      )
    );

    return section;
  }

  function renderOverview(data) {
    const status =
      document.getElementById(
        "fe22OverviewStatus"
      );

    const sections =
      document.getElementById(
        "fe22OverviewSections"
      );

    if (
      !status
      || !sections
    ) {
      return;
    }

    const text =
      "収録記事 "
      + Number(data.catalog_count || 0).toLocaleString("ja-JP")
      + "件"
      + " · 公開時刻 "
      + formatJST(data.publication_slot_jst)
      + " JST";
    status.textContent = text;

    const top =
      make(
        "div",
        "fe22-top-grid"
      );

    top.appendChild(
      lane(
        "LATEST",
        "公開日時の新しい順",
        data.latest || []
      )
    );

    top.appendChild(
      lane(
        "HOTTEST",
        "直近30日のHeat上位",
        data.hottest || []
      )
    );

    const trends =
      make(
        "div",
        "fe22-trend-grid"
      );

    const timeseries =
      data.timeseries_status || {};

    trends.appendChild(
      timeseries.rising === "ready"
        ? lane(
            "急上昇",
            data.definitions.rising,
            data.rising || []
          )
        : collectingLane(
            "急上昇",
            data.definitions.rising
          )
    );

    trends.appendChild(
      timeseries.persistent_hot
        === "ready"
        ? lane(
            "継続HOT",
            data.definitions
              .persistent_hot,
            data.persistent_hot || []
          )
        : collectingLane(
            "継続HOT",
            data.definitions
              .persistent_hot
          )
    );

    sections.replaceChildren(
      top,
      trends
    );
  }

  function formatJST(value) {
    if (!value) {
      return "—";
    }

    const d = new Date(value);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(d);
  }

  function renderTicker(data) {
    const track =
      document.getElementById(
        "fe22TickerTrack"
      );

    if (!track) {
      return;
    }

    const items =
      Array.isArray(
        data.ticker_items
      )
        ? data.ticker_items
        : [];

    track.replaceChildren();

    /*
     * Two identical sets permit seamless
     * -50% looping.
     */
    [
      ...items,
      ...items
    ].forEach((text) => {
      track.appendChild(
        make(
          "span",
          "fe22-ticker-item",
          text
        )
      );
    });

    /*
     * Previous RC used a visually slower
     * ticker. Fixed duration becomes faster
     * as headlines become longer, so use
     * constant pixel velocity instead.
     */
    requestAnimationFrame(() => {
      const oneSetWidth =
        track.scrollWidth / 2;

      const seconds =
        Math.max(
          48,
          oneSetWidth
            / TICKER_PIXELS_PER_SECOND
        );

      track.style.setProperty(
        "--fe22-ticker-duration",
        seconds.toFixed(1) + "s"
      );
    });
  }

  function applyGitHub(config) {
    const link =
      document.getElementById(
        "fe22GithubLink"
      );

    if (!link) {
      return;
    }

    const url =
      config
      && config.github_url;

    if (!url) {
      return;
    }

    link.href = url;
    link.target = "_blank";
    link.rel =
      "noopener noreferrer";

    link.classList.remove(
      "fe22-github-disabled"
    );

    link.removeAttribute(
      "aria-disabled"
    );
  }

  function localizeLegacyUI() {
    const exact = {
      "RADAR STATUS":
        "更新状況",
      "Catalog":
        "収録記事",
      "Recent":
        "最近の記事",
      "as-of":
        "基準時刻",
      "Generated":
        "生成時刻"
    };

    document
      .querySelectorAll(
        "h1,h2,h3,h4,p,span,div,dt,th"
      )
      .forEach((n) => {
        if (
          n.children.length !== 0
        ) {
          return;
        }

        const raw =
          (n.textContent || "")
          .trim();

        if (!raw) {
          return;
        }

        if (exact[raw]) {
          n.textContent =
            exact[raw];
          return;
        }

        let text = raw;

        text = text.replace(
          /\bCatalog\b/g,
          "収録記事"
        );

        text = text.replace(
          /\bas-of\b/gi,
          "基準時刻"
        );

        text = text.replace(
          /\bgenerated\b/gi,
          "生成時刻"
        );

        const countMatch =
          text.match(
            /^([\d,]+)\s+articles$/i
          );

        if (countMatch) {
          text =
            countMatch[1]
            + "件";
        }

        if (text !== raw) {
          n.textContent = text;
        }
      });
  }


  function bindOverviewNavigation() {
    const tab =
      document.getElementById(
        "fe22OverviewTab"
      );

    if (
      !tab
      || tab.dataset.fe22SpaBound === "1"
    ) {
      return;
    }

    tab.dataset.fe22SpaBound = "1";

    tab.addEventListener(
      "click",
      (event) => {
        if (
          event.button !== 0
          || event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
        ) {
          return;
        }

        event.preventDefault();

        if (!isOverviewRoute()) {
          history.pushState(
            {},
            "",
            "./"
          );
        }

        setOverviewMode(true);

        window.scrollTo({
          top: 0,
          behavior: "auto"
        });
      }
    );
  }

  function setOverviewMode(
    enabled
  ) {
    document.body
      .classList.toggle(
        "fe22-overview-mode",
        enabled
      );

    const root =
      document.getElementById(
        "fe22Overview"
      );

    if (root) {
      root.hidden = !enabled;
    }

    const overviewTab =
      document.getElementById(
        "fe22OverviewTab"
      );

    if (overviewTab) {
      overviewTab
        .classList.toggle(
          "active",
          enabled
        );

      if (enabled) {
        overviewTab.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        overviewTab.removeAttribute(
          "aria-current"
        );
      }
    }

    if (enabled) {
      document
        .querySelectorAll(
          "[data-nav-view]"
        )
        .forEach((n) => {
          n.classList.remove(
            "active"
          );

          n.removeAttribute(
            "aria-current"
          );
        });
    }
  }

  async function boot() {
    const [
      overview,
      config
    ] = await Promise.all([
      getJson(OVERVIEW_URL),
      getJson(CONFIG_URL)
    ]);

    renderOverview(overview);
    renderTicker(overview);
    applyGitHub(config);

    setOverviewMode(
      isOverviewRoute()
    );

    bindOverviewNavigation();
    localizeLegacyUI();

    /*
     * Existing app.js renders asynchronously.
     * Keep localization and Overview active
     * state stable after legacy render.
     */
    const observer =
      new MutationObserver(() => {
        localizeLegacyUI();

        setOverviewMode(
          isOverviewRoute()
        );
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );

    window.addEventListener(
      "popstate",
      () => {
        setOverviewMode(
          isOverviewRoute()
        );
      }
    );
  }

  if (
    document.readyState
      === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        boot().catch(
          console.error
        );
      }
    );
  } else {
    boot().catch(
      console.error
    );
  }
})();
