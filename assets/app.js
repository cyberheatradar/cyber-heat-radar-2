"use strict";

const PAGE_SIZE = 25;

const VIEW_META = {
  "latest": {
    title: "LATEST ARTICLES",
    description: "記事の公開日時が新しい順に表示"
  },
  "hottest": {
    title: "HOTTEST ARTICLES · LAST 30 DAYS",
    description: "直近30日間の記事を Heat の高い順に表示"
  },
  "vulnerability": {
    title: "VULNERABILITIES",
    description: "脆弱性関連"
  },
  "threat-actor": {
    title: "THREAT ACTORS",
    description: "脅威アクターが紐づく記事"
  },
  "campaign": {
    title: "CAMPAIGNS",
    description: "攻撃・脅威キャンペーン関連"
  },
  "malware": {
    title: "MALWARE",
    description: "マルウェア関連"
  },
  "ransomware": {
    title: "RANSOMWARE",
    description: "ランサムウェア関連"
  },
  "ttp-ioc": {
    title: "TTP / IoC",
    description: "TTP・IoC関連"
  },
  "defense-ops": {
    title: "DEFENSE & OPS",
    description: "防御・検知・運用・ガイダンス関連"
  },
  "ai-security": {
    title: "AI SECURITY",
    description: "AI × Security関連"
  },
  "supply-chain": {
    title: "SUPPLY CHAIN",
    description: "サプライチェーン関連"
  },
  "kev": {
    title: "CISA KEV",
    description: "seen_in_kev authority による KEV 関連"
  },
  "search": {
    title: "SEARCH RESULTS",
    description: "公開カタログ全体を検索"
  }
};

const state = {
  meta: {},
  recent: [],
  all: [],
  view: "latest",
  page: 1,
  q: "",
  security: "",
  sourceClass: "",
  documentForm: "",
  kev: "",
  sort: "observed",
  actor: ""
};

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function entityNames(value) {
  return arrayValue(value)
    .map((x) => {
      if (typeof x === "string") return x;
      if (!x || typeof x !== "object") return "";
      return x.canonical_name || x.entity_name || x.name || x.value || "";
    })
    .filter(Boolean);
}

function cves(row) {
  return arrayValue(row.cves || row.cve_ids || row.related_cves)
    .map((x) => String(x))
    .filter(Boolean);
}

function tags(row) {
  return arrayValue(row.public_tags).filter((x) => x && typeof x === "object");
}

function hasTag(row, wanted) {
  const target = String(wanted).toLowerCase();
  return tags(row).some((x) => {
    const key = String(x.key || "").toLowerCase();
    const label = String(x.label || "").toLowerCase();
    return key === target || label === target;
  });
}

function hasAnyTag(row, values) {
  return values.some((x) => hasTag(row, x));
}

function sourceName(row) {
  return row.source_name ||
         row.source ||
         row.source_id ||
         row.publisher ||
         row.source_class ||
         "Unknown source";
}

function heatScore(row) {
  const n = Number(row.heat_score);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function dateValue(raw) {
  if (!raw) return 0;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

function observedValue(row) {
  return dateValue(row.first_seen_at);
}

function publishedValue(row) {
  return dateValue(row.published_at);
}

function formatJST(raw) {
  if (!raw) return "—";

  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "—";

  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  return formatter.format(d) + " JST";
}

function textBlob(row) {
  const pieces = [
    row.title,
    row.summary,
    row.summary_excerpt,
    row.canonical_url,
    sourceName(row),
    row.source_class,
    row.document_form,
    row.security_relevance,
    row.primary_category,
    ...cves(row),
    ...entityNames(row.threat_actors),
    ...tags(row).map((x) => x.label || x.key || "")
  ];

  return pieces
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map(String))]
    .sort((a, b) => a.localeCompare(b));
}

function reactionDisplay(value) {
  if (value === null || value === undefined || value === "") {
    return "未評価";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    const candidates = [
      value.display,
      value.label,
      value.level,
      value.status,
      value.japanese_public_reaction_level,
      value.domestic_impact_level
    ];

    for (const x of candidates) {
      if (x !== null && x !== undefined && x !== "") {
        return String(x);
      }
    }

    const counts = [
      value.domestic_bookmark_count,
      value.domestic_developer_article_count,
      value.count
    ].filter((x) => Number.isFinite(Number(x)));

    if (counts.length) {
      return counts.map(Number).reduce((a, b) => a + b, 0) + "件";
    }
  }

  return "未評価";
}

function articlePermalink(row) {
  if (row.permalink_id) return row.permalink_id;

  return "article-" + String(row.public_article_id || "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function routeUrl(view, q) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("view", view);

  if (view === "search" && q) {
    url.searchParams.set("q", q);
  }

  url.hash = "";
  return url;
}

function shareUrlFor(row) {
  const url = routeUrl("search", "");
  url.hash = articlePermalink(row);
  return url.toString();
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();

  const ok = document.execCommand("copy");
  area.remove();

  if (!ok) {
    throw new Error("copy failed");
  }
}

let toastTimer = null;

function showToast(text) {
  const node = document.getElementById("toast");
  node.textContent = text;
  node.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    node.classList.remove("show");
  }, 1600);
}

