import {
  createOrder,
  getCustomerProfile,
  isLocalMode,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  settings,
  subscribeToProducts,
  watchAuthState,
} from "./firebase.js?v=20260503-3";

const state = {
  products: [],
  cart: loadCart(),
  customer: null,
  selectedQuantities: {},
  filters: {
    search: "",
    category: "all",
  },
};

const elements = {
  cartPanel: document.querySelector("#cart-panel"),
  accountPanel: document.querySelector("#account-panel"),
  imageViewer: document.querySelector("#image-viewer"),
  imageViewerImg: document.querySelector("#image-viewer-img"),
  imageViewerTitle: document.querySelector("#image-viewer-title"),
  cartCount: document.querySelector("#cart-count"),
  heroCartTotal: document.querySelector("#hero-cart-total"),
  heroProductCount: document.querySelector("#hero-product-count"),
  catalogGrid: document.querySelector("#catalog-grid"),
  template: document.querySelector("#product-card-template"),
  connectionStatus: document.querySelector("#connection-status"),
  categoryFilter: document.querySelector("#category-filter"),
  searchInput: document.querySelector("#search-input"),
  cartItems: document.querySelector("#cart-items"),
  cartSubtotal: document.querySelector("#cart-subtotal"),
  cartItemsCount: document.querySelector("#cart-items-count"),
  checkoutForm: document.querySelector("#checkout-form"),
  toast: document.querySelector("#toast"),
  accountStatus: document.querySelector("#account-status"),
};

let toastTimeoutId = null;

document.querySelector("#open-cart-btn")?.addEventListener("click", openCart);
document.querySelector("#account-btn")?.addEventListener("click", openAccount);
document.querySelector("#close-cart-btn")?.addEventListener("click", closeCart);
document.querySelector("#close-account-btn")?.addEventListener("click", closeAccount);
document
  .querySelector("#close-image-viewer-btn")
  ?.addEventListener("click", closeImageViewer);
document
  .querySelector("#close-image-viewer-icon")
  ?.addEventListener("click", closeImageViewer);
document
  .querySelector('[data-close-cart="true"]')
  ?.addEventListener("click", closeCart);
document
  .querySelector('[data-close-account="true"]')
  ?.addEventListener("click", closeAccount);
document.querySelector("#show-login-btn")?.addEventListener("click", () => {
  toggleAccountMode("login");
});
document.querySelector("#show-register-btn")?.addEventListener("click", () => {
  toggleAccountMode("register");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeImageViewer();
  }
});
document
  .querySelector("#logout-customer-btn")
  ?.addEventListener("click", async () => {
    await logoutCustomer();
  });
document
  .querySelector("#use-account-data-btn")
  ?.addEventListener("click", () => {
    applyCustomerProfileToCheckout();
    closeAccount();
    showToast("Datos cargados en el carrito");
  });
elements.catalogGrid?.addEventListener("click", (event) => {
  const quantityButton = event.target.closest(".quantity-btn");
  if (quantityButton) {
    const card = quantityButton.closest(".product-card");
    const productId = card?.dataset.productId;
    if (!productId) {
      return;
    }

    const currentQuantity = state.selectedQuantities[productId] || 1;
    const delta =
      quantityButton.dataset.action === "increase-card" ? 1 : -1;
    state.selectedQuantities[productId] = Math.max(1, currentQuantity + delta);
    updateCardQuantity(productId);
    return;
  }

  const imageButton = event.target.closest(".image-zoom-button");
  if (imageButton) {
    const card = imageButton.closest(".product-card");
    const productId = card?.dataset.productId;
    const product = state.products.find((item) => item.id === productId);
    if (product) {
      openImageViewer(product);
    }
    return;
  }

  const button = event.target.closest(".add-to-cart-btn");
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  addToCart(productId);
});

elements.searchInput?.addEventListener("input", (event) => {
  state.filters.search = event.target.value.trim().toLowerCase();
  renderProducts();
});

