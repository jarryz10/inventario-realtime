import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
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
  PackageOpen
} from "lucide-react";

export default function App() {
  // Products State
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [newProductName, setNewProductName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ type: "", text: "" });

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
      // Query collection directly without orderBy to avoid index prerequisites and connection drops on other devices
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

  // Handle Add Product
  const handleAddProduct = async (e) => {
    e.preventDefault();
    setAlertMessage({ type: "", text: "" });

    if (!newProductName.trim()) {
      setAlertMessage({ type: "error", text: "El nombre del producto no puede estar vacío." });
      return;
    }

    setIsSubmitting(true);
    try {
      // Executing addDoc asynchronously without awaiting allows the UI to remain responsive
      // and guarantees that the finally block runs immediately, resetting the loader.
      addDoc(collection(db, "items"), {
        name: newProductName.trim(),
        price: 0,
        description: "",
        stock: 0,
        category: "General",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=60",
        timestamp: serverTimestamp()
      }).catch(error => {
        console.error("Error adding document to Firestore:", error);
        setAlertMessage({ type: "error", text: "Error al agregar el producto. Inténtalo de nuevo." });
      });
      
      setNewProductName("");
      setAlertMessage({ type: "success", text: "¡Producto añadido correctamente en tiempo real!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error adding document to Firestore:", error);
      setAlertMessage({ type: "error", text: "Error al agregar el producto. Inténtalo de nuevo." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = async (productId) => {
    try {
      await deleteDoc(doc(db, "items", productId));
      setAlertMessage({ type: "success", text: "Producto eliminado correctamente." });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error deleting document from Firestore:", error);
      setAlertMessage({ type: "error", text: "Error al eliminar el producto de Firestore." });
    }
  };

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
      <div className="w-full max-w-4xl h-[88vh] glass-container rounded-[2.5rem] flex flex-col p-6 sm:p-8 shadow-2xl relative z-10 transition-all duration-300">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/50 dark:border-slate-800/50">
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

        {/* Content Section (Split Screen) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 mt-6 overflow-hidden">
          
          {/* Column Left: Add Product Form (colspan 5) */}
          <div className="md:col-span-5 flex flex-col">
            <div className="glass-card rounded-[2rem] p-5 shadow-lg flex flex-col justify-between h-full border border-white/40 dark:border-slate-800/30">
              <div>
                <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                  Agregar Producto
                </h2>
                
                <form onSubmit={handleAddProduct} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      Nombre del Producto
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. MacBook Pro M3"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 rounded-xl text-sm glass-input font-semibold"
                    />
                  </div>

                  {/* Feedback Alerts */}
                  {alertMessage.text && (
                    <div className={`p-3 rounded-xl border flex items-start gap-2 text-[10px] font-bold animate-fade-in ${
                      alertMessage.type === "error"
                        ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {alertMessage.type === "error" ? (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                      )}
                      <span>{alertMessage.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlusCircle className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? "Agregando..." : "Agregar a Firestore"}</span>
                  </button>
                </form>
              </div>

              {/* Bottom Instructions Card */}
              <div className="mt-4 p-3 rounded-2xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-600 dark:text-sky-300 leading-relaxed font-semibold">
                Cualquier cambio se reflejará en tiempo real en todas las pantallas gracias a la sincronización de onSnapshot.
              </div>
            </div>
          </div>

          {/* Column Right: Real-time Products List (colspan 7) */}
          <div className="md:col-span-7 flex flex-col overflow-hidden h-full">
            <div className="glass-card rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col justify-between overflow-hidden border border-white/40 dark:border-slate-800/30">
              
              {/* List Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                  Lista de Productos
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                  {products.length} productos
                </span>
              </div>

              {/* Scrollable Products List */}
              <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 min-h-[150px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                    <span className="text-xs text-slate-400 font-bold">Cargando base de datos...</span>
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <PackageOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Inventario vacío</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                      Aún no hay ningún producto. Agrega uno usando el formulario de la izquierda.
                    </p>
                  </div>
                ) : (
                  products.map((product) => (
                    <div
                      key={product.id}
                      className="glass-card rounded-2xl p-3 shadow-sm border border-white/30 dark:border-slate-800/20 flex items-center justify-between gap-4 transition-all duration-300 hover-scale hover:shadow-md animate-fade-in"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                          <Package className="w-4.5 h-4.5" />
                        </div>
                        <span className="font-extrabold text-slate-800 dark:text-white text-xs sm:text-sm truncate">
                          {product.name}
                        </span>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center shrink-0 transition-colors duration-150"
                        title="Eliminar de Firestore"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
