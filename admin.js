import {
  isLocalMode,
  loginAdmin,
  logoutAdmin,
  removeProduct,
  seedProducts,
  settings,
  subscribeToProducts,
  uploadProductImage,
  upsertProduct,
  watchAuthState,
} from "./firebase.js?v=20260504-2";
import { demoProducts } from "./demo-products.js";

const authPanel = document.querySelector(".auth-panel");
const adminPanel = document.querySelector("#admin-panel");
const authStatus = document.querySelector("#auth-status");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-btn");
const productForm = document.querySelector("#product-form");
const productsList = document.querySelector("#admin-products-list");

let products = [];

authPanel.classList.remove("hidden");
adminPanel.classList.add("hidden");

if (isLocalMode) {
  authStatus.textContent =
    "Modo local detectado. El panel administrador esta bloqueado por seguridad.";
  loginForm
    ?.querySelectorAll("input, button")
    .forEach((element) => {
      element.disabled = true;
    });
}

// 🔐 LOGIN
loginButton?.addEventListener("click", async () => {
  authStatus.textContent = "Validando acceso...";

  try {
    const email = document.querySelector("#admin-email").value.trim();
    const password = document.querySelector("#admin-password").value;
    await loginAdmin(email, password);
    authStatus.textContent = "Sesion iniciada.";
  } catch (error) {
    console.error("Error de inicio de sesion:", error);
    alert(friendlyError(error));
    authStatus.textContent = friendlyError(error);
  }
});

// 🔐 LOGOUT
document.querySelector("#logout-btn")?.addEventListener("click", async () => {
  await logoutAdmin();
});

// DEMO
document.querySelector("#seed-btn")?.addEventListener("click", async () => {
  const inserted = await seedProducts(demoProducts);
  alert(
    inserted
      ? "Productos demo insertados."
      : "Ya existen productos en la base de datos."
  );
});

// 🛒 CREAR / EDITAR PRODUCTO
productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = productForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Guardando...";

  try {
    const productId = document.querySelector("#product-id").value.trim();
    const imageFile = document.querySelector("#product-image").files[0];
    const manualImageUrl = document.querySelector("#product-image-url").value.trim();
    const currentProduct = products.find((item) => item.id === productId);
    let imageUrl = manualImageUrl || currentProduct?.imageUrl || "";

    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile);
    }

    await upsertProduct(productId, {
      name: document.querySelector("#product-name").value.trim(),
      price: Number(document.querySelector("#product-price").value),
      stock: 9999,
      category: document.querySelector("#product-category").value.trim(),
      description: document.querySelector("#product-description").value.trim(),
      sizes: parseSizes(document.querySelector("#product-sizes").value),
      imageUrl,
      storeName: settings.storeName,
    });

    productForm.reset();
    document.querySelector("#product-id").value = "";
    alert(productId ? "Producto actualizado correctamente." : "Producto creado correctamente.");
  } catch (error) {
    alert(friendlyError(error));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Guardar producto";
  }
});


watchAuthState((user) => {
  if (isLocalMode) {
    authPanel.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    return;
  }

  const isLoggedIn = Boolean(user);
  authPanel.classList.toggle("hidden", isLoggedIn);
  adminPanel.classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    authStatus.textContent = `Sesion activa: ${user.email}`;
  } else {
    authStatus.textContent = "Inicia sesion con tu usuario administrador.";
  }
});


// 🔄 PRODUCTOS
subscribeToProducts((items) => {
  products = items;
  renderAdminProducts();
});

function renderAdminProducts() {
  productsList.innerHTML = "";

  if (!products.length) {
    productsList.innerHTML =
      '<div class="empty-state">Aun no hay productos. Crea uno o inserta la demo.</div>';
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "admin-item";
    card.innerHTML = `
      <img src="${product.imageUrl || fallbackImage(product.name)}" alt="${product.name}" />
      <h3>${product.name}</h3>
      <p class="admin-item-meta">${product.category}</p>
      ${product.sizes?.length ? `<p class="helper-text">Tallas: ${product.sizes.join(", ")}</p>` : ""}
      <p>${product.description}</p>
      <strong>${formatCurrency(product.price)}</strong>
      <div class="admin-item-actions">
        <button class="secondary-button" type="button" data-action="edit">Editar</button>
        <button class="secondary-button danger-button" type="button" data-action="delete">Eliminar</button>
      </div>
    `;

    card
      .querySelector('[data-action="edit"]')
      ?.addEventListener("click", () => populateForm(product));

    card
      .querySelector('[data-action="delete"]')
      ?.addEventListener("click", async () => {
        const confirmed = window.confirm(`Eliminar "${product.name}"?`);
        if (confirmed) {
          await removeProduct(product.id);
        }
      });

    productsList.appendChild(card);
  });
}

function populateForm(product) {
  document.querySelector("#product-id").value = product.id;
  document.querySelector("#product-name").value = product.name;
  document.querySelector("#product-price").value = product.price;
  document.querySelector("#product-category").value = product.category;
  document.querySelector("#product-description").value = product.description;
  document.querySelector("#product-sizes").value = (product.sizes || []).join(", ");
  document.querySelector("#product-image-url").value = product.imageUrl || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function parseSizes(value) {
  return String(value || "")
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean);
}

function formatCurrency(value) {
  const amount = new Intl.NumberFormat(settings.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
  return `DOP ${amount}`;
}

function fallbackImage(label) {
  return `https://placehold.co/800x600/081220/5bf2ff?text=${encodeURIComponent(label)}`;
}

function friendlyError(error) {
  const code = error?.code || "";

  if (code.includes("invalid-credential")) {
    return "Correo o contrasena incorrectos.";
  }

  if (code.includes("auth/invalid-login-credentials")) {
    return "Correo o contrasena incorrectos.";
  }

  if (code.includes("auth/network-request-failed")) {
    return "No se pudo conectar con Firebase.";
  }

  if (code.includes("storage/unauthorized")) {
    return "No tienes permisos para subir imagenes en Firebase Storage.";
  }

  return error?.message || "Ocurrio un error inesperado.";
}
