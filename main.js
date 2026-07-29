import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyC7R3tUNl598ikgC8pzSfjJgAu718UZox4",
  authDomain: "dbtycs.firebaseapp.com",
  projectId: "dbtycs",
  storageBucket: "dbtycs.firebasestorage.app",
  messagingSenderId: "386450176653",
  appId: "1:386450176653:web:ac7d2273fb9af4211800c4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Provider de Google
const googleProvider = new GoogleAuthProvider();

// ==========================================
// 2. ELEMENTOS DEL DOM
// ==========================================
const modalAuth = document.getElementById("modalAuth");
const formLogin = document.getElementById("formLogin");
const formRegister = document.getElementById("formRegister");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const regEmail = document.getElementById("regEmail");
const regUsername = document.getElementById("regUsername");
const regPassword = document.getElementById("regPassword");
const regPasswordConfirm = document.getElementById("regPasswordConfirm");

const btnToggleLoginPassword = document.getElementById("btnToggleLoginPassword");
const btnToggleRegPassword = document.getElementById("btnToggleRegPassword");
const btnGoogleAuth = document.getElementById("btnGoogleAuth");
const chkRememberMe = document.getElementById("chkRememberMe");

const mensajeLoginError = document.getElementById("mensajeLoginError");
const mensajeRegError = document.getElementById("mensajeRegError");
const saludoUsuario = document.getElementById("saludoUsuario");
const btnCerrarSesion = document.getElementById("btnCerrarSesion");
const btnAbrirAuth = document.getElementById("btnAbrirAuth");

// Modales Calculadoras y Ficha
const modalFicha = document.getElementById("modalFicha");
const modalBasal = document.getElementById("modalBasal");
const modalRapida = document.getElementById("modalRapida");
const modalRatioIC = document.getElementById("modalRatioIC");
const modalFSI = document.getElementById("modalFSI");

// ==========================================
// 3. EVENTOS: MOSTRAR / OCULTAR CONTRASEÑA
// ==========================================
function togglePasswordVisibility(inputElement, buttonElement) {
  if (inputElement.type === "password") {
    inputElement.type = "text";
    buttonElement.textContent = "🙈"; // Clave al descubierto -> Ojo oculto/tachado
    buttonElement.setAttribute("aria-label", "Ocultar contraseña");
  } else {
    inputElement.type = "password";
    buttonElement.textContent = "👁️"; // Clave oculta -> Ojo abierto
    buttonElement.setAttribute("aria-label", "Mostrar contraseña");
  }
}

if (btnToggleLoginPassword && loginPassword) {
  btnToggleLoginPassword.addEventListener("click", () => {
    togglePasswordVisibility(loginPassword, btnToggleLoginPassword);
  });
}

if (btnToggleRegPassword && regPassword) {
  btnToggleRegPassword.addEventListener("click", () => {
    togglePasswordVisibility(regPassword, btnToggleRegPassword);
  });
}

// ==========================================
// 4. CAMBIO DE PESTAÑAS (LOGIN / REGISTRO)
// ==========================================
if (tabLogin && tabRegister) {
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    formLogin.style.display = "block";
    formRegister.style.display = "none";
  });

  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    formRegister.style.display = "block";
    formLogin.style.display = "none";
  });
}

// ==========================================
// 5. AUTENTICACIÓN CON GOOGLE
// ==========================================
if (btnGoogleAuth) {
  btnGoogleAuth.addEventListener("click", async () => {
    try {
      const persistenceType = (chkRememberMe && chkRememberMe.checked)
        ? browserLocalPersistence 
        : browserSessionPersistence;

      await setPersistence(auth, persistenceType);
      await signInWithPopup(auth, googleProvider);
      
      if (modalAuth) modalAuth.style.display = "none";
    } catch (error) {
      console.error("Error al autenticar con Google:", error);
      mostrarError(mensajeLoginError, "Error al iniciar sesión con Google: " + error.message);
    }
  });
}

