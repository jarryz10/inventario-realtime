import React from "react";
import { useApp } from "../../context/AppContext";
import { Check, X, ArrowUpRight, ArrowDownLeft, Clock, MessageSquare } from "lucide-react";

export default function PendingOrders() {
  const { orders, processOrder } = useApp();

  const pendingOrders = orders.filter(o => o.status === "pendiente");

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <span>Pedidos Pendientes</span>
          <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold">
            {pendingOrders.length}
          </span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 scroll-glass max-h-[400px] flex flex-col gap-4">
        {pendingOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center glass-card rounded-2xl p-6 flex-1">
            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2 animate-pulse" />
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">Todo al día</h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
              No hay solicitudes pendientes de autorización en este momento.
            </p>
          </div>
        ) : (
          pendingOrders.map((order) => {
            const isEntry = order.type === "entrada";
            return (
              <div
                key={order.id}
                className="glass-card rounded-2xl p-4 shadow-sm relative overflow-hidden border-l-4 border-l-sky-500 hover:shadow-md transition-shadow duration-200"
              >
                {/* Upper row: Item name & Badge type */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">
                      {order.itemName}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1 font-semibold">
                      Solicitado por: <span className="text-slate-600 dark:text-slate-400 font-bold">{order.requester}</span>
                    </p>
                  </div>

                  {/* Badge */}
                  <span className={`flex items-center gap-0.5 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                    isEntry
                      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                      : "text-red-500 bg-red-500/10 border-red-500/20"
                  }`}>
                    {isEntry ? (
                      <>
                        <ArrowDownLeft className="w-3 h-3" />
                        Entrada (Abasto)
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-3 h-3" />
                        Salida (Pedido)
                      </>
                    )}
                  </span>
                </div>

                {/* Body details */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/40 text-[11px]">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider block font-bold text-[9px]">Cantidad</span>
                    <span className="font-extrabold text-slate-800 dark:text-white">
                      {order.quantity} unidades
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider block font-bold text-[9px]">Fecha Solicitud</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(order.date)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 font-medium">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{order.notes}</span>
                  </div>
                )}

                {/* Action Controls */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/40">
                  <button
                    onClick={() => processOrder(order.id, "cancelado")}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-red-500/10 dark:bg-slate-800/60 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-500 font-bold text-[11px] flex items-center justify-center gap-1 transition-all duration-200"
                    title="Rechazar y cancelar pedido"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>

                  <button
                    onClick={() => processOrder(order.id, "completado")}
                    className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-[11px] flex items-center justify-center gap-1 transition-all duration-200 shadow-sm"
                    title="Aprobar y actualizar stock"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
