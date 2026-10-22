
"use strict";

(function () {
  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      const field = document.createElement("textarea");
      field.value = value;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();

      const ok = document.execCommand("copy");
      field.remove();

      if (!ok) {
        window.prompt("Copy URL:", value);
      }

      return ok;
    }
  }

  document.addEventListener("click", async function (event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const copy = target.closest("[data-media-copy]");

    if (copy) {
      event.preventDefault();

      const url = new URL(
        copy.dataset.mediaCopy,
        window.location.href
      ).href;

      await copyText(url);
      return;
    }

    const share = target.closest("[data-media-share]");

    if (share) {
      event.preventDefault();

      const url = new URL(
        share.dataset.mediaShare,
        window.location.href
      ).href;

      const title = share.dataset.shareTitle || "";

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: title,
            text: title,
            url: url
          });
          return;
        } catch (error) {
          if (error && error.name === "AbortError") {
            return;
          }
        }
      }

      await copyText(url);
    }
  });
})();
