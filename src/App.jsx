import React, { useState, useEffect, useRef } from "react";
import { db, storage, auth } from "./firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { translations } from "./translations";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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
  getDocs,
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
  FileText,
  Printer,
  Radio,
  Users,
  Globe,
  Palette,
  Shield,
  Bell,
  History,
  Key,
  Settings
} from "lucide-react";

const TABS_CONFIG = [
  {
    id: "inventario",
    title: "Inventario Real-time",
    description: "Supervisa y gestiona las existencias del almacén al instante",
    shortTitle: "Inventario",
    iconName: "Boxes"
  },
  {
    id: "ordenes",
    title: "Órdenes y Pedidos de Compra",
    description: "Solicita adquisiciones y compras externas para reabastecimiento",
    shortTitle: "Órdenes",
    iconName: "ClipboardList"
  },
  {
    id: "reportes",
    title: "Reporte Diario de Actividades",
    description: "Registra y audita las actividades realizadas durante el turno",
    shortTitle: "Reportes",
    iconName: "FileText"
  },
  {
    id: "limpieza",
    title: "Limpieza de Impresora",
    description: "Registra y supervisa los servicios de mantenimiento de equipos de impresión",
    shortTitle: "Limpieza",
    iconName: "Printer"
  },
  {
    id: "rfid",
    title: "Verificación de RFID",
    description: "Registra y supervisa las lecturas y el estado de antenas y sensores RFID",
    shortTitle: "RFID",
    iconName: "Radio"
  },
  {
    id: "usuario",
    title: "Administración de Usuarios",
    description: "Gestiona los asociados del equipo, sus niveles de acceso y credenciales de seguridad",
    shortTitle: "Usuario",
    iconName: "Users"
  }
];

const ICON_COMPONENTS = {
  Boxes,
  ClipboardList,
  FileText,
  Printer,
  Radio,
  Bell,
  Users
};

const getBackgroundClass = (theme) => {
  switch (theme) {
    case "nature":
      return "theme-nature";
    case "redwood":
      return "theme-redwood";
    case "coast":
      return "theme-coast";
    case "redrocks":
      return "theme-redrocks";
    default:
      return "theme-nature";
  }
};

const getBackgroundStyle = (theme) => {
  return {};
};

const getThemeActiveTabClass = (theme) => {
  return "bg-gradient-to-r from-emerald-800 to-emerald-600 text-white rounded-full font-bold shadow-md shadow-emerald-800/10 border-none";
};

const getMetallicFrameClass = (theme) => "";

const getMetallicIconClass = (theme) => "";


