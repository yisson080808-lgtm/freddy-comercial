import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  getDocs,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig, storeSettings } from "./firebase-config.js";

export const settings = storeSettings;
const useLocalMode =
  !firebaseConfig?.apiKey || firebaseConfig.apiKey.includes("TU_API_KEY");

const localSubscribers = new Set();
const localAuthSubscribers = new Set();
let localUser = loadLocalUser();
const localDbName = "fc-local-db";
const localStoreName = "products";
const localChannel =
  useLocalMode && "BroadcastChannel" in window
    ? new BroadcastChannel("fc-products")
    : null;

let auth = null;
let db = null;
let storage = null;
let productsCollection = null;
let ordersCollection = null;
let customersCollection = null;
let statsDoc = null;

if (!useLocalMode) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  productsCollection = collection(db, "products");
  ordersCollection = collection(db, "orders");
  customersCollection = collection(db, "customers");
  statsDoc = doc(db, "stats", "storefront");
}

export { auth, db, storage, productsCollection, ordersCollection, customersCollection, statsDoc };
export const isLocalMode = useLocalMode;

if (useLocalMode) {
  localUser = null;
  localStorage.removeItem("fc-local-user");
  window.addEventListener("storage", async (event) => {
    if (event.key === "fc-local-products") {
      await notifyProducts();
    }
    if (event.key === "fc-local-user-session") {
      localUser = loadLocalUser();
      notifyAuth();
    }
  });

  localChannel?.addEventListener("message", async () => {
    await notifyProducts();
  });
}

export function subscribeToProducts(callback) {
  if (useLocalMode) {
    localSubscribers.add(callback);
    getLocalProducts().then(callback);
    return () => localSubscribers.delete(callback);
  }

  const productsQuery = query(productsCollection, orderBy("createdAt", "desc"));
  return onSnapshot(productsQuery, (snapshot) => {
    const products = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
    callback(products);
  });
}

