import type { VendasProps } from "../../models/interface";
import { orderPresentation } from "../../util/orderPresentation";

export function OrderDestination({ order }: { order: VendasProps }) {
  const view = orderPresentation(order);
  return (
    <div className="text-sm leading-6 text-slate-700">
      <p className="font-bold text-orange-700">{view.label}</p>
      <p className="font-medium">{view.destinationLabel}</p>
      {view.restaurantName && <p>{view.restaurantName}</p>}
      {view.addressLines.map((line, index) => <p key={index}>{line}</p>)}
    </div>
  );
}

export function OrderAmounts({ order }: { order: VendasProps }) {
  const view = orderPresentation(order);
  return (
    <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
      <div className="flex justify-between gap-3"><dt>Subtotal dos produtos</dt><dd>{view.subtotal}</dd></div>
      <div className="flex justify-between gap-3"><dt>Taxa de entrega</dt><dd>{view.fee}</dd></div>
      <div className="flex justify-between gap-3 font-bold"><dt>Total do pedido</dt><dd className="text-lg text-green-600">{view.total}</dd></div>
    </dl>
  );
}