// ==========================================
// 6. AUTENTICACIÓN POR EMAIL Y CONTRASEÑA
// ==========================================
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultarError(mensajeLoginError);

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    try {
      const persistenceType = (chkRememberMe && chkRememberMe.checked)
        ? browserLocalPersistence 
        : browserSessionPersistence;

      await setPersistence(auth, persistenceType);
      await signInWithEmailAndPassword(auth, email, password);
      
      if (modalAuth) modalAuth.style.display = "none";
      formLogin.reset();
    } catch (error) {
      mostrarError(mensajeLoginError, obtenerMensajeError(error.code));
    }
  });
}

if (formRegister) {
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    ocultarError(mensajeRegError);

    const username = regUsername ? regUsername.value.trim() : '';
    const email = regEmail.value.trim();
    const password = regPassword.value;
    const passwordConfirm = regPasswordConfirm.value;

    if (!username) {
      mostrarError(mensajeRegError, "Ingresá un nombre de usuario.");
      return;
    }

    if (password !== passwordConfirm) {
      mostrarError(mensajeRegError, "Las contraseñas no coinciden.");
      return;
    }

    try {
      const credencial = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credencial.user, { displayName: username });

      // Cuenta creada -> seguimos directo al onboarding para completar el perfil de salud
      window.location.href = 'pages/onboarding.html';
    } catch (error) {
      mostrarError(mensajeRegError, obtenerMensajeError(error.code));
    }
  });
}

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  });
}

// Estado de perfil en memoria — lo llenamos cuando cargamos el perfil (más abajo)
let perfil = null;

// Botón opcional para abrir login/registro manualmente
if (btnAbrirAuth) {
  btnAbrirAuth.addEventListener("click", () => {
    if (modalAuth) modalAuth.style.display = "flex";
  });
}

// Observer del estado de Autenticación
onAuthStateChanged(auth, (user) => {
  if (user) {
    if (modalAuth) modalAuth.style.display = "none";
    if (saludoUsuario) {
      // Con sesión iniciada, el saludo usa el nombre de usuario (Firebase), no el de la ficha médica
      const nombreMostrar = user.displayName || user.email.split('@')[0];
      saludoUsuario.textContent = `Hola, ${nombreMostrar}`;
    }
    if (btnCerrarSesion) btnCerrarSesion.style.display = "block";
    if (btnAbrirAuth) btnAbrirAuth.style.display = "none";
  } else {
    // Sin sesión (modo local): el saludo usa el nombre cargado en el onboarding, si existe
    if (saludoUsuario) {
      saludoUsuario.textContent = (perfil && perfil.nombre) ? `Hola, ${perfil.nombre.split(' ')[0]}` : "Hola, Usuario";
    }
    if (btnCerrarSesion) btnCerrarSesion.style.display = "none";
    if (btnAbrirAuth) btnAbrirAuth.style.display = "inline-flex";
  }
});

// ==========================================
// 7. GESTIÓN DE MODALES DE LA INTERFAZ
// ==========================================
function abrirModal(modal) {
  if (modal) modal.style.display = "flex";
}

function cerrarModal(modal) {
  if (modal) modal.style.display = "none";
}

document.getElementById("cardFichaMedica")?.addEventListener("click", () => {
  renderFichaMedica();
  abrirModal(modalFicha);
});
document.getElementById("btnCerrarModal")?.addEventListener("click", () => cerrarModal(modalFicha));

document.getElementById("btnIrRatioIC")?.addEventListener("click", () => abrirModal(modalRatioIC));
document.getElementById("btnCerrarModalRatioIC")?.addEventListener("click", () => cerrarModal(modalRatioIC));

document.getElementById("btnIrFSI")?.addEventListener("click", () => abrirModal(modalFSI));
document.getElementById("btnCerrarModalFSI")?.addEventListener("click", () => cerrarModal(modalFSI));

// Cerrar modal al hacer clic en el fondo
window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.style.display = "none";
  }
});

// ==========================================
// 8. FUNCIONES AUXILIARES DE ERROR (AUTH)
// ==========================================
function mostrarError(elemento, mensaje) {
  if (elemento) {
    elemento.textContent = mensaje;
    elemento.style.display = "block";
  }
}

