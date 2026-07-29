// ============================================================================
// DBTYCS — Inicialización central de Firebase
// Todos los demás módulos (onboarding.js, registro.js, insulina.js, main.js)
// importan `auth` y `db` desde acá en vez de repetir la configuración.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7R3tUNl598ikgC8pzSfjJgAu718UZox4",
  authDomain: "dbtycs.firebaseapp.com",
  projectId: "dbtycs",
  storageBucket: "dbtycs.firebasestorage.app",
  messagingSenderId: "386450176653",
  appId: "1:386450176653:web:ac7d2273fb9af4211800c4"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);