elements.categoryFilter?.addEventListener("change", (event) => {
  state.filters.category = event.target.value;
  renderProducts();
});

elements.checkoutForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  checkoutOnWhatsApp().catch((error) => {
    alert(error?.message || "No se pudo completar el pedido.");
  });
});

document
  .querySelector("#login-customer-form")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.accountStatus.textContent = "Iniciando sesion...";

    try {
      const email = document.querySelector("#login-email").value.trim();
      const password = document.querySelector("#login-password").value;
      await loginCustomer(email, password);
      elements.accountStatus.textContent = "Sesion iniciada.";
      closeAccount();
      showToast("Sesion iniciada");
    } catch (error) {
      elements.accountStatus.textContent = friendlyAuthError(error);
      alert(friendlyAuthError(error));
    }
  });

document
  .querySelector("#register-customer-form")
  ?.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.accountStatus.textContent = "Creando cuenta...";

    try {
      const profile = {
        email: document.querySelector("#register-email").value.trim(),
        password: document.querySelector("#register-password").value,
        businessName: document.querySelector("#register-business-name").value.trim(),
        customerName: document.querySelector("#register-customer-name").value.trim(),
        customerPhone: document.querySelector("#register-customer-phone").value.trim(),
        customerAddress: document.querySelector("#register-customer-address").value.trim(),
      };

      await registerCustomer(profile);
      elements.accountStatus.textContent = "Cuenta creada correctamente.";
      applyProfileValues(profile);
      closeAccount();
      showToast("Cuenta creada");
    } catch (error) {
      elements.accountStatus.textContent = friendlyAuthError(error);
      alert(friendlyAuthError(error));
    }
  });

subscribeToProducts((products) => {
  state.products = products.map(normalizeProduct);
  syncCartWithProducts();
  renderCategories();
  renderProducts();
  renderCart();
});

watchAuthState(async (user) => {
  if (!user || isLocalMode) {
    state.customer = null;
    renderCustomerAccount();
    return;
  }

  const profile = await getCustomerProfile(user.uid);
  state.customer = {
    uid: user.uid,
    email: user.email || "",
    ...(profile || {}),
  };
  renderCustomerAccount();
  applyCustomerProfileToCheckout();
});

renderCart();
renderCustomerAccount();

function renderProducts() {
  const filteredProducts = state.products.filter((product) => {
    const matchesSearch = [product.name, product.description, product.category]
      .join(" ")
      .toLowerCase()
      .includes(state.filters.search);
    const matchesCategory =
      state.filters.category === "all" ||
      normalizeText(product.category) === state.filters.category;
    return matchesSearch && matchesCategory;
  });

  elements.catalogGrid.innerHTML = "";
  elements.heroProductCount.textContent = String(filteredProducts.length);

  if (!filteredProducts.length) {
    elements.catalogGrid.innerHTML =
      '<div class="empty-state">No hay productos que coincidan con tu busqueda.</div>';
    return;
  }

  filteredProducts.forEach((product) => {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".product-card");
    const image = fragment.querySelector(".product-image");
    const zoomButton = fragment.querySelector(".image-zoom-button");
    const category = fragment.querySelector(".product-category");
    const title = fragment.querySelector(".product-title");
    const description = fragment.querySelector(".product-description");
    const price = fragment.querySelector(".product-price");
    const button = fragment.querySelector(".add-to-cart-btn");
    const quantity = fragment.querySelector(".card-quantity");

    card.dataset.productId = product.id;
    image.src = safeImageUrl(product.imageUrl, product.name);
    image.alt = product.name;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.src = fallbackImage(product.name);
    });
    category.textContent = product.category;
    title.textContent = product.name;
    description.textContent = product.description;
    price.textContent = formatCurrency(product.price);
    button.dataset.productId = product.id;
    zoomButton.setAttribute("aria-label", `Ver imagen de ${product.name}`);
    quantity.textContent = String(state.selectedQuantities[product.id] || 1);

    elements.catalogGrid.appendChild(fragment);
  });
}

