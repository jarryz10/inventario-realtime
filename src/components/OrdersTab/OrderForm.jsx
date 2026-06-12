import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { ClipboardList, PlusCircle, AlertCircle } from "lucide-react";

export default function OrderForm() {
  const { items, createOrder, currentUser } = useApp();
  
  const [formData, setFormData] = useState({
    itemId: "",
    quantity: 1,
    type: "salida", // 'salida' (decrease) or 'entrada' (increase)
    notes: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Auto-select first item if list is loaded and selection is empty
  useEffect(() => {
    if (items.length > 0 && !formData.itemId) {
      setFormData(prev => ({ ...prev, itemId: items[0].id }));
    }
  }, [items, formData.itemId]);

  const selectedItem = items.find(i => i.id === formData.itemId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!formData.itemId) {
      setError("Por favor, selecciona un artículo.");
      return;
    }

    const qty = parseInt(formData.quantity);
    if (!qty || qty <= 0) {
      setError("La cantidad debe ser mayor que 0.");
      return;
    }

    // Validation: Out of stock check for outputs
    if (formData.type === "salida" && selectedItem && selectedItem.stock < qty) {
      setError(`Stock insuficiente. Solo quedan ${selectedItem.stock} unidades de este artículo.`);
      return;
    }

    try {
      await createOrder({
        itemId: formData.itemId,
        quantity: qty,
        type: formData.type,
        notes: formData.notes
      });
      
      setFormData({
        itemId: items[0]?.id || "",
        quantity: 1,
        type: "salida",
        notes: ""
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Hubo un error al procesar el pedido.");
      console.error(err);
    }
  };

  return (
    <div className="glass-card rounded-[2rem] p-6 shadow-xl w-full lg:max-w-md animate-fade-in flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4">
          <ClipboardList className="w-5 h-5 text-sky-500" />
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">Solicitar Pedido / Orden</h2>
        </div>

        {/* User Info Bar */}
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/30 dark:border-slate-800/30 text-[11px] text-slate-500 dark:text-slate-400 mb-4 font-semibold">
          Solicitante: <span className="text-slate-800 dark:text-white">{currentUser.name}</span> ({currentUser.role})
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Item Selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              Artículo a Pedir
            </label>
            {items.length === 0 ? (
              <p className="text-xs text-red-500">Cargando inventario...</p>
            ) : (
              <select
                value={formData.itemId}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold cursor-pointer"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                    {item.name} (Stock: {item.stock} - ${item.price})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || "" })}
                className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Tipo de Operación
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold cursor-pointer"
              >
                <option value="salida" className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                  Salida (Pedido)
                </option>
                <option value="entrada" className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                  Entrada (Abasto)
                </option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              Notas y Justificación
            </label>
            <textarea
              placeholder="Ej. Asignado a nuevo empleado, reposición mensual de stock..."
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold resize-none"
            />
          </div>

          {/* Alert messages */}
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-[10px] text-red-600 dark:text-red-400 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>¡Pedido solicitado con éxito y visible en tiempo real!</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-2 mt-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Solicitar Orden</span>
          </button>
        </form>
      </div>
    </div>
  );
}
