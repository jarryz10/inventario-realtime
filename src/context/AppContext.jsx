import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";

const AppContext = createContext();

// Sample premium items to seed the app initially
const MOCK_INITIAL_ITEMS = [
  {
    id: "item-1",
    name: "iPhone 15 Pro Max",
    category: "Tecnología",
    stock: 15,
    price: 1199,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&auto=format&fit=crop&q=60",
    description: "Smartphone de titanio y silicio, chip A17 Pro, almacenamiento de 256GB y sistema de cámaras avanzado.",
  },
  {
    id: "item-2",
    name: "MacBook Pro M3",
    category: "Tecnología",
    stock: 8,
    price: 1999,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300&auto=format&fit=crop&q=60",
    description: "Laptop profesional de 14 pulgadas con procesador Apple M3, 16GB de RAM unificada y SSD de 512GB.",
  },
  {
    id: "item-3",
    name: "Sony WH-1000XM5",
    category: "Audio",
    stock: 24,
    price: 349,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&auto=format&fit=crop&q=60",
    description: "Auriculares inalámbricos con cancelación de ruido líder del sector, sonido premium y 30 horas de batería.",
  },
  {
    id: "item-4",
    name: "Silla Herman Miller Aeron",
    category: "Mobiliario",
    stock: 5,
    price: 1399,
    image: "https://images.unsplash.com/photo-1580481072645-022f9a6dbf27?w=300&auto=format&fit=crop&q=60",
    description: "Silla ergonómica de oficina icónica con soporte PostureFit ajustable y suspensión de malla transpirable.",
  },
  {
    id: "item-5",
    name: "Teclado Keychron Q1 Pro",
    category: "Periféricos",
    stock: 12,
    price: 199,
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=300&auto=format&fit=crop&q=60",
    description: "Teclado mecánico custom inalámbrico, cuerpo de aluminio, hot-swappable con soporte QMK/VIA.",
  }
];

const MOCK_INITIAL_ORDERS = [
  {
    id: "order-1",
    itemId: "item-3",
    itemName: "Sony WH-1000XM5",
    quantity: 2,
    type: "salida", // 'salida' (pedido de stock) o 'entrada' (abastecimiento)
    requester: "Sofía Martínez",
    status: "completado", // 'pendiente', 'completado', 'cancelado'
    notes: "Para el equipo de diseño audiovisual.",
    date: new Date(Date.now() - 3600000 * 24).toISOString() // hace 1 día
  },
  {
    id: "order-2",
    itemId: "item-1",
    itemName: "iPhone 15 Pro Max",
    quantity: 1,
    type: "salida",
    requester: "Carlos Gómez",
    status: "pendiente",
    notes: "Asignación para nuevo desarrollador senior.",
    date: new Date(Date.now() - 3600000 * 2).toISOString() // hace 2 horas
  }
];

