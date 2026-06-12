import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  query, 
  where,
  serverTimestamp,
  updateDoc,
  increment
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
  MapPin,
  ClipboardList,
  DollarSign,
  ExternalLink,
  ShoppingBag,
  ListCollapse,
  Mail,
  Lock,
  LogOut,
  Edit3,
  FileText
} from "lucide-react";

export default function App() {
  // Authentication & Roles State
  const [currentUser, setCurrentUser] = useState(null);
  const [userLevel, setUserLevel] = useState(1); // 1 = Operador, 2 = Supervisor, 3 = Administrador
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Static fallback credentials and role mapping configuration (offline/dev fallback)
  const LOCAL_CREDENTIALS = {
    "1234": { password: "1234", level: 3 },
    "operador": { password: "123456", level: 1 },
    "supervisor": { password: "123456", level: 2 },
    "admin": { password: "123456", level: 3 }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState("inventario"); // 'inventario' | 'ordenes'

  // Products State (Inventario)
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  // Component Details Edit State
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailForm, setEditDetailForm] = useState({
    name: "",
    brand: "",
    model: "",
    sku: "",
    location: ""
  });
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  // Sync edit form fields when a product is opened or updated in real time
  useEffect(() => {
    if (selectedProduct) {
      if (!isEditingDetail) {
        setEditDetailForm({
          name: selectedProduct.name || "",
          brand: selectedProduct.brand || "",
          model: selectedProduct.model || "",
          sku: selectedProduct.sku || "",
          location: selectedProduct.location || ""
        });
      }
    } else {
      setIsEditingDetail(false);
    }
  }, [selectedProductId, selectedProduct, isEditingDetail]);

  // Orders State (Órdenes y Pedidos)
  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [orderHistory, setOrderHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Daily Reports State
  const [dailyReports, setDailyReports] = useState([]);
  const [isReportsLoading, setIsReportsLoading] = useState(true);
  const [reportRows, setReportRows] = useState([{ time: "08:00 - 09:00", activity: "" }]);
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);

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

  // Load user session from localStorage on mount and auto-initialize Master User
  useEffect(() => {
    setIsAuthChecking(true);
    try {
      const savedUser = localStorage.getItem("realtime_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setUserLevel(parsed.level || 1);
        if ((parsed.level || 1) < 2) {
          setActiveTab("inventario");
        }
      }
    } catch (err) {
      console.error("Error reading session from localStorage:", err);
    } finally {
      setIsAuthChecking(false);
    }

    // Initialize Master User '1234' in Firestore users collection if it doesn't exist
    const ensureMasterUser = async () => {
      try {
        const masterDocRef = doc(db, "users", "1234");
        const masterDocSnap = await getDoc(masterDocRef);
        if (!masterDocSnap.exists()) {
          await setDoc(masterDocRef, {
            password: "1234",
            level: 3,
            name: "Usuario Maestro",
            role: "admin"
          });
          console.log("Master User '1234' initialized in Firestore users collection.");
        }
      } catch (err) {
        console.error("Error ensuring Master User in Firestore:", err);
      }
    };
    ensureMasterUser();
  }, []);

  // Login handler with Firestore users validation
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    const username = loginUsername.trim().toLowerCase();
    if (!username || !loginPassword) {
      setLoginError("Por favor ingresa todos los campos obligatorios.");
      return;
    }

    setIsLoggingIn(true);
    try {
      let loggedUser = null;

      // 1. Try fetching username document from Firestore /users/{username}
      try {
        const userDocRef = doc(db, "users", username);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.password === loginPassword) {
            let level = 1;
            const val = userData.level || userData.role;
            if (val === 3 || val === "admin" || val === "administrator" || val === "Nivel 3") level = 3;
            else if (val === 2 || val === "supervisor" || val === "Nivel 2") level = 2;
            else if (val === 1 || val === "operator" || val === "operador" || val === "Nivel 1") level = 1;
            else if (!isNaN(parseInt(val))) level = parseInt(val);

            loggedUser = { username, level };
          } else {
            setLoginError("Contraseña incorrecta.");
            setIsLoggingIn(false);
            return;
          }
        }
      } catch (err) {
        console.error("Firestore user search error:", err);
      }

      // 2. If not found in Firestore, fallback to LOCAL_CREDENTIALS mapping
      if (!loggedUser) {
        if (LOCAL_CREDENTIALS[username]) {
          const localCreds = LOCAL_CREDENTIALS[username];
          if (localCreds.password === loginPassword) {
            loggedUser = { username, level: localCreds.level };
          } else {
            setLoginError("Contraseña incorrecta.");
            setIsLoggingIn(false);
            return;
          }
        }
      }

      // 3. Evaluate login result
      if (loggedUser) {
        setCurrentUser(loggedUser);
        setUserLevel(loggedUser.level);
        localStorage.setItem("realtime_user", JSON.stringify(loggedUser));
        
        // Redirection for operator
        if (loggedUser.level < 2) {
          setActiveTab("inventario");
        }
        // Clean fields
        setLoginUsername("");
        setLoginPassword("");
      } else {
        setLoginError("Usuario no registrado en el sistema.");
      }
    } catch (error) {
      console.error("Login verification error:", error);
      setLoginError("Ocurrió un error al procesar el ingreso. Revisa tu conexión.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    try {
      localStorage.removeItem("realtime_user");
      setCurrentUser(null);
      setUserLevel(1);
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
  }, [currentUser]);

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
  }, [currentUser]);

  // Effect to fetch order history in real-time from Firestore (orders with status "recibido" or "rechazado")
  useEffect(() => {
    if (!currentUser) return;
    setIsHistoryLoading(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("status", "in", ["recibido", "rechazado"])
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const historyList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Sort locally by timestamp (newest first)
          historyList.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          
          setOrderHistory(historyList);
          setIsHistoryLoading(false);
        },
        (error) => {
          console.error("Firestore order history query error:", error);
          setIsHistoryLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup order history real-time listener:", error);
      setIsHistoryLoading(false);
    }
  }, [currentUser]);

  // Effect to fetch daily reports in real-time from Firestore
  useEffect(() => {
    if (!currentUser) return;
    setIsReportsLoading(true);
    try {
      let q = collection(db, "daily_reports");
      
      // Filter in query for Nivel 1 (Operador)
      if (userLevel === 1) {
        q = query(collection(db, "daily_reports"), where("createdBy", "==", currentUser.username));
      }
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let reportsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Filter in JS for Nivel 2 (Supervisor sees Nivel 1 reports + their own reports)
          if (userLevel === 2) {
            reportsList = reportsList.filter(
              r => r.userLevel === 1 || r.createdBy === currentUser.username
            );
          }
          
          // Sort by timestamp (newest first)
          reportsList.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          
          setDailyReports(reportsList);
          setIsReportsLoading(false);
        },
        (error) => {
          console.error("Firestore daily reports query error:", error);
          setIsReportsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup daily reports real-time listener:", error);
      setIsReportsLoading(false);
    }
  }, [currentUser, userLevel]);

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
    if (!currentUser) return;
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
        status: "solicitado",
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

  // Add Daily Report Row
  const handleAddReportRow = () => {
    const standardBlocks = [
      "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
      "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
      "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00"
    ];
    let nextIndex = reportRows.length;
    if (nextIndex >= standardBlocks.length) nextIndex = standardBlocks.length - 1;
    const nextTime = standardBlocks[nextIndex];
    setReportRows(prev => [...prev, { time: nextTime, activity: "" }]);
  };

  // Remove Daily Report Row
  const handleRemoveReportRow = (index) => {
    if (reportRows.length <= 1) return;
    setReportRows(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Daily Report Submission
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (userLevel >= 3) return;
    setAlertMessage({ type: "", text: "" });

    const filledRows = reportRows.filter(r => r.activity.trim() !== "");
    if (filledRows.length === 0) {
      alert("Por favor ingresa al menos una actividad.");
      return;
    }

    setIsReportSubmitting(true);
    try {
      const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
      await addDoc(collection(db, "daily_reports"), {
        activities: filledRows.map(r => ({ time: r.time, activity: r.activity.trim() })),
        createdBy: currentUser.username,
        userLevel: userLevel,
        date: today,
        timestamp: serverTimestamp()
      });

      setReportRows([{ time: "08:00 - 09:00", activity: "" }]);
      setAlertMessage({ type: "success", text: "¡Reporte diario enviado exitosamente!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error submitting daily report:", error);
      setAlertMessage({ type: "error", text: "Error al enviar el reporte." });
    } finally {
      setIsReportSubmitting(false);
    }
  };

  // Generate and download PDF for a daily report
  const handleDownloadPDF = (report) => {
    try {
      // 1. Data Validation
      if (!report) {
        throw new Error("El reporte es nulo o indefinido");
      }
      
      const createdBy = report.createdBy || "N/D";
      const date = report.date || "N/D";
      const activities = Array.isArray(report.activities) ? report.activities : [];
      const userLevel = report.userLevel !== undefined ? report.userLevel : "N/D";

      const doc = new jsPDF();

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(14, 165, 233); // Sky-500
      doc.text("Reporte Diario de Actividades", 14, 20);

      // Subtitle
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text("MasterInventory - Sistema de Almacén", 14, 26);

      // Divider line
      doc.setDrawColor(226, 232, 240); // Slate-200 border
      doc.line(14, 32, 196, 32);

      // Metadata Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85); // Slate-700
      doc.text("Detalles del Reporte:", 14, 40);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Operador / Creador: ${createdBy}`, 14, 46);
      doc.text(`Nivel de Permisos: Nivel ${userLevel} (${userLevel === 2 ? "Supervisor" : "Operador"})`, 14, 52);
      doc.text(`Fecha del Turno: ${date}`, 14, 58);

      // Table of Activities
      const tableHeaders = [["Bloque de Tiempo", "Actividades Realizadas"]];
      const tableRows = activities.map(act => {
        const time = (act && act.time) ? act.time.trim() : "N/D";
        const activity = (act && act.activity) ? act.activity.trim() : "N/D";
        return [time, activity];
      });

      autoTable(doc, {
        startY: 66,
        head: tableHeaders,
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [14, 165, 233], // Sky-500
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50
        },
        margin: { top: 10, left: 14, right: 14 },
        styles: {
          overflow: "linebreak",
          cellPadding: 5
        }
      });

      // Save PDF
      const sanitizeDate = date.replace(/\//g, "-");
      const filename = `Reporte_${createdBy}_${sanitizeDate}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Error detallado de jspdf:", error);
      alert("Ocurrió un error al generar el PDF.");
    }
  };

  // Handle Approve Order (Level 3 only)
  const handleApproveOrder = async (orderId) => {
    if (userLevel < 3) return;
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, {
        status: "en_espera"
      });
      setAlertMessage({ type: "success", text: "¡Pedido aprobado y puesto en espera!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error approving order:", error);
    }
  };

  // Handle Reject Order (Level 3 only)
  const handleRejectOrder = async (orderId) => {
    if (userLevel < 3) return;
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, {
        status: "rechazado"
      });
      setAlertMessage({ type: "success", text: "Pedido rechazado." });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error rejecting order:", error);
    }
  };

  // Handle Receive Order (Level 2 or 3)
  const handleReceiveOrder = async (orderId) => {
    if (userLevel < 2) return;
    try {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, {
        status: "recibido"
      });
      setAlertMessage({ type: "success", text: "¡Pedido marcado como recibido!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error receiving order:", error);
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

  // Handle Save Component Details Edit
  const handleSaveProductDetails = async () => {
    if (userLevel < 2 || !selectedProduct) return;
    
    // Simple Validation
    if (
      !editDetailForm.name.trim() ||
      !editDetailForm.brand.trim() ||
      !editDetailForm.model.trim() ||
      !editDetailForm.sku.trim() ||
      !editDetailForm.location.trim()
    ) {
      alert("Por favor, rellena todos los campos obligatorios (*)");
      return;
    }
    if (editDetailForm.sku.trim().length !== 9) {
      alert("El SKU debe tener exactamente 9 caracteres.");
      return;
    }

    setIsSavingDetail(true);
    try {
      const docRef = doc(db, "items", selectedProduct.id);
      await updateDoc(docRef, {
        name: editDetailForm.name.trim(),
        brand: editDetailForm.brand.trim(),
        model: editDetailForm.model.trim(),
        sku: editDetailForm.sku.trim().toUpperCase(),
        location: editDetailForm.location.trim()
      });
      setIsEditingDetail(false);
      setAlertMessage({ type: "success", text: "¡Componente actualizado correctamente!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error updating product details:", error);
      alert("Ocurrió un error al guardar los cambios en Firestore.");
    } finally {
      setIsSavingDetail(false);
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
                Nombre de Usuario *
              </label>
              <div className="relative">
                <Boxes className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ej. operador"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
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
              <div>• Usuario Maestro (Nivel 3): 1234 / 1234</div>
              <div>• Operador (Nivel 1): operador / 123456</div>
              <div>• Supervisor (Nivel 2): supervisor / 123456</div>
              <div>• Administrador (Nivel 3): admin / 123456</div>
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
            <button
              onClick={() => {
                setActiveTab("reportes");
                setAlertMessage({ type: "", text: "" });
              }}
              className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-350 hover-scale cursor-pointer ${
                activeTab === "reportes"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
              title="Reporte Diario"
            >
              <FileText className="w-5.5 h-5.5 mb-1" />
              <span className="text-[10px] font-bold">Reportes</span>
            </button>
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
                {activeTab === "inventario" 
                  ? "Inventario Real-time" 
                  : activeTab === "ordenes" 
                    ? "Órdenes y Pedidos de Compra" 
                    : "Reporte Diario de Actividades"}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {activeTab === "inventario" 
                  ? "Supervisa y gestiona las existencias del almacén al instante" 
                  : activeTab === "ordenes"
                    ? "Solicita adquisiciones y compras externas para reabastecimiento"
                    : "Registra y audita las actividades realizadas durante el turno"}
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
            {activeTab === "ordenes" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full overflow-hidden">
                
                {/* Left Form: place order (colspan 3) */}
                <div className="md:col-span-3 flex flex-col h-full overflow-y-auto">
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
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            Cant *
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="0"
                            value={orderForm.quantity}
                            onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                            disabled={isOrderSubmitting}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                              orderErrors.quantity ? "border-red-500" : ""
                            }`}
                          />
                          {orderErrors.quantity && <p className="text-[9px] text-red-500 font-bold mt-0.5">{orderErrors.quantity}</p>}
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1" title="Costo en USD">
                            Costo *
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={orderForm.cost}
                            onChange={(e) => setOrderForm({ ...orderForm, cost: e.target.value })}
                            disabled={isOrderSubmitting}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                              orderErrors.cost ? "border-red-500" : ""
                            }`}
                          />
                          {orderErrors.cost && <p className="text-[9px] text-red-500 font-bold mt-0.5">{orderErrors.cost}</p>}
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

                {/* Right Columns: Kanban Board and History (colspan 9) */}
                <div className="md:col-span-9 flex flex-col h-full overflow-hidden gap-4">
                  {/* Kanban Board */}
                  <div className="glass-card rounded-[2rem] p-5 shadow-lg h-[58%] flex flex-col overflow-hidden border border-white/40 dark:border-slate-800/30 shrink-0">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                        Pedidos Pendientes y Seguimiento
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                        {orders.filter(o => o.status !== "recibido" && o.status !== "rechazado").length} pendientes
                      </span>
                    </div>

                    {/* Kanban Board Grid */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden min-h-0">
                      {isOrdersLoading ? (
                        <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
                          <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                          <span className="text-xs text-slate-400 font-bold">Cargando pedidos...</span>
                        </div>
                      ) : (
                        <>
                          {/* COLUMN 1: SOLICITADO */}
                          <div className="flex flex-col h-full bg-slate-500/5 dark:bg-slate-950/15 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/10 overflow-hidden animate-fade-in">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/40 dark:border-slate-800/30 shrink-0">
                              <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider">Solicitado</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-600">
                                {orders.filter(o => o.status === "solicitado" || !o.status).length}
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-2">
                              {orders.filter(o => o.status === "solicitado" || !o.status).map(order => (
                                <div key={order.id} className="glass-card rounded-2xl p-3 border border-white/40 dark:border-slate-800/20 flex flex-col gap-2 hover-scale animate-fade-in shadow-sm">
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold product-name-text text-xs truncate">{order.itemName}</h4>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">Mod: {order.itemModel}</p>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span>Cant: <strong className="text-slate-700 dark:text-slate-200">{order.quantity}</strong></span>
                                    <span className="font-bold text-sky-600 dark:text-sky-400">${order.cost?.toLocaleString("es-CL")}</span>
                                  </div>
                                  <div className="flex gap-2 mt-1 shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800/30 justify-between items-center">
                                    <a href={order.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title="Ver producto">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    {userLevel === 3 && (
                                      <div className="flex gap-1.5">
                                        <button onClick={() => handleRejectOrder(order.id)} className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[9px] font-black uppercase transition-colors" title="Rechazar Pedido">
                                          Rechazar
                                        </button>
                                        <button onClick={() => handleApproveOrder(order.id)} className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase transition-colors" title="Aprobar Pedido">
                                          Aprobar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {orders.filter(o => o.status === "solicitado" || !o.status).length === 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-6">Sin solicitudes</span>
                              )}
                            </div>
                          </div>

                          {/* COLUMN 2: EN ESPERA */}
                          <div className="flex flex-col h-full bg-slate-500/5 dark:bg-slate-950/15 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/10 overflow-hidden animate-fade-in">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/40 dark:border-slate-800/30 shrink-0">
                              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">En Espera</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600">
                                {orders.filter(o => o.status === "en_espera").length}
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-2">
                              {orders.filter(o => o.status === "en_espera").map(order => (
                                <div key={order.id} className="glass-card rounded-2xl p-3 border border-white/40 dark:border-slate-800/20 flex flex-col gap-2 hover-scale animate-fade-in shadow-sm">
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold product-name-text text-xs truncate">{order.itemName}</h4>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">Mod: {order.itemModel}</p>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span>Cant: <strong className="text-slate-700 dark:text-slate-200">{order.quantity}</strong></span>
                                    <span className="font-bold text-sky-600 dark:text-sky-400">${order.cost?.toLocaleString("es-CL")}</span>
                                  </div>
                                  <div className="flex gap-2 mt-1 shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800/30 justify-between items-center">
                                    <a href={order.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title="Ver producto">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    {userLevel >= 2 && (
                                      <button onClick={() => handleReceiveOrder(order.id)} className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase transition-colors shadow-sm" title="Recibido">
                                        Recibido
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {orders.filter(o => o.status === "en_espera").length === 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-6">Sin pedidos aprobados</span>
                              )}
                            </div>
                          </div>

                          {/* COLUMN 3: RECIBIDO */}
                          <div className="flex flex-col h-full bg-slate-500/5 dark:bg-slate-950/15 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/10 overflow-hidden animate-fade-in">
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/40 dark:border-slate-800/30 shrink-0">
                              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Recibido</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600">
                                {orders.filter(o => o.status === "recibido").slice(0, 3).length} rec.
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-2">
                              {orders.filter(o => o.status === "recibido").slice(0, 3).map(order => (
                                <div key={order.id} className="glass-card rounded-2xl p-3 border border-white/40 dark:border-slate-800/20 flex flex-col gap-2 hover-scale animate-fade-in shadow-sm opacity-80">
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold product-name-text text-xs truncate">{order.itemName}</h4>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">Mod: {order.itemModel}</p>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span>Cant: <strong className="text-slate-700 dark:text-slate-200">{order.quantity}</strong></span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">${order.cost?.toLocaleString("es-CL")}</span>
                                  </div>
                                  <div className="flex gap-2 mt-1 shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800/30 justify-between items-center">
                                    <a href={order.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title="Ver producto">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <span className="text-[8px] uppercase font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">Completado</span>
                                  </div>
                                </div>
                              ))}
                              {orders.filter(o => o.status === "recibido").length === 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-6">Sin pedidos recibidos</span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Historial de Pedidos */}
                  <div className="glass-card rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col overflow-hidden border border-white/40 dark:border-slate-800/30">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                        Historial de Pedidos
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                        {orderHistory.length} finalizados
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 scroll-glass min-h-0">
                      {isHistoryLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Loader2 className="w-6 h-6 text-sky-500 animate-spin mb-2" />
                          <span className="text-[10px] text-slate-400 font-bold">Cargando historial...</span>
                        </div>
                      ) : orderHistory.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                          No hay registros en el historial.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200/40 dark:border-slate-800/30 text-[9px] text-slate-400 font-black uppercase tracking-wider">
                                <th className="pb-2 font-black">Artículo</th>
                                <th className="pb-2 font-black">Modelo</th>
                                <th className="pb-2 font-black text-center">Cant</th>
                                <th className="pb-2 font-black text-right">Costo Total</th>
                                <th className="pb-2 font-black text-center">Estado</th>
                                <th className="pb-2 font-black text-center">Fecha/Hora</th>
                                <th className="pb-2 font-black text-center">Enlace</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/30 dark:divide-slate-800/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              {orderHistory.map((item) => {
                                const dateStr = item.timestamp?.toDate
                                  ? item.timestamp.toDate().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
                                  : (item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "N/D");
                                return (
                                  <tr key={item.id} className="hover:bg-slate-500/5 transition-colors">
                                    <td className="py-2.5 max-w-[150px] truncate pr-2 font-bold text-slate-800 dark:text-slate-100">{item.itemName}</td>
                                    <td className="py-2.5 max-w-[120px] truncate pr-2 text-slate-400 dark:text-slate-500 font-mono text-[9px]">{item.itemModel}</td>
                                    <td className="py-2.5 text-center font-bold text-slate-700 dark:text-slate-200">{item.quantity}</td>
                                    <td className="py-2.5 text-right font-black text-sky-600 dark:text-sky-400">${item.cost?.toLocaleString("es-CL")}</td>
                                    <td className="py-2.5 text-center">
                                      {item.status === "recibido" ? (
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Recibido</span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-red-500/10 text-red-600 dark:text-red-400">Rechazado</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-center text-[9px] text-slate-400 dark:text-slate-500 font-medium">{dateStr}</td>
                                    <td className="py-2.5 text-center">
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-sky-500 transition-colors"
                                        title="Ver producto"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: REPORTE DIARIO */}
            {activeTab === "reportes" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full overflow-hidden">
                {userLevel < 3 ? (
                  <>
                    {/* Left Form: create report (colspan 5) */}
                    <div className="md:col-span-5 flex flex-col h-full overflow-y-auto pr-1 scroll-glass">
                      <div className="glass-card rounded-[2rem] p-5 shadow-lg flex flex-col border border-white/40 dark:border-slate-800/30">
                        <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                          Nuevo Reporte Diario
                        </h2>
                        
                        <form onSubmit={handleSubmitReport} className="flex flex-col gap-4">
                          <div className="flex flex-col gap-4">
                            {reportRows.map((row, index) => (
                              <div key={index} className="p-3 rounded-2xl bg-slate-500/5 border border-slate-100/20 dark:border-slate-800/10 flex flex-col gap-2 relative">
                                <div className="flex justify-between items-center gap-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    Bloque de Hora
                                  </label>
                                  {reportRows.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveReportRow(index)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                      title="Eliminar fila"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                
                                <select
                                  value={row.time}
                                  onChange={(e) => {
                                    const updated = [...reportRows];
                                    updated[index].time = e.target.value;
                                    setReportRows(updated);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-xs glass-input font-bold"
                                >
                                  {[
                                    "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
                                    "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
                                    "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00", "19:00 - 20:00"
                                  ].map(block => (
                                    <option key={block} value={block} className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                                      {block}
                                    </option>
                                  ))}
                                </select>
                                
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                                  Actividad Realizada *
                                </label>
                                <textarea
                                  placeholder="Describe las tareas realizadas en este bloque..."
                                  value={row.activity}
                                  onChange={(e) => {
                                    const updated = [...reportRows];
                                    updated[index].activity = e.target.value;
                                    setReportRows(updated);
                                  }}
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-xl text-xs glass-input font-semibold resize-none"
                                  required
                                />
                              </div>
                            ))}
                          </div>
                          
                          <button
                            type="button"
                            onClick={handleAddReportRow}
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer hover:bg-sky-500/5"
                          >
                            <PlusCircle className="w-4 h-4" />
                            <span>Agregar Fila</span>
                          </button>
                          
                          <button
                            type="submit"
                            disabled={isReportSubmitting}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 cursor-pointer"
                          >
                            {isReportSubmitting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{isReportSubmitting ? "Enviando..." : "Enviar Reporte"}</span>
                          </button>
                        </form>
                      </div>
                    </div>
                    
                    {/* Right History: (colspan 7) */}
                    <div className="md:col-span-7 flex flex-col h-full overflow-hidden">
                      <div className="glass-card rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col overflow-hidden border border-white/40 dark:border-slate-800/30">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            Historial de Reportes
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                            {dailyReports.length} reportes
                          </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-4 pb-2">
                          {isReportsLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                              <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                              <span className="text-xs text-slate-400 font-bold">Cargando reportes...</span>
                            </div>
                          ) : dailyReports.length === 0 ? (
                            <span className="text-xs text-slate-400 dark:text-slate-500 text-center py-12 font-bold">Sin reportes registrados</span>
                          ) : (
                            dailyReports.map((report) => {
                              const isExpanded = expandedReportId === report.id;
                              return (
                                <div 
                                  key={report.id} 
                                  onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                  className="glass-card rounded-2xl p-4 border border-white/30 dark:border-slate-800/20 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-3 cursor-pointer select-none animate-fade-in"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{report.createdBy}</span>
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                        report.userLevel === 2 
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                          : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                      }`}>
                                        {report.userLevel === 2 ? "Supervisor" : "Operador"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{report.date}</span>
                                      <span className="text-[9px] text-slate-400 font-bold">{isExpanded ? "▲" : "▼"}</span>
                                    </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800/30 flex flex-col gap-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex flex-col gap-2">
                                        {report.activities?.map((row, idx) => (
                                          <div key={idx} className="flex gap-3 text-xs leading-relaxed">
                                            <span className="font-mono font-bold text-[10px] text-sky-600 dark:text-sky-400 shrink-0 bg-sky-500/5 px-2 py-0.5 rounded-lg h-fit">
                                              {row.time}
                                            </span>
                                            <span className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{row.activity}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="flex justify-end pt-2">
                                        <button
                                          onClick={() => handleDownloadPDF(report)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                          title="Descargar Reporte en PDF"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-white" />
                                          <span>Descargar PDF</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Nivel 3: Audit View (colspan 12) */
                  <div className="col-span-12 flex flex-col h-full overflow-hidden">
                    <div className="glass-card rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col overflow-hidden border border-white/40 dark:border-slate-800/30">
                      <div className="flex items-center justify-between mb-4 shrink-0">
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            Auditoría de Reportes Diarios
                          </h2>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Control y supervisión de turnos de Operadores y Supervisores</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50">
                          {dailyReports.length} totales
                        </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-4">
                        {isReportsLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center w-full">
                            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                            <span className="text-xs text-slate-400 font-bold">Cargando reportes para auditoría...</span>
                          </div>
                        ) : dailyReports.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-semibold w-full">
                            No se registran reportes en el sistema.
                          </div>
                        ) : (
                          dailyReports.map((report) => {
                            const isExpanded = expandedReportId === report.id;
                            return (
                              <div 
                                key={report.id} 
                                onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                className="glass-card rounded-2xl p-4 border border-white/30 dark:border-slate-800/20 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-2 cursor-pointer select-none animate-fade-in w-full h-auto"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{report.createdBy}</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                      report.userLevel === 2 
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                    }`}>
                                      {report.userLevel === 2 ? "Supervisor" : "Operador"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{report.date}</span>
                                    <span className="text-[9px] text-slate-400 font-bold">{isExpanded ? "▲" : "▼"}</span>
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-800/30 flex flex-col gap-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 scroll-glass">
                                      {report.activities?.map((row, idx) => (
                                        <div key={idx} className="flex gap-2 text-xs leading-relaxed">
                                          <span className="font-mono font-bold text-[9px] text-sky-600 dark:text-sky-400 shrink-0 bg-sky-500/5 px-1.5 py-0.5 rounded h-fit">
                                            {row.time}
                                          </span>
                                          <span className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{row.activity}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex justify-end pt-2">
                                      <button
                                        onClick={() => handleDownloadPDF(report)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                        title="Descargar Reporte en PDF"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-white" />
                                        <span>Descargar PDF</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                <h2 className="text-lg font-black text-slate-800 dark:text-white">
                  {isEditingDetail ? "Editar Componente" : "Detalles del Componente"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isEditingDetail ? "Modifica los campos técnicos del componente." : "Información técnica y stock en tiempo real."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {userLevel >= 2 && !isEditingDetail && (
                  <button
                    onClick={() => setIsEditingDetail(true)}
                    className="w-9 h-9 rounded-full bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 flex items-center justify-center transition-all duration-150 hover-scale cursor-pointer"
                    title="Editar Detalles"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedProductId(null);
                    setIsEditingDetail(false);
                  }}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors hover-scale"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Nombre del Artículo *</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        value={editDetailForm.name}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, name: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                        required
                      />
                    ) : (
                      <span className="text-sm font-extrabold product-name-text block">{selectedProduct.name}</span>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Marca *</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        value={editDetailForm.brand}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, brand: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                        required
                      />
                    ) : (
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 block">{selectedProduct.brand || "Sin Marca"}</span>
                    )}
                  </div>
                </div>

                {/* Row 2: Modelo & SKU */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Modelo *</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        value={editDetailForm.model}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, model: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                        required
                      />
                    ) : (
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 block">{selectedProduct.model || "Sin Modelo"}</span>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">SKU (9 Caracteres) *</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        maxLength={9}
                        value={editDetailForm.sku}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, sku: e.target.value.toUpperCase() })}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-mono font-bold uppercase outline-none focus:border-sky-500"
                        required
                      />
                    ) : (
                      <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300 uppercase block">{selectedProduct.sku || "Sin SKU"}</span>
                    )}
                  </div>
                </div>

                {/* Row 3: Ubicación Física */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">Ubicación Física *</span>
                  {isEditingDetail ? (
                    <input
                      type="text"
                      value={editDetailForm.location}
                      onChange={(e) => setEditDetailForm({ ...editDetailForm, location: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                      required
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-sky-500" />
                      {selectedProduct.location || "Sin Ubicación registrada"}
                    </span>
                  )}
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
            <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 mt-4 shrink-0 flex gap-3">
              {isEditingDetail ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetail(false)}
                    disabled={isSavingDetail}
                    className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover-scale transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProductDetails}
                    disabled={isSavingDetail}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/15 hover-scale flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingDetail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingDetail ? "Guardando..." : "Guardar Cambios"}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedProductId(null)}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover-scale transition-colors"
                >
                  Cerrar Detalles
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
