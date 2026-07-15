self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title || "LogHue", {
      body: data.body || "",
      icon: "https://loghue.com/images/loghue-logo.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