function currentRoute() {
  const url = new URL(window.location.href);
  const requested = url.searchParams.get("view") || "latest";

  return {
    view: VIEW_META[requested] ? requested : "latest",
    q: url.searchParams.get("q") || ""
  };
}

function loadRoute() {
  const route = currentRoute();
  state.view = route.view;
  state.q = route.q;
  state.page = 1;
}


function scrollToViewTop(behavior = "auto") {
  window.scrollTo({
    top: 0,
    behavior
  });
}

function navigate(view, q = "") {
  const url = routeUrl(view, q);
  history.pushState({}, "", url);
  state.view = view;
  state.q = q;
  state.page = 1;
  state.actor = "";
  render();
  scrollToViewTop("auto");
}

function viewRows() {
  let rows;

  if (state.view === "latest" || state.view === "hottest") {
    rows = [...state.recent];
  } else {
    rows = [...state.all];
  }

  switch (state.view) {
    case "vulnerability":
      rows = rows.filter((x) =>
        hasTag(x, "Vulnerability") || cves(x).length > 0
      );
      break;

    case "threat-actor":
      rows = rows.filter((x) => entityNames(x.threat_actors).length > 0);
      break;

    case "campaign":
      rows = rows.filter((x) =>
        hasAnyTag(x, ["Campaign", "Threat Advisory"])
      );
      break;

    case "malware":
      rows = rows.filter((x) => hasTag(x, "Malware"));
      break;

    case "ransomware":
      rows = rows.filter((x) => hasTag(x, "Ransomware"));
      break;

    case "ttp-ioc":
      rows = rows.filter((x) => hasAnyTag(x, ["TTP", "IoC"]));
      break;

    case "defense-ops":
      rows = rows.filter((x) =>
        hasAnyTag(x, [
          "Defense & Ops",
          "Defense",
          "Detection",
          "Hardening",
          "Incident Response",
          "Threat Hunting",
          "Guidance"
        ])
      );
      break;

    case "ai-security":
      rows = rows.filter((x) =>
        hasAnyTag(x, ["AI Security", "Agentic Security", "MCP"]) ||
        (
          x.ai_relevance &&
          String(x.ai_relevance).toLowerCase() !== "none"
        )
      );
      break;

    case "supply-chain":
      rows = rows.filter((x) => hasTag(x, "Supply Chain"));
      break;

    case "kev":
      rows = rows.filter((x) => x.seen_in_kev === true);
      break;

    case "search": {
      if (state.q.trim()) {
        const q = state.q.trim().toLowerCase();
        rows = rows.filter((x) => textBlob(x).includes(q));
      }

      if (state.security) {
        rows = rows.filter((x) =>
          String(x.security_relevance || "") === state.security
        );
      }

      if (state.sourceClass) {
        rows = rows.filter((x) =>
          String(x.source_class || "") === state.sourceClass
        );
      }

      if (state.documentForm) {
        rows = rows.filter((x) =>
          String(x.document_form || "") === state.documentForm
        );
      }

      if (state.kev === "yes") {
        rows = rows.filter((x) => x.seen_in_kev === true);
      } else if (state.kev === "no") {
        rows = rows.filter((x) => x.seen_in_kev !== true);
      }

      break;
    }
  }

  
  if (state.view === "search") {
    const searchParams =
      new URL(window.location.href).searchParams;

    const sourceFilter =
      searchParams.get("source") || "";

    const selectedTagLabels =
      new Set(
        searchParams
          .getAll("tag")
          .filter(Boolean)
      );

    const from =
      searchParams.get("from") || "";

    const to =
      searchParams.get("to") || "";

    const heatMinRaw =
      searchParams.get("heat_min");

    const heatMaxRaw =
      searchParams.get("heat_max");

    const heatMin =
      heatMinRaw === null || heatMinRaw === ""
        ? null
        : Number(heatMinRaw);

    const heatMax =
      heatMaxRaw === null || heatMaxRaw === ""
        ? null
        : Number(heatMaxRaw);

    rows = rows.filter((row) => {

      if (
        sourceFilter &&
        String(row.source_name || "").trim()
          !== sourceFilter
      ) {
        return false;
      }

      if (selectedTagLabels.size > 0) {
        const rawTags =
          row.public_tags || [];

        const rowTags =
          Array.isArray(rawTags)
            ? rawTags
            : (
                rawTags &&
                typeof rawTags === "object"
                  ? [rawTags]
                  : []
              );

        const matched =
          rowTags.some((tag) => {
            if (
              !tag ||
              typeof tag !== "object"
            ) {
              return false;
            }

            const label =
              String(
                tag.label || ""
              ).trim();

            return (
              label &&
              selectedTagLabels.has(label)
            );
          });

        if (!matched) {
          return false;
        }
      }

      if (from || to) {
        const published = publishedDateKey(row);

        // Published date filters never substitute Observed.
        if (!published) {
          return false;
        }

        if (from && published < from) {
          return false;
        }

        if (to && published > to) {
          return false;
        }
      }

      const heat = heatScore(row);

      if (
        heatMin !== null &&
        Number.isFinite(heatMin) &&
        heat < heatMin
      ) {
        return false;
      }

      if (
        heatMax !== null &&
        Number.isFinite(heatMax) &&
        heat > heatMax
      ) {
        return false;
      }

      return true;
    });
  }

  if (state.view === "hottest") {
    rows.sort((a, b) =>
      heatScore(b) - heatScore(a) ||
      publishedValue(b) - publishedValue(a)
    );
  } else if (state.view === "search") {
    rows.sort((a, b) =>
      publishedValue(b) - publishedValue(a) ||
      observedValue(b) - observedValue(a)
    );
  } else {
      rows.sort((a, b) =>
        publishedValue(b) - publishedValue(a) ||
        observedValue(b) - observedValue(a)
      );
    }
  return rows;
}

