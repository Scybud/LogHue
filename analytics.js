export function loadAnalytics() {
  // Prevent double-loading
  if (window.__analyticsLoaded) return;
  window.__analyticsLoaded = true;

  // Create the script tag
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-3VZMDG49GJ";
  document.head.appendChild(script);

  // Initialize GA after script loads
  script.onload = () => {
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      dataLayer.push(arguments);
    }
    window.gtag = gtag;

    gtag("js", new Date());
    gtag("config", "G-3VZMDG49GJ");
  };
}
