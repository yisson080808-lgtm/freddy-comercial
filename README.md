# Freddy Comercial

Tienda web estatica estilo marketplace con:

- Pagina principal futurista
- Catalogo conectado a Firebase
- Carrito con total en tiempo real
- Factura/pedido enviado por WhatsApp
- Panel de administrador para subir mercancia
- Hosting gratis en GitHub Pages, Netlify o Firebase Hosting
- Modo local para probar sin configurar Firebase al inicio
- Guardado de pedidos para llevar historial

## Archivos principales

- `index.html`: tienda para clientes
- `admin.html`: panel de administrador
- `styles.css`: diseno
- `app.js`: logica de carrito, filtros y WhatsApp
- `admin.js`: login y gestion de productos
- `firebase.js`: conexion con Firebase
- `firebase-config.example.js`: ejemplo de configuracion
- `favicon.svg`: icono de la tienda
- `site.webmanifest`: instalacion basica como web app
- `images/products/`: carpeta para fotos de productos en GitHub Pages

## Base de datos recomendada

Usa **Firebase** si quieres subirlo gratis y sin servidor propio.

`SQLite` no es buena opcion para `GitHub Pages`, porque necesitaras un backend para leer y escribir productos.

## Pasos para dejarlo funcionando

## Lo que ya quedo hecho

- Tienda principal responsive para movil, tablet y escritorio
- Carrito con cantidades, total y eliminar articulo
- Factura por WhatsApp al numero del negocio
- Registro del pedido antes de abrir WhatsApp
- Registro e inicio de sesion de clientes
- Panel admin preparado para Firebase Authentication real
- Metadatos base y archivos para publicacion

## Probarla de inmediato

Sin tocar nada ya puedes abrir la web y probarla en modo local.

- La tienda y el carrito funcionan en modo local para pruebas visuales.
- Los productos y pedidos de prueba se guardan en el navegador mientras no configures Firebase.
- El panel administrador queda bloqueado por seguridad hasta conectar Firebase Authentication real.

## Pasar a modo real con Firebase

1. Crea un proyecto en Firebase.
2. Activa:
   - Authentication con Email/Password
   - Firestore Database
   - Storage
3. Edita `firebase-config.js`.
4. Rellena tus credenciales de Firebase y tu numero de WhatsApp en `firebase-config.js`.
5. Crea un usuario administrador en Authentication.
6. Publica reglas de Firestore y Storage.
7. Sube estos archivos a GitHub Pages, Netlify o Firebase Hosting.

## Estructura en Firestore

Coleccion: `products`

Cada documento guarda:

```json
{
  "name": "Auriculares Nebula X9",
  "category": "Audio",
  "description": "Texto del producto",
  "price": 89.99,
  "stock": 18,
  "imageUrl": "https://...",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Coleccion: `orders`

```json
{
  "customerName": "Juan Perez",
  "customerPhone": "8090000000",
  "customerAddress": "Santo Domingo",
  "customerNote": "Opcional",
  "total": 1500,
  "currency": "DOP",
  "items": [
    {
      "id": "producto-id",
      "name": "Nombre",
      "price": 500,
      "quantity": 3,
      "lineTotal": 1500
    }
  ],
  "createdAt": "timestamp"
}
```

Coleccion: `customers`

```json
{
  "businessName": "Colmado Lopez",
  "customerName": "Juan Perez",
  "customerPhone": "8090000000",
  "customerAddress": "Santo Domingo",
  "email": "cliente@correo.com",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Reglas iniciales sugeridas

### Firestore

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /orders/{document=**} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
    match /customers/{userId} {
      allow create: if request.auth != null && request.auth.uid == userId;
      allow read, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false;
    }
  }
}
```

### Storage

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Hosting gratis recomendado

### Opcion 1: GitHub Pages

Ideal si quieres solo frontend + Firebase.

### Opcion 2: Netlify

Muy facil para arrastrar y publicar.

### Opcion 3: Firebase Hosting

Buena opcion si quieres todo dentro de Firebase.

## Usar una carpeta local de imagenes

Si no quieres depender de Firebase Storage, puedes guardar las fotos dentro de:

`images/products/`

Luego en el panel admin pegas la ruta asi:

`./images/products/mi-producto.jpg`

### Como subir imagenes desde GitHub

1. Entra a tu repositorio en GitHub.
2. Abre la carpeta `images/products`.
3. Dale a `Add file`.
4. Luego a `Upload files`.
5. Sube la foto.
6. Usa en el admin una ruta como:
   `./images/products/nombre-de-tu-foto.jpg`

## Nota importante

Mientras `firebase-config.js` siga con valores tipo `TU_API_KEY`, la app trabajara en modo local.

## Lo que te toca a ti

1. Crear tu proyecto en Firebase.
2. Activar Authentication, Firestore y Storage.
3. Crear el usuario administrador real en Firebase Authentication.
4. Poner tus credenciales reales en `firebase-config.js`.
5. Publicar las reglas de Firestore y Storage.
6. Subir la carpeta a GitHub Pages, Netlify o Firebase Hosting.
7. Probar un pedido real desde tu telefono con WhatsApp.

## Recomendacion final

Si quieres seguridad real, publica esta tienda usando Firebase real antes de empezar a vender.