function applyAnchorPage(rows) {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!id) return;

  const index = rows.findIndex((x) => articlePermalink(x) === id);

  if (index >= 0) {
    state.page = Math.floor(index / PAGE_SIZE) + 1;
  }
}

function setNavActive() {
  document.querySelectorAll("[data-nav-view]").forEach((node) => {
    node.classList.toggle(
      "active",
      node.getAttribute("data-nav-view") === state.view
    );
  });
}

function buildStatus() {
  const dl = document.getElementById("radarStatus");
  dl.replaceChildren();

  // CHR2_PUBLICATION_TIME_R1
  const entries = [
    ["収録記事", state.all.length.toLocaleString("ja-JP")],
    ["最近の記事", state.recent.length.toLocaleString("ja-JP")],
    ["最終更新", formatJST(state.meta.last_published_at)]
  ];

  for (const [k, v] of entries) {
    const wrap = make("div");
    const dt = make("dt", "", k);
    const dd = make("dd", "", v);
    wrap.append(dt, dd);
    dl.appendChild(wrap);
  }
}

function buildMeta() {
  const node = document.getElementById("catalogMeta");

  const generated = state.meta.generated_at ||
                    state.meta.generated ||
                    state.meta.generated_at_utc;

  node.textContent =
    "Catalog " +
    state.all.length.toLocaleString("ja-JP") +
    " · as-of " +
    formatJST(state.meta.as_of) +
    " · generated " +
    formatJST(generated);
}

function option(select, value, label) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  select.appendChild(o);
}


function publishedDateKey(row) {
  if (!row || !row.published_at) {
    return "";
  }

  const value = new Date(row.published_at);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(value);

  const out = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day"
    ) {
      out[part.type] = part.value;
    }
  }

  return `${out.year}-${out.month}-${out.day}`;
}