function renderCategories() {
  const categories = Array.from(
    new Set(state.products.map((product) => product.category).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  const currentValue = state.filters.category;
  elements.categoryFilter.innerHTML = '<option value="all">Todas</option>';

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = normalizeText(category);
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });

  elements.categoryFilter.value = categories.some(
    (category) => normalizeText(category) === currentValue,
  )
    ? currentValue
    : "all";
}

function addToCart(productId) {
  if (!productId) {
    alert("No se pudo identificar este producto.");
    return;
  }

  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    alert("Este producto no esta disponible ahora mismo.");
    return;
  }

  const existingItem = state.cart.find((item) => item.id === productId);
  const selectedQuantity = state.selectedQuantities[productId] || 1;

  if (existingItem) {
    existingItem.quantity += selectedQuantity;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      quantity: selectedQuantity,
    });
  }

  persistCart();
  renderCart();
  showToast("Anadido al carrito");
}

function updateQuantity(productId, delta) {
  const item = state.cart.find((entry) => entry.id === productId);
  if (!item) {
    return;
  }

  item.quantity = Math.max(0, item.quantity + delta);
  state.cart = state.cart.filter((entry) => entry.quantity > 0);
  persistCart();
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.id !== productId);
  persistCart();
  renderCart();
}

function renderCart() {
  elements.cartItems.innerHTML = "";

  if (!state.cart.length) {
    elements.cartItems.innerHTML =
      '<div class="empty-state">Tu carrito esta vacio. Agrega algo para empezar.</div>';
  } else {
    state.cart.forEach((item) => {
      const product = state.products.find((entry) => entry.id === item.id);
      const imageUrl = safeImageUrl(product?.imageUrl || item.imageUrl, item.name);
      const cartItem = document.createElement("article");
      cartItem.className = "cart-item";
      cartItem.innerHTML = `
        <img src="${imageUrl}" alt="${item.name}" />
        <div>
          <strong>${item.name}</strong>
          <div class="helper-text">${formatCurrency(item.price)}</div>
          <div class="cart-item-controls">
            <button class="mini-button" type="button" data-action="decrease">-</button>
            <span>${item.quantity}</span>
            <button class="mini-button" type="button" data-action="increase">+</button>
            <button class="mini-button" type="button" data-action="remove">X</button>
          </div>
        </div>
        <strong>${formatCurrency(item.price * item.quantity)}</strong>
      `;

      cartItem
        .querySelector('[data-action="decrease"]')
        ?.addEventListener("click", () => updateQuantity(item.id, -1));
      cartItem
        .querySelector('[data-action="increase"]')
        ?.addEventListener("click", () => updateQuantity(item.id, 1));
      cartItem
        .querySelector('[data-action="remove"]')
        ?.addEventListener("click", () => removeFromCart(item.id));

      elements.cartItems.appendChild(cartItem);
    });
  }

  const total = cartTotal();
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  elements.cartSubtotal.textContent = formatCurrency(total);
  elements.cartItemsCount.textContent = String(totalItems);
  elements.heroCartTotal.textContent = formatCurrency(total);
  elements.cartCount.textContent = String(totalItems);
}