export async function upsertProduct(productId, payload) {
  if (useLocalMode) {
    const products = await getLocalProducts();
    const timestamp = new Date().toISOString();

    if (productId) {
      const updated = products.map((product) =>
        product.id === productId
          ? { ...product, ...payload, updatedAt: timestamp }
          : product,
      );
      await saveLocalProducts(updated);
      await notifyProducts();
      return productId;
    }

    const id = `local-${crypto.randomUUID()}`;
    products.unshift({
      id,
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await saveLocalProducts(products);
    await notifyProducts();
    return id;
  }

  const safePayload = {
    ...payload,
    updatedAt: serverTimestamp(),
  };

  if (productId) {
    await updateDoc(doc(db, "products", productId), safePayload);
    return productId;
  }

  const created = await addDoc(productsCollection, {
    ...safePayload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function removeProduct(productId) {
  if (useLocalMode) {
    const currentProducts = await getLocalProducts();
    const filtered = currentProducts.filter((product) => product.id !== productId);
    await saveLocalProducts(filtered);
    await notifyProducts();
    return;
  }

  await deleteDoc(doc(db, "products", productId));
}

export async function loginAdmin(email, password) {
  if (useLocalMode) {
    throw new Error(
      "El panel administrador esta bloqueado en modo local. Configura Firebase Authentication para habilitar acceso seguro.",
    );
  }

  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutAdmin() {
  if (useLocalMode) {
    localUser = null;
    sessionStorage.removeItem("fc-local-user-session");
    localStorage.removeItem("fc-local-user");
    notifyAuth();
    return;
  }

  return signOut(auth);
}

export async function logoutCustomer() {
  return logoutAdmin();
}

export function watchAuthState(callback) {
  if (useLocalMode) {
    localAuthSubscribers.add(callback);
    callback(localUser);
    return () => localAuthSubscribers.delete(callback);
  }

  return onAuthStateChanged(auth, callback);
}

export async function uploadProductImage(file) {
  if (useLocalMode) {
    return fileToDataUrl(file);
  }

  try {
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const imageRef = ref(storage, `products/${fileName}`);
    await withTimeout(uploadBytes(imageRef, file), 12000);
    return getDownloadURL(imageRef);
  } catch {
    // Fallback for projects that are not using Firebase Storage yet.
    return fileToDataUrl(file);
  }
}

export async function seedProducts(products) {
  if (useLocalMode) {
    const current = await getLocalProducts();
    if (current.length) {
      return false;
    }
    const timestamp = new Date().toISOString();
    await saveLocalProducts(
      products.map((product) => ({
        id: `local-${crypto.randomUUID()}`,
        ...product,
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    );
    await notifyProducts();
    return true;
  }

  const snapshot = await getDocs(productsCollection);
  if (!snapshot.empty) {
    return false;
  }

  await Promise.all(
    products.map((product) =>
      addDoc(productsCollection, {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  return true;
}

export async function createOrder(order) {
  if (useLocalMode) {
    const orders = loadLocalOrders();
    orders.unshift({
      id: `order-${crypto.randomUUID()}`,
      ...order,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("fc-local-orders", JSON.stringify(orders));
    await bumpLocalStats("purchases");
    return orders[0].id;
  }

  const created = await addDoc(ordersCollection, {
    ...order,
    createdAt: serverTimestamp(),
  });
  await setDoc(
    statsDoc,
    {
      purchases: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return created.id;
}

export async function registerCustomer(profile) {
  if (useLocalMode) {
    throw new Error("Registro de clientes disponible solo con Firebase real.");
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    profile.email,
    profile.password,
  );

  await setDoc(doc(db, "customers", credential.user.uid), {
    businessName: profile.businessName,
    customerName: profile.customerName,
    customerPhone: profile.customerPhone,
    customerAddress: profile.customerAddress,
    email: profile.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return credential.user;
}

export async function loginCustomer(email, password) {
  if (useLocalMode) {
    throw new Error("Inicio de sesion de clientes disponible solo con Firebase real.");
  }

  return signInWithEmailAndPassword(auth, email, password);
}

export async function getCustomerProfile(userId) {
  if (useLocalMode || !userId) {
    return null;
  }

  const customerDoc = await getDoc(doc(db, "customers", userId));
  return customerDoc.exists() ? customerDoc.data() : null;
}

export async function recordStoreVisit() {
  if (useLocalMode) {
    await bumpLocalStats("visits");
    return;
  }

  await setDoc(
    statsDoc,
    {
      visits: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToStoreStats(callback) {
  if (useLocalMode) {
    callback(loadLocalStats());
    return () => {};
  }

  return onSnapshot(statsDoc, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : { visits: 0, purchases: 0 });
  });
}

async function getLocalProducts() {
  try {
    const database = await openLocalDb();
    if (database) {
      const indexedDbProducts = await readProductsFromIndexedDb(database);
      if (indexedDbProducts.length) {
        return indexedDbProducts;
      }
    }
  } catch {
    // Fallback below.
  }

  try {
    return JSON.parse(localStorage.getItem("fc-local-products")) || [];
  } catch {
    return [];
  }
}

async function saveLocalProducts(products) {
  try {
    const database = await openLocalDb();
    if (database) {
      await writeProductsToIndexedDb(database, products);
    }
  } catch {
    // Continue to fallback storage.
  }

  try {
    localStorage.setItem("fc-local-products", JSON.stringify(products));
  } catch {
    // IndexedDB remains the primary store when localStorage is too small.
  }

  localChannel?.postMessage({ type: "products-updated" });
}

async function notifyProducts() {
  const products = await getLocalProducts();
  localSubscribers.forEach((callback) => callback(products));
}

function loadLocalUser() {
  try {
    return JSON.parse(sessionStorage.getItem("fc-local-user-session"));
  } catch {
    return null;
  }
}

function loadLocalOrders() {
  try {
    return JSON.parse(localStorage.getItem("fc-local-orders")) || [];
  } catch {
    return [];
  }
}

function loadLocalStats() {
  try {
    return JSON.parse(localStorage.getItem("fc-local-stats")) || {
      visits: 0,
      purchases: 0,
    };
  } catch {
    return {
      visits: 0,
      purchases: 0,
    };
  }
}

async function bumpLocalStats(field) {
  const current = loadLocalStats();
  const nextValue = Number(current[field] || 0) + 1;
  const updated = {
    ...current,
    [field]: nextValue,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem("fc-local-stats", JSON.stringify(updated));
}

function notifyAuth() {
  localAuthSubscribers.forEach((callback) => callback(localUser));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function openLocalDb() {
  if (!("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(localDbName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(localStoreName)) {
        database.createObjectStore(localStoreName);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readProductsFromIndexedDb(database) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(localStoreName, "readonly");
    const store = transaction.objectStore(localStoreName);
    const request = store.get("catalog");

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function writeProductsToIndexedDb(database, products) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(localStoreName, "readwrite");
    const store = transaction.objectStore(localStoreName);
    store.put(products, "catalog");

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tiempo de espera agotado.")), timeoutMs),
    ),
  ]);
}