function buildSearchControls(container) {
  container.replaceChildren();

  const params =
    new URL(window.location.href)
      .searchParams;

  const form =
    document.createElement("form");

  form.className =
    "search-controls-v2";

  form.setAttribute(
    "role",
    "search"
  );

  const grid =
    document.createElement("div");

  grid.className =
    "search-controls-v2-grid";

  function field(
    labelText,
    input,
    extraClass = ""
  ) {
    const label =
      document.createElement("label");

    label.className =
      "search-field"
      + (
        extraClass
          ? " " + extraClass
          : ""
      );

    const text =
      document.createElement("span");

    text.className =
      "search-field-label";

    text.textContent =
      labelText;

    label.append(
      text,
      input
    );

    return label;
  }

  const sourceValues =
    [...new Set(
      state.all
        .map((row) =>
          String(
            row.source_name || ""
          ).trim()
        )
        .filter(Boolean)
    )].sort(
      (a, b) =>
        a.localeCompare(b)
    );

  const tagLabels =
    [...new Set(
      state.all.flatMap((row) => {
        const raw =
          row.public_tags || [];

        const values =
          Array.isArray(raw)
            ? raw
            : (
                raw &&
                typeof raw === "object"
                  ? [raw]
                  : []
              );

        return values
          .filter((tag) =>
            tag &&
            typeof tag === "object"
          )
          .map((tag) =>
            String(
              tag.label || ""
            ).trim()
          )
          .filter(Boolean);
      })
    )].sort(
      (a, b) =>
        a.localeCompare(b)
    );

  const q =
    document.createElement("input");

  q.type = "search";
  q.value =
    params.get("q")
    || state.q
    || "";

  q.placeholder = "Keyword";

  const source =
    document.createElement("input");

  source.type = "search";

  source.setAttribute(
    "list",
    "rc6bSourceOptions"
  );

  source.placeholder =
    "All Sources";

  source.autocomplete = "off";

  source.value =
    params.get("source")
    || "";

  const sourceList =
    document.createElement("datalist");

  sourceList.id =
    "rc6bSourceOptions";

  for (const value of sourceValues) {
    const option =
      document.createElement("option");

    option.value = value;

    sourceList.appendChild(option);
  }

  function isCanonicalDate(value) {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/
        .exec(value);

    if (!match) {
      return false;
    }

    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );

    return (
      date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
    );
  }

  function createCanonicalDateControl(
    paramName,
    ariaLabel
  ) {
    /*
     * Visible authority:
     *   text field -> always YYYY-MM-DD
     *
     * Picker authority:
     *   hidden native type=date
     *
     * Both are presented visually as ONE input.
     */
    const root =
      document.createElement("span");

    root.className =
      "search-date-control";

    const text =
      document.createElement("input");

    text.type = "text";
    text.className =
      "search-date-text";

    text.inputMode =
      "numeric";

    text.autocomplete =
      "off";

    text.spellcheck =
      false;

    text.maxLength =
      10;

    text.placeholder =
      "YYYY-MM-DD";

    text.value =
      params.get(paramName)
      || "";

    text.setAttribute(
      "aria-label",
      ariaLabel
    );

    const button =
      document.createElement("button");

    button.type =
      "button";

    button.className =
      "search-date-button";

    button.setAttribute(
      "aria-label",
      ariaLabel + " calendar"
    );

    const glyph =
      document.createElement("span");

    glyph.className =
      "search-date-calendar-glyph";

    glyph.setAttribute(
      "aria-hidden",
      "true"
    );

    button.appendChild(
      glyph
    );

    const picker =
      document.createElement("input");

    picker.type =
      "date";

    picker.className =
      "search-date-native";

    picker.tabIndex =
      -1;

    picker.setAttribute(
      "aria-hidden",
      "true"
    );

    function syncPickerFromText() {
      const value =
        text.value.trim();

      picker.value =
        isCanonicalDate(value)
          ? value
          : "";
    }

    if (
      isCanonicalDate(
        text.value
      )
    ) {
      picker.value =
        text.value;
    }

    text.addEventListener(
      "input",
      () => {
        text.setCustomValidity("");
        syncPickerFromText();
      }
    );

    picker.addEventListener(
      "change",
      () => {
        if (!picker.value) {
          return;
        }

        text.value =
          picker.value;

        text.setCustomValidity(
          ""
        );
      }
    );

    button.addEventListener(
      "click",
      () => {
        syncPickerFromText();

        if (
          typeof picker.showPicker
          === "function"
        ) {
          picker.showPicker();
        } else {
          picker.focus();
          picker.click();
        }
      }
    );

    root.append(
      text,
      button,
      picker
    );

    return {
      root,
      text,
      picker
    };
  }

  const fromControl =
    createCanonicalDateControl(
      "from",
      "Published From"
    );

  const from =
    fromControl.text;

  const toControl =
    createCanonicalDateControl(
      "to",
      "Published To"
    );

  const to =
    toControl.text;

  const heatMin =
    document.createElement("input");

  heatMin.type = "number";
  heatMin.min = "0";
  heatMin.max = "100";
  heatMin.step = "1";
  heatMin.placeholder = "0";
  heatMin.value =
    params.get("heat_min") || "";

  const heatMax =
    document.createElement("input");

  heatMax.type = "number";
  heatMax.min = "0";
  heatMax.max = "100";
  heatMax.step = "1";
  heatMax.placeholder = "100";
  heatMax.value =
    params.get("heat_max") || "";

  const selectedTags =
    new Set(
      params
        .getAll("tag")
        .filter(Boolean)
    );

  const tagsField =
    document.createElement("div");

  tagsField.className =
    "search-field search-field-tags";

  const tagsLabel =
    document.createElement("span");

  tagsLabel.className =
    "search-field-label";

  tagsLabel.textContent = "Tags";

  const details =
    document.createElement("details");

  details.className =
    "search-tags-dropdown";

  const summary =
    document.createElement("summary");

  summary.textContent =
    selectedTags.size
      ? (
          selectedTags.size
          + " selected"
        )
      : "All Tags";

  const menu =
    document.createElement("div");

  menu.className =
    "search-tags-menu";

  for (const label of tagLabels) {
    const item =
      document.createElement("label");

    item.className =
      "search-tag-option";

    const checkbox =
      document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.value = label;
    checkbox.checked =
      selectedTags.has(label);

    const text =
      document.createElement("span");

    text.textContent = label;

    item.append(
      checkbox,
      text
    );

    menu.appendChild(item);
  }

  details.append(
    summary,
    menu
  );

  tagsField.append(
    tagsLabel,
    details
  );

  grid.append(
    field(
      "Keyword",
      q,
      "search-field-keyword"
    ),
    field(
      "Source",
      source,
      "search-field-source"
    ),
    tagsField,
    field(
      "Heat Min",
      heatMin,
      "search-field-heat-min"
    ),
    field(
      "Heat Max",
      heatMax,
      "search-field-heat-max"
    ),
    field(
      "Published From",
      fromControl.root,
      "search-field-published-from"
    ),
    field(
      "Published To",
      toControl.root,
      "search-field-published-to"
    )
  );

  form.appendChild(sourceList);

  const actions =
    document.createElement("div");

  actions.className =
    "search-controls-v2-actions";

  const apply =
    document.createElement("button");

  apply.type = "submit";
  apply.textContent = "APPLY";

  const clear =
    document.createElement("button");

  clear.type = "button";
  clear.textContent =
    "CLEAR FILTERS";

  actions.append(
    apply,
    clear
  );

  form.append(
    grid,
    actions
  );

  container.appendChild(form);

  function validateFilters() {
    from.setCustomValidity("");
    to.setCustomValidity("");
    heatMin.setCustomValidity("");
    heatMax.setCustomValidity("");
    source.setCustomValidity("");

    if (
      from.value &&
      !isCanonicalDate(
        from.value.trim()
      )
    ) {
      from.setCustomValidity(
        "YYYY-MM-DD 形式の有効な日付を入力してください。"
      );

      from.reportValidity();

      return false;
    }

    if (
      to.value &&
      !isCanonicalDate(
        to.value.trim()
      )
    ) {
      to.setCustomValidity(
        "YYYY-MM-DD 形式の有効な日付を入力してください。"
      );

      to.reportValidity();

      return false;
    }

    const sourceValue =
      source.value.trim();

    if (
      sourceValue &&
      !sourceValues.includes(
        sourceValue
      )
    ) {
      source.setCustomValidity(
        "Source は候補から選択してください。"
      );

      source.reportValidity();

      return false;
    }

    if (
      from.value &&
      to.value &&
      from.value > to.value
    ) {
      to.setCustomValidity(
        "Published To は Published From 以降の日付を指定してください。"
      );

      to.reportValidity();

      return false;
    }

    const minValue =
      heatMin.value === ""
        ? null
        : Number(heatMin.value);

    const maxValue =
      heatMax.value === ""
        ? null
        : Number(heatMax.value);

    if (
      minValue !== null &&
      maxValue !== null &&
      minValue > maxValue
    ) {
      heatMax.setCustomValidity(
        "Heat Max は Heat Min 以上を指定してください。"
      );

      heatMax.reportValidity();

      return false;
    }

    return true;
  }

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      if (!validateFilters()) {
        return;
      }

      state.q =
        q.value.trim();

      state.page = 1;

      const url =
        routeUrl(
          "search",
          state.q
        );

      const sourceValue =
        source.value.trim();

      if (sourceValue) {
        url.searchParams.set(
          "source",
          sourceValue
        );
      }

      for (
        const checkbox
        of menu.querySelectorAll(
          'input[type="checkbox"]:checked'
        )
      ) {
        url.searchParams.append(
          "tag",
          checkbox.value
        );
      }

      if (from.value) {
        url.searchParams.set(
          "from",
          from.value
        );
      }

      if (to.value) {
        url.searchParams.set(
          "to",
          to.value
        );
      }

      if (heatMin.value !== "") {
        url.searchParams.set(
          "heat_min",
          heatMin.value
        );
      }

      if (heatMax.value !== "") {
        url.searchParams.set(
          "heat_max",
          heatMax.value
        );
      }

      history.replaceState(
        {},
        "",
        url
      );

      render();

      window.scrollTo({
        top: 0,
        behavior: "auto"
      });
    }
  );

  clear.addEventListener(
    "click",
    () => {
      state.q = "";
      state.page = 1;

      const url =
        routeUrl(
          "search",
          ""
        );

      history.replaceState(
        {},
        "",
        url
      );

      render();

      window.scrollTo({
        top: 0,
        behavior: "auto"
      });
    }
  );
}