async function checkoutOnWhatsApp() {
  if (!state.cart.length) {
    alert("Tu carrito esta vacio.");
    return;
  }

  const customerName = document.querySelector("#customer-name").value.trim();
  const customerPhone = document.querySelector("#customer-phone").value.trim();
  const customerAddress = document.querySelector("#customer-address").value.trim();
  const businessName = document.querySelector("#business-name").value.trim();

  if (!businessName || !customerName || !customerPhone || !customerAddress) {
    alert("Completa nombre del negocio, nombre, telefono y direccion.");
    return;
  }

  const pendingWindow = window.open("about:blank", "_blank");

  try {
    const orderId = await createOrder({
      businessName,
      customerName,
      customerPhone,
      customerAddress,
      storeName: settings.storeName,
      total: cartTotal(),
      currency: settings.currency,
      items: state.cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        lineTotal: item.price * item.quantity,
      })),
      source: isLocalMode ? "local-preview" : "firebase-storefront",
    });

    const invoiceLines = [
      `Factura de pedido - ${settings.storeName}`,
      `Pedido: ${orderId}`,
      `Negocio: ${businessName}`,
      `Cliente: ${customerName}`,
      `Telefono del cliente: ${customerPhone}`,
      `Direccion: ${customerAddress}`,
      "",
      "Productos:",
      ...state.cart.map(
        (item) =>
          `- ${item.name} | Cantidad: ${item.quantity} | Total: ${formatCurrency(item.price * item.quantity)}`,
      ),
      "",
      `Total: ${formatCurrency(cartTotal())}`,
    ];

    const message = encodeURIComponent(invoiceLines.join("\n"));
    const url = `https://wa.me/${settings.whatsappNumber}?text=${message}`;

    if (pendingWindow) {
      pendingWindow.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    pendingWindow?.close();
    throw error;
  }
}

function cartTotal() {
  return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function openAccount() {
  syncRegisterFormWithCheckout();
  elements.accountPanel.classList.add("is-open");
  elements.accountPanel.setAttribute("aria-hidden", "false");
}

function closeAccount() {
  elements.accountPanel.classList.remove("is-open");
  elements.accountPanel.setAttribute("aria-hidden", "true");
}

function openCart() {
  elements.cartPanel.classList.add("is-open");
  elements.cartPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
}

function openImageViewer(product) {
  if (!elements.imageViewer || !elements.imageViewerImg || !elements.imageViewerTitle) {
    return;
  }

  elements.imageViewerImg.src = safeImageUrl(product.imageUrl, product.name);
  elements.imageViewerImg.alt = product.name;
  elements.imageViewerTitle.textContent = product.name;
  elements.imageViewer.classList.add("is-open");
  elements.imageViewer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  if (!elements.imageViewer || !elements.imageViewerImg) {
    return;
  }

  elements.imageViewer.classList.remove("is-open");
  elements.imageViewer.setAttribute("aria-hidden", "true");
  elements.imageViewerImg.removeAttribute("src");
  document.body.style.overflow = "";
}

function closeCart() {
  elements.cartPanel.classList.remove("is-open");
  elements.cartPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

function showToast(message) {
  if (!elements.toast) {
    return;
  }

  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  elements.toast.setAttribute("aria-hidden", "false");

  window.clearTimeout(toastTimeoutId);
  toastTimeoutId = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    elements.toast.setAttribute("aria-hidden", "true");
  }, 1800);
}

function toggleAccountMode(mode) {
  const loginForm = document.querySelector("#login-customer-form");
  const registerForm = document.querySelector("#register-customer-form");
  const title = document.querySelector("#account-title");

  const isRegister = mode === "register";
  loginForm.classList.toggle("hidden", isRegister);
  registerForm.classList.toggle("hidden", !isRegister);
  title.textContent = isRegister ? "Crear cuenta" : "Iniciar sesion";
}

function syncRegisterFormWithCheckout() {
  const businessName = document.querySelector("#business-name")?.value.trim() || "";
  const customerName = document.querySelector("#customer-name")?.value.trim() || "";
  const customerPhone = document.querySelector("#customer-phone")?.value.trim() || "";
  const customerAddress = document.querySelector("#customer-address")?.value.trim() || "";

  if (businessName) {
    document.querySelector("#register-business-name").value = businessName;
  }
  if (customerName) {
    document.querySelector("#register-customer-name").value = customerName;
  }
  if (customerPhone) {
    document.querySelector("#register-customer-phone").value = customerPhone;
  }
  if (customerAddress) {
    document.querySelector("#register-customer-address").value = customerAddress;
  }
}