const USERS = [
  { name: "Juan Pérez (Admin)", role: "admin", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
  { name: "María Gómez (Operador)", role: "operator", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
  { name: "Sofía Martínez (Finanzas)", role: "finance", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" }
];

export const AppProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [currentUser, setCurrentUser] = useState(USERS[0]);
  const [theme, setTheme] = useState("light");
  const [activeTab, setActiveTab] = useState("inventario"); // 'inventario' o 'pedidos'
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Sync states in real time using Firebase or fallback
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      // 1. Firebase Listeners
      const itemsQuery = query(collection(db, "items"), orderBy("name", "asc"));
      const unsubscribeItems = onSnapshot(itemsQuery, (snapshot) => {
        const itemsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // If Firestore is empty, seed it on first setup
        if (itemsList.length === 0) {
          MOCK_INITIAL_ITEMS.forEach(async (item) => {
            const { id, ...itemData } = item;
            await addDoc(collection(db, "items"), itemData);
          });
        } else {
          setItems(itemsList);
        }
      });

      const ordersQuery = query(collection(db, "orders"), orderBy("date", "desc"));
      const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
        const ordersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // If Firestore is empty, seed it on first setup
        if (ordersList.length === 0) {
          MOCK_INITIAL_ORDERS.forEach(async (order) => {
            const { id, ...orderData } = order;
            await addDoc(collection(db, "orders"), {
              ...orderData,
              date: orderData.date
            });
          });
        } else {
          setOrders(ordersList);
        }
      });

      return () => {
        unsubscribeItems();
        unsubscribeOrders();
      };
    } else {
      // 2. Local Fallback Sincronización (BroadcastChannel + LocalStorage)
      const loadLocalData = () => {
        const localItems = localStorage.getItem("realtime_items");
        const localOrders = localStorage.getItem("realtime_orders");

        if (localItems) {
          setItems(JSON.parse(localItems));
        } else {
          localStorage.setItem("realtime_items", JSON.stringify(MOCK_INITIAL_ITEMS));
          setItems(MOCK_INITIAL_ITEMS);
        }

        if (localOrders) {
          setOrders(JSON.parse(localOrders));
        } else {
          localStorage.setItem("realtime_orders", JSON.stringify(MOCK_INITIAL_ORDERS));
          setOrders(MOCK_INITIAL_ORDERS);
        }
      };

      loadLocalData();

      // Listen to cross-tab updates via BroadcastChannel
      const channel = new BroadcastChannel("inventory_sync_channel");
      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === "SYNC_ITEMS") {
          setItems(payload);
        } else if (type === "SYNC_ORDERS") {
          setOrders(payload);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // Update theme class on HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Broadcast function for fallback channel
  const broadcastChange = (type, payload) => {
    if (!isFirebaseConfigured) {
      const channel = new BroadcastChannel("inventory_sync_channel");
      channel.postMessage({ type, payload });
      channel.close();
    }
  };

  // ACTIONS

  // 1. Add new item to inventory
  const addItem = async (itemData) => {
    const defaultImage = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=60"; // nice default shoe image
    const newItem = {
      name: itemData.name,
      category: itemData.category || "General",
      stock: parseInt(itemData.stock) || 0,
      price: parseFloat(itemData.price) || 0,
      image: itemData.image || defaultImage,
      description: itemData.description || "",
    };

    if (isFirebaseConfigured && db) {
      await addDoc(collection(db, "items"), newItem);
    } else {
      const updatedItems = [...items, { ...newItem, id: `item-${Date.now()}` }];
      localStorage.setItem("realtime_items", JSON.stringify(updatedItems));
      setItems(updatedItems);
      broadcastChange("SYNC_ITEMS", updatedItems);
    }
  };

  // 2. Add / Subtract stock directly
  const adjustStock = async (itemId, amount) => {
    if (isFirebaseConfigured && db) {
      const itemRef = doc(db, "items", itemId);
      const currentItem = items.find(i => i.id === itemId);
      if (currentItem) {
        const newStock = Math.max(0, currentItem.stock + amount);
        await updateDoc(itemRef, { stock: newStock });
      }
    } else {
      const updatedItems = items.map(item => {
        if (item.id === itemId) {
          return { ...item, stock: Math.max(0, item.stock + amount) };
        }
        return item;
      });
      localStorage.setItem("realtime_items", JSON.stringify(updatedItems));
      setItems(updatedItems);
      broadcastChange("SYNC_ITEMS", updatedItems);
    }
  };

  // 3. Create a new Order Request
  const createOrder = async (orderData) => {
    const targetItem = items.find(i => i.id === orderData.itemId);
    if (!targetItem) return;

    const newOrder = {
      itemId: orderData.itemId,
      itemName: targetItem.name,
      quantity: parseInt(orderData.quantity) || 1,
      type: orderData.type || "salida", // 'salida' or 'entrada'
      requester: currentUser.name,
      status: "pendiente",
      notes: orderData.notes || "",
      date: new Date().toISOString()
    };

    if (isFirebaseConfigured && db) {
      await addDoc(collection(db, "orders"), newOrder);
    } else {
      const updatedOrders = [{ ...newOrder, id: `order-${Date.now()}` }, ...orders];
      localStorage.setItem("realtime_orders", JSON.stringify(updatedOrders));
      setOrders(updatedOrders);
      broadcastChange("SYNC_ORDERS", updatedOrders);
    }
  };

  // 4. Process Pending Order (Approve/Complete or Reject/Cancel)
  const processOrder = async (orderId, newStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== "pendiente") return;

    if (newStatus === "completado") {
      // If approved, update stock
      const targetItem = items.find(i => i.id === order.itemId);
      if (targetItem) {
        const multiplier = order.type === "entrada" ? 1 : -1;
        await adjustStock(order.itemId, order.quantity * multiplier);
      }
    }

    if (isFirebaseConfigured && db) {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
    } else {
      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      });
      localStorage.setItem("realtime_orders", JSON.stringify(updatedOrders));
      setOrders(updatedOrders);
      broadcastChange("SYNC_ORDERS", updatedOrders);
    }
  };

  const selectedItem = items.find(item => item.id === selectedItemId) || null;

  return (
    <AppContext.Provider
      value={{
        items,
        orders,
        currentUser,
        setCurrentUser,
        USERS,
        theme,
        setTheme,
        activeTab,
        setActiveTab,
        selectedItemId,
        setSelectedItemId,
        selectedItem,
        addItem,
        adjustStock,
        createOrder,
        processOrder,
        isFirebaseConfigured
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