function renderControls() {
  const container = document.getElementById("viewControls");
  container.replaceChildren();

  if (state.view === "search") {
    container.hidden = false;
    buildSearchControls(container);
    return;
  }
container.hidden = true;
}

function tagNode(tag) {
  const family = [
    "red",
    "blue",
    "purple",
    "cyan",
    "orange",
    "neutral"
  ].includes(String(tag.color_family))
    ? String(tag.color_family)
    : "neutral";

  return make(
    "span",
    "tag tag-" + family,
    tag.label || tag.key || "Tag"
  );
}

function heatClass(score) {
  if (score >= 85) return "heat-critical";
  if (score >= 65) return "heat-hot";
  if (score >= 40) return "heat-warm";
  return "heat-cold";
}

function highlightTextMatches(root, query) {
  const needle = String(query || "").trim();

  if (!needle) return;

  const foldedNeedle =
    needle.toLowerCase();

  const walker =
    document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(
      walker.currentNode
    );
  }

  for (const node of nodes) {
    const value =
      node.nodeValue || "";

    const foldedValue =
      value.toLowerCase();

    let cursor = 0;

    let index =
      foldedValue.indexOf(
        foldedNeedle,
        cursor
      );

    if (index < 0) continue;

    const fragment =
      document.createDocumentFragment();

    while (index >= 0) {
      if (index > cursor) {
        fragment.appendChild(
          document.createTextNode(
            value.slice(
              cursor,
              index
            )
          )
        );
      }

      const mark =
        document.createElement(
          "mark"
        );

      mark.className =
        "search-hit";

      mark.textContent =
        value.slice(
          index,
          index + needle.length
        );

      fragment.appendChild(
        mark
      );

      cursor =
        index + needle.length;

      index =
        foldedValue.indexOf(
          foldedNeedle,
          cursor
        );
    }

    if (cursor < value.length) {
      fragment.appendChild(
        document.createTextNode(
          value.slice(cursor)
        )
      );
    }

    node.replaceWith(
      fragment
    );
  }
}