function ocultarError(elemento) {
  if (elemento) {
    elemento.textContent = "";
    elemento.style.display = "none";
  }
}

function obtenerMensajeError(codigo) {
  switch (codigo) {
    case "auth/invalid-email":
      return "El correo electrónico no es válido.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Este correo ya está registrado.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/popup-closed-by-user":
      return "Se cerró la ventana de inicio de sesión de Google.";
    default:
      return "Ocurrió un error. Inténtalo nuevamente.";
  }
}

// ==========================================
// 9. PERFIL, CALCULADORAS Y FICHA MÉDICA
// (reincorporado — esto faltaba en la versión con Firebase)
// ==========================================

const perfilGuardado = localStorage.getItem('dbtycs_perfil') || localStorage.getItem('perfilDiabetes');
if (perfilGuardado) {
  try {
    perfil = JSON.parse(perfilGuardado);
  } catch (e) {
    console.error('Error al parsear el perfil:', e);
  }
}

// Si hay perfil guardado, el saludo usa el nombre del perfil por encima del de Firebase
if (saludoUsuario && perfil && perfil.nombre) {
  const primerNombre = perfil.nombre.split(' ')[0];
  saludoUsuario.textContent = `Hola, ${primerNombre}`;
}

function calcularEdad(fechaNacimientoStr) {
  if (!fechaNacimientoStr) return null;
  const fechaNac = new Date(fechaNacimientoStr);
  if (isNaN(fechaNac.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const m = hoy.getMonth() - fechaNac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : null;
}

// --- CALCULADORA DE INSULINA BASAL ---
const btnIrBasal = document.getElementById('btnIrBasal');
const btnCerrarModalBasal = document.getElementById('btnCerrarModalBasal');
const btnCalcularBasalAccion = document.getElementById('btnCalcularBasalAccion');

const lblPesoPerfil = document.getElementById('lblPesoPerfil');
const lblActividadPerfil = document.getElementById('lblActividadPerfil');
const resultadoBasalContainer = document.getElementById('resultadoBasalContainer');
const valorDosisBasal = document.getElementById('valorDosisBasal');
const detalleCalculoBasal = document.getElementById('detalleCalculoBasal');

const basalContenidoNormal = document.getElementById('basalContenidoNormal');
const basalAlertaFaltaDatos = document.getElementById('basalAlertaFaltaDatos');

let pesoUsuario = null;
let actividadLaboral = 'ligero';
let deporteFrecuencia = 'ninguno';
let patronesEspeciales = [];

if (btnIrBasal) {
  btnIrBasal.addEventListener('click', () => {
    abrirModal(modalBasal);

    pesoUsuario = perfil ? (perfil.peso || perfil.pesoKg) : null;
    actividadLaboral = perfil ? (perfil.trabajo || 'ligero') : 'ligero';
    deporteFrecuencia = perfil ? (perfil.deporte || 'ninguno') : 'ninguno';
    patronesEspeciales = perfil && Array.isArray(perfil.patrones) ? perfil.patrones : [];

    if (!pesoUsuario) {
      if (basalContenidoNormal) basalContenidoNormal.style.display = 'none';
      if (basalAlertaFaltaDatos) basalAlertaFaltaDatos.style.display = 'block';
    } else {
      if (basalContenidoNormal) basalContenidoNormal.style.display = 'block';
      if (basalAlertaFaltaDatos) basalAlertaFaltaDatos.style.display = 'none';
      if (lblPesoPerfil) lblPesoPerfil.textContent = `${pesoUsuario} kg`;

      const textosActividad = {
        sedentario: 'Sedentario (Oficina / Poco movimiento)',
        ligero: 'Ligeramente activo',
        activo: 'Moderadamente activo',
        muy_activo: 'Muy activo / Trabajo pesado'
      };

      const textosDeporte = {
        ninguno: 'Sin ejercicio regular',
        '1_2': '1-2 veces por semana',
        '3_4': '3-4 veces por semana',
        '5_mas': '5+ veces por semana (Intenso)'
      };

      if (lblActividadPerfil) {
        let textoPatronesInfo = patronesEspeciales.length > 0 ? ` | Factores: ${patronesEspeciales.length}` : '';
        lblActividadPerfil.textContent = `${textosActividad[actividadLaboral] || 'Estándar'} | Deporte: ${textosDeporte[deporteFrecuencia] || 'Ninguno'}${textoPatronesInfo}`;
      }

      if (resultadoBasalContainer) resultadoBasalContainer.style.display = 'none';
    }
  });
}

if (btnCerrarModalBasal) {
  btnCerrarModalBasal.addEventListener('click', () => cerrarModal(modalBasal));
}

if (btnCalcularBasalAccion) {
  btnCalcularBasalAccion.addEventListener('click', () => {
    if (!pesoUsuario) return;

    let factorMin = 0.35;
    let factorMax = 0.50;

    if (actividadLaboral === 'sedentario') {
      factorMin += 0.05;
      factorMax += 0.05;
    } else if (actividadLaboral === 'muy_activo') {
      factorMin -= 0.05;
      factorMax -= 0.05;
    }

    if (deporteFrecuencia === '5_mas') {
      factorMin -= 0.08;
      factorMax -= 0.08;
    } else if (deporteFrecuencia === '3_4') {
      factorMin -= 0.04;
      factorMax -= 0.04;
    }

    if (patronesEspeciales.includes('fenomeno_alba') || patronesEspeciales.includes('estres')) {
      factorMin += 0.05;
      factorMax += 0.08;
    }
    if (patronesEspeciales.includes('ciclo_menstrual')) {
      factorMax += 0.05;
    }

    if (factorMin < 0.30) factorMin = 0.30;
    if (factorMax > 0.65) factorMax = 0.65;

    const dosisMinCalculada = pesoUsuario * factorMin;
    const dosisMaxCalculada = pesoUsuario * factorMax;

    const dosisMinFinal = Math.round(dosisMinCalculada * 2) / 2;
    const dosisMaxFinal = Math.round(dosisMaxCalculada * 2) / 2;

    if (valorDosisBasal) {
      valorDosisBasal.textContent = `Entre ${dosisMinFinal} y ${dosisMaxFinal} Unidades / día`;
    }

    if (detalleCalculoBasal) {
      detalleCalculoBasal.innerHTML = `
        Cálculo basado en tu peso de <strong>${pesoUsuario} kg</strong>, factor adaptado de <strong>${factorMin.toFixed(2)} a ${factorMax.toFixed(2)} u/kg</strong> (considerando actividad, deporte y factores especiales).<br>
        <em>Nota: Este rango orientativo te ayuda a evaluar valores lógicos. Valida siempre cualquier ajuste con tu médico tratante.</em>
      `;
    }

    if (resultadoBasalContainer) {
      resultadoBasalContainer.style.display = 'block';
    }
  });
}

// --- CALCULADORA DE INSULINA RÁPIDA ---
const btnIrRapida = document.getElementById('btnIrRapida');
const btnCerrarModalRapida = document.getElementById('btnCerrarModalRapida');
const btnCalcularRapidaAccion = document.getElementById('btnCalcularRapidaAccion');

const rapidaContenidoNormal = document.getElementById('rapidaContenidoNormal');
const rapidaAlertaFaltaDatos = document.getElementById('rapidaAlertaFaltaDatos');

const inputCarbs = document.getElementById('inputCarbs');
const inputGlucemiaActual = document.getElementById('inputGlucemiaActual');
const inputGlucemiaObjetivo = document.getElementById('inputGlucemiaObjetivo');

const resultadoRapidaContainer = document.getElementById('resultadoRapidaContainer');
const valorDosisRapida = document.getElementById('valorDosisRapida');
const detalleCalculoRapida = document.getElementById('detalleCalculoRapida');

if (btnIrRapida) {
  btnIrRapida.addEventListener('click', () => {
    abrirModal(modalRapida);

    const ratioIC = perfil ? perfil.ratioIC : null;

    if (!ratioIC) {
      if (rapidaContenidoNormal) rapidaContenidoNormal.style.display = 'none';
      if (rapidaAlertaFaltaDatos) rapidaAlertaFaltaDatos.style.display = 'block';
    } else {
      if (rapidaContenidoNormal) rapidaContenidoNormal.style.display = 'block';
      if (rapidaAlertaFaltaDatos) rapidaAlertaFaltaDatos.style.display = 'none';
      if (inputCarbs) inputCarbs.value = '';
      if (inputGlucemiaActual) inputGlucemiaActual.value = '';
      if (resultadoRapidaContainer) resultadoRapidaContainer.style.display = 'none';
    }
  });
}

if (btnCerrarModalRapida) {
  btnCerrarModalRapida.addEventListener('click', () => cerrarModal(modalRapida));
}

if (btnCalcularRapidaAccion) {
  btnCalcularRapidaAccion.addEventListener('click', () => {
    if (!perfil || !perfil.ratioIC) return;

    const gramosCarbs = parseFloat(inputCarbs.value) || 0;
    const ratioIC = Number(perfil.ratioIC);

    const unidadesCarbs = gramosCarbs / ratioIC;

    let unidadesCorreccion = 0;
    const glucemiaActual = parseFloat(inputGlucemiaActual.value);
    const glucemiaObjetivo = parseFloat(inputGlucemiaObjetivo.value) || 100;
    const isf = Number(perfil.factorCorreccion) || 0;

    let textoCorreccion = '';
    if (!isNaN(glucemiaActual) && isf > 0) {
      const diferenciaGlucemia = glucemiaActual - glucemiaObjetivo;
      unidadesCorreccion = diferenciaGlucemia / isf;
      textoCorreccion = `<br>Corrección por glucemia (${glucemiaActual} mg/dL vs objetivo ${glucemiaObjetivo}): <strong>${unidadesCorreccion >= 0 ? '+' : ''}${unidadesCorreccion.toFixed(1)} U</strong> (ISF: ${isf})`;
    }

    let dosisTotal = unidadesCarbs + unidadesCorreccion;
    if (dosisTotal < 0) dosisTotal = 0;

    const dosisRedondeada = Math.round(dosisTotal * 2) / 2;

    if (valorDosisRapida) {
      valorDosisRapida.textContent = `${dosisRedondeada} Unidades`;
    }

    if (detalleCalculoRapida) {
      detalleCalculoRapida.innerHTML = `
        Insulina para ${gramosCarbs} g de carbohidratos (Ratio I:C: ${ratioIC}): <strong>${unidadesCarbs.toFixed(1)} U</strong>
        ${textoCorreccion}<br>
        <em>Total exacto calculado: ${dosisTotal.toFixed(2)} U (redondeado a ${dosisRedondeada} U). Valida siempre con tu médico.</em>
      `;
    }

    if (resultadoRapidaContainer) {
      resultadoRapidaContainer.style.display = 'block';
    }
  });
}

// --- CALCULADORA DE RATIO I:C (Regla del 500) ---
const btnCalcularRatioICAccion = document.getElementById('btnCalcularRatioICAccion');
const btnAplicarRatioIC = document.getElementById('btnAplicarRatioIC');

const inputDTDRatio = document.getElementById('inputDTDRatio');
const resultadoRatioICContainer = document.getElementById('resultadoRatioICContainer');
const valorRatioIC = document.getElementById('valorRatioIC');
const detalleCalculoRatioIC = document.getElementById('detalleCalculoRatioIC');

let ratioCalculado = null;

if (btnCalcularRatioICAccion) {
  btnCalcularRatioICAccion.addEventListener('click', () => {
    const dtd = parseFloat(inputDTDRatio.value);

    if (!dtd || dtd <= 0) {
      alert('Ingresá tu Dosis Total Diaria (basal + bolos) para calcular.');
      return;
    }

    ratioCalculado = Math.round((500 / dtd) * 2) / 2;

    if (valorRatioIC) valorRatioIC.textContent = `1U cada ${ratioCalculado} g`;

    if (detalleCalculoRatioIC) {
      detalleCalculoRatioIC.innerHTML = `
        Con una DTD de <strong>${dtd} U/día</strong>: 500 ÷ ${dtd} = <strong>${ratioCalculado} g/U</strong> (Regla del 500).
      `;
    }

    if (resultadoRatioICContainer) resultadoRatioICContainer.style.display = 'block';
  });
}

if (btnAplicarRatioIC) {
  btnAplicarRatioIC.addEventListener('click', () => {
    if (ratioCalculado === null) return;

    const confirmado = confirm(
      `¿Confirmás que ya validaste este valor con tu médico?\n\nRatio I:C: 1U cada ${ratioCalculado}g\n\nEsto va a reemplazar el valor actual de tu ficha.`
    );
    if (!confirmado) return;

    const perfilActual = JSON.parse(localStorage.getItem('dbtycs_perfil') || '{}');
    perfilActual.ratioIC = ratioCalculado;
    perfilActual.actualizadoEn = new Date().toISOString();

    localStorage.setItem('dbtycs_perfil', JSON.stringify(perfilActual));
    perfil = perfilActual;

    alert('Listo, se actualizó tu Ratio I:C en la ficha médica.');
    cerrarModal(modalRatioIC);
  });
}

// --- CALCULADORA DE FSI (Regla del 1800 — NovoRapid) ---
const btnCalcularFSIAccion = document.getElementById('btnCalcularFSIAccion');
const btnAplicarFSI = document.getElementById('btnAplicarFSI');

const inputDTDFSI = document.getElementById('inputDTDFSI');
const resultadoFSIContainer = document.getElementById('resultadoFSIContainer');
const valorFSI = document.getElementById('valorFSI');
const detalleCalculoFSI = document.getElementById('detalleCalculoFSI');

let fsiCalculado = null;

if (btnCalcularFSIAccion) {
  btnCalcularFSIAccion.addEventListener('click', () => {
    const dtd = parseFloat(inputDTDFSI.value);

    if (!dtd || dtd <= 0) {
      alert('Ingresá tu Dosis Total Diaria (basal + bolos) para calcular.');
      return;
    }

    const constanteFSI = 1800;
    fsiCalculado = Math.round((constanteFSI / dtd) * 2) / 2;

    if (valorFSI) valorFSI.textContent = `${fsiCalculado} mg/dL`;

    if (detalleCalculoFSI) {
      detalleCalculoFSI.innerHTML = `
        Con una DTD de <strong>${dtd} U/día</strong>: ${constanteFSI} ÷ ${dtd} = <strong>${fsiCalculado} mg/dL/U</strong> (Regla del ${constanteFSI}, para NovoRapid).
      `;
    }

    if (resultadoFSIContainer) resultadoFSIContainer.style.display = 'block';
  });
}

if (btnAplicarFSI) {
  btnAplicarFSI.addEventListener('click', () => {
    if (fsiCalculado === null) return;

    const confirmado = confirm(
      `¿Confirmás que ya validaste este valor con tu médico?\n\nFSI: ${fsiCalculado} mg/dL/U\n\nEsto va a reemplazar el valor actual de tu ficha.`
    );
    if (!confirmado) return;

    const perfilActual = JSON.parse(localStorage.getItem('dbtycs_perfil') || '{}');
    perfilActual.factorCorreccion = fsiCalculado;
    perfilActual.actualizadoEn = new Date().toISOString();

    localStorage.setItem('dbtycs_perfil', JSON.stringify(perfilActual));
    perfil = perfilActual;

    alert('Listo, se actualizó tu FSI en la ficha médica.');
    cerrarModal(modalFSI);
  });
}

// --- MODAL FICHA MÉDICA ---
const fichaDatos = document.getElementById('fichaDatos');
const btnExportarPDF = document.getElementById('btnExportarPDF');

function obtenerItemsFichaMedica() {
  if (!perfil) return null;

  const fechaNac = perfil.fechaNacimiento || perfil.fechaNac || perfil.nacimiento;
  const edadCalculada = calcularEdad(fechaNac);
  const textoEdad = edadCalculada !== null ? `${edadCalculada} años` : (perfil.edad ? `${perfil.edad} años` : 'No especificado');

  const textosActividad = {
    sedentario: 'Sedentario',
    ligero: 'Ligeramente activo',
    activo: 'Moderadamente activo',
    muy_activo: 'Muy activo'
  };

  return [
    { label: 'Nombre Completo', val: perfil.nombre || 'No especificado' },
    { label: 'Edad', val: textoEdad },
    { label: 'Tipo de Diabetes', val: perfil.tipoDiabetes || 'No especificado' },
    { label: 'Altura', val: perfil.altura ? `${perfil.altura} cm` : 'No especificado' },
    { label: 'Peso Corporal', val: perfil.peso ? `${perfil.peso} kg` : 'No especificado' },
    { label: 'Actividad / Ocupación', val: textosActividad[perfil.trabajo] || 'No especificado' },
    { label: 'Método / Tratamiento', val: 'Insulinodependiente' },
    { label: 'Insulina Basal', val: perfil.insulinaBasal || 'No especificado' },
    { label: 'Insulina Rápida', val: perfil.insulinaRapida || 'No especificado' },
    { label: 'Ratio Carb', val: perfil.ratioIC ? `${perfil.ratioIC} g/U` : 'No especificado' },
    { label: 'Factor ISF', val: perfil.factorCorreccion ? `${perfil.factorCorreccion} mg/dL/U` : 'No especificado' }
  ];
}

function renderFichaMedica() {
  if (!fichaDatos) return;

  const items = obtenerItemsFichaMedica();
  if (!items) {
    fichaDatos.innerHTML = '<p>No se encontraron datos registrados. Completa la configuración de perfil primero.</p>';
    return;
  }

  let html = '<div class="summary-list">';
  items.forEach(item => {
    html += `
      <div class="summary-item">
        <span class="label">${item.label}:</span>
        <span class="value">${item.val}</span>
      </div>
    `;
  });
  html += '</div>';

  fichaDatos.innerHTML = html;
}

if (btnExportarPDF) {
  btnExportarPDF.addEventListener('click', () => {
    generarPDFFichaMedica();
  });
}

function generarPDFFichaMedica() {
  if (typeof jspdf === 'undefined') {
    alert('No se pudo cargar la librería de generación de PDF. Verificá tu conexión a internet.');
    return;
  }

  const items = obtenerItemsFichaMedica();
  if (!items) {
    alert('No hay datos de perfil cargados todavía. Completá el onboarding primero.');
    return;
  }

  const { jsPDF } = jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const nombreUsuario = (perfil && perfil.nombre) ? perfil.nombre : 'Paciente';

  // --- Encabezado con color de marca ---
  doc.setFillColor(2, 132, 199); // --accent-hover
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Ficha Médica Resumida', marginX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('DBTYCS · Diabetes Tipo 1 y Control de Salud', marginX, 24);

  // --- Nombre y fecha de generación ---
  let y = 46;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(nombreUsuario, marginX, y);

  const fechaGeneracion = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado el ${fechaGeneracion}`, pageWidth - marginX, y, { align: 'right' });

  y += 6;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  // --- Listado de datos ---
  doc.setFontSize(10.5);
  items.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(item.label, marginX, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.val), pageWidth - marginX, y, { align: 'right' });

    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 9;
  });

  // --- Pie de página / disclaimer ---
  const footerY = pageHeight - 22;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, footerY - 6, pageWidth - marginX, footerY - 6);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Este documento es un resumen autoreportado por el paciente, generado por DBTYCS. No reemplaza la evaluación de un profesional de la salud.',
    marginX,
    footerY,
    { maxWidth: pageWidth - marginX * 2 }
  );

  doc.save(`Ficha_Medica_${nombreUsuario.trim().replace(/\s+/g, '_')}.pdf`);
}