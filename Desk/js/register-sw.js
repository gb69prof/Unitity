(function () {
  "use strict";
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(error => console.warn("Service worker non registrato", error)));
  }
})();
