export const customerOrderKey = (restaurantId: string) => `customer_order:${restaurantId}`;
const sessionEventKey = (restaurantId: string) => `customer_session_changed:${restaurantId}`;

export function clearCustomerBrowserData(restaurantId: string) {
  localStorage.removeItem(`chat_credential:${restaurantId}`);
  localStorage.removeItem(customerOrderKey(restaurantId));
  // Legacy values have no reliable association with a restaurant or person.
  localStorage.removeItem("customerInfo");
  localStorage.removeItem("order");
  localStorage.setItem(sessionEventKey(restaurantId), `${Date.now()}:${Math.random()}`);
}

export function watchCustomerSessionChanges(restaurantId: string, onChange: () => void) {
  function changed(event: StorageEvent) {
    if (event.key === sessionEventKey(restaurantId)) onChange();
  }
  window.addEventListener("storage", changed);
  return () => window.removeEventListener("storage", changed);
}
