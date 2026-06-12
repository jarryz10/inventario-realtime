import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { X, Plus, Image as ImageIcon } from "lucide-react";

export default function ItemForm({ isOpen, onClose }) {
  const { addItem } = useApp();
  const [formData, setFormData] = useState({
    name: "",
    category: "Tecnología",
    stock: "",
    price: "",
    image: "",
    description: ""
  });
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "El nombre es obligatorio.";
    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = "El precio debe ser mayor que 0.";
    }
    if (!formData.stock || parseInt(formData.stock) < 0) {
      newErrors.stock = "El stock inicial no puede ser negativo.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await addItem({
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock)
      });
      // Reset form
      setFormData({
        name: "",
        category: "Tecnología",
        stock: "",
        price: "",
        image: "",
        description: ""
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ["Tecnología", "Audio", "Mobiliario", "Periféricos", "Almacenaje", "Oficina", "General"];

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-card w-full max-w-lg rounded-[2rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Agregar Nuevo Artículo</h2>
            <p className="text-xs text-slate-400">Completa los campos para indexar el producto en tiempo real.</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Name Field */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              Nombre del Artículo *
            </label>
            <input
              type="text"
              placeholder="Ej. Auriculares Bose QuietComfort"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold ${
                errors.name ? "border-red-500 focus:border-red-500" : ""
              }`}
            />
            {errors.name && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category Field */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Categoría
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Field */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Precio (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold ${
                  errors.price ? "border-red-500 focus:border-red-500" : ""
                }`}
              />
              {errors.price && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.price}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Stock Field */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Stock Inicial *
              </label>
              <input
                type="number"
                placeholder="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold ${
                  errors.stock ? "border-red-500 focus:border-red-500" : ""
                }`}
              />
              {errors.stock && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.stock}</p>}
            </div>

            {/* Image URL Field */}
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                URL de Imagen (Opcional)
              </label>
              <input
                type="text"
                placeholder="https://images.unsplash.com/..."
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold"
              />
            </div>
          </div>

          {/* Description Field */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              Descripción del Artículo
            </label>
            <textarea
              placeholder="Ingresa especificaciones técnicas o detalles del producto..."
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-semibold resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-sky-500/15 hover-scale"
            >
              Crear Artículo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