const MOCK_ICONS = [
  { name: "CPU", url: "https://images.unsplash.com/photo-1591453089816-0fbb971b454c?w=100&auto=format&fit=crop&q=80" },
  { name: "RAM", url: "https://images.unsplash.com/photo-1562408590-e32931084e23?w=100&auto=format&fit=crop&q=80" },
  { name: "Motherboard", url: "https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=100&auto=format&fit=crop&q=80" },
  { name: "GPU", url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=100&auto=format&fit=crop&q=80" }
];

export default function App() {
  // Translation State
  const [language, setLanguage] = useState(() => localStorage.getItem("app_language") || "es");
  const t = translations[language];

  // Visual Theme State
  const [visualTheme, setVisualTheme] = useState(() => localStorage.getItem("app_theme") || "classic");

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
    "1234": { password: "9919", level: 3 },
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

  // Notifications & Movements States
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);
  const hasCleanedUpRef = useRef(false);
  const [movements, setMovements] = useState([]);
  const [isMovementsLoading, setIsMovementsLoading] = useState(false);
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
  const selectedProduct = products.find(p => p.id === selectedProductId) || null;
  const [searchTerm, setSearchTerm] = useState("");

  // SKU Verification state in the Detail / Stock Control Modal
  const [detailSkuInput, setDetailSkuInput] = useState("");

  const filteredProducts = products.filter(product => {
    const nameMatch = (product.name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const brandMatch = (product.brand || "").toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = (product.sku || "").toLowerCase().includes(searchTerm.toLowerCase());
    return nameMatch || brandMatch || skuMatch;
  });


  // Component Details Edit State
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editDetailForm, setEditDetailForm] = useState({
    name: "",
    brand: "",
    model: "",
    sku: "",
    location: "",
    minStock: "",
    description: "",
    image: "",
    imageType: "upload"
  });
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  // Sync edit form fields when a product is opened or updated in real time
  useEffect(() => {
    if (selectedProduct) {
      if (!isEditingDetail) {
        let detectedImageType = "upload";
        if (selectedProduct.image) {
          if (MOCK_ICONS.some(ic => ic.url === selectedProduct.image)) {
            detectedImageType = "icon";
          } else if (selectedProduct.image.startsWith("https://firebasestorage.googleapis.com/")) {
            detectedImageType = "upload";
          } else {
            detectedImageType = "url";
          }
        }
        setEditDetailForm({
          name: selectedProduct.name || "",
          brand: selectedProduct.brand || "",
          model: selectedProduct.model || "",
          sku: selectedProduct.sku || "",
          location: selectedProduct.location || "",
          minStock: selectedProduct.minStock !== undefined ? selectedProduct.minStock.toString() : "",
          description: selectedProduct.description || "",
          image: selectedProduct.image || "",
          imageType: detectedImageType
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
  const [reportRows, setReportRows] = useState([{ time: "08:00 AM - 09:00 AM", activity: "" }]);
  const [isReportSubmitting, setIsReportSubmitting] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);

  // Printer Cleaning State
  const [printerCleanings, setPrinterCleanings] = useState([]);
  const [isCleaningLoading, setIsCleaningLoading] = useState(true);
  const [cleaningRows, setCleaningRows] = useState([{ station: "", ip: "10.40.", printerType: "" }]);
  const [cleaningErrors, setCleaningErrors] = useState({});
  const [isCleaningSubmitting, setIsCleaningSubmitting] = useState(false);
  const [expandedCleaningId, setExpandedCleaningId] = useState(null);

  // RFID Verification State
  const [rfidVerifications, setRfidVerifications] = useState([]);
  const [isRfidLoading, setIsRfidLoading] = useState(true);
  const [rfidRows, setRfidRows] = useState(() => {
    const saved = localStorage.getItem("rfidRows");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing saved rfidRows:", e);
      }
    }
    return [{ station: "", ip: "10.40.", antennaStatus: "" }];
  });
  const [rfidErrors, setRfidErrors] = useState({});
  const [isRfidSubmitting, setIsRfidSubmitting] = useState(false);
  const [expandedRfidId, setExpandedRfidId] = useState(null);

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [userForm, setUserForm] = useState({
    name: "",
    position: "",
    shift: "Matutino",
    level: 1,
    username: "",
    password: "",
    email: ""
  });
  const [userFormError, setUserFormError] = useState("");
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    position: "",
    shift: "Matutino",
    level: 1,
    password: "",
    email: ""
  });
  const [isUserSaving, setIsUserSaving] = useState(false);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ type: "", text: "" });

  // Change Password Modal State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: ""
  });
  const [changePasswordError, setChangePasswordError] = useState("");
  const [isChangePasswordSubmitting, setIsChangePasswordSubmitting] = useState(false);

  // Refs & States for Firebase Storage file upload
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Form State: Add Component
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    model: "",
    sku: "",
    location: "",
    minStock: "",
    stock: "",
    description: "",
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

  // Theme State (Forced to light mode)
  const [theme, setTheme] = useState("light");

  // Effect to toggle Mode (always light)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("dark");
  }, []);

  const toggleTheme = () => {};

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

    // Initialize or Update Master User '1234' in Firestore users collection
    const ensureMasterUser = async () => {
      try {
        const masterDocRef = doc(db, "users", "1234");
        const masterDocSnap = await getDoc(masterDocRef);
        if (!masterDocSnap.exists()) {
          await setDoc(masterDocRef, {
            password: "9919",
            level: 3,
            name: "Usuario Maestro",
            role: "admin"
          });
          console.log("Master User '1234' initialized in Firestore users collection.");
        } else {
          // If it exists, ensure the password is updated to "9919"
          const userData = masterDocSnap.data();
          if (userData.password !== "9919") {
            await updateDoc(masterDocRef, { password: "9919" });
            console.log("Master User '1234' password updated to '9919' in Firestore.");
          }
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
      setLoginError(t.err_required_fields);
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

  // Effect to fetch printer cleanings in real-time from Firestore
  useEffect(() => {
    if (!currentUser) return;
    setIsCleaningLoading(true);
    try {
      let q = collection(db, "printer_cleaning");
      
      // Filter in query for Nivel 1 (Operador)
      if (userLevel === 1) {
        q = query(collection(db, "printer_cleaning"), where("createdBy", "==", currentUser.username));
      }
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let cleaningList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Sort by timestamp (newest first)
          cleaningList.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          
          setPrinterCleanings(cleaningList);
          setIsCleaningLoading(false);
        },
        (error) => {
          console.error("Firestore printer cleanings query error:", error);
          setIsCleaningLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup printer cleanings real-time listener:", error);
      setIsCleaningLoading(false);
    }
  }, [currentUser, userLevel]);

  // Effect to fetch RFID verifications in real-time from Firestore
  useEffect(() => {
    if (!currentUser) return;
    setIsRfidLoading(true);
    try {
      let q = collection(db, "rfid_verification");
      
      // Filter in query for Nivel 1 (Operador)
      if (userLevel === 1) {
        q = query(collection(db, "rfid_verification"), where("createdBy", "==", currentUser.username));
      }
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          let rfidList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Sort by timestamp (newest first)
          rfidList.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          
          setRfidVerifications(rfidList);
          setIsRfidLoading(false);
        },
        (error) => {
          console.error("Firestore RFID verifications query error:", error);
          setIsRfidLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup RFID verifications real-time listener:", error);
      setIsRfidLoading(false);
    }
  }, [currentUser, userLevel]);

  // Effect to fetch all users in real-time from Firestore for Nivel 3 (Admin)
  useEffect(() => {
    if (!currentUser || userLevel < 3) {
      setIsUsersLoading(false);
      return;
    }
    setIsUsersLoading(true);
    try {
      const unsubscribe = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setUsersList(list);
          setIsUsersLoading(false);
        },
        (error) => {
          console.error("Firestore users query error:", error);
          setIsUsersLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup users list real-time listener:", error);
      setIsUsersLoading(false);
    }
  }, [currentUser, userLevel]);

  // Effect to fetch notifications in real-time from Firestore
  useEffect(() => {
    if (!currentUser) {
      setIsNotificationsLoading(false);
      return;
    }
    setIsNotificationsLoading(true);
    try {
      const unsubscribe = onSnapshot(
        collection(db, "notifications"),
        (snapshot) => {
          const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          list.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          setNotifications(list);
          setIsNotificationsLoading(false);
        },
        (error) => {
          console.error("Firestore notifications query error:", error);
          setIsNotificationsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup notifications list real-time listener:", error);
      setIsNotificationsLoading(false);
    }
  }, [currentUser]);

  // Effect to close the notification popover when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Effect to sync RFID verification rows to localStorage
  useEffect(() => {
    localStorage.setItem("rfidRows", JSON.stringify(rfidRows));
  }, [rfidRows]);

  // Effect to reset SKU input when details modal opens/closes
  useEffect(() => {
    setDetailSkuInput("");
  }, [selectedProductId]);

  // Effect to auto-clean notifications older than 5 days
  useEffect(() => {
    if (!currentUser || hasCleanedUpRef.current) return;
    hasCleanedUpRef.current = true;

    const cleanOldNotifications = async () => {
      try {
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        const q = query(
          collection(db, "notifications"),
          where("timestamp", "<", fiveDaysAgo)
        );
        const querySnapshot = await getDocs(q);
        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
          deletePromises.push(deleteDoc(docSnap.ref));
        });
        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
          console.log(`Auto-cleaned ${deletePromises.length} old notifications.`);
        }
      } catch (error) {
        console.error("Error auto-cleaning notifications:", error);
      }
    };

    cleanOldNotifications();
  }, [currentUser]);

  // Handler to delete a single notification
  const handleDeleteNotification = async (notifId) => {
    try {
      await deleteDoc(doc(db, "notifications", notifId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Handler to mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => n.read !== true);
      const promises = unreadNotifs.map(n => 
        updateDoc(doc(db, "notifications", n.id), { read: true })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  // Handler to clear all notifications
  const handleClearAllNotifications = async () => {
    try {
      const promises = notifications.map(n => 
        deleteDoc(doc(db, "notifications", n.id))
      );
      await Promise.all(promises);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  // Handler to process clicks on notifications and redirect accordingly
  const handleNotificationClick = (notif) => {
    setIsNotificationsOpen(false);

    // Dynamic redirection
    if (notif.type === "reporte_diario") {
      setActiveTab("reportes");
    } else if (notif.type === "limpieza_impresora") {
      setActiveTab("limpieza");
    } else if (
      notif.type === "stock_minimo" || 
      notif.type === "nuevo_componente" || 
      notif.type?.includes("componente") || 
      notif.type?.includes("stock")
    ) {
      setActiveTab("inventario");
      
      // Try to find the item name to search it
      let itemName = notif.itemName;
      if (!itemName && notif.message) {
        // Find inside quotes e.g. "ITEM"
        const match = notif.message.match(/"([^"]+)"/);
        if (match) itemName = match[1];
      }
      if (itemName) {
        setSearchTerm(itemName);
      } else {
        setSearchTerm("");
      }
    } else if (notif.type?.includes("orden")) {
      setActiveTab("ordenes");
    } else if (notif.type === "rfid") {
      setActiveTab("rfid");
    }
  };

  // Effect to fetch movements in real-time from Firestore
  useEffect(() => {
    if (!currentUser) {
      setIsMovementsLoading(false);
      return;
    }
    setIsMovementsLoading(true);
    try {
      const unsubscribe = onSnapshot(
        collection(db, "movements"),
        (snapshot) => {
          const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          list.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
            return timeB - timeA;
          });
          setMovements(list);
          setIsMovementsLoading(false);
        },
        (error) => {
          console.error("Firestore movements query error:", error);
          setIsMovementsLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to setup movements list real-time listener:", error);
      setIsMovementsLoading(false);
    }
  }, [currentUser]);

  // Effect to protect and redirect unauthorized users from the User tab
  useEffect(() => {
    if (activeTab === "usuario" && userLevel < 3) {
      setActiveTab("inventario");
    }
  }, [activeTab, userLevel]);

  // Helper to build a clean 9-character SKU from name, brand, and model
  const buildSKUString = (name, brand, model) => {
    const getPart = (val) => {
      // Convert to uppercase, remove spaces, default to empty string
      const clean = (val || "").toUpperCase().replace(/\s+/g, "");
      // Pad with 'X' to 3 characters and slice
      return clean.padEnd(3, "X").substring(0, 3);
    };
    return getPart(name) + getPart(brand) + getPart(model);
  };

  // Generate SKU for Add Component Form
  const handleGenerateSKU = () => {
    const sku = buildSKUString(formData.name, formData.brand, formData.model);
    setFormData(prev => ({ ...prev, sku }));
    if (formErrors.sku) {
      setFormErrors(prev => ({ ...prev, sku: null }));
    }
  };

  // Generate SKU for Edit Component Form (Modal Details)
  const handleGenerateEditSKU = () => {
    const sku = buildSKUString(editDetailForm.name, editDetailForm.brand, editDetailForm.model);
    setEditDetailForm(prev => ({ ...prev, sku }));
  };

  // Add Component Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = t.err_name_req;
    if (!formData.brand.trim()) errors.brand = t.err_brand_req;
    if (!formData.model.trim()) errors.model = t.err_model_req;
    if (!formData.sku.trim() || formData.sku.trim().length !== 9) {
      errors.sku = t.err_sku_invalid;
    }
    if (!formData.location.trim()) errors.location = t.err_location_req;
    if (formData.minStock === "" || parseInt(formData.minStock) < 0) {
      errors.minStock = t.err_min_stock_invalid;
    }
    if (formData.stock === "" || parseInt(formData.stock) < 0) {
      errors.stock = t.err_stock_invalid;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle File Upload to Firebase Storage
  const handleFileUpload = (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);

    const uniqueFileName = `${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, `inventory_images/${uniqueFileName}`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / (snapshot.totalBytes || 1)) * 100);
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Código de error de Firebase Storage:", error.code);
        console.error("Mensaje completo de error:", error.message);
        alert(`Error al iniciar subida (0%): ${error.code} - Revisa la consola.`);
        setIsUploading(false);
        setUploadProgress(null);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref)
          .then((downloadURL) => {
            if (isEditingDetail) {
              setEditDetailForm((prev) => ({ ...prev, image: downloadURL }));
            } else {
              setFormData((prev) => ({ ...prev, imageUrl: downloadURL }));
            }
            setIsUploading(false);
            setUploadProgress(null);
          })
          .catch((err) => {
            console.error("Firebase Storage getDownloadURL Failed:", err);
            alert(language === "es" 
              ? `Falla al obtener la URL de la imagen: ${err.message || err}` 
              : `Failed to get download URL: ${err.message || err}`
            );
            setIsUploading(false);
            setUploadProgress(null);
          });
      }
    );
  };

  const onFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const onEditFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Helper to log inventory movements to Firestore
  const logMovement = async (itemName, type, amount, operator) => {
    try {
      const activeOperator = operator || currentUser?.username || "Sistema";
      await addDoc(collection(db, "movements"), {
        timestamp: serverTimestamp(),
        itemName: itemName,
        type: type, // "Entrada" | "Salida" | "Ajuste por Edición"
        amount: amount,
        operator: activeOperator
      });
    } catch (error) {
      console.error("Error logging movement to Firestore:", error);
    }
  };

  // Generate and download PDF report of inventory movements history
  const handleDownloadMovementsPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(32, 164, 100); // Emerald color
      doc.text("Reporte de Movimientos de Inventario - MasterInventory", 14, 20);

      // Subtitle / Metadata
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Slate-500
      const todayStr = new Date().toLocaleString("es-CL");
      doc.text(`Fecha de generación: ${todayStr}`, 14, 28);
      doc.text(`Generado por: ${currentUser?.username || "Sistema"}`, 14, 34);

      // Divider line
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.line(14, 38, 196, 38);

      // Prepare Table Data
      const tableHeaders = [["Fecha y Hora", "Artículo", "Tipo de Movimiento", "Cantidad", "Operador"]];
      const tableRows = movements.map(mov => {
        const dateStr = mov.timestamp?.toDate
          ? mov.timestamp.toDate().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
          : (mov.timestamp?.seconds ? new Date(mov.timestamp.seconds * 1000).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "N/D");
        return [
          dateStr,
          mov.itemName || "N/D",
          mov.type || "N/D",
          mov.amount !== undefined ? mov.amount : "N/D",
          mov.operator || "N/D"
        ];
      });

      autoTable(doc, {
        startY: 44,
        head: tableHeaders,
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [32, 164, 100], // Emerald-600
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50
        },
        margin: { top: 10, left: 14, right: 14 },
        styles: {
          overflow: "linebreak",
          cellPadding: 4
        }
      });

      doc.save(`Movimientos_Inventario_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("Error generating movements PDF:", error);
      alert("Error al generar el PDF del historial.");
    }
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

      const pName = formData.name.trim();
      const pStock = parseInt(formData.stock) || 0;
      const pMinStock = parseInt(formData.minStock) || 0;

      addDoc(collection(db, "items"), {
        name: pName,
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        sku: formData.sku.trim().toUpperCase(),
        location: formData.location.trim(),
        minStock: pMinStock,
        stock: pStock,
        description: formData.description.trim(),
        image: finalImageUrl,
        timestamp: serverTimestamp()
      }).then(async (docRef) => {
        await logMovement(pName, "Entrada", pStock);
        
        try {
          await addDoc(collection(db, "notifications"), {
            timestamp: serverTimestamp(),
            type: "nuevo_componente",
            message: language === "es"
              ? `Nuevo Componente Registrado: "${pName}" con ${pStock} unidades en "${formData.location.trim()}".`
              : `New Component Registered: "${pName}" with ${pStock} units in "${formData.location.trim()}".`,
            title: language === "es" ? "Componente Creado" : "Component Created",
            itemName: pName,
            read: false
          });
        } catch (err) {
          console.error("Error creating low stock notification:", err);
        }

        if (pStock <= pMinStock) {
          try {
            await addDoc(collection(db, "notifications"), {
              timestamp: serverTimestamp(),
              type: "stock_minimo",
              message: language === "es"
                ? `Alerta de Stock Mínimo: "${pName}" tiene ${pStock} unidades (mínimo requerido: ${pMinStock}).`
                : `Low Stock Alert: "${pName}" has ${pStock} units (minimum required: ${pMinStock}).`,
              title: language === "es" ? "Stock Mínimo Bajo" : "Low Stock Alert",
              itemName: pName,
              read: false
            });
          } catch (err) {
            console.error("Error creating low stock notification:", err);
          }
        }
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
        description: "",
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
    if (!orderForm.itemName.trim()) errors.itemName = t.err_item_name_req;
    if (!orderForm.itemModel.trim()) errors.itemModel = t.err_model_req;
    if (!orderForm.quantity || parseInt(orderForm.quantity) <= 0) {
      errors.quantity = t.err_qty_invalid;
    }
    if (!orderForm.cost || parseFloat(orderForm.cost) <= 0) {
      errors.cost = t.err_cost_invalid;
    }
    if (!orderForm.url.trim() || !orderForm.url.startsWith("http")) {
      errors.url = t.err_url_invalid;
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

      await addDoc(collection(db, "notifications"), {
        timestamp: serverTimestamp(),
        type: "orden_compra",
        message: language === "es"
          ? `Nueva Solicitud de Compra: "${orderForm.itemName.trim()}" (Cant: ${orderForm.quantity}) registrada por "${currentUser.username}".`
          : `New Purchase Request: "${orderForm.itemName.trim()}" (Qty: ${orderForm.quantity}) registered by "${currentUser.username}".`,
        title: language === "es" ? "Solicitud de Compra" : "Purchase Request",
        read: false
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
      "12:00 AM - 01:00 AM", "01:00 AM - 02:00 AM", "02:00 AM - 03:00 AM", "03:00 AM - 04:00 AM",
      "04:00 AM - 05:00 AM", "05:00 AM - 06:00 AM", "06:00 AM - 07:00 AM", "07:00 AM - 08:00 AM",
      "08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM",
      "12:00 PM - 01:00 PM", "01:00 PM - 02:00 PM", "02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM",
      "04:00 PM - 05:00 PM", "05:00 PM - 06:00 PM", "06:00 PM - 07:00 PM", "07:00 PM - 08:00 PM",
      "08:00 PM - 09:00 PM", "09:00 PM - 10:00 PM", "10:00 PM - 11:00 PM", "11:00 PM - 12:00 AM"
    ];
    const lastRow = reportRows[reportRows.length - 1];
    let nextTime = "08:00 AM - 09:00 AM";
    if (lastRow) {
      const lastIndex = standardBlocks.indexOf(lastRow.time);
      if (lastIndex !== -1) {
        nextTime = standardBlocks[(lastIndex + 1) % standardBlocks.length];
      }
    }
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
      alert(t.alert_min_one_activity);
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

      await addDoc(collection(db, "notifications"), {
        timestamp: serverTimestamp(),
        type: "reporte_diario",
        message: language === "es"
          ? `El operador "${currentUser.username}" ha registrado el Reporte Diario de Actividades para la fecha ${today}.`
          : `Operator "${currentUser.username}" has registered the Daily Activity Report for date ${today}.`,
        title: language === "es" ? "Reporte Diario Registrado" : "Daily Report Registered",
        read: false
      });

      setReportRows([{ time: "08:00 AM - 09:00 AM", activity: "" }]);
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
      
      const createdBy = report.createdBy || "N/A";
      const date = report.date || "N/A";
      const activities = Array.isArray(report.activities) ? report.activities : [];
      const userLevel = report.userLevel !== undefined ? report.userLevel : "N/A";

      const doc = new jsPDF();

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(14, 165, 233); // Sky-500
      doc.text("Daily Activity Report", 14, 20);

      // Subtitle
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text("MasterInventory - Warehouse System", 14, 26);

      // Divider line
      doc.setDrawColor(226, 232, 240); // Slate-200 border
      doc.line(14, 32, 196, 32);

      // Metadata Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85); // Slate-700
      doc.text("Report Details:", 14, 40);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Operator / Creator: ${createdBy}`, 14, 46);
      doc.text(`Permission Level: Level ${userLevel} (${userLevel === 2 ? "Supervisor" : "Operator"})`, 14, 52);
      doc.text(`Shift Date: ${date}`, 14, 58);

      // Table of Activities
      const tableHeaders = [["Time Block", "Activities Performed"]];
      const tableRows = activities.map(act => {
        const time = (act && act.time) ? act.time.trim() : "N/A";
        const activity = (act && act.activity) ? act.activity.trim() : "N/A";
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
      const filename = `Report_${createdBy}_${sanitizeDate}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Error detallado de jspdf:", error);
      alert(t.alert_pdf_error);
    }
  };

  // Generate and download PDF for a component's technical sheet
  const handleDownloadTechnicalSheet = (product) => {
    if (userLevel < 2) return;
    try {
      if (!product) {
        throw new Error("El producto es nulo o indefinido");
      }

      const name = product.name || "N/A";
      const brand = product.brand || "No Brand";
      const model = product.model || "No Model";
      const sku = product.sku || "No SKU";
      const location = product.location || "No Location";
      const stock = product.stock !== undefined ? product.stock : 0;
      const minStock = product.minStock !== undefined ? product.minStock : 0;

      const doc = new jsPDF();

      // Membrete / Top logo & brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(14, 165, 233); // Sky-500
      doc.text("MasterInventory", 14, 20);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text("Real-time Warehouse Management System", 14, 25);

      // Title of the document
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text("Component Technical Sheet", 14, 38);

      // Horizontal divider line
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.setLineWidth(0.5);
      doc.line(14, 43, 196, 43);

      // Organized block/table with item details
      const tableHeaders = [["Specification", "Component Detail"]];
      const tableRows = [
        ["Item Name", name],
        ["Brand", brand],
        ["Model", model],
        ["SKU (Code)", sku.toUpperCase()],
        ["Physical Location", location],
        ["Current Stock", `${stock} units`],
        ["Minimum Authorized Stock", `${minStock} units`],
        ["Stock Status", stock <= 0 ? "Out of Stock" : stock < minStock ? "Low Stock (Replenish)" : "Available"]
      ];

      autoTable(doc, {
        startY: 48,
        head: tableHeaders,
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Slate-800
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9.5,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50
        },
        margin: { left: 14, right: 14 },
        styles: {
          overflow: "linebreak",
          cellPadding: 6
        }
      });

      // Position after the table
      const finalY = doc.lastAutoTable.finalY + 15;

      // Draw a neat box for the image placeholder
      doc.setDrawColor(14, 165, 233); // Sky-500
      doc.setLineWidth(0.5);
      doc.setFillColor(248, 250, 252); // Slate-50 background for placeholder
      doc.rect(14, finalY, 182, 50, "FD"); // border and fill

      // Image placeholder text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(14, 165, 233);
      doc.text("Reference Component Image / Photo", 14 + 48, finalY + 22);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("MasterInventory - Quality Control and Traceability", 14 + 52, finalY + 30);
      
      // Footer info
      const pageHeight = doc.internal.pageSize.height;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(`Document generated on: ${new Date().toLocaleString()}`, 14, pageHeight - 10);
      doc.text("Controlled copy - External modification prohibited", 140, pageHeight - 10);

      // Save PDF
      const sanitizeName = name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      const filename = `Technical_Sheet_${sanitizeName}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Error al descargar ficha técnica:", error);
      alert(t.alert_pdf_tech_error);
    }
  };

  // Validate IPv4 Address starting with 10.40.
  const isValidIP = (ip) => {
    const ipPattern = /^10\.40\.\d{1,3}\.\d{1,3}$/;
    if (!ipPattern.test(ip)) return false;
    const parts = ip.split(".");
    const octet3 = parseInt(parts[2], 10);
    const octet4 = parseInt(parts[3], 10);
    return octet3 >= 0 && octet3 <= 255 && octet4 >= 0 && octet4 <= 255;
  };

  // Validate RFID Lector IP Address (starting with 10.40. and last two octets between 0 and 255)
  const isValidRfidIP = (ip) => {
    const rfidIpPattern = /^10\.40\.(?:25[0-5]|2[0-4]\d|[0-1]?\d{1,2})\.(?:25[0-5]|2[0-4]\d|[0-1]?\d{1,2})$/;
    return rfidIpPattern.test(ip);
  };

  // Check if an RFID status corresponds to 'Bueno' or 'Óptimo' (case insensitive)
  const isStatusBueno = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes("buen") || s.includes("optim") || s === "bueno";
  };

  // Restrict IP Address editing to maintain 10.40. prefix and allow only numbers and dots for a specific row
  const handleIPChangeForRow = (index, val) => {
    const updated = [...cleaningRows];
    if (!val.startsWith("10.40.")) {
      updated[index].ip = "10.40.";
    } else {
      const suffix = val.substring(6);
      const cleanSuffix = suffix.replace(/[^0-9.]/g, "");
      updated[index].ip = "10.40." + cleanSuffix;
    }
    setCleaningRows(updated);
  };

  // Add a new empty row to the cleaning list
  const handleAddCleaningRow = () => {
    setCleaningRows([...cleaningRows, { station: "", ip: "10.40.", printerType: "" }]);
  };

  // Remove a row from the cleaning list
  const handleRemoveCleaningRow = (index) => {
    if (cleaningRows.length > 1) {
      const updated = cleaningRows.filter((_, i) => i !== index);
      setCleaningRows(updated);
      
      const updatedErrors = { ...cleaningErrors };
      delete updatedErrors[index];
      setCleaningErrors(updatedErrors);
    }
  };

  // Submit printer cleaning form rows to Firestore
  const handleSubmitCleaning = async (e) => {
    e.preventDefault();
    if (userLevel >= 3) return;
    setAlertMessage({ type: "", text: "" });

    const errors = {};
    let hasErrors = false;

    cleaningRows.forEach((row, index) => {
      const station = row.station.trim();
      const ip = row.ip.trim();
      const printerType = row.printerType.trim();
      const rowErrors = {};

      if (!station) {
        rowErrors.station = t.err_station_req;
      } else if (station.length > 3) {
        rowErrors.station = t.err_station_max;
      }

      if (!ip) {
        rowErrors.ip = t.err_ip_req;
      } else if (!isValidIP(ip)) {
        rowErrors.ip = t.err_ip_invalid;
      }

      if (!printerType) {
        rowErrors.printerType = t.err_printer_model_req;
      }

      if (Object.keys(rowErrors).length > 0) {
        errors[index] = rowErrors;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setCleaningErrors(errors);
      return;
    }

    setCleaningErrors({});
    setIsCleaningSubmitting(true);
    try {
      const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
      
      const printersData = cleaningRows.map(row => ({
        station: row.station.trim(),
        ip: row.ip.trim(),
        printerType: row.printerType.trim()
      }));

      await addDoc(collection(db, "printer_cleaning"), {
        printers: printersData,
        createdBy: currentUser.username,
        userLevel: userLevel,
        date: today,
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, "notifications"), {
        timestamp: serverTimestamp(),
        type: "limpieza_impresora",
        message: language === "es"
          ? `El operador "${currentUser.username}" ha registrado un servicio de Limpieza de Impresora para ${printersData.length} equipo(s).`
          : `Operator "${currentUser.username}" has registered a Printer Cleaning service for ${printersData.length} equipment(s).`,
        title: language === "es" ? "Limpieza de Impresora" : "Printer Cleaning Registered",
        read: false
      });

      setCleaningRows([{ station: "", ip: "10.40.", printerType: "" }]);
      setAlertMessage({ type: "success", text: "¡Servicio(s) de limpieza registrado(s) exitosamente!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error submitting cleaning registry:", error);
      setAlertMessage({ type: "error", text: "Error al registrar la limpieza." });
    } finally {
      setIsCleaningSubmitting(false);
    }
  };

  // Generate and download PDF for printer cleaning service sheet
  const handleDownloadCleaningPDF = (record) => {
    try {
      if (!record) {
        throw new Error("El registro es nulo o indefinido");
      }

      const createdBy = record.createdBy || "N/A";
      const date = record.date || "N/A";
      const recordUserLevel = record.userLevel !== undefined ? record.userLevel : "N/A";
      
      const printers = record.printers || (record.station ? [{
        station: record.station,
        ip: record.ip,
        printerType: record.printerType
      }] : []);

      const doc = new jsPDF();

      // Membrete / Top logo & brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(14, 165, 233); // Sky-500
      doc.text("MasterInventory", 14, 20);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text("Warehouse Maintenance and Quality System", 14, 25);

      // Title of the document
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text("Printer Cleaning Consolidated Report", 14, 38);

      // Subtitle with Metadata
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(`Technician: ${createdBy} (Level ${recordUserLevel})`, 14, 46);
      doc.text(`Report Date: ${date}`, 140, 46);

      // Horizontal divider line
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.setLineWidth(0.5);
      doc.line(14, 50, 196, 50);

      // Organized table with item details
      const tableHeaders = [["Station", "IP Address", "Printer Type"]];
      const tableRows = printers.map(pr => [
        pr.station || "N/A",
        pr.ip || "N/A",
        pr.printerType || "N/A"
      ]);

      autoTable(doc, {
        startY: 55,
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
          fontSize: 9.5,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50
        },
        margin: { left: 14, right: 14 },
        styles: {
          overflow: "linebreak",
          cellPadding: 6
        }
      });

      // Signature/Authorization section
      const finalY = doc.lastAutoTable.finalY + 30;

      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.line(14, finalY, 80, finalY);
      doc.line(130, finalY, 196, finalY);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Technician Signature", 14 + 16, finalY + 5);
      doc.text("Supervisor / Quality Signature", 130 + 10, finalY + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(createdBy, 14 + 20, finalY + 10);
      doc.text("MasterInventory QC", 130 + 20, finalY + 10);

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(`Document generated on: ${new Date().toLocaleString()}`, 14, pageHeight - 10);
      doc.text("Official maintenance record - Confidential", 130, pageHeight - 10);

      // Save PDF
      const filename = `Cleaning_Report_${createdBy}_${date.replace(/\//g, "-")}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Error al descargar PDF de limpieza:", error);
      alert(t.alert_pdf_cleaning_error);
    }
  };

  // Restrict RFID IP Address editing to maintain 10.40. prefix and allow only numbers and dots for a specific row
  const handleRfidIPChangeForRow = (index, val) => {
    const updated = [...rfidRows];
    if (!val.startsWith("10.40.")) {
      updated[index].ip = "10.40.";
    } else {
      const suffix = val.substring(6);
      const cleanSuffix = suffix.replace(/[^0-9.]/g, "");
      updated[index].ip = "10.40." + cleanSuffix;
    }
    setRfidRows(updated);
  };

  // Add a new empty row to the RFID verification list
  const handleAddRfidRow = () => {
    setRfidRows([...rfidRows, { station: "", ip: "10.40.", antennaStatus: "" }]);
  };

  // Remove a row from the RFID verification list
  const handleRemoveRfidRow = (index) => {
    if (rfidRows.length > 1) {
      const updated = rfidRows.filter((_, i) => i !== index);
      setRfidRows(updated);
      
      const updatedErrors = { ...rfidErrors };
      delete updatedErrors[index];
      setRfidErrors(updatedErrors);
    }
  };

  // Submit RFID verification form rows to Firestore
  const handleSubmitRfid = async (e) => {
    e.preventDefault();
    if (userLevel >= 3) return;
    setAlertMessage({ type: "", text: "" });

    const errors = {};
    let hasErrors = false;

    rfidRows.forEach((row, index) => {
      const station = row.station.trim();
      const ip = row.ip.trim();
      const antennaStatus = row.antennaStatus.trim();
      const rowErrors = {};

      if (!station) {
        rowErrors.station = t.err_station_req;
      } else if (station.length > 3) {
        rowErrors.station = t.err_station_max;
      }

      if (!ip) {
        rowErrors.ip = t.err_ip_req;
      } else if (!isValidRfidIP(ip)) {
        rowErrors.ip = t.err_ip_invalid_rfid;
      }

      if (!antennaStatus) {
        rowErrors.antennaStatus = t.err_antenna_status_req;
      }

      if (Object.keys(rowErrors).length > 0) {
        errors[index] = rowErrors;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setRfidErrors(errors);
      return;
    }

    setRfidErrors({});
    setIsRfidSubmitting(true);
    try {
      const today = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
      
      const stationsData = rfidRows.map(row => ({
        estacion: row.station.trim(),
        ip: row.ip.trim(),
        estado: row.antennaStatus.toLowerCase().trim()
      }));

      await addDoc(collection(db, "rfid_verification"), {
        stations: stationsData,
        createdBy: currentUser.username,
        userLevel: userLevel,
        date: today,
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, "notifications"), {
        timestamp: serverTimestamp(),
        type: "rfid",
        message: language === "es"
          ? `El operador "${currentUser.username}" ha registrado la Verificación de RFID para ${stationsData.length} estación(es).`
          : `Operator "${currentUser.username}" has registered the RFID Verification for ${stationsData.length} station(s).`,
        title: language === "es" ? "Verificación RFID" : "RFID Verification",
        read: false
      });

      setAlertMessage({ type: "success", text: "¡Verificación(es) de RFID registrada(s) exitosamente!" });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error submitting RFID verification:", error);
      setAlertMessage({ type: "error", text: "Error al registrar la verificación de RFID." });
    } finally {
      setIsRfidSubmitting(false);
    }
  };

  // Create a new technical user in Firestore
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (userLevel < 3) return;
    setUserFormError("");
    setAlertMessage({ type: "", text: "" });

    const name = userForm.name.trim();
    const position = userForm.position.trim();
    const shift = userForm.shift;
    const level = Number(userForm.level);
    const username = userForm.username.trim().toLowerCase();
    const password = userForm.password;
    const email = userForm.email.trim();

    if (!name || !position || !shift || !level || !username || !password) {
      setUserFormError(t.err_asterisk_fields);
      return;
    }

    setIsUserSubmitting(true);
    try {
      // Check if user already exists
      const userDocRef = doc(db, "users", username);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setUserFormError(
          language === "es"
            ? `El Usuario / ID "${username}" ya está registrado en el sistema.`
            : `Username / ID "${username}" is already registered in the system.`
        );
        setIsUserSubmitting(false);
        return;
      }

      // Determine default role based on level
      const role = level === 3 ? "admin" : level === 2 ? "supervisor" : "operator";

      await setDoc(userDocRef, {
        name,
        position,
        shift,
        level,
        password,
        role,
        email
      });

      setUserForm({
        name: "",
        position: "",
        shift: "Matutino",
        level: 1,
        username: "",
        password: "",
        email: ""
      });

      setAlertMessage({
        type: "success",
        text: language === "es" ? "¡Usuario creado exitosamente!" : "User created successfully!"
      });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error creating user:", error);
      setUserFormError(
        language === "es"
          ? "Error al registrar el nuevo usuario en Firestore."
          : "Error registering new user in Firestore."
      );
    } finally {
      setIsUserSubmitting(false);
    }
  };

  // Open Edit User dialog modal
  const handleEditUserClick = (user) => {
    setEditingUser(user);
    setEditUserForm({
      name: user.name || "",
      position: user.position || "",
      shift: user.shift || "Matutino",
      level: user.level || 1,
      password: user.password || "",
      email: user.email || ""
    });
  };

  // Save changes to edited user in Firestore
  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (userLevel < 3 || !editingUser) return;
    setIsUserSaving(true);
    try {
      const userDocRef = doc(db, "users", editingUser.id);
      const levelNum = Number(editUserForm.level);
      const role = levelNum === 3 ? "admin" : levelNum === 2 ? "supervisor" : "operator";

      await updateDoc(userDocRef, {
        name: editUserForm.name.trim(),
        position: editUserForm.position.trim(),
        shift: editUserForm.shift,
        level: levelNum,
        password: editUserForm.password,
        role: role,
        email: (editUserForm.email || "").trim()
      });

      setEditingUser(null);
      setAlertMessage({
        type: "success",
        text: language === "es" ? "¡Usuario actualizado correctamente!" : "User updated successfully!"
      });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error updating user:", error);
      alert(t.alert_user_save_error);
    } finally {
      setIsUserSaving(false);
    }
  };

  // Delete user from Firestore
  // Send Password Reset Email via Firebase Auth
  const handleSendPasswordReset = async (user) => {
    let email = user.email || "";
    if (!email) {
      if (user.id.includes("@")) {
        email = user.id;
      } else {
        const inputEmail = prompt(
          language === "es"
            ? `El usuario "${user.name}" no tiene un correo electrónico registrado. Por favor, introduce su correo para enviar el restablecimiento:`
            : `User "${user.name}" does not have a registered email. Please enter their email to send the reset link:`
        );
        if (!inputEmail) return;
        email = inputEmail.trim();
        
        try {
          await updateDoc(doc(db, "users", user.id), { email });
        } catch (err) {
          console.error("Error saving user email:", err);
        }
      }
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert(
        language === "es"
          ? `Se ha enviado con éxito el correo de restablecimiento de contraseña a: ${email}`
          : `Password reset email successfully sent to: ${email}`
      );
      
      await addDoc(collection(db, "notifications"), {
        timestamp: serverTimestamp(),
        type: "seguridad",
        message: language === "es"
          ? `Solicitud de restablecimiento de contraseña enviada para el usuario "${user.name}" al correo ${email}.`
          : `Password reset link sent for user "${user.name}" to email ${email}.`,
        title: language === "es" ? "Restablecimiento de Contraseña" : "Password Reset",
        read: false
      });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      alert(
        language === "es"
          ? `Error al enviar el correo de restablecimiento: ${error.message}`
          : `Failed to send reset email: ${error.message}`
      );
    }
  };

  // Change Password for Logged-In User
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangePasswordError("");
    const { currentPassword, newPassword, confirmNewPassword } = changePasswordForm;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setChangePasswordError(language === "es" ? "Todos los campos son obligatorios." : "All fields are required.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangePasswordError(language === "es" ? "Las nuevas contraseñas no coinciden." : "New passwords do not match.");
      return;
    }

    const username = currentUser.username;
    setIsChangePasswordSubmitting(true);

    try {
      const userDocRef = doc(db, "users", username);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.password !== currentPassword) {
          setChangePasswordError(language === "es" ? "La contraseña actual es incorrecta." : "Current password is incorrect.");
          setIsChangePasswordSubmitting(false);
          return;
        }

        await updateDoc(userDocRef, { password: newPassword });

        alert(language === "es" ? "¡Contraseña cambiada exitosamente!" : "Password changed successfully!");
        setIsChangePasswordOpen(false);
        setChangePasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
        
        await addDoc(collection(db, "notifications"), {
          timestamp: serverTimestamp(),
          type: "seguridad",
          message: language === "es"
            ? `El usuario "${userDisplayName}" ha actualizado su contraseña de acceso.`
            : `User "${userDisplayName}" has updated their access password.`,
          title: language === "es" ? "Contraseña Actualizada" : "Password Updated",
          read: false
        });
      } else {
        setChangePasswordError(language === "es" ? "Error: Documento de usuario no encontrado." : "Error: User document not found.");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setChangePasswordError(language === "es" ? "Error al guardar en el servidor." : "Error saving to server.");
    } finally {
      setIsChangePasswordSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (userLevel < 3) return;
    
    // Safety check: Prevent deleting self
    if (user.id === currentUser.username) {
      alert(t.alert_cannot_delete_self);
      return;
    }

    // Safety check: Prevent deleting master user '1234'
    if (user.id === "1234") {
      alert(t.alert_master_protected);
      return;
    }

    const confirmDelete = window.confirm(
      language === "es"
        ? `¿Está completamente seguro de que desea eliminar al asociado "${user.name}" (${user.id})?\nEsta acción es irreversible y revocará su acceso de inmediato.`
        : `Are you completely sure you want to delete associate "${user.name}" (${user.id})?\nThis action is irreversible and will revoke access immediately.`
    );

    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "users", user.id));
        setAlertMessage({
          type: "success",
          text: language === "es" ? "Usuario eliminado del sistema correctamente." : "User successfully deleted from the system."
        });
        setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
      } catch (error) {
        console.error("Error deleting user:", error);
        alert(t.alert_user_delete_error);
      }
    }
  };

  // Delete printer cleaning document from Firestore (strictly Level 3)
  const handleDeleteCleaning = async (id) => {
    if (userLevel < 3) {
      alert(t.alert_insufficient_permissions);
      return;
    }
    const confirmDelete = window.confirm(t.confirm_delete_report);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "printer_cleaning", id));
      setAlertMessage({
        type: "success",
        text: language === "es" ? "Reporte de limpieza eliminado permanentemente." : "Printer cleaning report permanently deleted."
      });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error deleting cleaning report:", error);
      alert(t.alert_cleaning_delete_error);
    }
  };

  // Delete RFID verification document from Firestore (strictly Level 3)
  const handleDeleteRfid = async (id) => {
    if (userLevel < 3) {
      alert(t.alert_insufficient_permissions);
      return;
    }
    const confirmDelete = window.confirm(t.confirm_delete_report);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "rfid_verification", id));
      setAlertMessage({
        type: "success",
        text: language === "es" ? "Reporte de RFID eliminado permanentemente." : "RFID verification report permanently deleted."
      });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error deleting RFID report:", error);
      alert(t.alert_rfid_delete_error);
    }
  };

  // Delete daily report document from Firestore (strictly Level 3)
  const handleDeleteDailyReport = async (id) => {
    if (userLevel < 3) {
      alert(t.alert_insufficient_permissions);
      return;
    }
    const confirmDelete = window.confirm(t.confirm_delete_report);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "daily_reports", id));
      setAlertMessage({
        type: "success",
        text: language === "es" ? "Reporte de actividad eliminado permanentemente." : "Daily activity report permanently deleted."
      });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error deleting daily report:", error);
      alert(t.alert_report_delete_error);
    }
  };

  // Delete purchase order document from Firestore (strictly Level 3)
  const handleDeleteOrder = async (id) => {
    if (userLevel < 3) {
      alert(t.alert_insufficient_permissions);
      return;
    }
    const confirmDelete = window.confirm(t.confirm_delete_report);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "orders", id));
      setAlertMessage({
        type: "success",
        text: language === "es" ? "Pedido eliminado permanentemente." : "Purchase order permanently deleted."
      });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error deleting order:", error);
      alert(t.alert_order_delete_error);
    }
  };

  // Generate and download PDF for RFID verification service sheet
  const handleDownloadRfidPDF = (record) => {
    try {
      if (!record) {
        throw new Error("El registro es nulo o indefinido");
      }

      const createdBy = record.createdBy || "N/A";
      const date = record.date || "N/A";
      const recordUserLevel = record.userLevel !== undefined ? record.userLevel : "N/A";
      const stations = record.stations || (record.station ? [{
        estacion: record.station,
        ip: record.ip,
        estado: record.antennaStatus
      }] : []);

      const doc = new jsPDF();

      // Membrete / Top logo & brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(14, 165, 233); // Sky-500
      doc.text("MasterInventory", 14, 20);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text("Warehouse Maintenance and Quality System", 14, 25);

      // Title of the document
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text("RFID Verification Consolidated Report", 14, 38);

      // Subtitle with Metadata
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(`Technician: ${createdBy} (Level ${recordUserLevel})`, 14, 46);
      doc.text(`Report Date: ${date}`, 140, 46);

      // Horizontal divider line
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.setLineWidth(0.5);
      doc.line(14, 50, 196, 50);

      // Organized table with item details
      const tableHeaders = [["Station", "Reader IP Address", "Antennas Status"]];
      const tableRows = stations.map(st => {
        const stationVal = st.estacion || st.station || "N/A";
        const ipVal = st.ip || "N/A";
        const statusVal = st.estado || st.antennaStatus || "";
        const isBueno = isStatusBueno(statusVal);
        return [
          stationVal,
          ipVal,
          isBueno ? "Good (✔)" : "Fail (❌)"
        ];
      });

      autoTable(doc, {
        startY: 55,
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
          fontSize: 9.5,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate-50
        },
        margin: { left: 14, right: 14 },
        styles: {
          overflow: "linebreak",
          cellPadding: 6
        }
      });

      // Signature/Authorization section
      const finalY = doc.lastAutoTable.finalY + 30;

      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.line(14, finalY, 80, finalY);
      doc.line(130, finalY, 196, finalY);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Technician Signature", 14 + 16, finalY + 5);
      doc.text("Supervisor / Quality Signature", 130 + 10, finalY + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(createdBy, 14 + 20, finalY + 10);
      doc.text("MasterInventory QC", 130 + 20, finalY + 10);

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(`Document generated on: ${new Date().toLocaleString()}`, 14, pageHeight - 10);
      doc.text("Official verification record - Confidential", 130, pageHeight - 10);

      // Save PDF
      const sanitizeUser = createdBy.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      const filename = `RFID_Verification_${sanitizeUser}_${date.replace(/\//g, "-")}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Error al descargar PDF de RFID:", error);
      alert(t.alert_pdf_rfid_error);
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
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await addDoc(collection(db, "notifications"), {
          timestamp: serverTimestamp(),
          type: "orden_aprobada",
          message: language === "es"
            ? `Pedido Aprobado: "${order.itemName}" (${order.quantity} uds.) aprobado por "${currentUser.username}".`
            : `Order Approved: "${order.itemName}" (${order.quantity} pcs.) approved by "${currentUser.username}".`,
          title: language === "es" ? "Pedido Aprobado" : "Order Approved",
          read: false
        });
      }
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
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await addDoc(collection(db, "notifications"), {
          timestamp: serverTimestamp(),
          type: "orden_rechazada",
          message: language === "es"
            ? `Pedido Rechazado: "${order.itemName}" (${order.quantity} uds.) rechazado por "${currentUser.username}".`
            : `Order Rejected: "${order.itemName}" (${order.quantity} pcs.) rejected by "${currentUser.username}".`,
          title: language === "es" ? "Pedido Rechazado" : "Order Rejected",
          read: false
        });
      }
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
      const order = orders.find(o => o.id === orderId);
      if (order) {
        await addDoc(collection(db, "notifications"), {
          timestamp: serverTimestamp(),
          type: "orden_recibida",
          message: language === "es"
            ? `Pedido Recibido: "${order.itemName}" (${order.quantity} uds.) recibido por "${currentUser.username}".`
            : `Order Received: "${order.itemName}" (${order.quantity} pcs.) received by "${currentUser.username}".`,
          title: language === "es" ? "Pedido Recibido" : "Order Received",
          read: false
        });
      }
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
      const product = products.find(p => p.id === productId);
      if (product) {
        await logMovement(product.name, "Salida", product.stock || 0);
        await addDoc(collection(db, "notifications"), {
          timestamp: serverTimestamp(),
          type: "eliminacion_componente",
          message: language === "es"
            ? `Componente Eliminado: "${product.name}" eliminado por "${currentUser.username}".`
            : `Component Deleted: "${product.name}" deleted by "${currentUser.username}".`,
          title: language === "es" ? "Componente Eliminado" : "Component Deleted",
          read: false
        });
      }
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
      const product = products.find(p => p.id === productId);
      if (product) {
        const type = amount > 0 ? "Entrada" : "Salida";
        const newStock = Math.max(0, currentStock + amount);
        const minStock = product.minStock || 0;
        
        await logMovement(product.name, type, Math.abs(amount));

        await addDoc(collection(db, "notifications"), {
          timestamp: serverTimestamp(),
          type: type === "Entrada" ? "entrada_stock" : "salida_stock",
          message: language === "es"
            ? `Ajuste de Stock: ${type} de ${Math.abs(amount)} unidades en "${product.name}" por "${currentUser.username || "Sistema"}".`
            : `Stock Adjustment: ${type} of ${Math.abs(amount)} units in "${product.name}" by "${currentUser.username || "System"}".`,
          title: language === "es" ? `Movimiento (${type})` : `Movement (${type})`,
          itemName: product.name,
          read: false
        });

        if (newStock <= minStock) {
          try {
            await addDoc(collection(db, "notifications"), {
              timestamp: serverTimestamp(),
              type: "stock_minimo",
              message: language === "es"
                ? `Alerta de Stock Mínimo: "${product.name}" tiene ${newStock} unidades (mínimo requerido: ${minStock}).`
                : `Low Stock Alert: "${product.name}" has ${newStock} units (minimum required: ${minStock}).`,
              title: language === "es" ? "Stock Mínimo Bajo" : "Low Stock Alert",
              itemName: product.name,
              read: false
            });
          } catch (err) {
            console.error("Error creating low stock notification:", err);
          }
        }
      }

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
      alert(t.err_asterisk_fields);
      return;
    }
    if (editDetailForm.sku.trim().length !== 9) {
      alert(t.alert_sku_length);
      return;
    }
    if (editDetailForm.minStock === "" || parseInt(editDetailForm.minStock) < 0) {
      alert(t.alert_min_stock_val);
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
        location: editDetailForm.location.trim(),
        minStock: parseInt(editDetailForm.minStock) || 0,
        description: (editDetailForm.description || "").trim(),
        image: (editDetailForm.image || "").trim()
      });
      await logMovement(editDetailForm.name.trim(), "Ajuste por Edición", 0);

      await addDoc(collection(db, "notifications"), {
        timestamp: serverTimestamp(),
        type: "edicion_componente",
        message: language === "es"
          ? `Componente Modificado: "${editDetailForm.name.trim()}" editado por "${currentUser.username}".`
          : `Component Modified: "${editDetailForm.name.trim()}" edited by "${currentUser.username}".`,
        title: language === "es" ? "Componente Modificado" : "Component Modified",
        itemName: editDetailForm.name.trim(),
        read: false
      });

      setIsEditingDetail(false);
      setAlertMessage({
        type: "success",
        text: language === "es" ? "¡Componente actualizado correctamente!" : "Component updated successfully!"
      });
      setTimeout(() => setAlertMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error updating product details:", error);
      alert(t.alert_firestore_save_error);
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


  if (isAuthChecking) {
    return (
      <div 
        className="min-h-screen w-screen flex items-center justify-center p-3 sm:p-6 transition-all duration-500 relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 overflow-hidden"
      >
        <div className="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/10 -top-40 -left-40 blur-3xl pointer-events-none" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-lime-400/5 -bottom-40 -right-40 blur-3xl pointer-events-none" />
        
        <div className="glass-card rounded-[2rem] p-8 shadow-lg border border-emerald-850 bg-white/95 dark:bg-slate-900/95 z-10 flex flex-col items-center justify-center max-w-sm w-full text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">{t.verifying_session}</h2>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div 
        className="min-h-screen w-screen flex items-center justify-center p-3 sm:p-6 transition-all duration-500 relative animate-fade-in bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 overflow-hidden"
      >
        {/* Decorative Liquid Shapes */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/10 -top-40 -left-40 blur-3xl pointer-events-none" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-lime-400/5 -bottom-40 -right-40 blur-3xl pointer-events-none" />
        
        {/* Controls in top-right corner of login screen */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Language Selector */}
          <button
            onClick={() => {
              const nextLang = language === "es" ? "en" : "es";
              setLanguage(nextLang);
              localStorage.setItem("app_language", nextLang);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 select-none cursor-pointer transition-all duration-200 shadow-sm"
            title={language === "es" ? "Switch to English" : "Cambiar a Español"}
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{language === "es" ? "ES" : "EN"}</span>
          </button>
        </div>

        <div className="w-full max-w-md glass-container rounded-[2rem] p-8 sm:p-10 shadow-xl relative z-10 animate-scale-in border border-emerald-800 bg-white/95 dark:bg-slate-900/95">
          {/* Logo Area */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-inner">
              <Boxes className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white mt-4 tracking-tight font-serif-premium">
              {language === "es" ? "Inventario Real-time" : "Real-time Inventory"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">{t.login_description}</p>
          </div>

          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-2">
            {t.login_title}
          </h2>

          {loginError && (
            <div className="mb-4 p-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1">
                {t.username_or_id}
              </label>
              <div className="relative">
                <Boxes className="absolute left-4 top-3.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={language === "es" ? "ej. operador" : "e.g. operador"}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  disabled={isLoggingIn}
                  className="w-full py-3 rounded-full text-xs glass-input font-bold"
                  style={{ paddingLeft: '44px', paddingRight: '40px' }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1">
                {t.password}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={isLoggingIn}
                  className="w-full py-3 rounded-full text-xs glass-input font-bold"
                  style={{ paddingLeft: '44px', paddingRight: '40px' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-600 to-lime-500 hover:from-emerald-700 hover:to-lime-600 text-white font-black text-xs shadow-lg shadow-emerald-500/20 hover-scale flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50 cursor-pointer border-none"
            >
              {isLoggingIn ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>{isLoggingIn ? t.authenticating : t.enter_btn}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => n.read !== true).length;

  const userProfile = usersList.find(u => u.id === currentUser?.username);
  const userShift = userProfile?.shift || "Mixto";
  const userDisplayName = userProfile?.name || (currentUser?.username === "1234" ? "Usuario Maestro" : currentUser?.username || "Usuario");
  const userPosition = userProfile?.position || (currentUser?.username === "1234" ? "Superusuario" : "Operario");

  return (
    <div 
      className="min-h-screen w-screen flex transition-all duration-500 relative bg-slate-50 dark:bg-slate-950"
    >


      {/* Flat Main Dashboard Container */}
      <div className="w-full h-screen flex relative z-10 transition-all duration-300 dashboard-root overflow-hidden">
        
        {/* LEFT FIXED SIDEBAR */}
        <div className="w-64 sm:w-72 glass-sidebar flex flex-col p-6 justify-between shrink-0 select-none border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-col gap-6 flex-1 min-h-0">
            {/* Logo Area */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </div>
              <span className="text-xl font-bold font-serif-premium text-slate-900 dark:text-white tracking-tight">
                MasterInventory
              </span>
            </div>

            {/* Navigation Tabs (Dynamic modular configuration) */}
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 scroll-glass">
              {TABS_CONFIG.filter(tab => tab.id !== "usuario" || userLevel >= 3).map((tab) => {
                const IconComponent = ICON_COMPONENTS[tab.iconName] || Boxes;
                const tabTitle = t[`tab_${tab.id}_title`] || tab.title;
                const tabShort = t[`tab_${tab.id}_short`] || tab.shortTitle;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setAlertMessage({ type: "", text: "" });
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-full transition-all duration-200 cursor-pointer text-left ${
                      isActive
                        ? getThemeActiveTabClass(visualTheme)
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    title={tabTitle}
                  >
                    <IconComponent className="w-4.5 h-4.5 shrink-0" />
                    <span className="truncate font-serif-premium font-semibold text-[13px]">{tabShort}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Controls Panel */}
          <div className="flex flex-col gap-4 mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
            {/* User Profile Card */}
            <div className="p-3 bg-gradient-to-br from-emerald-950 to-emerald-800 text-white rounded-2xl border border-emerald-800/40 flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-white/10 text-white border border-white/20 flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser?.username === "1234" ? "UM" : (currentUser?.username || "U").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-extrabold text-white truncate">
                    {userDisplayName}
                  </span>
                  <span className="text-[9px] text-emerald-100 font-bold leading-tight">
                    {userPosition}
                  </span>
                  <span className="text-[9px] text-emerald-200 font-semibold leading-tight">
                    Nivel {userLevel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setChangePasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
                    setChangePasswordError("");
                    setIsChangePasswordOpen(true);
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white hover:text-emerald-300 transition-colors duration-200 cursor-pointer border border-transparent"
                  title={language === "es" ? "Cambiar contraseña" : "Change password"}
                >
                  <Settings className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={handleLogout}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-white hover:text-red-400 transition-colors duration-200 cursor-pointer border border-transparent"
                  title={t.logout}
                >
                  <LogOut className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => {
                const nextLang = language === "es" ? "en" : "es";
                setLanguage(nextLang);
                localStorage.setItem("app_language", nextLang);
              }}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold border border-slate-200 dark:border-slate-700 select-none cursor-pointer transition-colors duration-200 shadow-sm"
            >
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>{language === "es" ? "Switch to English" : "Cambiar a Español"}</span>
            </button>
          </div>
        </div>

        {/* RIGHT WORKSPACE */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#064e3b] to-[#4ade80] p-6 sm:p-8 relative">
          
          {/* Decorative Fluid Shapes */}
          <div className="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/10 -top-40 -left-40 blur-3xl pointer-events-none" />
          <div className="absolute w-[600px] h-[600px] rounded-full bg-lime-400/5 -bottom-40 -right-40 blur-3xl pointer-events-none" />
          
          {/* Greeting Banner */}
          <div className="glass-card rounded-[2rem] px-6 py-4 flex items-center justify-between mb-6 shrink-0 border border-emerald-700/35 bg-white/95 shadow-lg relative z-30 text-slate-800">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-base font-extrabold text-emerald-900">
                  {language === "es" ? `Hola, ${userDisplayName}` : `Hello, ${userDisplayName}`}
                </h2>
                <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                  {language === "es" 
                    ? `Turno: ${userShift} | Acceso: Nivel ${userLevel}`
                    : `Shift: ${userShift} | Access: Level ${userLevel}`}
                </p>
              </div>

              {/* Campana de Notificaciones Flotante */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => {
                    setIsNotificationsOpen(!isNotificationsOpen);
                    // Mark all as read when opening
                    if (!isNotificationsOpen) {
                      handleMarkAllAsRead();
                    }
                  }}
                  className="p-2 rounded-full hover:bg-emerald-50 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-300 relative focus:outline-none transition-colors duration-200 cursor-pointer border-none bg-transparent"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white animate-pulse" />
                  )}
                </button>

                {isNotificationsOpen && (
                  <div 
                    className="absolute left-0 top-full mt-2 w-80 sm:w-96 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in"
                    style={{ zIndex: 9999 }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                        {language === "es" ? "Notificaciones" : "Notifications"}
                      </span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-extrabold cursor-pointer border-none bg-transparent"
                          >
                            {language === "es" ? "Leer todas" : "Read all"}
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={handleClearAllNotifications}
                            className="text-[10px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-extrabold cursor-pointer border-none bg-transparent"
                          >
                            {language === "es" ? "Borrar todas" : "Clear all"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* List */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                      {isNotificationsLoading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mb-1.5" />
                          <span className="text-[10px] text-slate-400 font-bold">{t.loading_database}</span>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                          <Bell className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-1.5" />
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === "es" ? "No hay notificaciones" : "No notifications"}
                          </p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {language === "es" 
                              ? "Las alertas y cambios se mostrarán aquí en tiempo real."
                              : "Alerts and changes will be shown here in real time."}
                          </p>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const dateStr = notif.timestamp?.toDate
                            ? notif.timestamp.toDate().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
                            : (notif.timestamp?.seconds ? new Date(notif.timestamp.seconds * 1000).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "N/D");

                          let badgeColor = "bg-sky-500/10 text-sky-600 border-sky-500/20";
                          if (notif.type === "stock_minimo") {
                            badgeColor = "bg-rose-500/10 text-rose-600 border-rose-500/20";
                          } else if (notif.type === "limpieza_impresora") {
                            badgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                          } else if (notif.type === "reporte_diario") {
                            badgeColor = "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
                          } else if (notif.type === "rfid") {
                            badgeColor = "bg-violet-500/10 text-violet-600 border-violet-500/20";
                          } else if (notif.type?.includes("orden")) {
                            badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                          } else if (notif.type?.includes("componente")) {
                            badgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                          } else if (notif.type?.includes("stock")) {
                            badgeColor = "bg-teal-500/10 text-teal-600 border-teal-500/20";
                          }

                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-3 flex items-start gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-150 relative group cursor-pointer ${
                                notif.read !== true ? "bg-emerald-50/20 dark:bg-emerald-950/10" : ""
                              }`}
                            >
                              <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border uppercase shrink-0 mt-0.5 ${badgeColor}`}>
                                {notif.type ? notif.type.replace("_", " ") : "Alerta"}
                              </span>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 truncate">
                                    {notif.title || "Notificación"}
                                  </h4>
                                  <span className="text-[8px] text-slate-400 shrink-0 font-mono font-semibold">
                                    {dateStr}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug break-words">
                                  {notif.message}
                                </p>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNotification(notif.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:text-slate-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/35 rounded transition-all duration-150 shrink-0 cursor-pointer border-none bg-transparent"
                                title={language === "es" ? "Eliminar" : "Delete"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider select-none">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === "es" ? `Nivel ${userLevel}` : `Level ${userLevel}`}</span>
              </div>
              
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider select-none">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.connected}</span>
              </div>
            </div>
          </div>

          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-2 relative z-10">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight font-serif-premium">
                {t[`tab_${activeTab}_title`] || "Panel de Control"}
              </h1>
              <p className="text-xs text-emerald-100 font-medium mt-0.5 opacity-90">
                {t[`tab_${activeTab}_desc`] || ""}
              </p>
            </div>

            <div className="flex items-center gap-3 justify-end flex-wrap">
              {activeTab === "inventario" && (
                <div className="relative w-48 sm:w-60 shrink-0">
                  <input
                    type="text"
                    placeholder={t.search_components}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-2 rounded-full text-xs glass-input font-bold"
                    style={{ paddingLeft: '44px', paddingRight: '40px' }}
                  />
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <svg
                      className="h-3.5 w-3.5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                      type="button"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {activeTab === "inventario" && (
                <button
                  onClick={() => setIsMovementsModalOpen(true)}
                  className="flex items-center gap-2 px-4.5 py-2.5 rounded-full text-xs font-extrabold shadow-md hover-scale cursor-pointer bg-white hover:bg-slate-50 text-emerald-950 border border-emerald-100"
                >
                  <History className="w-4 h-4 text-emerald-600" />
                  <span>{language === "es" ? "Historial de Movimientos" : "Movement History"}</span>
                </button>
              )}

              {activeTab === "inventario" && userLevel >= 2 && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-4.5 py-2.5 text-emerald-950 bg-gradient-to-r from-lime-300 to-emerald-400 hover:from-lime-400 hover:to-emerald-500 rounded-full text-xs font-black shadow-lg shadow-emerald-500/20 hover-scale cursor-pointer border border-lime-300"
                >
                  <PlusCircle className="w-4.5 h-4.5" />
                  <span>{t.add_component}</span>
                </button>
              )}
            </div>
          </div>

          {/* Success Alerts */}
          {alertMessage.text && alertMessage.type === "success" && (
            <div className="mb-4 p-3 rounded-full bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-2 animate-fade-in shrink-0 relative z-10 animate-pulse">
              <CheckCircle className="w-4 h-4 shrink-0 text-lime-300" />
              <span>{alertMessage.text}</span>
            </div>
          )}

          {/* Bottom Area containing the Tab Content Views */}
          <div className="flex-1 min-h-0 overflow-hidden relative z-10">
            <div className={`h-full ${(activeTab === "limpieza" || activeTab === "rfid" || activeTab === "usuario") ? "overflow-y-auto pb-4" : "overflow-hidden"}`}>
            
            {/* TAB 1: INVENTARIO */}
            {activeTab === "inventario" && (
              <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 shadow-lg h-full flex flex-col justify-between overflow-hidden`}>
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                    {t.components_warehouse}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                    {products.length} {t.registered_suffix}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 min-h-[200px]">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                      <span className="text-xs text-slate-400 font-bold">{t.loading_database}</span>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
                      <PackageOpen className="w-14 h-14 text-slate-300 dark:text-slate-700 mb-2" />
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.empty_inventory}</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                        {t.empty_inventory_desc}
                      </p>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
                      <PackageOpen className="w-14 h-14 text-slate-300 dark:text-slate-700 mb-2" />
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">{t.no_matches}</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                        {language === "es" 
                          ? `No encontramos artículos que coincidan con "${searchTerm}". Intenta buscar otro término.`
                          : `No items matched the search term "${searchTerm}". Try another term.`}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-4">
                      {filteredProducts.map((product, index) => {
                        const isUnlocked = unlockedSkuItems[product.id];
                        return (
                          <div
                            key={product.id}
                            onClick={() => setSelectedProductId(product.id)}
                            className="inventory-item-card rounded-[2rem] p-5 flex flex-col justify-between gap-4 cursor-pointer animate-fade-in"
                          >
                            <div className="flex gap-3">
                              {/* Oval Image Mask */}
                              <div className="w-14 h-20 rounded-full overflow-hidden bg-slate-950 shadow-inner shrink-0 border border-emerald-800/30 aspect-[2/3]">
                                <img
                                  src={product.image || "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=100&auto=format&fit=crop&q=80"}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] uppercase font-bold tracking-wider text-lime-300">
                                  {product.brand || t.no_brand}
                                </span>
                                <h3 className="font-black text-sm truncate leading-snug text-white">
                                  {product.name}
                                </h3>
                                <p className="text-[11px] font-semibold mt-0.5 truncate text-emerald-100">
                                  Mod: {product.model || t.na}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-3 border-t text-[11px] border-emerald-800/30">
                              <div className="p-2 rounded-2xl flex flex-col bg-emerald-950/40 border border-emerald-850/40">
                                <span className="text-[8px] uppercase font-black tracking-wider mb-0.5 text-emerald-200">SKU</span>
                                <span className="font-black truncate text-white">{product.sku || t.na}</span>
                              </div>

                              <div className="p-2 rounded-2xl flex flex-col bg-emerald-950/40 border border-emerald-850/40">
                                <span className="text-[8px] uppercase font-black tracking-wider mb-0.5 text-emerald-200">{language === "es" ? "Ubicación" : "Location"}</span>
                                <span className="font-black truncate text-white">{product.location || t.na}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-emerald-800/30">
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] uppercase font-black tracking-wider block text-emerald-200">{t.stock_status}</span>
                                <div className="flex items-center gap-1.5">
                                  {getStockStatus(product.stock, product.minStock)}
                                </div>
                              </div>

                              {userLevel >= 2 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProduct(product.id);
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 text-emerald-300 hover:text-red-400 hover:bg-white/10"
                                  title={t.delete_firestore_tooltip}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                  <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 shadow-lg flex flex-col`}>
                    <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                      {t.purchase_request}
                    </h2>
                    
                    <form onSubmit={handleAddOrder} className="flex flex-col gap-4">
                      {/* Nombre del Artículo */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          {t.item_name_label}
                        </label>
                        <input
                          type="text"
                          placeholder={t.item_name_placeholder}
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
                          {t.model_label}
                        </label>
                        <input
                          type="text"
                          placeholder={t.item_model_placeholder}
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
                            {t.qty_label}
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder={t.qty_placeholder}
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
                            {t.cost_short}
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder={t.cost_placeholder}
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
                          {t.link_placeholder}
                        </label>
                        <input
                          type="text"
                          placeholder={t.url_placeholder}
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
                        <span>{isOrderSubmitting ? t.saving : t.submit_order}</span>
                      </button>

                    </form>
                  </div>
                </div>

                {/* Right Columns: Kanban Board and History (colspan 9) */}
                <div className="md:col-span-9 flex flex-col h-full overflow-hidden gap-4">
                  {/* Kanban Board */}
                  <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 shadow-lg h-[58%] flex flex-col overflow-hidden shrink-0`}>
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                        {t.pending_orders}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                        {orders.filter(o => o.status !== "recibido" && o.status !== "rechazado").length} {t.pending_suffix}
                      </span>
                    </div>

                    {/* Kanban Board Grid */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden min-h-0">
                      {isOrdersLoading ? (
                        <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
                          <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                          <span className="text-xs text-slate-400 font-bold">{t.loading}</span>
                        </div>
                      ) : (
                        <>
                          {/* COLUMN 1: SOLICITADO */}
                          <div className={`flex flex-col h-full bg-slate-500/5 dark:bg-slate-950/15 rounded-2xl p-3 border overflow-hidden animate-fade-in ${getMetallicFrameClass(visualTheme)}`}>
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/40 dark:border-slate-800/30 shrink-0">
                              <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider">{t.requested_col}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-600">
                                {orders.filter(o => o.status === "solicitado" || !o.status).length}
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-2">
                              {orders.filter(o => o.status === "solicitado" || !o.status).map(order => (
                                <div key={order.id} className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-3 flex flex-col gap-2 hover-scale animate-fade-in shadow-sm`}>
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold product-name-text text-xs truncate">{order.itemName}</h4>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">Mod: {order.itemModel}</p>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span>{language === "es" ? "Cant:" : "Qty:"} <strong className="text-slate-700 dark:text-slate-200">{order.quantity}</strong></span>
                                    <span className="font-bold text-sky-600 dark:text-sky-400">${order.cost?.toLocaleString("es-CL")}</span>
                                  </div>
                                  <div className="flex gap-2 mt-1 shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800/30 justify-between items-center">
                                    <a href={order.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title={t.view_product_tooltip}>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    {userLevel === 3 && (
                                      <div className="flex gap-1.5">
                                        <button onClick={() => handleRejectOrder(order.id)} className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[9px] font-black uppercase transition-colors" title={t.reject_order_tooltip}>
                                          {t.btn_reject}
                                        </button>
                                        <button onClick={() => handleApproveOrder(order.id)} className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase transition-colors" title={t.approve_order_tooltip}>
                                          {t.btn_approve}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {orders.filter(o => o.status === "solicitado" || !o.status).length === 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-6">{t.no_requests}</span>
                              )}
                            </div>
                          </div>

                          {/* COLUMN 2: EN ESPERA */}
                          <div className={`flex flex-col h-full bg-slate-500/5 dark:bg-slate-950/15 rounded-2xl p-3 border overflow-hidden animate-fade-in ${getMetallicFrameClass(visualTheme)}`}>
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/40 dark:border-slate-800/30 shrink-0">
                              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">{t.onhold_col}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600">
                                {orders.filter(o => o.status === "en_espera").length}
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-2">
                              {orders.filter(o => o.status === "en_espera").map(order => (
                                <div key={order.id} className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-3 flex flex-col gap-2 hover-scale animate-fade-in shadow-sm`}>
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold product-name-text text-xs truncate">{order.itemName}</h4>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">Mod: {order.itemModel}</p>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span>{language === "es" ? "Cant:" : "Qty:"} <strong className="text-slate-700 dark:text-slate-200">{order.quantity}</strong></span>
                                    <span className="font-bold text-sky-600 dark:text-sky-400">${order.cost?.toLocaleString("es-CL")}</span>
                                  </div>
                                  <div className="flex gap-2 mt-1 shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800/30 justify-between items-center">
                                    <a href={order.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title={t.view_product_tooltip}>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    {userLevel >= 2 && (
                                      <button onClick={() => handleReceiveOrder(order.id)} className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase transition-colors shadow-sm" title={t.receive_order_tooltip}>
                                        {t.btn_received}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {orders.filter(o => o.status === "en_espera").length === 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-6">{t.no_approved}</span>
                              )}
                            </div>
                          </div>

                          {/* COLUMN 3: RECIBIDO */}
                          <div className={`flex flex-col h-full bg-slate-500/5 dark:bg-slate-950/15 rounded-2xl p-3 border overflow-hidden animate-fade-in ${getMetallicFrameClass(visualTheme)}`}>
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/40 dark:border-slate-800/30 shrink-0">
                              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t.received_col}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600">
                                {orders.filter(o => o.status === "recibido").slice(0, 3).length} rec.
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-2">
                              {orders.filter(o => o.status === "recibido").slice(0, 3).map(order => (
                                <div key={order.id} className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-3 flex flex-col gap-2 hover-scale animate-fade-in shadow-sm opacity-80`}>
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold product-name-text text-xs truncate">{order.itemName}</h4>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">Mod: {order.itemModel}</p>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                    <span>{language === "es" ? "Cant:" : "Qty:"} <strong className="text-slate-700 dark:text-slate-200">{order.quantity}</strong></span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">${order.cost?.toLocaleString("es-CL")}</span>
                                  </div>
                                  <div className="flex gap-2 mt-1 shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800/30 justify-between items-center">
                                    <a href={order.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors" title={t.view_product_tooltip}>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                    <span className="text-[8px] uppercase font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">{t.completed_status}</span>
                                  </div>
                                </div>
                              ))}
                              {orders.filter(o => o.status === "recibido").length === 0 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-6">{t.no_received}</span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Historial de Pedidos */}
                  <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col overflow-hidden`}>
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                        {t.orders_history_title}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                        {orderHistory.length} {t.finished_suffix}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 scroll-glass min-h-0">
                      {isHistoryLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Loader2 className="w-6 h-6 text-sky-500 animate-spin mb-2" />
                          <span className="text-[10px] text-slate-400 font-bold">{t.loading}</span>
                        </div>
                      ) : orderHistory.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                          {t.no_records}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200/40 dark:border-slate-800/30 text-[9px] text-slate-400 font-black uppercase tracking-wider">
                                <th className="pb-2 font-black">{t.item_header}</th>
                                <th className="pb-2 font-black">{t.model_label.replace(" *", "")}</th>
                                <th className="pb-2 font-black text-center">{t.qty_header}</th>
                                <th className="pb-2 font-black text-right">{t.cost_header}</th>
                                <th className="pb-2 font-black text-center">{t.status_label}</th>
                                <th className="pb-2 font-black text-center">{t.date_time}</th>
                                <th className="pb-2 font-black text-center">{t.link_header}</th>
                                {userLevel >= 3 && <th className="pb-2 font-black text-center">{t.actions}</th>}
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
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{t.received_status}</span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-red-500/10 text-red-600 dark:text-red-400">{t.rejected_status}</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-center text-[9px] text-slate-400 dark:text-slate-500 font-medium">{dateStr}</td>
                                    <td className="py-2.5 text-center">
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-sky-500 transition-colors"
                                        title={t.view_product_tooltip}
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </td>
                                    {userLevel >= 3 && (
                                      <td className="py-2.5 text-center">
                                        <button
                                          onClick={() => handleDeleteOrder(item.id)}
                                          className="p-1 rounded bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-colors cursor-pointer hover-scale flex items-center justify-center mx-auto"
                                          title={t.delete}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    )}
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

            {activeTab === "reportes" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full overflow-hidden">
                {userLevel < 3 ? (
                  <>
                    {/* Left Form: create report (colspan 5) */}
                    <div className="md:col-span-5 flex flex-col h-full overflow-y-auto pr-1 scroll-glass">
                      <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 shadow-lg flex flex-col`}>
                        <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                          {t.new_daily_report}
                        </h2>
                        
                        <form onSubmit={handleSubmitReport} className="flex flex-col gap-4">
                          <div className="flex flex-col gap-4">
                            {reportRows.map((row, index) => (
                              <div key={index} className="p-3 rounded-2xl bg-slate-500/5 border border-slate-100/20 dark:border-slate-800/10 flex flex-col gap-2 relative">
                                <div className="flex justify-between items-center gap-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    {t.time_block_header}
                                  </label>
                                  {reportRows.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveReportRow(index)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                      title={t.delete_row_tooltip}
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
                                    "12:00 AM - 01:00 AM", "01:00 AM - 02:00 AM", "02:00 AM - 03:00 AM", "03:00 AM - 04:00 AM",
                                    "04:00 AM - 05:00 AM", "05:00 AM - 06:00 AM", "06:00 AM - 07:00 AM", "07:00 AM - 08:00 AM",
                                    "08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM", "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM",
                                    "12:00 PM - 01:00 PM", "01:00 PM - 02:00 PM", "02:00 PM - 03:00 PM", "03:00 PM - 04:00 PM",
                                    "04:00 PM - 05:00 PM", "05:00 PM - 06:00 PM", "06:00 PM - 07:00 PM", "07:00 PM - 08:00 PM",
                                    "08:00 PM - 09:00 PM", "09:00 PM - 10:00 PM", "10:00 PM - 11:00 PM", "11:00 PM - 12:00 AM"
                                  ].map(block => (
                                    <option key={block} value={block} className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                                      {block}
                                    </option>
                                  ))}
                                </select>
                                
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                                  {t.activity_header}
                                </label>
                                <textarea
                                  placeholder={t.activity_placeholder}
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
                            <span>{t.add_row}</span>
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
                            <span>{isReportSubmitting ? t.submitting : t.submit_report}</span>
                          </button>
                        </form>
                      </div>
                    </div>
                    
                    {/* Right History: (colspan 7) */}
                    <div className="md:col-span-7 flex flex-col h-full overflow-hidden">
                      <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col overflow-hidden`}>
                        <div className="flex items-center justify-between mb-4 shrink-0">
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            {t.recent_reports_title}
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                            {dailyReports.length} {t.reports_suffix}
                          </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-4 pb-2">
                          {isReportsLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                              <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                              <span className="text-xs text-slate-400 font-bold">{t.loading}</span>
                            </div>
                          ) : dailyReports.length === 0 ? (
                            <span className="text-xs text-slate-400 dark:text-slate-500 text-center py-12 font-bold">{t.no_reports_registered}</span>
                          ) : (
                            dailyReports.map((report) => {
                              const isExpanded = expandedReportId === report.id;
                              return (
                                <div 
                                  key={report.id} 
                                  onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                  className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-4 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-3 cursor-pointer select-none animate-fade-in`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{report.createdBy}</span>
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                        report.userLevel === 2 
                                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                          : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                      }`}>
                                        {report.userLevel === 2 ? t.supervisor_role : t.operator_role}
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
                                      <div className="flex justify-end pt-2 gap-2">
                                        {userLevel >= 3 && (
                                          <button
                                            onClick={() => handleDeleteDailyReport(report.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer transition-colors duration-200"
                                            title={t.delete}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>{t.delete}</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDownloadPDF(report)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                          title={t.download_report_pdf}
                                        >
                                          <FileText className="w-3.5 h-3.5 text-white" />
                                          <span>{t.download_pdf}</span>
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
                    <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 shadow-lg flex-1 flex flex-col overflow-hidden`}>
                      <div className="flex items-center justify-between mb-4 shrink-0">
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            {t.audit_reports_title}
                          </h2>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">{t.audit_reports_subtitle}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                          {dailyReports.length} {t.total_suffix}
                        </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1 scroll-glass flex flex-col gap-3 pb-4">
                        {isReportsLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center w-full">
                            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                            <span className="text-xs text-slate-400 font-bold">{t.loading_reports_audit}</span>
                          </div>
                        ) : dailyReports.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-semibold w-full">
                            {t.no_reports_system}
                          </div>
                        ) : (
                          dailyReports.map((report) => {
                            const isExpanded = expandedReportId === report.id;
                            return (
                              <div 
                                key={report.id} 
                                onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                                className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-4 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-2 cursor-pointer select-none animate-fade-in w-full h-auto`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{report.createdBy}</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                      report.userLevel === 2 
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                    }`}>
                                      {report.userLevel === 2 ? t.supervisor_role : t.operator_role}
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
                                          <span className="text-slate-600 dark:text-slate-350 whitespace-pre-wrap">{row.activity}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex justify-end pt-2 gap-2">
                                      {userLevel >= 3 && (
                                        <button
                                          onClick={() => handleDeleteDailyReport(report.id)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer transition-colors duration-200"
                                          title={t.delete}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>{t.delete}</span>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDownloadPDF(report)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                        title={t.download_report_pdf}
                                      >
                                        <FileText className="w-3.5 h-3.5 text-white" />
                                        <span>{t.download_pdf}</span>
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

            {/* TAB 4: LIMPIEZA DE IMPRESORA */}
            {activeTab === "limpieza" && (
              <div className="flex flex-col gap-6 h-auto overflow-y-auto pb-12 pr-1 scroll-glass">
                {userLevel < 3 ? (
                  <>
                    {/* Form: create cleaning logs (full width) */}
                    <div className="w-full flex flex-col h-auto">
                      <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-8 shadow-lg flex flex-col`}>
                        <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                          {t.printer_form_title}
                        </h2>
                        
                        <form onSubmit={handleSubmitCleaning} className="flex flex-col gap-5">
                          {/* List of dynamic rows */}
                          <div className="flex flex-col gap-4">
                            {cleaningRows.map((row, index) => (
                              <div key={index} className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-500/5 dark:bg-slate-900/10 p-4 rounded-2xl border animate-fade-in ${getMetallicFrameClass(visualTheme)}`}>
                                
                                {/* Estación */}
                                <div className="md:col-span-3">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    {t.workstation_label}
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={3}
                                    placeholder={language === "es" ? "Ej. A01" : "e.g. A01"}
                                    value={row.station}
                                    onChange={(e) => {
                                      const updated = [...cleaningRows];
                                      updated[index].station = e.target.value;
                                      setCleaningRows(updated);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                                      cleaningErrors[index]?.station ? "border-red-500" : ""
                                    }`}
                                    required
                                  />
                                  {cleaningErrors[index]?.station && (
                                    <p className="text-[9px] text-red-500 font-bold mt-1">{cleaningErrors[index].station}</p>
                                  )}
                                </div>
 
                                {/* IP Address */}
                                <div className="md:col-span-4">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    {t.ip_address_label}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={language === "es" ? "Ej. 10.40.23.104" : "e.g. 10.40.23.104"}
                                    value={row.ip}
                                    onChange={(e) => handleIPChangeForRow(index, e.target.value)}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-mono font-bold ${
                                      cleaningErrors[index]?.ip ? "border-red-500" : ""
                                    }`}
                                    required
                                  />
                                  {cleaningErrors[index]?.ip && (
                                    <p className="text-[9px] text-red-500 font-bold mt-1">{cleaningErrors[index].ip}</p>
                                  )}
                                </div>
 
                                {/* Tipo de Impresora */}
                                <div className="md:col-span-4">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    {t.printer_type_label}
                                  </label>
                                  <select
                                    value={row.printerType}
                                    onChange={(e) => {
                                      const updated = [...cleaningRows];
                                      updated[index].printerType = e.target.value;
                                      setCleaningRows(updated);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-bold ${
                                      cleaningErrors[index]?.printerType ? "border-red-500" : ""
                                    }`}
                                    required
                                  >
                                    <option value="" disabled className="bg-slate-100 dark:bg-slate-900 text-slate-400">{t.select_model_placeholder}</option>
                                    {["Sato", "Zebra", "Lexmark"].map(model => (
                                      <option key={model} value={model} className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                                        {model}
                                      </option>
                                    ))}
                                  </select>
                                  {cleaningErrors[index]?.printerType && (
                                    <p className="text-[9px] text-red-500 font-bold mt-1">{cleaningErrors[index].printerType}</p>
                                  )}
                                </div>
 
                                {/* Remover fila button */}
                                <div className="md:col-span-1 flex justify-center pb-1">
                                  {cleaningRows.length > 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCleaningRow(index)}
                                      className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-colors duration-200 hover-scale cursor-pointer animate-fade-in"
                                      title={language === "es" ? "Eliminar fila" : "Remove row"}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <div className="w-10 h-10" />
                                  )}
                                </div>
 
                              </div>
                            ))}
                          </div>
 
                          {/* Form actions */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            <button
                              type="button"
                              onClick={handleAddCleaningRow}
                              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-2 border-dashed border-slate-300/40 hover:border-slate-400 dark:border-slate-700/40 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300 hover:bg-white/5 font-bold text-xs hover-scale flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200"
                            >
                              <PlusCircle className={`w-4 h-4 ${getMetallicIconClass(visualTheme)}`} />
                              <span>{t.add_printer_btn}</span>
                            </button>

                            <button
                              type="submit"
                              disabled={isCleaningSubmitting}
                              className="w-full sm:w-auto px-8 py-3 rounded-full bg-gradient-to-r from-[#20a464] to-[#3cd070] hover:from-[#20a464] hover:to-[#3cd070] text-white font-bold text-xs shadow-lg shadow-[#20a464]/20 hover-scale flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {isCleaningSubmitting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              <span>{isCleaningSubmitting ? t.loading : (language === "es" ? "Registrar Limpiezas" : "Register Cleanings")}</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                    
                    {/* Bottom History: (full width) */}
                    <div className="w-full flex flex-col h-auto">
                      <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-20 shadow-lg flex flex-col`}>
                        <div className="flex items-center justify-between mb-4 shrink-0">
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            {t.cleaning_history_title}
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                            {printerCleanings.length} {t.reports_suffix}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-3 pb-2">
                          {isCleaningLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                              <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                              <span className="text-xs text-slate-400 font-bold">{t.loading}</span>
                            </div>
                          ) : printerCleanings.length === 0 ? (
                            <span className="text-xs text-slate-400 dark:text-slate-500 text-center py-12 font-bold">{t.no_records}</span>
                          ) : (
                            printerCleanings.map((record) => {
                              const isExpanded = expandedCleaningId === record.id;
                              const printersList = record.printers || (record.station ? [{
                                station: record.station,
                                ip: record.ip,
                                printerType: record.printerType
                              }] : []);

                              return (
                                <div 
                                  key={record.id} 
                                  onClick={() => setExpandedCleaningId(isExpanded ? null : record.id)}
                                  className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-4 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-2 cursor-pointer select-none animate-fade-in w-full h-auto`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-xs text-slate-900">
                                        {t.user_label}: {record.createdBy}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-800 font-bold">{record.date}</span>
                                      <span className="text-[10px] text-slate-800 font-extrabold">{isExpanded ? "▲" : "▼"}</span>
                                    </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="mt-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/30 flex flex-col gap-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                          <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider">
                                              <th className="py-2 px-3">{t.station_label}</th>
                                              <th className="py-2 px-3">{t.ip_address_label}</th>
                                              <th className="py-2 px-3">{t.printer_type_label}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/20 font-semibold text-slate-700 dark:text-slate-350">
                                            {printersList.map((pr, pIdx) => {
                                              const stationVal = pr.station || "N/D";
                                              const ipVal = pr.ip || "N/D";
                                              const typeVal = pr.printerType || "N/D";
                                              return (
                                                <tr key={pIdx} className="hover:bg-slate-500/5 transition-colors">
                                                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{stationVal}</td>
                                                  <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{ipVal}</td>
                                                  <td className="py-2 px-3">
                                                    <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-955 dark:text-white border border-sky-300 dark:border-sky-800 text-[9px] font-black uppercase shadow-sm">
                                                      {typeVal}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      
                                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/20">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                          {language === "es" ? "Registrado por" : "Registered by"}: {record.createdBy} ({t.level_label} {record.userLevel})
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {userLevel >= 3 && (
                                            <button
                                              onClick={() => handleDeleteCleaning(record.id)}
                                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer transition-colors duration-200"
                                              title={t.delete}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              <span>{t.delete}</span>
                                            </button>
                                          )}
                                          <button
                                            onClick={() => handleDownloadCleaningPDF(record)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                            title={t.download_pdf}
                                          >
                                            <FileText className="w-3.5 h-3.5 text-white" />
                                            <span>{t.download_pdf}</span>
                                          </button>
                                        </div>
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
                  /* Nivel 3: Audit View (full width) */
                  <div className="w-full flex flex-col h-auto">
                    <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-20 shadow-lg flex flex-col`}>
                      <div className="flex items-center justify-between mb-4 shrink-0">
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            {t.cleaning_supervision_title}
                          </h2>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">{t.cleaning_supervision_subtitle}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                          {printerCleanings.length} {t.total_suffix}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-3 pb-4">
                        {isCleaningLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center w-full">
                            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                            <span className="text-xs text-slate-400 font-bold">{t.loading}</span>
                          </div>
                        ) : printerCleanings.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-semibold w-full">
                            {t.no_records}
                          </div>
                        ) : (
                          printerCleanings.map((record) => {
                            const isExpanded = expandedCleaningId === record.id;
                            const printersList = record.printers || (record.station ? [{
                              station: record.station,
                              ip: record.ip,
                              printerType: record.printerType
                            }] : []);

                            return (
                              <div 
                                key={record.id} 
                                onClick={() => setExpandedCleaningId(isExpanded ? null : record.id)}
                                className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-4 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-2 cursor-pointer select-none animate-fade-in w-full h-auto`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-xs text-slate-900">
                                      {t.user_label}: {record.createdBy}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-800 font-bold">{record.date}</span>
                                    <span className="text-[10px] text-slate-800 font-extrabold">{isExpanded ? "▲" : "▼"}</span>
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div className="mt-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/30 flex flex-col gap-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="border-b border-slate-200 dark:border-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider">
                                            <th className="py-2 px-3">{t.station_label}</th>
                                            <th className="py-2 px-3">{t.ip_address_label}</th>
                                            <th className="py-2 px-3">{t.printer_type_label}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/20 font-semibold text-slate-700 dark:text-slate-350">
                                          {printersList.map((pr, pIdx) => {
                                            const stationVal = pr.station || "N/D";
                                            const ipVal = pr.ip || "N/D";
                                            const typeVal = pr.printerType || "N/D";
                                            return (
                                              <tr key={pIdx} className="hover:bg-slate-500/5 transition-colors">
                                                <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{stationVal}</td>
                                                <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{ipVal}</td>
                                                <td className="py-2 px-3">
                                                  <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-955 dark:text-white border border-sky-300 dark:border-sky-800 text-[9px] font-black uppercase shadow-sm">
                                                    {typeVal}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                    
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/20">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                        {language === "es" ? "Registrado por" : "Registered by"}: {record.createdBy} ({t.level_label} {record.userLevel})
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {userLevel >= 3 && (
                                          <button
                                            onClick={() => handleDeleteCleaning(record.id)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer transition-colors duration-200"
                                            title={t.delete}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>{t.delete}</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDownloadCleaningPDF(record)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                          title={t.download_pdf}
                                        >
                                          <FileText className="w-3.5 h-3.5 text-white" />
                                          <span>{t.download_pdf}</span>
                                        </button>
                                      </div>
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

            {/* TAB 5: VERIFICACIÓN DE RFID */}
            {activeTab === "rfid" && (
              <div className="flex flex-col gap-6 h-auto overflow-y-auto pb-12 pr-1 scroll-glass">
                {userLevel < 3 ? (
                  <>
                    {/* Form: create RFID verification logs (full width) */}
                    <div className="w-full flex flex-col h-auto">
                      <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-8 shadow-lg flex flex-col`}>
                        <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                          {t.rfid_form_title}
                        </h2>
                        
                        <form onSubmit={handleSubmitRfid} className="flex flex-col gap-5">
                          {/* List of dynamic rows */}
                          <div className="flex flex-col gap-4">
                            {rfidRows.map((row, index) => (
                              <div key={index} className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-500/5 dark:bg-slate-900/10 p-4 rounded-2xl border animate-fade-in ${getMetallicFrameClass(visualTheme)}`}>
                                
                                {/* Estación */}
                                <div className="md:col-span-3">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    {t.station_field}
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={3}
                                    placeholder={language === "es" ? "Ej. A01" : "e.g. A01"}
                                    value={row.station}
                                    onChange={(e) => {
                                      const updated = [...rfidRows];
                                      updated[index].station = e.target.value;
                                      setRfidRows(updated);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                                      rfidErrors[index]?.station ? "border-red-500" : ""
                                    }`}
                                    required
                                  />
                                  {rfidErrors[index]?.station && (
                                    <p className="text-[9px] text-red-500 font-bold mt-1">{rfidErrors[index].station}</p>
                                  )}
                                </div>
 
                                {/* Lector IP */}
                                <div className="md:col-span-4">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    {t.ip_field}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={language === "es" ? "Ej. 10.40.85.12" : "e.g. 10.40.85.12"}
                                    value={row.ip}
                                    onChange={(e) => handleRfidIPChangeForRow(index, e.target.value)}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-mono font-bold ${
                                      rfidErrors[index]?.ip ? "border-red-500" : ""
                                    }`}
                                    required
                                  />
                                  {rfidErrors[index]?.ip && (
                                    <p className="text-[9px] text-red-500 font-bold mt-1">{rfidErrors[index].ip}</p>
                                  )}
                                </div>
 
                                {/* Estado de Antenas */}
                                <div className="md:col-span-4">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                                    {t.antennas_field}
                                  </label>
                                  <select
                                    value={row.antennaStatus}
                                    onChange={(e) => {
                                      const updated = [...rfidRows];
                                      updated[index].antennaStatus = e.target.value;
                                      setRfidRows(updated);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-bold ${
                                      rfidErrors[index]?.antennaStatus ? "border-red-500" : ""
                                    }`}
                                    required
                                  >
                                    <option value="" disabled className="bg-slate-100 dark:bg-slate-900 text-slate-400">{t.select_status_placeholder}</option>
                                    <option value="Bueno" className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">{t.status_optimo}</option>
                                    <option value="Fallo" className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">{t.status_fallo}</option>
                                  </select>
                                  {rfidErrors[index]?.antennaStatus && (
                                    <p className="text-[9px] text-red-500 font-bold mt-1">{rfidErrors[index].antennaStatus}</p>
                                  )}
                                </div>
 
                                {/* Remover fila button */}
                                <div className="md:col-span-1 flex justify-center pb-1">
                                  <button
                                    type="button"
                                    disabled={rfidRows.length === 1}
                                    onClick={() => handleRemoveRfidRow(index)}
                                    className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white disabled:opacity-30 disabled:hover:bg-red-500/10 disabled:hover:text-red-500 transition-colors duration-200 hover-scale cursor-pointer"
                                    title={language === "es" ? "Eliminar fila" : "Remove row"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
 
                              </div>
                            ))}
                          </div>
 
                          {/* Form actions */}
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={handleAddRfidRow}
                                className="px-5 py-2.5 rounded-xl border-2 border-dashed border-slate-300/40 hover:border-slate-400 dark:border-slate-700/40 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300 hover:bg-white/5 font-bold text-xs hover-scale flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200"
                              >
                                <PlusCircle className={`w-4 h-4 ${getMetallicIconClass(visualTheme)}`} />
                                <span>{t.add_rfid_btn}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRfidRows([{ station: "", ip: "10.40.", antennaStatus: "" }]);
                                  setRfidErrors({});
                                }}
                                className="px-5 py-2.5 rounded-xl border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-500/5 font-bold text-xs hover-scale flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200"
                              >
                                <RefreshCw className="w-4 h-4" />
                                <span>{language === "es" ? "Limpiar" : "Clear"}</span>
                              </button>
                            </div>

                            <button
                              type="submit"
                              disabled={isRfidSubmitting}
                              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                              {isRfidSubmitting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              <span>{isRfidSubmitting ? t.loading : t.save_record}</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                    
                    {/* Bottom History: (full width) */}
                    <div className="w-full flex flex-col h-auto">
                      <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-20 shadow-lg flex flex-col`}>
                        <div className="flex items-center justify-between mb-4 shrink-0">
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            {t.rfid_history_title}
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                            {rfidVerifications.length} {t.reports_suffix}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-3 pb-2">
                          {isRfidLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                              <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                              <span className="text-xs text-slate-400 font-bold">{t.loading_verifications}</span>
                            </div>
                          ) : rfidVerifications.length === 0 ? (
                            <span className="text-xs text-slate-400 dark:text-slate-500 text-center py-12 font-bold">{t.no_rfid_records}</span>
                          ) : (
                            rfidVerifications.map((record) => {
                              const isExpanded = expandedRfidId === record.id;
                              const stationsList = record.stations || (record.station ? [{
                                estacion: record.station,
                                ip: record.ip,
                                estado: record.antennaStatus
                              }] : []);

                              return (
                                <div 
                                  key={record.id} 
                                  onClick={() => setExpandedRfidId(isExpanded ? null : record.id)}
                                  className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-4 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-2 cursor-pointer select-none animate-fade-in w-full h-auto`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-xs text-slate-900">
                                        {t.user_label}: {record.createdBy}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-800 font-bold">{record.date}</span>
                                      <span className="text-[10px] text-slate-800 font-extrabold">{isExpanded ? "▲" : "▼"}</span>
                                    </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="mt-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/30 flex flex-col gap-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                          <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider">
                                              <th className="py-2 px-3">{t.station_header}</th>
                                              <th className="py-2 px-3">{t.ip_header}</th>
                                              <th className="py-2 px-3 text-center">{t.antennas_header}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/20 font-semibold text-slate-700 dark:text-slate-350">
                                            {stationsList.map((st, sIdx) => {
                                              const stationVal = st.estacion || st.station || "N/D";
                                              const ipVal = st.ip || "N/D";
                                              const statusVal = st.estado || st.antennaStatus || "";
                                              const isBueno = isStatusBueno(statusVal);
                                              return (
                                                <tr key={sIdx} className="hover:bg-slate-500/5 transition-colors">
                                                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{stationVal}</td>
                                                  <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{ipVal}</td>
                                                  <td className="py-2 px-3 text-center">
                                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold ${
                                                      isBueno 
                                                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" 
                                                        : "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                                                    }`} title={isBueno ? t.status_optimo : t.status_fallo}>
                                                      {isBueno ? "✔" : "❌"}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      
                                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/20">
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                          {t.registered_by_level} {record.createdBy} ({t.level_short} {record.userLevel})
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {userLevel >= 3 && (
                                            <button
                                              onClick={() => handleDeleteRfid(record.id)}
                                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer transition-colors duration-200"
                                              title={t.delete_report_tooltip}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              <span>{t.delete}</span>
                                            </button>
                                          )}
                                          <button
                                            onClick={() => handleDownloadRfidPDF(record)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                            title={t.download_pdf_tooltip}
                                          >
                                            <FileText className="w-3.5 h-3.5 text-white" />
                                            <span>{t.download_pdf}</span>
                                          </button>
                                        </div>
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
                  /* Nivel 3: Audit View (full width) */
                  <div className="w-full flex flex-col h-auto">
                    <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-20 shadow-lg flex flex-col`}>
                      <div className="flex items-center justify-between mb-4 shrink-0">
                        <div>
                          <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                            {t.rfid_supervision_title}
                          </h2>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">{t.rfid_supervision_subtitle}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                          {rfidVerifications.length} {t.total_suffix}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-3 pb-4">
                        {isRfidLoading ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center w-full">
                            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                            <span className="text-xs text-slate-400 font-bold">{t.loading_supervision}</span>
                          </div>
                        ) : rfidVerifications.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs font-semibold w-full">
                            {t.no_verifications_system}
                          </div>
                        ) : (
                          rfidVerifications.map((record) => {
                            const isExpanded = expandedRfidId === record.id;
                            const stationsList = record.stations || (record.station ? [{
                              estacion: record.station,
                              ip: record.ip,
                              estado: record.antennaStatus
                            }] : []);

                            return (
                              <div 
                                key={record.id} 
                                onClick={() => setExpandedRfidId(isExpanded ? null : record.id)}
                                className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-2xl p-4 hover:border-white/50 dark:hover:border-slate-700/35 transition-all duration-300 shadow-sm flex flex-col gap-2 cursor-pointer select-none animate-fade-in w-full h-auto`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-xs text-slate-900">
                                      {t.user_label}: {record.createdBy}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-800 font-bold">{record.date}</span>
                                    <span className="text-[10px] text-slate-800 font-extrabold">{isExpanded ? "▲" : "▼"}</span>
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div className="mt-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/30 flex flex-col gap-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="border-b border-slate-200 dark:border-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider">
                                            <th className="py-2 px-3">{t.station_header}</th>
                                            <th className="py-2 px-3">{t.ip_header}</th>
                                            <th className="py-2 px-3 text-center">{t.antennas_header}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/20 font-semibold text-slate-700 dark:text-slate-350">
                                          {stationsList.map((st, sIdx) => {
                                            const stationVal = st.estacion || st.station || "N/D";
                                            const ipVal = st.ip || "N/D";
                                            const statusVal = st.estado || st.antennaStatus || "";
                                            const isBueno = isStatusBueno(statusVal);
                                            return (
                                              <tr key={sIdx} className="hover:bg-slate-500/5 transition-colors">
                                                <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{stationVal}</td>
                                                <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{ipVal}</td>
                                                <td className="py-2 px-3 text-center">
                                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold ${
                                                    isBueno 
                                                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" 
                                                      : "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                                                  }`} title={isBueno ? t.status_optimo : t.status_fallo}>
                                                    {isBueno ? "✔" : "❌"}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                    
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/20">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                        {t.registered_by_level} {record.createdBy} ({t.level_short} {record.userLevel})
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {userLevel >= 3 && (
                                          <button
                                            onClick={() => handleDeleteRfid(record.id)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer transition-colors duration-200"
                                            title={t.delete_report_tooltip}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>{t.delete}</span>
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDownloadRfidPDF(record)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold shadow-sm hover-scale cursor-pointer"
                                          title={t.download_pdf_tooltip}
                                        >
                                          <FileText className="w-3.5 h-3.5 text-white" />
                                          <span>{t.download_pdf}</span>
                                        </button>
                                      </div>
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

            {/* TAB 6: ADMINISTRACIÓN DE USUARIOS (Solo Nivel 3) */}
            {activeTab === "usuario" && userLevel >= 3 && (
              <div className="flex flex-col gap-6 h-auto overflow-y-auto pb-12 pr-1 scroll-glass w-full">
                
                {/* Two Column Layout: Register Form and Users List */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                  
                  {/* Column 1: Register Form */}
                  <div className="lg:col-span-1 flex flex-col h-auto">
                    <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-8 shadow-lg flex flex-col`}>
                      <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">
                        {t.user_form_title}
                      </h2>
                      
                      <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
                        {/* Nombre del Asociado */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            {t.assoc_name}
                          </label>
                          <input
                            type="text"
                            placeholder={language === "es" ? "Ej. Juan Pérez" : "e.g. John Doe"}
                            value={userForm.name}
                            onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                            required
                          />
                        </div>

                        {/* Posición / Puesto */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            {t.position_label}
                          </label>
                          <input
                            type="text"
                            placeholder={language === "es" ? "Ej. Técnico de Soporte" : "e.g. Support Technician"}
                            value={userForm.position}
                            onChange={(e) => setUserForm(prev => ({ ...prev, position: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                            required
                          />
                        </div>

                        {/* Turno */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            {t.shift_label}
                          </label>
                          <select
                            value={userForm.shift}
                            onChange={(e) => setUserForm(prev => ({ ...prev, shift: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-bold"
                            required
                          >
                            <option value="Matutino" className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">{t.morning_shift}</option>
                            <option value="Nocturno" className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">{t.night_shift}</option>
                          </select>
                        </div>

                        {/* Nivel de Acceso */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            {t.level_access_label}
                          </label>
                          <select
                            value={userForm.level}
                            onChange={(e) => setUserForm(prev => ({ ...prev, level: Number(e.target.value) }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-bold"
                            required
                          >
                            <option value={1} className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">{t.level_1_opt}</option>
                            <option value={2} className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">{t.level_2_opt}</option>
                            <option value={3} className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">{t.level_3_opt}</option>
                          </select>
                        </div>

                        {/* Usuario / ID (Texto único) */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            {t.user_id_unique}
                          </label>
                          <input
                            type="text"
                            placeholder={language === "es" ? "Ej. jperez" : "e.g. jdoe"}
                            value={userForm.username}
                            onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                            required
                          />
                        </div>

                        {/* Contraseña */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            {t.password}
                          </label>
                          <input
                            type="password"
                            placeholder={t.password_placeholder_input}
                            value={userForm.password}
                            onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                            required
                          />
                        </div>

                        {/* Correo Electrónico */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                            {language === "es" ? "Correo Electrónico" : "Email Address"}
                          </label>
                          <input
                            type="email"
                            placeholder="ejemplo@correo.com"
                            value={userForm.email || ""}
                            onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                          />
                        </div>

                        {userFormError && (
                          <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{userFormError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isUserSubmitting}
                          className="w-full mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isUserSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <PlusCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{isUserSubmitting ? t.creating_user : t.btn_create_user}</span>
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Column 2: Users List */}
                  <div className="lg:col-span-2 flex flex-col h-auto">
                    <div className={`glass-card ${getMetallicFrameClass(visualTheme)} rounded-[2rem] p-5 pb-8 shadow-lg flex flex-col w-full min-h-[400px]`}>
                      <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">
                          {t.assoc_list_title}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-slate-800/30 text-white text-[10px] font-bold border border-white/10 dark:border-slate-700/50">
                          {usersList.length} {t.associates_suffix}
                        </span>
                      </div>

                      {isUsersLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center w-full my-auto">
                          <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-2" />
                          <span className="text-xs text-slate-400 font-bold">{t.loading_associates}</span>
                        </div>
                      ) : usersList.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-xs font-semibold my-auto">
                          {t.no_associates_registered}
                        </div>
                      ) : (
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider">
                                <th className="py-3 px-3">{t.assoc_header}</th>
                                <th className="py-3 px-3">{t.assoc_username_header}</th>
                                <th className="py-3 px-3">{t.position_header}</th>
                                <th className="py-3 px-3">{t.shift_header}</th>
                                <th className="py-3 px-3 text-center">{t.level_header}</th>
                                <th className="py-3 px-3 text-center">{t.actions}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/20 font-semibold text-slate-700 dark:text-slate-350">
                              {usersList.map((user) => {
                                const isSelf = user.id === currentUser.username;
                                const isMaster = user.id === "1234";
                                return (
                                  <tr key={user.id} className="hover:bg-slate-500/5 transition-colors">
                                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                                      {user.name || "N/D"} {isSelf && <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-600 text-[9px] font-black uppercase">{t.you_badge}</span>}
                                    </td>
                                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400 font-bold">{user.id}</td>
                                    <td className="py-3 px-3">{user.position || "N/D"}</td>
                                    <td className="py-3 px-3">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                        user.shift === "Matutino"
                                          ? "bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-350 border-amber-300/30"
                                          : "bg-indigo-100/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-350 border-indigo-300/30"
                                      }`}>
                                        {user.shift === "Matutino" ? t.morning_shift : t.night_shift}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-center font-bold">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                                        user.level === 3
                                          ? "bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-350 border-purple-300/30"
                                          : user.level === 2
                                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-350 border-emerald-300/30"
                                          : "bg-slate-100 text-slate-900 dark:bg-slate-950/40 dark:text-slate-350 border-slate-300/30"
                                      }`}>
                                        {t.level_short} {user.level || 1}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3">
                                      <div className="flex items-center justify-center gap-2">
                                        {/* Edit Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleEditUserClick(user)}
                                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500 text-sky-600 hover:text-white transition-all cursor-pointer hover-scale flex items-center justify-center"
                                          title={t.edit_details_access_tooltip}
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        
                                        {/* Reset Password Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleSendPasswordReset(user)}
                                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all cursor-pointer hover-scale flex items-center justify-center"
                                          title={language === "es" ? "Restablecer contraseña" : "Reset password"}
                                        >
                                          <Key className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteUser(user)}
                                          disabled={isSelf || isMaster}
                                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-50 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:hover:bg-red-500/10 disabled:hover:text-red-500 transition-all cursor-pointer hover-scale flex items-center justify-center"
                                          title={isSelf ? t.cannot_delete_self_tooltip : isMaster ? t.master_user_protected_tooltip : t.delete_assoc_tooltip}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
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




          </div>
        </div>
      </div>
    </div>

      {/* POPUP MODAL: Editar Asociado */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className={`glass-card ${getMetallicFrameClass(visualTheme)} w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in flex flex-col`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white font-serif-premium">
                  {t.edit_user_title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 opacity-80">{t.edit_assoc_subtitle} {editingUser.id}.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors hover-scale"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUserEdit} className="flex flex-col gap-4">
              {/* Usuario / ID (Read-only) */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  {t.username_readonly}
                </label>
                <input
                  type="text"
                  value={editingUser.id}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-mono font-bold opacity-60 cursor-not-allowed"
                />
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {t.assoc_name}
                </label>
                <input
                  type="text"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                  required
                />
              </div>

              {/* Posición / Puesto */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {t.position_label}
                </label>
                <input
                  type="text"
                  value={editUserForm.position}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, position: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                  required
                />
              </div>

              {/* Turno */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {t.shift_label}
                </label>
                <select
                  value={editUserForm.shift}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, shift: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-bold"
                  required
                >
                  <option value="Matutino">{t.morning_shift}</option>
                  <option value="Nocturno">{t.night_shift}</option>
                </select>
              </div>

              {/* Nivel de Acceso */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {t.level_access_label}
                </label>
                <select
                  value={editUserForm.level}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, level: Number(e.target.value) }))}
                  disabled={editingUser.id === "1234"}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-bold ${
                    editingUser.id === "1234" ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  required
                >
                  <option value={1}>{t.level_1_opt}</option>
                  <option value={2}>{t.level_2_opt}</option>
                  <option value={3}>{t.level_3_opt}</option>
                </select>
                {editingUser.id === "1234" && (
                  <p className="text-[9px] text-slate-400 font-bold mt-1">{t.master_user_protected}</p>
                )}
              </div>

              {/* Contraseña */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {t.password}
                </label>
                <input
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                  required
                />
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {language === "es" ? "Correo Electrónico" : "Email Address"}
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={editUserForm.email || ""}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold text-xs hover-scale cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isUserSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/15 hover-scale flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isUserSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  <span>{isUserSaving ? t.saving : t.save_changes}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Historial de Movimientos */}
      {isMovementsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className={`glass-card ${getMetallicFrameClass(visualTheme)} w-full max-w-4xl rounded-[2.5rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in flex flex-col max-h-[90vh]`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white font-serif-premium">
                  {language === "es" ? "Historial de Movimientos" : "Movement History"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 opacity-80">
                  {language === "es"
                    ? "Registro de transacciones de inventario (Entradas, Salidas y Ajustes)"
                    : "Inventory transaction log (Entries, Outputs and Adjustments)"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadMovementsPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-md hover-scale cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{language === "es" ? "Descargar Reporte PDF" : "Download PDF Report"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMovementsModalOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors hover-scale cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content / Table */}
            <div className="flex-1 overflow-y-auto pr-1 scroll-glass min-h-[200px]">
              {isMovementsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 className="w-8 h-8 text-[#20a464] animate-spin mb-2" />
                  <span className="text-xs text-slate-400 font-bold">{t.loading_database}</span>
                </div>
              ) : movements.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-semibold">
                  {language === "es" ? "No se encontraron movimientos registrados." : "No registered movements found."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/40 dark:border-slate-800/30 text-[9px] text-slate-400 font-black uppercase tracking-wider">
                        <th className="pb-2 font-black">{language === "es" ? "Fecha y Hora" : "Date & Time"}</th>
                        <th className="pb-2 font-black">{language === "es" ? "Artículo" : "Item"}</th>
                        <th className="pb-2 font-black">{language === "es" ? "Tipo" : "Type"}</th>
                        <th className="pb-2 font-black text-center">{language === "es" ? "Cantidad" : "Quantity"}</th>
                        <th className="pb-2 font-black">{language === "es" ? "Operador" : "Operator"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/30 dark:divide-slate-800/10 text-[11px] font-semibold text-slate-600 dark:text-slate-350">
                      {movements.map((mov) => {
                        const dateStr = mov.timestamp?.toDate
                          ? mov.timestamp.toDate().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
                          : (mov.timestamp?.seconds ? new Date(mov.timestamp.seconds * 1000).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "N/D");
                        
                        let badgeColor = "bg-sky-500/10 text-sky-600 border-sky-500/20";
                        if (mov.type === "Entrada") {
                          badgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                        } else if (mov.type === "Salida") {
                          badgeColor = "bg-rose-500/10 text-rose-600 border-rose-500/20";
                        } else if (mov.type === "Ajuste por Edición") {
                          badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                        }

                        return (
                          <tr key={mov.id} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-2.5 pr-2 font-mono text-slate-400 dark:text-slate-500 text-[10px]">{dateStr}</td>
                            <td className="py-2.5 max-w-[200px] truncate pr-2 font-bold text-slate-800 dark:text-slate-100">{mov.itemName}</td>
                            <td className="py-2.5 pr-2">
                              <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg border uppercase ${badgeColor}`}>
                                {mov.type}
                              </span>
                            </td>
                            <td className="py-2.5 text-center font-bold text-slate-700 dark:text-slate-200">
                              {mov.type === "Ajuste por Edición" ? "-" : mov.amount}
                            </td>
                            <td className="py-2.5 text-slate-500 dark:text-slate-400 font-bold">{mov.operator}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-200/50 dark:border-slate-800/50 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setIsMovementsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold text-xs hover-scale cursor-pointer"
              >
                {t.cancel}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP MODAL: Agregar Nuevo Componente */}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className={`glass-card ${getMetallicFrameClass(visualTheme)} w-full max-w-xl rounded-[2.5rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in max-h-[92vh] flex flex-col`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white font-serif-premium">
                  {t.add_new_component_title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 opacity-80">
                  {language === "es" ? "Registra una nueva pieza en el inventario real-time." : "Register a new piece in the real-time inventory."}
                </p>
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
                    {t.name_label}
                  </label>
                  <input
                    type="text"
                    placeholder={language === "es" ? "Ej. Microprocesador Intel Core i9" : "e.g. Intel Core i9 Processor"}
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
                    {t.brand_label}
                  </label>
                  <input
                    type="text"
                    placeholder={language === "es" ? "Ej. Intel" : "e.g. Intel"}
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
                    {t.model_label}
                  </label>
                  <input
                    type="text"
                    placeholder={language === "es" ? "Ej. i9-14900K" : "e.g. i9-14900K"}
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
                    {language === "es" ? "SKU (9 Caracteres) *" : "SKU (9 Characters) *"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={9}
                      placeholder={language === "es" ? "Ej. INTEL1490" : "e.g. INTEL1490"}
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
                      <span>{language === "es" ? "Generar" : "Generate"}</span>
                    </button>
                  </div>
                  {formErrors.sku && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.sku}</p>}
                </div>
              </div>

              {/* Row 3: Ubicación física y Stock Mínimo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    {t.location_label}
                  </label>
                  <input
                    type="text"
                    placeholder={language === "es" ? "Ej. Estante C - Fila 2" : "e.g. Shelf C - Row 2"}
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
                    {t.min_stock_label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder={language === "es" ? "Ej. 5" : "e.g. 5"}
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
                  {language === "es" ? "Stock Inicial *" : "Initial Stock *"}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={language === "es" ? "Ej. 25" : "e.g. 25"}
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold ${
                    formErrors.stock ? "border-red-500" : ""
                  }`}
                />
                {formErrors.stock && <p className="text-[9px] text-red-500 font-bold mt-1">{formErrors.stock}</p>}
              </div>

              {/* Row 4.5: Descripción del Artículo */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  {t.desc_label}
                </label>
                <textarea
                  placeholder={language === "es" ? "Describe brevemente el componente (marca, modelo, características...)..." : "Briefly describe the component (brand, model, features...)..."}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl text-xs glass-input font-semibold resize-none"
                />
              </div>

              {/* Row 5: Imagen del Artículo con Pestañas y Zona de arrastre */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  {language === "es" ? "Imagen del Artículo *" : "Item Image *"}
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
                    {t.upload_file}
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
                    {t.select_icon}
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
                    {t.url_label}
                  </button>
                </div>

                {/* Tab Content 1: Upload (Firebase Storage integration) */}
                {formData.imageType === "upload" && (
                  <div 
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700/50 hover:border-sky-500 dark:hover:border-sky-500 transition-colors flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 dark:bg-slate-900/10 group min-h-[110px]"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={onFileSelect}
                      style={{ display: "none" }}
                      accept="image/*"
                    />
                    
                    {isUploading ? (
                      <div className="w-full flex flex-col items-center justify-center">
                        <Loader2 className="w-7 h-7 text-sky-500 animate-spin mb-2" />
                        <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                          {language === "es" ? `Subiendo: ${uploadProgress}%` : `Uploading: ${uploadProgress}%`}
                        </span>
                        <div className="w-32 bg-slate-200 dark:bg-slate-800 rounded-full h-1 mt-2 overflow-hidden">
                          <div className="bg-sky-500 h-1 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    ) : formData.imageUrl ? (
                      <div className="flex flex-col items-center gap-1.5 animate-scale-in">
                        <img 
                          src={formData.imageUrl} 
                          alt="Preview" 
                          className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
                        />
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {language === "es" ? "¡Imagen cargada correctamente!" : "Image uploaded successfully!"}
                        </span>
                        <span className="text-[8px] text-slate-400 font-semibold max-w-[240px] truncate">
                          {formData.imageUrl}
                        </span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-sky-500 transition-colors mb-1.5" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {language === "es" ? "Haz clic para seleccionar una imagen" : "Click to select an image"}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Tab Content 2: Select Icon */}
                {formData.imageType === "icon" && (
                  <div className="p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 grid grid-cols-4 gap-2 bg-slate-50/50 dark:bg-slate-900/10">
                    {MOCK_ICONS.map((ic) => (
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
                      placeholder={t.image_url_placeholder}
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
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-sky-500/15 hover-scale flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlusCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmitting ? t.saving : t.save_component}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Detalle de Componente */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className={`glass-card ${getMetallicFrameClass(visualTheme)} w-full max-w-lg rounded-[2.5rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in max-h-[92vh] flex flex-col`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800/50 mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white font-serif-premium">
                  {isEditingDetail ? (language === "es" ? "Editar Componente" : "Edit Component") : t.details_modal_title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 opacity-80">
                  {isEditingDetail ? (language === "es" ? "Modifica los campos técnicos del componente." : "Modify the technical fields of the component.") : (language === "es" ? "Información técnica y stock en tiempo real." : "Technical info and real-time stock.")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {userLevel >= 2 && !isEditingDetail && (
                  <>
                    <button
                      onClick={() => handleDownloadTechnicalSheet(selectedProduct)}
                      className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-all duration-150 hover-scale cursor-pointer"
                      title={t.technical_sheet_download}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingDetail(true)}
                      className="w-9 h-9 rounded-full bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 flex items-center justify-center transition-all duration-150 hover-scale cursor-pointer"
                      title={t.edit_details_tooltip}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </>
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
                  src={isEditingDetail ? (editDetailForm.image || "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop&q=80") : (selectedProduct.image || "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&auto=format&fit=crop&q=80")}
                  alt={isEditingDetail ? editDetailForm.name : selectedProduct.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  {getStockStatus(selectedProduct.stock, selectedProduct.minStock)}
                </div>
              </div>

              {/* Edit Image Tabs */}
              {isEditingDetail && (
                <div className="p-4 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/20 dark:border-slate-800/20 backdrop-blur-md shrink-0 flex flex-col gap-3 animate-fade-in">
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-black tracking-wider block mb-1">
                    {language === "es" ? "Imagen del Artículo" : "Item Image"}
                  </span>
                  
                  {/* Tabs */}
                  <div className="flex gap-4 border-b border-slate-200/50 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-wider mb-2">
                    <button
                      type="button"
                      onClick={() => setEditDetailForm({ ...editDetailForm, imageType: "upload" })}
                      className={`pb-2 px-3 transition-colors cursor-pointer ${
                        editDetailForm.imageType === "upload"
                          ? "border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 font-extrabold"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {t.upload_file}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDetailForm({ ...editDetailForm, imageType: "icon" })}
                      className={`pb-2 px-3 transition-colors cursor-pointer ${
                        editDetailForm.imageType === "icon"
                          ? "border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 font-extrabold"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {t.select_icon}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDetailForm({ ...editDetailForm, imageType: "url" })}
                      className={`pb-2 px-3 transition-colors cursor-pointer ${
                        editDetailForm.imageType === "url"
                          ? "border-b-2 border-sky-500 text-sky-600 dark:text-sky-400 font-extrabold"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {t.url_label}
                    </button>
                  </div>

                  {/* Tab Content 1: Upload */}
                  {editDetailForm.imageType === "upload" && (
                    <div 
                      onClick={() => !isUploading && editFileInputRef.current?.click()}
                      className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700/50 hover:border-sky-500 dark:hover:border-sky-500 transition-colors flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 dark:bg-slate-900/10 group min-h-[110px]"
                    >
                      <input
                        type="file"
                        ref={editFileInputRef}
                        onChange={onEditFileSelect}
                        style={{ display: "none" }}
                        accept="image/*"
                      />
                      
                      {isUploading ? (
                        <div className="w-full flex flex-col items-center justify-center">
                          <Loader2 className="w-7 h-7 text-sky-500 animate-spin mb-2" />
                          <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                            {language === "es" ? `Subiendo: ${uploadProgress}%` : `Uploading: ${uploadProgress}%`}
                          </span>
                          <div className="w-32 bg-slate-200 dark:bg-slate-800 rounded-full h-1 mt-2 overflow-hidden">
                            <div className="bg-sky-500 h-1 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : editDetailForm.image ? (
                        <div className="flex flex-col items-center gap-1.5 animate-scale-in">
                          <img 
                            src={editDetailForm.image} 
                            alt="Preview" 
                            className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
                          />
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {language === "es" ? "¡Imagen cargada correctamente!" : "Image uploaded successfully!"}
                          </span>
                          <span className="text-[8px] text-slate-400 font-semibold max-w-[240px] truncate">
                            {editDetailForm.image}
                          </span>
                        </div>
                      ) : (
                        <>
                          <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-sky-500 transition-colors mb-1.5" />
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {language === "es" ? "Haz clic para seleccionar una imagen" : "Click to select an image"}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Tab Content 2: Select Icon */}
                  {editDetailForm.imageType === "icon" && (
                    <div className="p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 grid grid-cols-4 gap-2 bg-slate-50/50 dark:bg-slate-900/10">
                      {MOCK_ICONS.map((ic) => (
                        <button
                          key={ic.name}
                          type="button"
                          onClick={() => setEditDetailForm({ ...editDetailForm, image: ic.url })}
                          className={`p-2 rounded-xl flex flex-col items-center gap-1 border transition-all duration-150 hover-scale cursor-pointer ${
                            editDetailForm.image === ic.url
                              ? "bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400 font-extrabold"
                              : "border-slate-200/50 dark:border-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <img src={ic.url} alt={ic.name} className="w-10 h-10 object-cover rounded-lg" />
                          <span className="text-[9px] font-extrabold">{ic.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tab Content 3: URL */}
                  {editDetailForm.imageType === "url" && (
                    <div className="flex flex-col gap-1 bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
                      <label className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">
                        {language === "es" ? "URL de la Imagen" : "Image URL"}
                      </label>
                      <input
                        type="url"
                        value={editDetailForm.image}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, image: e.target.value })}
                        placeholder="https://ejemplo.com/imagen.jpg"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 text-xs border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Information Grid */}
              <div className="flex flex-col gap-4 text-xs font-semibold">
                
                {/* Row 1: Nombre & Marca */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">{t.name_label}</span>
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
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">{t.brand_label}</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        value={editDetailForm.brand}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, brand: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                        required
                      />
                    ) : (
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 block">{selectedProduct.brand || t.no_brand}</span>
                    )}
                  </div>
                </div>

                {/* Row 2: Modelo & SKU */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">{t.model_label}</span>
                    {isEditingDetail ? (
                      <input
                        type="text"
                        value={editDetailForm.model}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, model: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                        required
                      />
                    ) : (
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 block">{selectedProduct.model || t.no_model}</span>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">{language === "es" ? "SKU (9 Caracteres) *" : "SKU (9 Characters) *"}</span>
                    {isEditingDetail ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={9}
                          value={editDetailForm.sku}
                          onChange={(e) => setEditDetailForm({ ...editDetailForm, sku: e.target.value.toUpperCase() })}
                          className="flex-1 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-mono font-bold uppercase outline-none focus:border-sky-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleGenerateEditSKU}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-[10px] hover-scale flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                          title={language === "es" ? "Generar SKU automáticamente" : "Generate SKU automatically"}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{language === "es" ? "Generar" : "Generate"}</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-mono font-bold text-slate-600 dark:text-slate-300 uppercase block">{selectedProduct.sku || t.no_sku}</span>
                    )}
                  </div>
                </div>

                {/* Row 3: Ubicación Física & Stock Mínimo */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">{language === "es" ? "Ubicación Física *" : "Physical Location *"}</span>
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
                        {selectedProduct.location || t.no_location}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">{t.min_stock_label}</span>
                    {isEditingDetail ? (
                      <input
                        type="number"
                        min="0"
                        value={editDetailForm.minStock}
                        onChange={(e) => setEditDetailForm({ ...editDetailForm, minStock: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500"
                        required
                      />
                    ) : (
                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200 block">
                        {selectedProduct.minStock !== undefined ? selectedProduct.minStock : 0}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/30">
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider block mb-1">{t.desc_label}</span>
                  {isEditingDetail ? (
                    <textarea
                      value={editDetailForm.description}
                      onChange={(e) => setEditDetailForm({ ...editDetailForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-[11px] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-semibold outline-none focus:border-sky-500 resize-none"
                    />
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                      {selectedProduct.description || (language === "es" ? "Sin descripción proporcionada." : "No description provided.")}
                    </p>
                  )}
                </div>

                {/* SKU Validation input */}
                <div className="p-3.5 rounded-2xl bg-emerald-950/20 dark:bg-emerald-900/10 border border-emerald-800/20 dark:border-emerald-700/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-500 dark:text-emerald-300 uppercase font-black tracking-wider">
                      {language === "es" ? "Validación por SKU para modificar Stock" : "SKU Validation to modify Stock"}
                    </span>
                    {detailSkuInput.trim().toUpperCase() === (selectedProduct.sku || "").trim().toUpperCase() ? (
                      <span className="text-[10px] text-lime-600 dark:text-lime-400 font-extrabold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {language === "es" ? "Verificado" : "Verified"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-red-500 dark:text-red-400 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {language === "es" ? "Bloqueado" : "Locked"}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={language === "es" ? "Escriba o escanee el SKU..." : "Type or scan SKU..."}
                      value={detailSkuInput}
                      onChange={(e) => setDetailSkuInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-semibold outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Row 4: Stock controls & Min stock */}
                <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col text-center sm:text-left">
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider mb-0.5">{t.stock_control}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{t.stock_control_desc}</span>
                  </div>
                  
                  {/* Stock adjuster controls */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(selectedProduct.id, -1, selectedProduct.stock)}
                      disabled={detailSkuInput.trim().toUpperCase() !== (selectedProduct.sku || "").trim().toUpperCase() || selectedProduct.stock <= 0}
                      className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-base disabled:opacity-40 hover-scale transition-colors cursor-pointer"
                      title={t.subtract_unit_tooltip}
                    >
                      -
                    </button>
                    <div className="text-center min-w-[50px]">
                      <span className="text-2xl font-black text-slate-800 dark:text-white block">{selectedProduct.stock}</span>
                      <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider block">{t.min_prefix} {selectedProduct.minStock}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(selectedProduct.id, 1, selectedProduct.stock)}
                      disabled={detailSkuInput.trim().toUpperCase() !== (selectedProduct.sku || "").trim().toUpperCase()}
                      className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-black text-base hover-scale transition-colors cursor-pointer disabled:opacity-40"
                      title={t.add_unit_tooltip}
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
                    disabled={isSavingDetail || isUploading}
                    className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover-scale transition-colors disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProductDetails}
                    disabled={isSavingDetail || isUploading}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/15 hover-scale flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingDetail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingDetail ? t.saving : t.save_changes}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedProductId(null)}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover-scale transition-colors"
                >
                  {t.close_details}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* POPUP MODAL: Cambiar Contraseña del Perfil */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#064e3b] text-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 relative overflow-hidden animate-scale-in border border-emerald-800/40 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white font-serif-premium">
                  {language === "es" ? "Cambiar Contraseña" : "Change Password"}
                </h2>
                <p className="text-xs text-emerald-100 mt-0.5 opacity-80">
                  {language === "es" ? "Actualiza tus credenciales de acceso técnico." : "Update your technical access credentials."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors hover-scale"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleChangePasswordSubmit} className="flex flex-col gap-4">
              {/* Contraseña Actual */}
              <div>
                <label className="text-xs font-bold text-emerald-100 block mb-1">
                  {language === "es" ? "Contraseña Actual" : "Current Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={changePasswordForm.currentPassword}
                    onChange={(e) => setChangePasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full py-2.5 rounded-xl text-xs glass-input font-semibold text-slate-800"
                    style={{ paddingLeft: "40px" }}
                    required
                  />
                </div>
              </div>

              {/* Nueva Contraseña */}
              <div>
                <label className="text-xs font-bold text-emerald-100 block mb-1">
                  {language === "es" ? "Nueva Contraseña" : "New Password"}
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={changePasswordForm.newPassword}
                    onChange={(e) => setChangePasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full py-2.5 rounded-xl text-xs glass-input font-semibold text-slate-800"
                    style={{ paddingLeft: "40px" }}
                    required
                  />
                </div>
              </div>

              {/* Confirmar Nueva Contraseña */}
              <div>
                <label className="text-xs font-bold text-emerald-100 block mb-1">
                  {language === "es" ? "Confirmar Nueva Contraseña" : "Confirm New Password"}
                </label>
                <div className="relative">
                  <CheckCircle className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={changePasswordForm.confirmNewPassword}
                    onChange={(e) => setChangePasswordForm(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                    className="w-full py-2.5 rounded-xl text-xs glass-input font-semibold text-slate-800"
                    style={{ paddingLeft: "40px" }}
                    required
                  />
                </div>
              </div>

              {changePasswordError && (
                <div className="flex items-center gap-1.5 p-2.5 rounded-xl bg-red-500/20 text-red-200 text-[10px] font-bold border border-red-500/30">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{changePasswordError}</span>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs hover-scale cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isChangePasswordSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 hover:from-lime-300 hover:to-emerald-400 text-emerald-950 font-black text-xs shadow-lg hover-scale flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer border-none"
                >
                  {isChangePasswordSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{isChangePasswordSubmitting ? (language === "es" ? "Guardando..." : "Saving...") : (language === "es" ? "Guardar" : "Save")}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