function highlightSearchHits(article) {
  if (state.view !== "search") {
    return;
  }

  const query =
    state.q.trim();

  if (!query) {
    return;
  }

  article
    .querySelectorAll(
      ".article-title a,"
      + " .summary-excerpt,"
      + " .metadata-row,"
      + " .tag-list"
    )
    .forEach((node) => {
      highlightTextMatches(
        node,
        query
      );
    });
}


function metadataItem(label, value) {
  const span = make("span", "metadata-item");
  const strong = make("strong", "", label + ": ");
  const text = document.createTextNode(value);
  span.append(strong, text);
  return span;
}

function buildCard(row) {
  const article = make("article", "article-card");
  article.id = articlePermalink(row);

  const top = make("div", "card-topline");
  const tagList = make("div", "tag-list");

  for (const tag of tags(row)) {
    tagList.appendChild(tagNode(tag));
  }

  const shareUrl = shareUrlFor(row);
  const shareTitle = row.title || "Cyber Heat Radar";

  const shareActions = make(
    "div",
    "share-actions"
  );

  const copy = make(
    "button",
    "share-button share-action",
    "COPY"
  );
  copy.type = "button";
  copy.title = "記事リンクをコピー";

  copy.addEventListener(
    "click",
    async () => {
      try {
        await copyText(shareUrl);
        showToast(
          "記事リンクをコピーしました"
        );
      } catch (_) {
        window.prompt(
          "Copy article link:",
          shareUrl
        );
      }
    }
  );

  const xShare = make(
    "a",
    "share-button share-action",
    "𝕏"
  );
  xShare.href =
    "https://x.com/intent/tweet"
    + "?text="
    + encodeURIComponent(shareTitle)
    + "&url="
    + encodeURIComponent(shareUrl);
  xShare.target = "_blank";
  xShare.rel = "noopener noreferrer";
  xShare.title = "Xで投稿";

  const systemShare = make(
    "button",
    "share-button share-action",
    "SHARE"
  );
  systemShare.type = "button";
  systemShare.title =
    "端末の共有メニューを開く";

  systemShare.addEventListener(
    "click",
    async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareTitle,
            url: shareUrl
          });
          return;
        } catch (error) {
          if (
            error
            && error.name === "AbortError"
          ) {
            return;
          }
        }
      }

      try {
        await copyText(shareUrl);
        showToast(
          "共有機能が利用できないため"
          + "記事リンクをコピーしました"
        );
      } catch (_) {
        window.prompt(
          "Copy article link:",
          shareUrl
        );
      }
    }
  );

  shareActions.append(
    copy,
    xShare
  );

  if (
    typeof navigator.share
    === "function"
  ) {
    shareActions.append(
      systemShare
    );
  }

  top.append(
    tagList,
    shareActions
  );

  const title = make("h2", "article-title");
  const link = make("a", "", row.title || "(untitled)");

  link.href = row.canonical_url || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  title.appendChild(link);

  const summary = make(
    "p",
    "summary-excerpt",
    row.summary_excerpt || row.summary || "要約なし"
  );

  const metadata = make("div", "metadata-row");

  metadata.append(
    metadataItem("Source", sourceName(row)),
    metadataItem("Published", formatJST(row.published_at)),
    metadataItem("Observed", formatJST(row.first_seen_at))
  );

  const bottom = make("div", "card-bottom");
  const signals = make("div", "signal-row");

  const external = make("span", "signal");
  external.append(
    make("strong", "", "外部反応: "),
    document.createTextNode(reactionDisplay(row.external_reaction))
  );

  const domestic = make("span", "signal");
  domestic.append(
    make("strong", "", "国内波及: "),
    document.createTextNode(reactionDisplay(row.domestic_impact))
  );

  signals.append(external, domestic);

  const score = heatScore(row);
  const heat = make("div", "heat-box " + heatClass(score));
  const label = make("div", "heat-label", "HEAT " + Math.round(score));
  const track = make("div", "heat-track");
  const fill = make("div", "heat-fill");

  fill.style.width = score + "%";
  track.appendChild(fill);
  heat.append(label, track);

  bottom.append(signals, heat);

  article.append(top, title, summary, metadata, bottom);

  highlightSearchHits(article);

  return article;
}

