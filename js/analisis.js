// ============================================================================
// DBTYCS — Análisis de Sangre
// Guarda cada análisis en localStorage['dbtycs_analisis'] como array de
// objetos. Cada entrada es un análisis completo (fecha + los parámetros que
// se hayan cargado). Sincroniza con Firestore cuando hay sesión iniciada.
// ============================================================================

import { auth } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { guardarDocEnNube, eliminarDocDeNube, sincronizarColeccion, estaLogueado } from './firestore-sync.js';

const ANALISIS_KEY = 'dbtycs_analisis';

const CAMPOS_ANALISIS = [
  { key: 'hba1c', label: 'HbA1c (Hemoglobina Glicosilada)', unidad: '%', grupo: 'Control glucémico' },
  { key: 'glucemiaAyunas', label: 'Glucemia en ayunas', unidad: 'mg/dL', grupo: 'Control glucémico' },
  { key: 'colesterolTotal', label: 'Colesterol Total', unidad: 'mg/dL', grupo: 'Perfil lipídico' },
  { key: 'colesterolHDL', label: 'Colesterol HDL', unidad: 'mg/dL', grupo: 'Perfil lipídico' },
  { key: 'colesterolLDL', label: 'Colesterol LDL', unidad: 'mg/dL', grupo: 'Perfil lipídico' },
  { key: 'trigliceridos', label: 'Triglicéridos', unidad: 'mg/dL', grupo: 'Perfil lipídico' },
  { key: 'creatinina', label: 'Creatinina', unidad: 'mg/dL', grupo: 'Función renal' },
  { key: 'microalbuminuria', label: 'Microalbuminuria', unidad: 'mg/L', grupo: 'Función renal' },
  { key: 'peptidoC', label: 'Péptido C', unidad: 'ng/mL', grupo: 'Páncreas / Autoinmunidad' },
  { key: 'antiGAD65', label: 'Anti-GAD65', unidad: 'UI/mL', grupo: 'Páncreas / Autoinmunidad' },
  { key: 'antiIA2', label: 'Anti-IA2', unidad: 'UI/mL', grupo: 'Páncreas / Autoinmunidad' },
  { key: 'tsh', label: 'TSH', unidad: 'µUI/mL', grupo: 'Tiroides' },
  { key: 'vitaminaD', label: 'Vitamina D', unidad: 'ng/mL', grupo: 'Vitaminas' },
  { key: 'vitaminaB12', label: 'Vitamina B12', unidad: 'pg/mL', grupo: 'Vitaminas' },
];

const COLORES_GRAFICO = ['#38bdf8', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#facc15'];
let graficosActivos = [];

document.addEventListener('DOMContentLoaded', () => {
  precargarFecha();
  generarFormulario();
  renderTodo();

  const form = document.getElementById('formNuevoAnalisis');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      guardarNuevoAnalisis();
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const bajoDatos = await sincronizarColeccion('analisis', ANALISIS_KEY, guardarAnalisisCompleto);
      if (bajoDatos) renderTodo();
    }
  });
});