function persistCart() {
  try {
    const lightCart = state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));
    localStorage.setItem("fc-cart", JSON.stringify(lightCart));
  } catch {
    // If the browser blocks storage or it's full, keep the cart working in memory.
  }
}

function loadCart() {
  try {
    return (JSON.parse(localStorage.getItem("fc-cart")) || []).map((item) => ({
      id: String(item.id),
      name: String(item.name || "Producto"),
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));
  } catch {
    return [];
  }
}

function syncCartWithProducts() {
  const inventory = new Map(state.products.map((product) => [product.id, product]));

  state.cart = state.cart
    .map((item) => {
      const product = inventory.get(item.id);
      if (!product) {
        return null;
      }

      return {
        ...item,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl || fallbackImage(product.name),
        quantity: Math.max(1, Number(item.quantity) || 1),
      };
    })
    .filter(Boolean);

  persistCart();
}

function renderCustomerAccount() {
  const guestView = document.querySelector("#account-guest-view");
  const userView = document.querySelector("#account-user-view");

  const isLoggedIn = Boolean(state.customer);
  guestView.classList.toggle("hidden", isLoggedIn);
  userView.classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) {
    document.querySelector("#account-btn").textContent = "Mi cuenta";
    elements.accountStatus.textContent =
      "Registra tu cuenta para llenar el carrito mas rapido.";
    return;
  }

  document.querySelector("#account-btn").textContent =
    state.customer.customerName || "Mi cuenta";
  document.querySelector("#account-user-name").textContent =
    state.customer.customerName || "Cliente";
  document.querySelector("#account-user-email").textContent =
    state.customer.email || "";
  document.querySelector("#account-user-business").textContent =
    state.customer.businessName || "";
  document.querySelector("#account-user-phone").textContent =
    state.customer.customerPhone || "";
  document.querySelector("#account-user-address").textContent =
    state.customer.customerAddress || "";
  elements.accountStatus.textContent =
    "Tu cuenta esta lista para autocompletar tus pedidos.";
}

function applyCustomerProfileToCheckout() {
  if (!state.customer) {
    return;
  }

  applyProfileValues(state.customer);
}

function applyProfileValues(profile) {
  document.querySelector("#business-name").value = profile.businessName || "";
  document.querySelector("#customer-name").value = profile.customerName || "";
  document.querySelector("#customer-phone").value = profile.customerPhone || "";
  document.querySelector("#customer-address").value = profile.customerAddress || "";
}

function updateCardQuantity(productId) {
  const card = elements.catalogGrid?.querySelector(
    `.product-card[data-product-id="${CSS.escape(productId)}"]`,
  );
  const quantityLabel = card?.querySelector(".card-quantity");
  if (quantityLabel) {
    quantityLabel.textContent = String(state.selectedQuantities[productId] || 1);
  }
}

function normalizeProduct(product) {
  return {
    ...product,
    id: String(product.id),
    name: String(product.name || "Producto"),
    description: String(product.description || ""),
    category: String(product.category || "General"),
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl.trim() : "",
  };
}

function safeImageUrl(value, label) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return fallbackImage(label);
  }

  try {
    return encodeURI(raw);
  } catch {
    return fallbackImage(label);
  }
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function formatCurrency(value) {
  const amount = new Intl.NumberFormat(settings.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
  return `DOP ${amount}`;
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) {
    return "Ese correo ya tiene una cuenta.";
  }
  if (code.includes("invalid-login-credentials") || code.includes("invalid-credential")) {
    return "Correo o contrasena incorrectos.";
  }
  if (code.includes("weak-password")) {
    return "La contrasena debe tener al menos 6 caracteres.";
  }
  if (code.includes("invalid-email")) {
    return "Correo invalido.";
  }
  return error?.message || "No se pudo completar la accion.";
}

function fallbackImage(label) {
  return `https://placehold.co/800x600/081220/5bf2ff?text=${encodeURIComponent(label)}`;
}
