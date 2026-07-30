// ============================================================================
// DBTYCS — Registro de Insulina
// Guarda cada aplicación (basal o rápida) en localStorage['dbtycs_insulina']
// como un array plano de registros. Carga 100% manual e independiente del
// Registro de Comidas — cada aplicación se carga una sola vez, acá.
//
// Ahora también sincroniza con Firestore cuando hay sesión iniciada.
// ============================================================================

import { auth } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { guardarDocEnNube, eliminarDocDeNube, sincronizarColeccion, estaLogueado } from './firestore-sync.js';

const INSULINA_KEY = 'dbtycs_insulina';

document.addEventListener('DOMContentLoaded', () => {
  precargarFechaHoraInsulina();
  renderHistorialInsulina();

  const form = document.getElementById('formNuevaInsulina');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      guardarNuevaAplicacion();
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const bajoDatos = await sincronizarColeccion('insulina', INSULINA_KEY, guardarAplicaciones);
      if (bajoDatos) {
        renderHistorialInsulina();
        if (typeof actualizarWidgetInsulinaActiva === 'function') actualizarWidgetInsulinaActiva();
      }
    }
  });
});

// --- Utilidades ---

function generarIdInsulina() {
  return `ins_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cargarAplicaciones() {
  try {
    const guardado = localStorage.getItem(INSULINA_KEY);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    console.error('No se pudieron leer las aplicaciones guardadas:', e);
    return [];
  }
}

function guardarAplicaciones(lista) {
  localStorage.setItem(INSULINA_KEY, JSON.stringify(lista));
}

function precargarFechaHoraInsulina() {
  const input = document.getElementById('inputFechaHoraInsulina');
  if (!input) return;
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  input.value = ahora.toISOString().slice(0, 16);
}

// --- Alta ---

function guardarNuevaAplicacion() {
  const tipo = document.querySelector('input[name="tipoInsulina"]:checked')?.value;
  const unidades = parseFloat(document.getElementById('inputUnidadesInsulina').value);
  const fechaHora = document.getElementById('inputFechaHoraInsulina').value;
  const notas = document.getElementById('inputNotasInsulina').value.trim();

  if (!tipo || isNaN(unidades) || unidades <= 0 || !fechaHora) {
    alert('Completá el tipo, las unidades y la fecha/hora para guardar.');
    return;
  }

  const aplicacion = {
    id: generarIdInsulina(),
    tipo, // 'basal' | 'rapida'
    unidades,
    fechaHora,
    notas: notas || null,
    creadoEn: new Date().toISOString(),
  };

  const lista = cargarAplicaciones();
  lista.push(aplicacion);
  guardarAplicaciones(lista);
  if (estaLogueado()) guardarDocEnNube('insulina', aplicacion);

  document.getElementById('formNuevaInsulina').reset();
  document.getElementById('radioTipoBasal').checked = true;
  precargarFechaHoraInsulina();

  renderHistorialInsulina();
  if (typeof actualizarWidgetInsulinaActiva === 'function') actualizarWidgetInsulinaActiva();
}

function eliminarAplicacion(id) {
  if (!confirm('¿Eliminar esta aplicación? No se puede deshacer.')) return;
  const lista = cargarAplicaciones().filter((a) => a.id !== id);
  guardarAplicaciones(lista);
  if (estaLogueado()) eliminarDocDeNube('insulina', id);
  renderHistorialInsulina();
  if (typeof actualizarWidgetInsulinaActiva === 'function') actualizarWidgetInsulinaActiva();
}

// --- Agrupación y render ---

function obtenerClaveDia(fechaHoraStr) {
  // fechaHora viene de un input datetime-local, ya en hora local -> los primeros 10 chars son YYYY-MM-DD
  return fechaHoraStr.slice(0, 10);
}

function formatearEncabezadoDia(claveDia) {
  const fecha = new Date(`${claveDia}T00:00:00`);
  if (isNaN(fecha.getTime())) return claveDia;
  return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function formatearHora(fechaHoraStr) {
  const fecha = new Date(fechaHoraStr);
  if (isNaN(fecha.getTime())) return '--:--';
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function agruparPorDia(lista) {
  const grupos = {};
  lista.forEach((a) => {
    const clave = obtenerClaveDia(a.fechaHora);
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(a);
  });
  return grupos;
}

function renderFilaAplicacion(a) {
  return `
    <div class="entry-row">
      <span class="entry-time">${formatearHora(a.fechaHora)}</span>
      <span class="entry-type-badge ${a.tipo}">${a.tipo === 'basal' ? 'Basal' : 'Rápida'}</span>
      <span class="entry-units">${a.unidades} U</span>
      <span class="entry-notes">${a.notas || ''}</span>
      <button class="entry-delete" onclick="eliminarAplicacion('${a.id}')" title="Eliminar">✕</button>
    </div>
  `;
}

function renderHistorialInsulina() {
  const contenedor = document.getElementById('listaHistorialInsulina');
  if (!contenedor) return;

  const lista = cargarAplicaciones();

  if (!lista.length) {
    contenedor.innerHTML = '<div class="empty-state">Todavía no cargaste ninguna aplicación. Usá el formulario de arriba para empezar.</div>';
    return;
  }

  const grupos = agruparPorDia(lista);
  const claves = Object.keys(grupos).sort((a, b) => (a < b ? 1 : -1)); // más reciente primero

  contenedor.innerHTML = claves.map((clave) => {
    const aplicacionesDelDia = grupos[clave].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));

    const totalBasal = aplicacionesDelDia.filter((a) => a.tipo === 'basal').reduce((s, a) => s + a.unidades, 0);
    const totalRapida = aplicacionesDelDia.filter((a) => a.tipo === 'rapida').reduce((s, a) => s + a.unidades, 0);
    const totalCombinado = totalBasal + totalRapida;

    return `
      <div class="day-group">
        <div class="day-group-header">
          <span class="day-date">${formatearEncabezadoDia(clave)}</span>
          <div class="day-totals">
            <span class="total-pill basal">Basal: ${totalBasal} U</span>
            <span class="total-pill rapida">Rápida: ${totalRapida} U</span>
            <span class="total-pill total">Total: ${totalCombinado} U</span>
          </div>
        </div>
        <div class="day-entries">
          ${aplicacionesDelDia.map(renderFilaAplicacion).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Los módulos ES no exponen funciones al scope global automáticamente,
// pero el HTML generado usa onclick="eliminarAplicacion(...)" — hace
// falta colgarla de window.
window.eliminarAplicacion = eliminarAplicacion;