function generarId() {
  return `ana_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cargarAnalisis() {
  try {
    const guardado = localStorage.getItem(ANALISIS_KEY);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    console.error('No se pudieron leer los análisis guardados:', e);
    return [];
  }
}

function guardarAnalisisCompleto(lista) {
  localStorage.setItem(ANALISIS_KEY, JSON.stringify(lista));
}

function precargarFecha() {
  const input = document.getElementById('inputFechaAnalisis');
  if (input) input.value = new Date().toISOString().slice(0, 10);
}

function generarFormulario() {
  const contenedor = document.getElementById('camposAnalisis');
  if (!contenedor) return;

  const grupos = {};
  CAMPOS_ANALISIS.forEach((campo) => {
    if (!grupos[campo.grupo]) grupos[campo.grupo] = [];
    grupos[campo.grupo].push(campo);
  });

  contenedor.innerHTML = Object.entries(grupos).map(([grupo, campos]) => `
    <div style="margin-top: 18px;">
      <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">${grupo}</div>
      <div class="form-grid">
        ${campos.map((campo) => `
          <div class="form-group">
            <label for="campo_${campo.key}">${campo.label} (${campo.unidad})</label>
            <input type="number" step="0.01" id="campo_${campo.key}" placeholder="Ej. --">
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function guardarNuevoAnalisis() {
  const fecha = document.getElementById('inputFechaAnalisis').value;
  const notas = document.getElementById('inputNotasAnalisis').value.trim();

  if (!fecha) {
    alert('Ingresá la fecha del análisis.');
    return;
  }

  const entrada = {
    id: generarId(),
    fecha,
    notas: notas || null,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };

  let algunCampoCargado = false;
  CAMPOS_ANALISIS.forEach((campo) => {
    const valor = parseFloat(document.getElementById(`campo_${campo.key}`).value);
    entrada[campo.key] = isNaN(valor) ? null : valor;
    if (!isNaN(valor)) algunCampoCargado = true;
  });

  if (!algunCampoCargado) {
    alert('Cargá al menos un valor para guardar el análisis.');
    return;
  }

  const lista = cargarAnalisis();
  lista.push(entrada);
  guardarAnalisisCompleto(lista);
  if (estaLogueado()) guardarDocEnNube('analisis', entrada);

  document.getElementById('formNuevoAnalisis').reset();
  precargarFecha();

  renderTodo();
}

function eliminarAnalisis(id) {
  if (!confirm('¿Eliminar este análisis? No se puede deshacer.')) return;
  const lista = cargarAnalisis().filter((a) => a.id !== id);
  guardarAnalisisCompleto(lista);
  if (estaLogueado()) eliminarDocDeNube('analisis', id);
  renderTodo();
}

function formatearFecha(fechaStr) {
  const fecha = new Date(`${fechaStr}T00:00:00`);
  if (isNaN(fecha.getTime())) return fechaStr;
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderTabla() {
  const contenedor = document.getElementById('tablaAnalisis');
  if (!contenedor) return;

  const lista = cargarAnalisis().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (!lista.length) {
    contenedor.innerHTML = '<div class="empty-state">Todavía no cargaste ningún análisis.</div>';
    return;
  }

  const camposConDatos = CAMPOS_ANALISIS.filter((campo) => lista.some((a) => a[campo.key] !== null && a[campo.key] !== undefined));

  contenedor.innerHTML = `
    <table class="ins-tabla" style="min-width: 600px;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border);">
          <td style="font-weight: 700; color: var(--text-main); padding: 9px 10px;">Fecha</td>
          ${camposConDatos.map((c) => `<td style="font-weight: 700; color: var(--text-main); padding: 9px 10px; white-space: nowrap;">${c.label}</td>`).join('')}
          <td></td>
        </tr>
      </thead>
      <tbody>
        ${lista.map((a) => `
          <tr>
            <td class="ins-td-hora" style="white-space: nowrap;">${formatearFecha(a.fecha)}</td>
            ${camposConDatos.map((c) => `<td class="ins-td-unidades">${a[c.key] !== null && a[c.key] !== undefined ? `${a[c.key]} ${c.unidad}` : '—'}</td>`).join('')}
            <td class="ins-td-accion"><button class="entry-delete" onclick="eliminarAnalisis('${a.id}')" title="Eliminar">✕</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderGraficos() {
  const contenedor = document.getElementById('graficosAnalisis');
  if (!contenedor) return;

  graficosActivos.forEach((chart) => chart.destroy());
  graficosActivos = [];

  const lista = cargarAnalisis().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const camposConDatos = CAMPOS_ANALISIS.filter((campo) => lista.filter((a) => a[campo.key] !== null && a[campo.key] !== undefined).length > 0);

  if (!camposConDatos.length) {
    contenedor.innerHTML = '<div class="empty-state">Los gráficos van a aparecer acá a medida que cargues análisis.</div>';
    return;
  }

  contenedor.innerHTML = camposConDatos.map((campo) => `
    <div class="form-card" style="margin-bottom: 16px;">
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 10px; font-size: 0.9rem;">${campo.label}</div>
      <canvas id="grafico_${campo.key}" height="90"></canvas>
    </div>
  `).join('');

  camposConDatos.forEach((campo, i) => {
    const puntos = lista.filter((a) => a[campo.key] !== null && a[campo.key] !== undefined);
    const canvas = document.getElementById(`grafico_${campo.key}`);
    if (!canvas) return;

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: puntos.map((p) => formatearFecha(p.fecha)),
        datasets: [{
          label: campo.label,
          data: puntos.map((p) => p[campo.key]),
          borderColor: COLORES_GRAFICO[i % COLORES_GRAFICO.length],
          backgroundColor: COLORES_GRAFICO[i % COLORES_GRAFICO.length] + '22',
          tension: 0.25,
          fill: true,
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        },
      },
    });

    graficosActivos.push(chart);
  });
}

function renderTodo() {
  renderTabla();
  renderGraficos();
}

window.eliminarAnalisis = eliminarAnalisis;