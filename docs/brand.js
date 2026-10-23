/* Brand loader — the ONLY place that says which business this site is.
   It loads docs/brands/<DEFAULT_BRAND>/brand.css + brand.js before anything else runs.
   tools/sync-client.ps1 rewrites DEFAULT_BRAND when it copies the core into a client studio folder.
   Local preview only (localhost / 127.0.0.1): add ?brand=<id> to any page to try another brand;
   it sticks for the browser tab until you use ?brand=<default id> or close the tab. */
(function () {
  var DEFAULT_BRAND = "bizconnect";
  var id = DEFAULT_BRAND;
  try {
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      var q = new URLSearchParams(location.search).get("brand");
      if (q && /^[a-z0-9_-]{1,40}$/.test(q)) sessionStorage.setItem("previewBrand", q);
      id = sessionStorage.getItem("previewBrand") || DEFAULT_BRAND;
    }
  } catch (e) {}
  window.BRAND_BASE = "brands/" + id + "/";
  document.write('<link rel="stylesheet" href="' + window.BRAND_BASE + 'brand.css">' +
    '<script src="' + window.BRAND_BASE + 'brand.js"><\/script>');
})();
