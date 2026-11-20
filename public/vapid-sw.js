self.addEventListener("push", (event) => {
  console.log("🔔 EVENTO PUSH RECEBIDO PELO SERVICE WORKER");

  let dados = {};

  try {
    dados = event.data?.json() ?? {};
  } catch (error) {
    console.error("Erro ao ler notificação:", error);
  }

  const titulo = dados.title || "Gama Lanches";

  const opcoes = {
    body: dados.body || "Você recebeu uma nova notificação.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: dados.url || "/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = new URL(
    event.notification.data?.url || "/dashboard",
    self.location.origin,
  ).href;

  event.waitUntil(clients.openWindow(url));
});
