import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  query, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Boxes, 
  PlusCircle, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Database,
  Moon,
  Sun,
  Package,
  PackageOpen,
  X,
  RefreshCw,
  UploadCloud,
  FileText,
  MapPin,
  TrendingDown,
  Layers,
  Link as LinkIcon,
  Smile
} from "lucide-react";

export default function App() {
  // Products State
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ type: "", text: "" });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    model: "",
    sku: "",
    location: "",
    minStock: "",
    stock: "",
    imageType: "upload", // 'upload' | 'icon' | 'url'
    imageUrl: ""
  });

  const [formErrors, setFormErrors] = useState({});

  // Theme State
  const [theme, setTheme] = useState("light");

  // Effect to toggle Dark Mode
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Effect to fetch products in real-time from Firestore
  useEffect(() => {
    setIsLoading(true);
    try {
      const q = collection(db, "items");
      
      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const productsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Sort locally in JS by timestamp (newest first) to avoid query preconditions
          productsList.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          
          setProducts(productsList);
          setIsLoading(false);
        },
        (error) => {
          console.error("Firestore onSnapshot error:", error);
          setAlertMessage({ 
            type: "error", 
            text: "Error de conexión con Firestore. Revisa tus credenciales en .env.local" 
          });
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup real-time listener:", error);
      setIsLoading(false);
    }
  }, []);

  // Generate a random 9-character uppercase SKU
  const handleGenerateSKU = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 9; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, sku: result }));
    // Clear error for SKU if any
    if (formErrors.sku) {
      setFormErrors(prev => ({ ...prev, sku: null }));
    }
  };

  // Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Nombre obligatorio";
    if (!formData.brand.trim()) errors.brand = "Marca obligatoria";
    if (!formData.model.trim()) errors.model = "Modelo obligatorio";
    if (!formData.sku.trim() || formData.sku.trim().length !== 9) {
      errors.sku = "El SKU debe tener exactamente 9 caracteres";
    }
    if (!formData.location.trim()) errors.location = "Ubicación obligatoria";
    if (formData.minStock === "" || parseInt(formData.minStock) < 0) {
      errors.minStock = "Mínimo inválido";
    }
    if (formData.stock === "" || parseInt(formData.stock) < 0) {
      errors.stock = "Stock inicial inválido";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Add Product
  const handleAddProduct = (e) => {
    e.preventDefault();
    setAlertMessage({ type: "", text: "" });

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Define a fallback image URL if none is provided or chosen
      let finalImageUrl = formData.imageUrl.trim();
      if (!finalImageUrl) {
        if (formData.imageType === "icon") {
          finalImageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80"; // nice abstract placeholder
        } else {
          finalImageUrl = "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop&q=80"; // tech/industrial
        }
      }

      // Execute Firestore addition asynchronously
      addDoc(collection(db, "items"), {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        sku: formData.sku.trim().toUpperCase(),
        location: formData.location.trim(),
        minStock: parseInt(formData.minStock) || 0,
        stock: parseInt(formData.stock) || 0,
        image: finalImageUrl,
        timestamp: serverTimestamp()
      }).catch(error => {
        console.error("Error adding document to Firestore:", error);
        setAlertMessage({ type: "error", text: "Error al guardar en Firestore." });
      });

      // Clear form and close modal
      setFormData({
        name: "",
        brand: "",
        model: "",
        sku: "",
        location: "",
        minStock: "",
        stock: "",
        imageType: "upload",
        imageUrl: ""
      });
      setIsAddModalOpen(false);
      setAlertMessage({ type: "success", text: "¡Componente agregado en tiempo real!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error in form submission:", error);
      setAlertMessage({ type: "error", text: "Ocurrió un error inesperado." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = async (productId) => {
    try {
      await deleteDoc(doc(db, "items", productId));
      setAlertMessage({ type: "success", text: "Componente eliminado correctamente." });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error deleting document from Firestore:", error);
      setAlertMessage({ type: "error", text: "Error al eliminar el componente de Firestore." });
    }
  };

  const getStockStatus = (stock, minStock) => {
    const s = parseInt(stock) || 0;
    const m = parseInt(minStock) || 0;
    if (s === 0) {
      return <span className="px-2 py-1 text-[10px] font-bold text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg animate-pulse">Agotado</span>;
    } else if (s <= m) {
      return <span className="px-2 py-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg">Stock Bajo ({s}/{m})</span>;
    } else {
      return <span className="px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">Óptimo ({s})</span>;
    }
  };

  // Preset mock icons for "Seleccionar Icono" tab
  const mockIcons = [
    { name: "CPU", url: "https://images.unsplash.com/photo-1591453089816-0fbb971b454c?w=100&auto=format&fit=crop&q=80" },
    { name: "RAM", url: "https://images.unsplash.com/photo-1562408590-e32931084e23?w=100&auto=format&fit=crop&q=80" },
    { name: "Motherboard", url: "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=100&auto=format&fit=crop&q=80" },
    { name: "GPU", url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=100&auto=format&fit=crop&q=80" }
  ];

  return (
    <div 
      className="min-h-screen w-screen flex items-center justify-center p-3 sm:p-6 transition-all duration-500 relative"
      style={{
        backgroundImage: "url('/mountain_background.png')",
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat"
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/50 backdrop-blur-[2px] transition-colors duration-500 pointer-events-none" />

      {/* Main Glassmorphic Dashboard Card */}
      <div className="w-full max-w-6xl h-[88vh] glass-container rounded-[2.5rem] flex flex-col p-6 sm:p-8 shadow-2xl relative z-10 transition-all duration-300">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white hover:scale-105 transition-transform duration-200 shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                Inventario Real-time
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sincronización instantánea con Firebase Firestore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Database Connected Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
              <Database className="w-3.5 h-3.5" />
              <span>Conectado</span>
            </div>

            {/* Add Component Trigger Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 rounded-xl text-xs font-bold shadow-md shadow-sky-500/10 hover-scale"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              <span>Agregar Componente</span>
            </button>

            {/* Dark Mode Switcher */}
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="w-10 h-10 rounded-xl glass-card flex items-center justify-center hover-scale transition-colors duration-200"
              title={theme === "light" ? "Modo Oscuro" : "Modo Claro"}
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5 text-slate-600 hover:text-slate-900" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400 hover:text-amber-300" />
              )}
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {alertMessage.text && alertMessage.type === "success" && (
          <div className="mx-1 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in shrink-0">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{alertMessage.text}</span>
          </div>
        )}

        {/* Content Section: Wide Detailed List of Components */}
        <div className="flex-1 flex flex-col overflow-hidden mt-6">
          <div className="glass-card rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col justify-between overflow-hidden border border-white/40 dark:border-slate-800/30">
            
            {/* List Title */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                Componentes en Inventario
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                {products.length} registrados
              </span>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 min-h-[200px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                  <span className="text-xs text-slate-400 font-bold">Cargando base de datos...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <PackageOpen className="w-14 h-14 text-slate-300 dark:text-slate-700 mb-2" />
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Inventario vacío</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                    No se registran componentes en Firestore. Haz clic en "Agregar Componente" para dar de alta uno.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="glass-card rounded-[2rem] p-4 shadow-sm border border-white/30 dark:border-slate-800/20 flex flex-col justify-between gap-4 transition-all duration-300 hover-scale hover:shadow-md animate-fade-in"
                    >
                      {/* upper block: Image, name, brand, model */}
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-inner shrink-0 border border-slate-200/55 dark:border-slate-800/50">
                          <img
                            src={product.image || "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=100&auto=format&fit=crop&q=80"}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] uppercase font-bold text-sky-600 dark:text-sky-400 tracking-wider">
                            {product.brand || "Sin Marca"}
                          </span>
                          <h3 className="font-extrabold product-name-text text-sm truncate leading-snug">
                            {product.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 truncate">
                            Mod: {product.model || "N/D"}
                          </p>
                        </div>
                      </div>

                      {/* middle block: SKU badge & Location */}
                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/30 text-[11px]">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30 flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">SKU</span>
                          <span className="font-mono font-bold text-[10px] text-slate-600 dark:text-slate-300 uppercase truncate">
                            {product.sku || "N/A"}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30 flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Ubicación</span>
                          <span className="font-bold text-[10px] text-slate-600 dark:text-slate-300 truncate flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-sky-500" />
                            {product.location || "N/D"}
                          </span>
                        </div>
                      </div>

                      {/* footer block: Stock status & Delete action */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/30">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Estado de Stock</span>
                          {getStockStatus(product.stock, product.minStock)}
                        </div>

                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center shrink-0 transition-colors duration-150"
                          title="Eliminar de Firestore"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

      {/* POPUP MODAL: Agregar Nuevo Componente */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card w-full max-w-xl rounded-[2.5rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in max-h-[92vh] flex flex-col border border-white/50 dark:border-slate-800/40">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white">Agregar Nuevo Componente</h2>
                <p className="text-xs text-slate-400 mt-0.5">Registra una nueva pieza en el inventario real-time.</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors hover-scale"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleAddProduct} className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-4">
              
              {/* Row 1: Nombre del Artículo y Marca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Nombre del Artículo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Microprocesador Intel Core i9"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                      formErrors.name ? "border-red-500" : ""
                    }`}
                  />
                  {formErrors.name && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Marca *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Intel"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                      formErrors.brand ? "border-red-500" : ""
                    }`}
                  />
                  {formErrors.brand && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.brand}</p>}
                </div>
              </div>

              {/* Row 2: Modelo y SKU (con botón Generar) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. i9-14900K"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                      formErrors.model ? "border-red-500" : ""
                    }`}
                  />
                  {formErrors.model && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.model}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    SKU (9 Caracteres) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={9}
                      placeholder="Ej. INTEL1490"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-xs glass-input font-mono font-bold uppercase ${
                        formErrors.sku ? "border-red-500" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateSKU}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover-scale flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Generar</span>
                    </button>
                  </div>
                  {formErrors.sku && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.sku}</p>}
                </div>
              </div>

              {/* Row 3: Ubicación física y Stock Mínimo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Ubicación Física *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Estante C - Fila 2"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                      formErrors.location ? "border-red-500" : ""
                    }`}
                  />
                  {formErrors.location && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.location}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Stock Mínimo (Alerta) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej. 5"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                      formErrors.minStock ? "border-red-500" : ""
                    }`}
                  />
                  {formErrors.minStock && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.minStock}</p>}
                </div>
              </div>

              {/* Row 4: Stock Inicial */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Stock Inicial *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ej. 25"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                    formErrors.stock ? "border-red-500" : ""
                  }`}
                />
                {formErrors.stock && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.stock}</p>}
              </div>

              {/* Row 5: Imagen del Artículo con Pestañas y Zona de arrastre */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  Imagen del Artículo *
                </label>
                
                {/* Selector tabs */}
                <div className="flex border-b border-slate-200/50 dark:border-slate-800/50 shrink-0 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageType: "upload" })}
                    className={`pb-2 px-3 transition-colors ${
                      formData.imageType === "upload"
                        ? "border-b-2 border-sky-500 text-sky-600 dark:text-sky-400"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    Subir Archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageType: "icon" })}
                    className={`pb-2 px-3 transition-colors ${
                      formData.imageType === "icon"
                        ? "border-b-2 border-sky-500 text-sky-600 dark:text-sky-400"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    Seleccionar Icono
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageType: "url" })}
                    className={`pb-2 px-3 transition-colors ${
                      formData.imageType === "url"
                        ? "border-b-2 border-sky-500 text-sky-600 dark:text-sky-400"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    URL
                  </button>
                </div>

                {/* Tab Content 1: Upload (Mock Drag & Drop) */}
                {formData.imageType === "upload" && (
                  <div 
                    onClick={() => setFormData({ ...formData, imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&auto=format&fit=crop&q=80" })}
                    className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700/50 hover:border-sky-500 dark:hover:border-sky-500 transition-colors flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 dark:bg-slate-900/10 group"
                  >
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-sky-500 transition-colors mb-1.5" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {formData.imageUrl ? "¡Imagen cargada correctamente!" : "Arrastra una imagen aquí o haz click para seleccionar"}
                    </span>
                    {formData.imageUrl && <span className="text-[8px] text-emerald-500 font-semibold mt-0.5">Mock: Placa de Hardware Cargada</span>}
                  </div>
                )}

                {/* Tab Content 2: Select Icon */}
                {formData.imageType === "icon" && (
                  <div className="p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 grid grid-cols-4 gap-2 bg-slate-50/50 dark:bg-slate-900/10">
                    {mockIcons.map((ic) => (
                      <button
                        key={ic.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: ic.url })}
                        className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 hover-scale ${
                          formData.imageUrl === ic.url
                            ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/40"
                        }`}
                      >
                        <img src={ic.url} alt={ic.name} className="w-10 h-10 rounded-lg object-cover" />
                        <span className="text-[8px] font-black">{ic.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Tab Content 3: URL Input */}
                {formData.imageType === "url" && (
                  <div className="flex flex-col gap-1.5 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Pega la URL de la imagen aquí (https://...)"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                    />
                  </div>
                )}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors hover-scale"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlusCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmitting ? "Guardando..." : "Guardar Componente"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
