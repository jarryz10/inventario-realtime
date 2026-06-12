import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDoc,
  query, 
  serverTimestamp,
  updateDoc,
  increment
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
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
  MapPin,
  ClipboardList,
  DollarSign,
  ExternalLink,
  ShoppingBag,
  ListCollapse,
  Mail,
  Lock,
  LogOut
} from "lucide-react";

export default function App() {
  // Authentication & Roles State
  const [currentUser, setCurrentUser] = useState(null);
  const [userLevel, setUserLevel] = useState(1); // 1 = Operador, 2 = Supervisor, 3 = Administrador
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Static fallback role mapping configuration
  const ROLE_MAPPING = {
    "operador@realtime.com": 1,
    "supervisor@realtime.com": 2,
    "admin@realtime.com": 3
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState("inventario"); // 'inventario' | 'ordenes'

  // Products State (Inventario)
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  // Orders State (Órdenes y Pedidos)
  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ type: "", text: "" });

  // Form State: Add Component
  const [formData, setFormData] = useState({
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
  const [formErrors, setFormErrors] = useState({});

  // Form State: Add Order
  const [orderForm, setOrderForm] = useState({
    itemName: "",
    itemModel: "",
    quantity: "",
    cost: "",
    url: ""
  });
  const [orderErrors, setOrderErrors] = useState({});
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);

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

  // Auth listener and role resolver
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthChecking(true);
      if (user) {
        setCurrentUser(user);
        
        let roleLevel = 1;
        const email = user.email ? user.email.toLowerCase() : "";
        
        // Try local email mapping first
        if (ROLE_MAPPING[email] !== undefined) {
          roleLevel = ROLE_MAPPING[email];
        }

        // Try reading role/level from Firestore /users/{userId}
        try {
          const userDocSnap = await getDoc(doc(db, "users", user.uid));
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const val = userData.role || userData.level;
            if (val !== undefined) {
              if (val === 3 || val === "admin" || val === "administrator" || val === "Nivel 3") roleLevel = 3;
              else if (val === 2 || val === "supervisor" || val === "Nivel 2") roleLevel = 2;
              else if (val === 1 || val === "operator" || val === "operador" || val === "Nivel 1") roleLevel = 1;
              else if (!isNaN(parseInt(val))) roleLevel = parseInt(val);
            }
          }
        } catch (err) {
          console.error("Firestore user doc role fetch error:", err);
        }

        setUserLevel(roleLevel);
        // Operator redirection
        if (roleLevel < 2) {
          setActiveTab("inventario");
        }
      } else {
        setCurrentUser(null);
        setUserLevel(1);
      }
      setIsAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Por favor ingresa todos los campos obligatorios.");
      return;
    }

    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
    } catch (error) {
      console.error("Login authentication error:", error);
      let errorMsg = "Error al iniciar sesión. Inténtalo de nuevo.";
      if (
        error.code === "auth/user-not-found" || 
        error.code === "auth/wrong-password" || 
        error.code === "auth/invalid-credential"
      ) {
        errorMsg = "Credenciales incorrectas. Revisa tu correo y contraseña.";
      } else if (error.code === "auth/invalid-email") {
        errorMsg = "El formato de correo no es válido.";
      }
      setLoginError(errorMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedProductId(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Effect to fetch products in real-time from Firestore (items)
  useEffect(() => {
    if (!currentUser) return;
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
          
          // Sort locally in JS by timestamp (newest first)
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
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup real-time listener:", error);
      setIsLoading(false);
    }
  }, []);

  // Effect to fetch orders in real-time from Firestore (orders)
  useEffect(() => {
    if (!currentUser) return;
    setIsOrdersLoading(true);
    try {
      const q = collection(db, "orders");
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const ordersList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Sort locally by timestamp (newest first)
          ordersList.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          
          setOrders(ordersList);
          setIsOrdersLoading(false);
        },
        (error) => {
          console.error("Firestore orders query error:", error);
          setIsOrdersLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup orders real-time listener:", error);
      setIsOrdersLoading(false);
    }
  }, []);

  // Generate SKU
  const handleGenerateSKU = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 9; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, sku: result }));
    if (formErrors.sku) {
      setFormErrors(prev => ({ ...prev, sku: null }));
    }
  };

  // Add Component Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Nombre obligatorio";
    if (!formData.brand.trim()) errors.brand = "Marca obligatoria";
    if (!formData.model.trim()) errors.model = "Modelo obligatorio";
    if (!formData.sku.trim() || formData.sku.trim().length !== 9) {
      errors.sku = "El SKU debe tener 9 caracteres";
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

  // Add Component Submission
  const handleAddProduct = (e) => {
    e.preventDefault();
    if (userLevel < 2) return;
    setAlertMessage({ type: "", text: "" });

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl.trim();
      if (!finalImageUrl) {
        finalImageUrl = "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop&q=80";
      }

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
        console.error("Error adding document:", error);
        setAlertMessage({ type: "error", text: "Error al guardar en Firestore." });
      });

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
      setAlertMessage({ type: "success", text: "¡Componente agregado con éxito!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Order Form Validation
  const validateOrderForm = () => {
    const errors = {};
    if (!orderForm.itemName.trim()) errors.itemName = "Nombre del artículo obligatorio";
    if (!orderForm.itemModel.trim()) errors.itemModel = "Modelo obligatorio";
    if (!orderForm.quantity || parseInt(orderForm.quantity) <= 0) {
      errors.quantity = "Cantidad debe ser mayor que 0";
    }
    if (!orderForm.cost || parseFloat(orderForm.cost) <= 0) {
      errors.cost = "Costo total debe ser mayor que 0";
    }
    if (!orderForm.url.trim() || !orderForm.url.startsWith("http")) {
      errors.url = "Ingresa un enlace válido que inicie con http";
    }
    setOrderErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Add Order Submission
  const handleAddOrder = async (e) => {
    e.preventDefault();
    if (userLevel < 2) return;
    setAlertMessage({ type: "", text: "" });

    if (!validateOrderForm()) return;

    setIsOrderSubmitting(true);
    try {
      await addDoc(collection(db, "orders"), {
        itemName: orderForm.itemName.trim(),
        itemModel: orderForm.itemModel.trim(),
        quantity: parseInt(orderForm.quantity) || 0,
        cost: parseFloat(orderForm.cost) || 0,
        url: orderForm.url.trim(),
        timestamp: serverTimestamp()
      });

      setOrderForm({
        itemName: "",
        itemModel: "",
        quantity: "",
        cost: "",
        url: ""
      });
      setAlertMessage({ type: "success", text: "¡Solicitud de compra registrada en tiempo real!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error saving order:", error);
      setAlertMessage({ type: "error", text: "Error al registrar el pedido." });
    } finally {
      setIsOrderSubmitting(false);
    }
  };

  // Handle Delete Component
  const handleDeleteProduct = async (productId) => {
    if (userLevel < 2) return;
    try {
      await deleteDoc(doc(db, "items", productId));
      setAlertMessage({ type: "success", text: "Componente eliminado correctamente." });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  // Handle Adjust Stock
  const handleAdjustStock = async (productId, amount, currentStock) => {
    if (amount < 0 && currentStock <= 0) return;
    try {
      const docRef = doc(db, "items", productId);
      await updateDoc(docRef, {
        stock: increment(amount)
      });
    } catch (error) {
      console.error(error);
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

  const mockIcons = [
    { name: "CPU", url: "https://images.unsplash.com/photo-1591453089816-0fbb971b454c?w=100&auto=format&fit=crop&q=80" },
    { name: "RAM", url: "https://images.unsplash.com/photo-1562408590-e32931084e23?w=100&auto=format&fit=crop&q=80" },
    { name: "Motherboard", url: "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=100&auto=format&fit=crop&q=80" },
    { name: "GPU", url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=100&auto=format&fit=crop&q=80" }
  ];

  if (isAuthChecking) {
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
        <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/50 backdrop-blur-[2px]" />
        <div className="glass-card rounded-[2rem] p-8 shadow-2xl z-10 flex flex-col items-center justify-center max-w-sm w-full text-center border border-white/40 dark:border-slate-800/30">
          <Loader2 className="w-12 h-12 text-sky-500 animate-spin mb-4" />
          <h2 className="text-sm font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Verificando sesión...</h2>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div 
        className="min-h-screen w-screen flex items-center justify-center p-3 sm:p-6 transition-all duration-500 relative animate-fade-in"
        style={{
          backgroundImage: "url('/mountain_background.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat"
        }}
      >
        <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/50 backdrop-blur-[2px] pointer-events-none" />
        
        <div className="w-full max-w-md glass-container rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative z-10 border border-white/50 dark:border-slate-800/30 animate-scale-in">
          {/* Logo Area */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 hover-scale">
              <Boxes className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white mt-4 tracking-tight">Inventario Real-time</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">Control de existencias y pedidos de compra</p>
          </div>

          <h2 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
            Iniciar Sesión
          </h2>

          {loginError && (
            <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Correo Electrónico *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="email"
                  placeholder="ej. operador@realtime.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isLoggingIn}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Contraseña *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={isLoggingIn}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>{isLoggingIn ? "Autenticando..." : "Ingresar"}</span>
            </button>
          </form>

          {/* Quick instructions / Demo credentials */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30 text-[10px] text-slate-400 font-semibold leading-relaxed">
            <span className="text-sky-500 font-bold block mb-1">Credenciales de Prueba:</span>
            <div className="grid grid-cols-1 gap-1 font-mono">
              <div>• Operador (Nivel 1): operador@realtime.com / 123456</div>
              <div>• Supervisor (Nivel 2): supervisor@realtime.com / 123456</div>
              <div>• Administrador (Nivel 3): admin@realtime.com / 123456</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      {/* Floating Glassmorphic Main Dashboard Card */}
      <div className="w-full max-w-6xl h-[88vh] glass-container rounded-[2.5rem] flex overflow-hidden shadow-2xl relative z-10 transition-all duration-300">
        
        {/* LEFT FIXED SIDEBAR */}
        <div className="w-20 sm:w-24 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md border-r border-white/40 dark:border-slate-800/30 flex flex-col items-center py-8 justify-between shrink-0 select-none">
          {/* Logo Area */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 hover-scale">
              <Boxes className="w-6 h-6" />
            </div>
            <span className="text-[9px] font-black text-sky-600 dark:text-sky-400 mt-2 tracking-wider">REALTIME</span>
          </div>

          {/* Navigation Tabs (Inventario vs Ordenes) */}
          <div className="flex flex-col gap-5">
            <button
              onClick={() => {
                setActiveTab("inventario");
                setAlertMessage({ type: "", text: "" });
              }}
              className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-350 hover-scale cursor-pointer ${
                activeTab === "inventario"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
              title="Inventario"
            >
              <Boxes className="w-5.5 h-5.5 mb-1" />
              <span className="text-[10px] font-bold">Inventario</span>
            </button>
            {userLevel >= 2 && (
              <button
                onClick={() => {
                  setActiveTab("ordenes");
                  setAlertMessage({ type: "", text: "" });
                }}
                className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-350 hover-scale cursor-pointer ${
                  activeTab === "ordenes"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
                title="Órdenes y Pedidos"
              >
                <ClipboardList className="w-5.5 h-5.5 mb-1" />
                <span className="text-[10px] font-bold">Órdenes</span>
              </button>
            )}
          </div>

          {/* Theme & Logout */}
          <div className="flex flex-col items-center gap-4">
            {/* Theme switcher */}
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover-scale transition-colors duration-200 cursor-pointer"
              title={theme === "light" ? "Modo Oscuro" : "Modo Claro"}
            >
              {theme === "light" ? (
                <Moon className="w-5 h-5 text-slate-500 hover:text-slate-900" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400 hover:text-amber-300" />
              )}
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-red-500/10 text-slate-400 hover:text-red-500 hover-scale transition-colors duration-200 cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RIGHT WORKSPACE */}
        <div className="flex-1 flex flex-col p-6 sm:p-8 overflow-hidden">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {activeTab === "inventario" ? "Inventario Real-time" : "Órdenes y Pedidos de Compra"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {activeTab === "inventario" 
                  ? "Supervisa y gestiona las existencias del almacén al instante" 
                  : "Solicita adquisiciones y compras externas para reabastecimiento"}
              </p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 select-none">
                <Database className="w-3.5 h-3.5" />
                <span>Conectado</span>
              </div>

              {activeTab === "inventario" && userLevel >= 2 && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 rounded-xl text-xs font-bold shadow-md shadow-sky-500/10 hover-scale cursor-pointer"
                >
                  <PlusCircle className="w-4.5 h-4.5" />
                  <span>Agregar Componente</span>
                </button>
              )}
            </div>
          </div>

          {/* Success Alerts */}
          {alertMessage.text && alertMessage.type === "success" && (
            <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in shrink-0">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{alertMessage.text}</span>
            </div>
          )}

          {/* TAB CONTENT VIEWS */}
          <div className="flex-1 overflow-hidden mt-6">
            
            {/* TAB 1: INVENTARIO */}
            {activeTab === "inventario" && (
              <div className="glass-card rounded-[2rem] p-5 shadow-lg h-full flex flex-col justify-between overflow-hidden border border-white/40 dark:border-slate-800/30">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                    Componentes en Almacén
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                    {products.length} registrados
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 min-h-[200px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                      <span className="text-xs text-slate-400 font-bold">Cargando base de datos...</span>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
                      <PackageOpen className="w-14 h-14 text-slate-300 dark:text-slate-700 mb-2" />
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Inventario vacío</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                        No se registran componentes. Presiona "Agregar Componente" para dar de alta uno.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => setSelectedProductId(product.id)}
                          className="glass-card rounded-[2rem] p-4 shadow-sm border border-white/30 dark:border-slate-800/20 flex flex-col justify-between gap-4 transition-all duration-300 hover-scale hover:shadow-md cursor-pointer animate-fade-in"
                        >
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

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/30">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block">Estado de Stock</span>
                              <div className="flex items-center gap-1.5">
                                {getStockStatus(product.stock, product.minStock)}
                                
                                <div className="flex items-center gap-1 ml-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAdjustStock(product.id, -1, product.stock);
                                    }}
                                    disabled={product.stock <= 0}
                                    className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold disabled:opacity-40 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800 hover-scale transition-colors cursor-pointer"
                                    title="Restar 1 unidad"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAdjustStock(product.id, 1, product.stock);
                                    }}
                                    className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-bold hover-scale transition-colors cursor-pointer"
                                    title="Sumar 1 unidad"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>

                            {userLevel >= 2 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProduct(product.id);
                                }}
                                className="w-8 h-8 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center shrink-0 transition-colors duration-150"
                                title="Eliminar de Firestore"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ÓRDENES Y PEDIDOS */}
            {activeTab === "ordenes" && userLevel >= 2 && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full overflow-hidden">
                
                {/* Left Form: place order (colspan 5) */}
                <div className="md:col-span-5 flex flex-col h-full overflow-y-auto">
                  <div className="glass-card rounded-[2rem] p-5 shadow-lg flex flex-col border border-white/40 dark:border-slate-800/30">
                    <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                      Solicitud de Compra
                    </h2>
                    
                    <form onSubmit={handleAddOrder} className="flex flex-col gap-4">
                      {/* Nombre del Artículo */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          Nombre del Artículo *
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Memoria RAM DDR5 32GB"
                          value={orderForm.itemName}
                          onChange={(e) => setOrderForm({ ...orderForm, itemName: e.target.value })}
                          disabled={isOrderSubmitting}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                            orderErrors.itemName ? "border-red-500" : ""
                          }`}
                        />
                        {orderErrors.itemName && <p className="text-[9px] text-red-500 font-bold mt-1">{orderErrors.itemName}</p>}
                      </div>

                      {/* Modelo */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          Modelo *
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Kingston Fury Beast"
                          value={orderForm.itemModel}
                          onChange={(e) => setOrderForm({ ...orderForm, itemModel: e.target.value })}
                          disabled={isOrderSubmitting}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                            orderErrors.itemModel ? "border-red-500" : ""
                          }`}
                        />
                        {orderErrors.itemModel && <p className="text-[9px] text-red-500 font-bold mt-1">{orderErrors.itemModel}</p>}
                      </div>

                      {/* Cantidad y Costo Total */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Cantidad *
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="0"
                            value={orderForm.quantity}
                            onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                            disabled={isOrderSubmitting}
                            className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                              orderErrors.quantity ? "border-red-500" : ""
                            }`}
                          />
                          {orderErrors.quantity && <p className="text-[9px] text-red-500 font-bold mt-1">{orderErrors.quantity}</p>}
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Costo Total (USD) *
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={orderForm.cost}
                            onChange={(e) => setOrderForm({ ...orderForm, cost: e.target.value })}
                            disabled={isOrderSubmitting}
                            className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                              orderErrors.cost ? "border-red-500" : ""
                            }`}
                          />
                          {orderErrors.cost && <p className="text-[9px] text-red-500 font-bold mt-1">{orderErrors.cost}</p>}
                        </div>
                      </div>

                      {/* URL Enlace */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          URL Enlace al Producto *
                        </label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={orderForm.url}
                          onChange={(e) => setOrderForm({ ...orderForm, url: e.target.value })}
                          disabled={isOrderSubmitting}
                          className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                            orderErrors.url ? "border-red-500" : ""
                          }`}
                        />
                        {orderErrors.url && <p className="text-[9px] text-red-500 font-bold mt-1">{orderErrors.url}</p>}
                      </div>

                      {/* Submit button */}
                      <button
                        type="submit"
                        disabled={isOrderSubmitting}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isOrderSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShoppingBag className="w-3.5 h-3.5" />
                        )}
                        <span>{isOrderSubmitting ? "Registrando..." : "Registrar Pedido"}</span>
                      </button>

                    </form>
                  </div>
                </div>

                {/* Right List: registered orders (colspan 7) */}
                <div className="md:col-span-7 flex flex-col overflow-hidden h-full">
                  <div className="glass-card rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col justify-between overflow-hidden border border-white/40 dark:border-slate-800/30">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                      <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                        Historial de Compras Solicitadas
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                        {orders.length} pedidos
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 min-h-[200px]">
                      {isOrdersLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                          <span className="text-xs text-slate-400 font-bold">Cargando pedidos...</span>
                        </div>
                      ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                          <ClipboardList className="w-14 h-14 text-slate-300 dark:text-slate-700 mb-2" />
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">Sin órdenes registradas</h3>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                            No hay pedidos cargados en Firestore. Rellena el formulario para solicitar uno.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {orders.map((order) => (
                            <div
                              key={order.id}
                              className="glass-card rounded-2xl p-4 shadow-sm border border-white/30 dark:border-slate-800/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-305 hover-scale animate-fade-in"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-[8px] uppercase font-black text-sky-500 dark:text-sky-400 tracking-wider">
                                  COMPRA SOLICITADA
                                </span>
                                <h4 className="font-extrabold product-name-text text-sm truncate leading-snug">
                                  {order.itemName}
                                </h4>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-semibold">
                                  Mod: {order.itemModel} • Qty: <span className="text-slate-700 dark:text-slate-300 font-bold">{order.quantity}</span>
                                </p>
                              </div>

                              <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                                <div className="text-left sm:text-right">
                                  <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block">Costo Total</span>
                                  <span className="font-black text-sky-600 dark:text-sky-400 text-sm flex items-center">
                                    <DollarSign className="w-3.5 h-3.5" />
                                    {order.cost?.toLocaleString("es-CL")}
                                  </span>
                                </div>
                                <a
                                  href={order.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover-scale transition-colors"
                                  title="Ver producto en la web"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

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

      {/* POPUP MODAL: Detalle de Componente */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card w-full max-w-lg rounded-[2.5rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in max-h-[92vh] flex flex-col border border-white/50 dark:border-slate-800/40">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white">Detalles del Componente</h2>
                <p className="text-xs text-slate-400 mt-0.5">Información técnica y stock en tiempo real.</p>
              </div>
              <button
                onClick={() => setSelectedProductId(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors hover-scale"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-5">
              
              {/* Large Featured Image */}
              <div className="w-full h-56 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/40 shadow-inner shrink-0 relative">
                <img
                  src={selectedProduct.image || "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop&q=80"}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  {getStockStatus(selectedProduct.stock, selectedProduct.minStock)}
                </div>
              </div>

              {/* Information Grid */}
              <div className="flex flex-col gap-4 text-xs font-semibold">
                
                {/* Row 1: Nombre & Marca */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Nombre del Artículo</span>
                    <span className="text-sm font-extrabold product-name-text block">{selectedProduct.name}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Marca</span>
                    <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 block">{selectedProduct.brand || "Sin Marca"}</span>
                  </div>
                </div>

                {/* Row 2: Modelo & SKU */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Modelo</span>
                    <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 block">{selectedProduct.model || "Sin Modelo"}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">SKU</span>
                    <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300 uppercase block">{selectedProduct.sku || "Sin SKU"}</span>
                  </div>
                </div>

                {/* Row 3: Ubicación Física */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Ubicación Física</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-sky-500" />
                    {selectedProduct.location || "Sin Ubicación registrada"}
                  </span>
                </div>

                {/* Row 4: Stock controls & Min stock */}
                <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col text-center sm:text-left">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Control de Stock</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Ajusta el volumen en inventario.</span>
                  </div>
                  
                  {/* Stock adjuster controls */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(selectedProduct.id, -1, selectedProduct.stock)}
                      disabled={selectedProduct.stock <= 0}
                      className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-base disabled:opacity-40 hover-scale transition-colors cursor-pointer"
                      title="Restar 1 unidad"
                    >
                      -
                    </button>
                    <div className="text-center min-w-[50px]">
                      <span className="text-2xl font-black text-slate-800 dark:text-white block">{selectedProduct.stock}</span>
                      <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block">Min: {selectedProduct.minStock}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(selectedProduct.id, 1, selectedProduct.stock)}
                      className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-black text-base hover-scale transition-colors cursor-pointer"
                      title="Sumar 1 unidad"
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover-scale transition-colors"
              >
                Cerrar Detalles
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
