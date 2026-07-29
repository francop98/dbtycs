// ============================================================================
// DBTYCS — Sincronización con Firestore
// Estructura en la nube:
//   usuarios/{uid}                  -> documento con el perfil
//   usuarios/{uid}/eventos/{id}     -> un documento por comida registrada
//   usuarios/{uid}/insulina/{id}    -> un documento por aplicación de insulina
//
// Estrategia: localStorage sigue siendo la copia rápida/local de siempre.
// Cuando hay sesión iniciada, cada guardado también se escribe en Firestore.
// Al iniciar sesión (o cargar una página estando ya logueado), si la nube
// tiene datos, la nube manda (se baja y pisa lo local). Si la nube está
// vacía pero hay datos locales, se suben (primer login = migración).
// ============================================================================

import { auth, db } from './firebase-init.js';
import {
  doc, setDoc, getDoc, deleteDoc,
  collection, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function uidActual() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

export function estaLogueado() {
  return !!auth.currentUser;
}

// --- Perfil ---

export async function guardarPerfilEnNube(perfil) {
  const uid = uidActual();
  if (!uid || !perfil) return;
  await setDoc(doc(db, 'usuarios', uid), perfil, { merge: true });
}

export async function cargarPerfilDeNube() {
  const uid = uidActual();
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  return snap.exists() ? snap.data() : null;
}

export async function sincronizarPerfil() {
  const uid = uidActual();
  if (!uid) return null;

  const perfilNube = await cargarPerfilDeNube();
  if (perfilNube) {
    localStorage.setItem('dbtycs_perfil', JSON.stringify(perfilNube));
    return perfilNube;
  }

  const perfilLocal = JSON.parse(localStorage.getItem('dbtycs_perfil') || 'null');
  if (perfilLocal) {
    await guardarPerfilEnNube(perfilLocal);
  }
  return perfilLocal;
}

// --- Documentos individuales dentro de una subcolección (eventos / insulina) ---

export async function guardarDocEnNube(nombreColeccion, item) {
  const uid = uidActual();
  if (!uid || !item || !item.id) return;
  await setDoc(doc(db, 'usuarios', uid, nombreColeccion, item.id), item);
}

export async function eliminarDocDeNube(nombreColeccion, id) {
  const uid = uidActual();
  if (!uid) return;
  await deleteDoc(doc(db, 'usuarios', uid, nombreColeccion, id));
}

// --- Sincronización genérica de una colección completa (eventos o insulina) ---
// storageKey: la clave de localStorage (ej. 'dbtycs_eventos')
// guardarLocalFn: función que recibe el array y lo guarda en localStorage
// Devuelve true si bajó datos de la nube (conviene volver a pintar la UI)
export async function sincronizarColeccion(nombreColeccion, storageKey, guardarLocalFn) {
  const uid = uidActual();
  if (!uid) return false;

  const snap = await getDocs(collection(db, 'usuarios', uid, nombreColeccion));
  const datosNube = snap.docs.map((d) => d.data());

  if (datosNube.length > 0) {
    guardarLocalFn(datosNube);
    return true;
  }

  const datosLocal = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (datosLocal.length > 0) {
    const batch = writeBatch(db);
    datosLocal.forEach((item) => {
      batch.set(doc(db, 'usuarios', uid, nombreColeccion, item.id), item);
    });
    await batch.commit();
  }

  return false;
}