
"use strict";

(function () {
  const root = document.getElementById("m4SearchResults");
  const list = document.getElementById("m4SearchList");
  const pager = document.getElementById("m4SearchPagination");
  const countNode = document.getElementById("m4SearchCount");

  if (!root || !list || !pager || !countNode) return;

  const sources = ["zenn", "qiita", "medium"];
  const pageSize = window.CHRMediaPagination.pageSize;

  let rows = [];
  let ready = false;
  let page = 1;
  let previousQuery = "";

  function fold(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase();
  }

  function parameters() {
    return new URL(window.location.href).searchParams;
  }

  function enhanceSourceDropdown() {
    const container = document.getElementById("viewControls");
    if (!container) return;

    const selects = Array.from(
      container.querySelectorAll("select")
    );

    const select = selects.find(function (candidate) {
      return Array.from(candidate.options).some(
        function (option) {
          return option.textContent.trim() === "All Sources";
        }
      );
    });

    if (!select) return;

    for (const name of sources) {
      const value = "blog:" + name;

      if (Array.from(select.options).some(
        function (option) {
          return option.value === value;
        }
      )) {
        continue;
      }

      const option = document.createElement("option");
      option.value = value;
      option.textContent = name.toUpperCase() + "（ブログ）";
      select.appendChild(option);
    }

    const requested = parameters().get("source") || "";

    if (requested.startsWith("blog:")) {
      select.value = requested;
    }
  }

  function sourceCards() {
    const cards = new Map();

    document.querySelectorAll(
      "[data-m4-source] article.article-card"
    ).forEach(function (article) {
      const link = article.querySelector(
        ".article-title a[href]"
      );

      if (link) {
        cards.set(link.href, article);
      }
    });

    return cards;
  }

  function containsQuery(row, query) {
    if (!query) return true;

    return fold([
      row.title,
      row.excerpt,
      row.author,
      ...(row.author_tags || [])
    ].join(" ")).includes(query);
  }

  function matchedRows(params) {
    const sourceFilter = params.get("source") || "";
    const query = fold((params.get("q") || "").trim());
    const from = params.get("from") || "";
    const to = params.get("to") || "";

    // Existing news-only filters must not silently assign
    // Heat or Cyber Heat Radar classification to blogs.
    const newsOnly = [
      "heat_min",
      "heat_max",
      "tag",
      "kev",
      "security",
      "source_class",
      "document_form"
    ].some(function (name) {
      return params.getAll(name).some(Boolean);
    });

    if (newsOnly) return [];

    if (
      sourceFilter &&
      !sourceFilter.startsWith("blog:")
    ) {
      return [];
    }

    return rows.filter(function (row) {
      if (
        sourceFilter &&
        sourceFilter !== "blog:" + row.source
      ) {
        return false;
      }

      const published = String(row.published_at || "")
        .slice(0, 10);

      if (from && (!published || published < from)) {
        return false;
      }

      if (to && (!published || published > to)) {
        return false;
      }

      return containsQuery(row, query);
    }).sort(function (a, b) {
      const first = Date.parse(a.published_at || "") || 0;
      const second = Date.parse(b.published_at || "") || 0;

      return second - first;
    });
  }

  function render() {
    const params = parameters();

    const newsHeading =
      document.getElementById("m4NewsSearchHeading");

    if (newsHeading) {
      const isSearch = params.get("view") === "search";
      const blogOnly = (
        params.get("source") || ""
      ).startsWith("blog:");

      newsHeading.hidden = !isSearch || blogOnly;
    }

    if (params.get("view") !== "search") {
      root.hidden = true;
      return;
    }

    enhanceSourceDropdown();

    if (!ready) {
      root.hidden = true;
      return;
    }

    const signature = window.location.search;

    if (signature !== previousQuery) {
      page = 1;
      previousQuery = signature;
    }

    const results = matchedRows(params);
    const cardMap = sourceCards();
    const totalPages = Math.max(
      1, Math.ceil(results.length / pageSize)
    );
    page = Math.max(1, Math.min(totalPages, page));

    list.replaceChildren();

    let displayed = 0;

    for (const row of results.slice((page - 1) * pageSize, page * pageSize)) {
      const card = cardMap.get(
        new URL(row.url, window.location.href).href
      );

      if (!card) continue;

      const copy = card.cloneNode(true);
      copy.removeAttribute("id");
        copy.hidden = false;

      list.appendChild(copy);
      displayed += 1;
    }

    const blogOnly = (
      params.get("source") || ""
    ).startsWith("blog:");

    root.hidden = !blogOnly && results.length === 0;

    if (!root.hidden && displayed === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "該当するブログ記事はありません。";
      list.appendChild(empty);
    }

    countNode.textContent =
      results.length.toLocaleString("ja-JP") + "件";

    window.CHRMediaPagination.paint(
      pager, page, totalPages, function (next) {
        page = next;
        render();
        root.scrollIntoView({
          behavior: "smooth", block: "start"
        });
      }
    );
  }

  

  const viewControls = document.getElementById("viewControls");
  const newsArticleList = document.getElementById("articleList");

  let scheduled = false;

  function schedule() {
    if (scheduled) return;

    scheduled = true;

    queueMicrotask(function () {
      scheduled = false;
      render();
    });
  }

  if (viewControls) {
    new MutationObserver(schedule).observe(
      viewControls,
      { childList: true, subtree: true }
    );
  }

  if (newsArticleList) {
    new MutationObserver(schedule).observe(
      newsArticleList,
      { childList: true }
    );
  }

  window.addEventListener("popstate", schedule);

  document.addEventListener("submit", function (event) {
    const target = event.target;

    if (
      target &&
      (
        target.id === "headerSearchForm" ||
        target.closest("#viewControls")
      )
    ) {
      schedule();
    }
  }, true);

  document.addEventListener("click", function (event) {
    if (!(event.target instanceof Element)) return;

    if (event.target.closest(
      "[data-nav-view], [data-media-tab], #fe22OverviewTab"
    )) {
      schedule();
    }
  }, true);

  fetch("./data/media-v1.json")
    .then(function (response) {
      if (!response.ok) {
        throw new Error("media search data HTTP error");
      }
      return response.json();
    })
    .then(function (data) {
      if (!data || data.heat_enabled !== false) {
        throw new Error("invalid media search data");
      }

      for (const source of sources) {
        if (!Array.isArray(data.sources[source])) {
          throw new Error("missing source: " + source);
        }

        for (const row of data.sources[source]) {
          if (
            !Array.isArray(row.author_tags) ||
            typeof row.url !== "string"
          ) {
            throw new Error("invalid media search record");
          }

          rows.push(row);
        }
      }

      ready = true;
      schedule();
    })
    .catch(function (error) {
      console.error("Media search unavailable:", error);

      root.hidden = false;
      list.textContent =
        "ブログ検索データを読み込めませんでした。";
    });

  schedule();
})();
