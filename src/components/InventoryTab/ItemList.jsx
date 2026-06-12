import React from "react";
import { useApp } from "../../context/AppContext";
import { AlertCircle, Plus, Minus, Info } from "lucide-react";

export default function ItemList({ searchTerm, selectedCategory }) {
  const { items, selectedItemId, setSelectedItemId, adjustStock } = useApp();

  // Filter items based on search and category
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "Todos" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStockBadge = (stock) => {
    if (stock === 0) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-extrabold text-red-500 bg-red-500/10 px-2 py-1 rounded-lg animate-pulse border border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          Agotado
        </span>
      );
    } else if (stock < 5) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-extrabold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          Bajo Stock ({stock})
        </span>
      );
    } else {
      return (
        <span className="text-[11px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
          Disponible ({stock})
        </span>
      );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pr-1 scroll-glass max-h-[calc(100vh-250px)]">
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-2xl p-8">
          <Info className="w-12 h-12 text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No se encontraron artículos</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            Intenta cambiar el término de búsqueda o la categoría seleccionada, o agrega un nuevo producto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-6">
          {filteredItems.map((item) => {
            const isSelected = selectedItemId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`glass-card rounded-3xl p-4 cursor-pointer relative overflow-hidden transition-all duration-300 hover-scale hover-glow flex flex-col justify-between ${
                  isSelected 
                    ? "ring-2 ring-sky-500 dark:ring-sky-400 bg-white/90 dark:bg-slate-800/80 shadow-lg shadow-sky-500/5" 
                    : "hover:bg-white/80 dark:hover:bg-slate-800/60"
                }`}
              >
                {/* Product Image and Category */}
                <div className="relative w-full h-36 rounded-2xl overflow-hidden mb-3 bg-slate-100 dark:bg-slate-900 group">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider">
                    {item.category}
                  </div>
                  <div className="absolute top-2 right-2">
                    {getStockBadge(item.stock)}
                  </div>
                </div>

                {/* Info Text */}
                <div className="flex-1 flex flex-col">
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 mt-1 min-h-[32px]">
                    {item.description || "Sin descripción proporcionada."}
                  </p>
                </div>

                {/* Footer Controls / Price */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Precio</span>
                    <span className="text-lg font-black text-sky-600 dark:text-sky-400">
                      ${item.price.toLocaleString("es-CL")}
                    </span>
                  </div>

                  {/* Stock Quick Controls */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => adjustStock(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center hover-scale"
                      title="Restar 1 unidad"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-800 dark:text-slate-200">
                      {item.stock}
                    </span>
                    <button
                      onClick={() => adjustStock(item.id, 1)}
                      className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 flex items-center justify-center hover-scale"
                      title="Sumar 1 unidad"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