function paginationButton(text, disabled, handler) {
  const button = make("button", "", text);
  button.type = "button";
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function renderPagination(totalPages) {
  const nav = document.getElementById("pagination");
  nav.replaceChildren();

  if (totalPages <= 1) return;

  const go = (page) => {
    state.page = Math.max(1, Math.min(totalPages, page));
    window.location.hash = "";
    render();
    scrollToViewTop("smooth");
  };

  nav.append(
    paginationButton("First", state.page === 1, () => go(1)),
    paginationButton("Previous", state.page === 1, () => go(state.page - 1)),
    make(
      "span",
      "page-indicator",
      "Page " + state.page + " / " + totalPages
    ),
    paginationButton(
      "Next",
      state.page === totalPages,
      () => go(state.page + 1)
    ),
    paginationButton(
      "Last",
      state.page === totalPages,
      () => go(totalPages)
    )
  );
}

function highlightAnchor() {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!id) return;

  requestAnimationFrame(() => {
    const node = document.getElementById(id);
    if (!node) return;

    node.classList.add("anchor-target");

    node.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    setTimeout(() => {
      node.classList.remove("anchor-target");
    }, 2200);
  });
}

function render() {
  setNavActive();

  const headerSearchInput =
    document.getElementById(
      "headerSearchInput"
    );

  if (headerSearchInput) {
    headerSearchInput.value =
      state.view === "search"
        ? state.q
        : "";
  }

  const meta = VIEW_META[state.view] || VIEW_META.latest;

  document.getElementById("viewTitle").textContent = meta.title;
  document.getElementById("viewDescription").textContent = meta.description;

  renderControls();

  const rows = viewRows();

  applyAnchorPage(rows);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  state.page = Math.max(1, Math.min(totalPages, state.page));

  const start = (state.page - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  document.getElementById("resultCount").textContent =
    rows.length.toLocaleString("ja-JP") + " articles";

  const list = document.getElementById("articleList");
  list.replaceChildren();

  if (!visible.length) {
    list.appendChild(
      make("div", "empty-state", "該当する記事はありません。")
    );
  } else {
    for (const row of visible) {
      list.appendChild(buildCard(row));
    }
  }

  renderPagination(totalPages);

  document.body.dataset.appReady = "true";
  document.body.dataset.currentView = state.view;
  document.body.dataset.resultCount = String(rows.length);

  highlightAnchor();
}

function bindNavigation() {
  document.querySelectorAll("[data-nav-view]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();

      const mobileMenu =
        node.closest(
          "#mobileTopicMenu"
        );

      if (mobileMenu) {
        mobileMenu.open = false;
      }

      navigate(
        node.getAttribute(
          "data-nav-view"
        ) || "latest"
      );
    });
  });

  document.querySelectorAll(
    "[data-mobile-overview]"
  ).forEach((node) => {
    node.addEventListener(
      "click",
      (event) => {
        event.preventDefault();

        const mobileMenu =
          node.closest(
            "#mobileTopicMenu"
          );

        if (mobileMenu) {
          mobileMenu.open = false;
        }

        const overview =
          document.getElementById(
            "fe22OverviewTab"
          );

        if (!overview) {
          return;
        }

        /*
         * Relay to the already-qualified FE22 Overview
         * SPA handler. No page reload / JSON refetch.
         */
        overview.click();
      }
    );
  });

  document.getElementById("headerSearchForm")
    .addEventListener("submit", (event) => {
      event.preventDefault();

      const q = document.getElementById("headerSearchInput")
        .value
        .trim();

      navigate("search", q);
    });

  window.addEventListener("popstate", () => {
    loadRoute();
    render();
  });

  window.addEventListener("hashchange", () => {
    const rows = viewRows();
    applyAnchorPage(rows);
    render();
  });
}

async function fetchJson(path) {
  const response = await fetch(path, {cache: "no-store"});

  if (!response.ok) {
    throw new Error(path + " returned HTTP " + response.status);
  }

  return response.json();
}

async function boot() {
  const [meta, recent, all] = await Promise.all([
    fetchJson("./data/meta.json"),
    fetchJson("./data/recent.json"),
    fetchJson("./data/search-index.json")
  ]);

  if (!Array.isArray(recent) || !Array.isArray(all)) {
    throw new Error("catalog JSON shape invalid");
  }

  state.meta = meta || {};
  state.recent = recent;
  state.all = all;

  loadRoute();
  bindNavigation();
  buildMeta();
  buildStatus();

  document.getElementById("headerSearchInput").value =
    state.view === "search" ? state.q : "";

  render();
  startPublicationUpdateNotice(state.meta.last_published_at);
}

