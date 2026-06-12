import React from "react";
import { useApp } from "../../context/AppContext";
import { CheckCircle, XCircle, ArrowUpRight, ArrowDownLeft, Calendar } from "lucide-react";

export default function OrderHistory() {
  const { orders } = useApp();

  const historyOrders = orders.filter(o => o.status !== "pendiente");

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
          <span>Historial de Pedidos</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">
            {historyOrders.length}
          </span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 scroll-glass max-h-[400px] flex flex-col gap-3">
        {historyOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center glass-card rounded-2xl p-6 flex-1">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">Historial vacío</h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
              Aún no se ha completado ni cancelado ningún pedido.
            </p>
          </div>
        ) : (
          historyOrders.map((order) => {
            const isEntry = order.type === "entrada";
            const isCompleted = order.status === "completado";
            return (
              <div
                key={order.id}
                className={`glass-card rounded-2xl p-3.5 shadow-sm border-l-4 transition-all duration-200 hover:shadow-md ${
                  isCompleted 
                    ? "border-l-emerald-500 bg-white/60 dark:bg-slate-800/40" 
                    : "border-l-rose-500 bg-white/45 dark:bg-slate-800/20 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {/* Status Icon */}
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    )}

                    <div>
                      <h4 className="font-extrabold text-slate-800 dark:text-white text-xs sm:text-sm">
                        {order.itemName}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Por <span className="font-semibold">{order.requester.split(" ")[0]}</span> • {formatDate(order.date)}
                      </p>
                    </div>
                  </div>

                  {/* Quantity and Movement Type */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-slate-800 dark:text-white block">
                      {isEntry ? "+" : "-"}{order.quantity} un.
                    </span>
                    <span className={`text-[8px] font-black uppercase inline-flex items-center gap-0.5 ${
                      isEntry ? "text-emerald-500" : "text-rose-500"
                    }`}>
                      {isEntry ? (
                        <>
                          <ArrowDownLeft className="w-2.5 h-2.5" />
                          Entrada
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                          Salida
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Subtitle / Notes / Status Label */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/20 text-[9px] text-slate-400">
                  <span className="truncate max-w-[70%] font-medium italic">
                    {order.notes ? `"${order.notes}"` : "Sin comentarios"}
                  </span>
                  <span className={`font-extrabold tracking-wide uppercase px-1.5 py-0.5 rounded-md ${
                    isCompleted 
                      ? "text-emerald-600 bg-emerald-500/5 dark:text-emerald-400" 
                      : "text-rose-600 bg-rose-500/5 dark:text-rose-400"
                  }`}>
                    {isCompleted ? "Completado" : "Rechazado"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
