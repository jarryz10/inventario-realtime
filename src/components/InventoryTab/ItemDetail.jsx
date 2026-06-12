import React from "react";
import { useApp } from "../../context/AppContext";
import { Plus, Minus, X, AlertTriangle, Layers, DollarSign, PackageOpen } from "lucide-react";

export default function ItemDetail() {
  const { selectedItem, setSelectedItemId, adjustStock } = useApp();

  if (!selectedItem) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center text-center p-8 rounded-3xl glass-card w-80 xl:w-96 shrink-0 h-[calc(100vh-250px)] border-dashed border-2 border-slate-300 dark:border-slate-700/50">
        <PackageOpen className="w-12 h-12 text-slate-400 mb-3 animate-bounce" />
        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400">Detalles del Artículo</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 max-w-[200px]">
          Haz clic en cualquier artículo para ver sus detalles, precio e historial y ajustar su stock en tiempo real.
        </p>
      </div>
    );
  }

  const isLowStock = selectedItem.stock < 5;
  const isOutOfStock = selectedItem.stock === 0;

  return (
    <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4 animate-fade-in">
      
      {/* Detail Glass Card */}
      <div className="glass-card rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between h-full shadow-xl">
        
        {/* Header (Close Button & Title) */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">
            Ficha de Producto
          </span>
          <button
            onClick={() => setSelectedItemId(null)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover-scale"
            title="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Large Product Image */}
        <div className="w-full h-48 rounded-2xl overflow-hidden mb-4 bg-slate-100 dark:bg-slate-900 shadow-inner">
          <img
            src={selectedItem.image}
            alt={selectedItem.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Details */}
        <div className="flex-1 flex flex-col mb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {selectedItem.category}
            </span>
            {isOutOfStock && (
              <span className="text-[10px] font-extrabold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                Agotado
              </span>
            )}
            {!isOutOfStock && isLowStock && (
              <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 animate-pulse">
                Stock Crítico
              </span>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mt-2 leading-snug">
            {selectedItem.name}
          </h2>

          <div className="h-px bg-slate-200/50 dark:bg-slate-800/50 my-3" />

          {/* Specifications */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-bold">Precio Unitario</span>
              <div className="flex items-center text-slate-800 dark:text-white mt-0.5">
                <DollarSign className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span className="font-extrabold text-base text-sky-600 dark:text-sky-400">
                  {selectedItem.price.toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-bold">Ubicación</span>
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 block mt-1">
                Pasillo A / Estantería 4
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            {selectedItem.description || "Este artículo no dispone de una descripción detallada todavía. Puedes añadirla editando el artículo."}
          </p>
        </div>

        {/* Stock Adjuster / Controls */}
        <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Control de Stock</span>
              <span className="text-[11px] text-slate-400">Modifica la cantidad disponible:</span>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-black ${
                isOutOfStock ? "text-red-500" : isLowStock ? "text-amber-500" : "text-slate-800 dark:text-white"
              }`}>
                {selectedItem.stock}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Unidades</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustStock(selectedItem.id, -1)}
              className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm flex items-center justify-center gap-2 hover-scale transition-colors"
            >
              <Minus className="w-4 h-4" />
              <span>Restar 1</span>
            </button>

            <button
              onClick={() => adjustStock(selectedItem.id, 1)}
              className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm flex items-center justify-center gap-2 hover-scale transition-colors shadow-md shadow-slate-950/10 dark:shadow-white/5"
            >
              <Plus className="w-4 h-4" />
              <span>Sumar 1</span>
            </button>
          </div>

          {isLowStock && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>El inventario está por debajo del stock de seguridad sugerido (5 unidades). Solicita un reabastecimiento en Órdenes.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
