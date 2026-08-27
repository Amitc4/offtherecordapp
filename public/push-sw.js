/**
 * @file push-sw.js — Web Push handlers, imported into the generated service worker.
 *
 * Displays incoming push notifications and routes taps back into the app.
 */
/* eslint-disable no-undef */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Off The Record", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Off The Record";
  const options = {
    body: data.body || "",
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: data.notification_id || undefined,
    data: {
      type: data.type || "general",
      record_id: data.record_id || null,
      from_user_id: data.from_user_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const type = event.notification.data?.type;
  let path = "/";
  if (type === "chat_message" || type === "trade_offer") path = "/?tab=chats";
  else if (type === "wishlist_match") path = "/?tab=discover";
  else if (type === "friend_request") path = "/?tab=profile&friendRequests=1";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(path);
            } catch {
              /* ignore navigation failures */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(path);
    })(),
  );
});
