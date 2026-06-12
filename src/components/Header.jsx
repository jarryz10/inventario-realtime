import React from "react";
import { useApp } from "../context/AppContext";
import { Search, Plus, UserCheck, HelpCircle } from "lucide-react";

export default function Header({ 
  searchTerm, 
  setSearchTerm, 
  selectedCategory, 
  setSelectedCategory,
  onOpenAddModal
}) {
  const { activeTab, currentUser, items } = useApp();

  // Extract unique categories from items
  const categories = ["Todos", ...new Set(items.map(item => item.category))];

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/50 dark:border-slate-800/50">
      
      {/* Title Area */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
          {activeTab === "inventario" ? "Control de Inventario" : "Órdenes y Pedidos"}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {activeTab === "inventario" 
            ? "Monitorea, actualiza y gestiona el stock de tus artículos en tiempo real."
            : "Solicita productos y gestiona los pedidos pendientes y el historial de transacciones."}
        </p>
      </div>

      {/* Action / Search Area */}
      <div className="flex flex-wrap items-center gap-3">
        {activeTab === "inventario" ? (
          <>
            {/* Search Bar */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar artículo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass-input font-medium"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm glass-input font-medium cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                  {cat}
                </option>
              ))}
            </select>

            {/* Add Item Button */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-semibold text-sm shadow-md shadow-sky-500/10 hover-scale"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Artículo</span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 text-sm font-semibold border border-sky-500/20">
            <UserCheck className="w-4.5 h-4.5" />
            <span>Operando como: {currentUser.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
