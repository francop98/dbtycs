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
  const tipo = document.getElementById('selectTipoInsulina')?.value;
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
  document.getElementById('selectTipoInsulina').value = 'rapida';
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

// --- Agrupación y render (acordeón: mes → día → datos) ---

function obtenerClaveDia(fechaHoraStr) {
  // fechaHora viene de un input datetime-local, ya en hora local -> los primeros 10 chars son YYYY-MM-DD
  return fechaHoraStr.slice(0, 10);
}

function obtenerClaveMes(claveDia) {
  return claveDia.slice(0, 7); // YYYY-MM
}

function formatearEncabezadoDia(claveDia) {
  const fecha = new Date(`${claveDia}T00:00:00`);
  if (isNaN(fecha.getTime())) return claveDia;
  return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function formatearEncabezadoMes(claveMes) {
  const fecha = new Date(`${claveMes}-01T00:00:00`);
  if (isNaN(fecha.getTime())) return claveMes;
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearHora(fechaHoraStr) {
  const fecha = new Date(fechaHoraStr);
  if (isNaN(fecha.getTime())) return '--:--';
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function sumarPorTipo(lista, tipo) {
  return lista.filter((a) => a.tipo === tipo).reduce((s, a) => s + a.unidades, 0);
}

function renderFilaAplicacion(a) {
  return `
    <tr>
      <td class="ins-td-hora">${formatearHora(a.fechaHora)}</td>
      <td><span class="entry-type-badge ${a.tipo}">${a.tipo === 'basal' ? 'Basal' : 'Rápida'}</span></td>
      <td class="ins-td-unidades">${a.unidades} U</td>
      <td class="ins-td-notas">${a.notas || ''}</td>
      <td class="ins-td-accion"><button class="entry-delete" onclick="eliminarAplicacion('${a.id}')" title="Eliminar">✕</button></td>
    </tr>
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

  // Agrupar por día primero
  const porDia = {};
  lista.forEach((a) => {
    const claveDia = obtenerClaveDia(a.fechaHora);
    if (!porDia[claveDia]) porDia[claveDia] = [];
    porDia[claveDia].push(a);
  });

  // Agrupar los días por mes
  const porMes = {};
  Object.keys(porDia).forEach((claveDia) => {
    const claveMes = obtenerClaveMes(claveDia);
    if (!porMes[claveMes]) porMes[claveMes] = [];
    porMes[claveMes].push(claveDia);
  });

  const clavesMes = Object.keys(porMes).sort((a, b) => (a < b ? 1 : -1)); // más reciente primero

  contenedor.innerHTML = clavesMes.map((claveMes, indexMes) => {
    const diasDelMes = porMes[claveMes].sort((a, b) => (a < b ? 1 : -1));
    const todasLasAplicacionesDelMes = diasDelMes.flatMap((d) => porDia[d]);

    const totalBasalMes = sumarPorTipo(todasLasAplicacionesDelMes, 'basal');
    const totalRapidaMes = sumarPorTipo(todasLasAplicacionesDelMes, 'rapida');

    const idMes = `mes-${claveMes}`;

    return `
      <div class="ins-month">
        <button type="button" class="ins-month-header" data-target="${idMes}">
          <span class="ins-chevron">▸</span>
          <span class="ins-month-name">${formatearEncabezadoMes(claveMes)}</span>
          <div class="day-totals">
            <span class="total-pill basal">${totalBasalMes} U</span>
            <span class="total-pill rapida">${totalRapidaMes} U</span>
          </div>
        </button>
        <div class="ins-month-body" id="${idMes}" style="display: none;">
          ${diasDelMes.map((claveDia) => {
            const aplicacionesDelDia = porDia[claveDia].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
            const totalBasal = sumarPorTipo(aplicacionesDelDia, 'basal');
            const totalRapida = sumarPorTipo(aplicacionesDelDia, 'rapida');
            const idDia = `dia-${claveDia}`;

            return `
              <div class="ins-day">
                <button type="button" class="ins-day-header" data-target="${idDia}">
                  <span class="ins-chevron">▸</span>
                  <span class="day-date">${formatearEncabezadoDia(claveDia)}</span>
                  <div class="day-totals">
                    <span class="total-pill basal">${totalBasal} U</span>
                    <span class="total-pill rapida">${totalRapida} U</span>
                  </div>
                </button>
                <div class="ins-day-body" id="${idDia}" style="display: none;">
                  <table class="ins-tabla">
                    <tbody>
                      ${aplicacionesDelDia.map(renderFilaAplicacion).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  // El mes más reciente arranca desplegado, para no tener que abrir siempre
  const primerMes = contenedor.querySelector('.ins-month-header');
  if (primerMes) primerMes.click();

  contenedor.querySelectorAll('.ins-month-header, .ins-day-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const chevron = btn.querySelector('.ins-chevron');
      if (!target) return;

      const abierto = target.style.display !== 'none';
      target.style.display = abierto ? 'none' : 'block';
      if (chevron) chevron.textContent = abierto ? '▸' : '▾';
    });
  });
}

// Los módulos ES no exponen funciones al scope global automáticamente,
// pero el HTML generado usa onclick="eliminarAplicacion(...)" — hace
// falta colgarla de window.
window.eliminarAplicacion = eliminarAplicacion;