boot().catch((error) => {
  console.error(error);

  document.body.dataset.appReady = "false";

  const list = document.getElementById("articleList");

  if (list) {
    list.replaceChildren(
      make(
        "div",
        "empty-state",
        "Catalog initialization failed: " + String(error)
      )
    );
  }
});


function installBackToTop() {
  if (document.getElementById("backToTopButton")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "backToTopButton";
  button.className = "back-to-top";
  button.type = "button";
  button.textContent = "↑ TOP";
  button.setAttribute("aria-label", "ページの一番上へ戻る");

  const sync = () => {
    const visible = window.scrollY > 600;
    button.classList.toggle("is-visible", visible);
    button.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  button.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  window.addEventListener("scroll", sync, {
    passive: true
  });

  document.body.appendChild(button);
  sync();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    installBackToTop,
    { once: true }
  );
} else {
  installBackToTop();
}

// FE2.2 RC3: common card renderer authority.
window.CyberHeatRadarUI = Object.freeze({
  buildCard
});


// ==========================================================
// P10_R9_R4_LAYOUT_MODES
// ==========================================================
(() => {
  "use strict";

  const STORAGE_KEY =
    "cyberheatradar.article-layout.v1";

  const VALID_LAYOUTS =
    new Set([
      "detail",
      "block",
      "list"
    ]);

  function readStoredLayout() {
    try {
      const value =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (VALID_LAYOUTS.has(value)) {
        return value;
      }
    } catch (_) {
      // localStorage may be unavailable.
    }

    return "detail";
  }

  function storeLayout(layout) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        layout
      );
    } catch (_) {
      // Page-local layout remains usable.
    }
  }

  function applyLayout(
    layout,
    persist = false
  ) {
    if (!VALID_LAYOUTS.has(layout)) {
      layout = "detail";
    }

    document.documentElement.dataset
      .articleLayout = layout;

    document
      .querySelectorAll(
        "[data-article-layout]"
      )
      .forEach((button) => {
        const active =
          button.getAttribute(
            "data-article-layout"
          ) === layout;

        button.setAttribute(
          "aria-pressed",
          active ? "true" : "false"
        );

        button.classList.toggle(
          "active",
          active
        );
      });

    if (persist) {
      storeLayout(layout);
    }
  }

  function bindLayoutSwitcher() {
    document.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            ".article-layout-bar [data-article-layout]"
          );

        if (!button) {
          return;
        }

        applyLayout(
          button.getAttribute(
            "data-article-layout"
          ),
          true
        );
      }
    );

    applyLayout(
      readStoredLayout(),
      false
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      bindLayoutSwitcher,
      {once: true}
    );
  } else {
    bindLayoutSwitcher();
  }
})();


// CHR2_UPDATE_NOTICE_R1
// Inform the visitor about a newer publication.
// Never replace cards or reload without a user click.
function startPublicationUpdateNotice(initialPublishedAt) {
  const initialTime = Date.parse(initialPublishedAt || "");
  if (!Number.isFinite(initialTime)) return;

  const masthead = document.querySelector(".masthead-inner");
  const brand = masthead &&
    masthead.querySelector(":scope > a.brand");

  if (!brand || document.getElementById("chr2UpdateNotice")) {
    return;
  }

  // Keep the logo and button together on desktop and mobile.
  const wrap = document.createElement("div");
  wrap.className = "chr2-brand-notice";
  masthead.insertBefore(wrap, brand);
  wrap.appendChild(brand);

  const notice = document.createElement("button");
  notice.id = "chr2UpdateNotice";
  notice.className = "chr2-update-notice";
  notice.type = "button";
  notice.textContent = "更新あり";
  notice.title = "新しい公開内容を読み込む";
  notice.setAttribute(
    "aria-label",
    "更新あり。クリックしてページを再読み込み"
  );
  notice.setAttribute("aria-live", "polite");
  notice.hidden = true;

  notice.addEventListener("click", () => {
    // Same normal-reload behavior as F5.
    window.location.reload();
  });

  wrap.appendChild(notice);

  let checking = false;

  async function checkForUpdate() {
    if (checking || document.hidden || !notice.hidden) {
      return;
    }

    checking = true;

    try {
      const response = await fetch(
        "./data/meta.json",
        {cache: "no-store"}
      );

      if (!response.ok) return;

      const meta = await response.json();

      const latestTime = Date.parse(
        meta && typeof meta.last_published_at === "string"
          ? meta.last_published_at
          : ""
      );

      if (
        Number.isFinite(latestTime) &&
        latestTime > initialTime
      ) {
        notice.hidden = false;
      }
    } catch (_error) {
      // Network failure must not disturb the current page.
    } finally {
      checking = false;
    }
  }

  // One read-only metadata check per minute.
  window.setInterval(checkForUpdate, 60000);

  // Recover promptly when returning to an inactive tab.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void checkForUpdate();
  });

  window.addEventListener(
    "focus",
    () => void checkForUpdate()
  );

  window.addEventListener(
    "online",
    () => void checkForUpdate()
  );

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) void checkForUpdate();
  });
}
