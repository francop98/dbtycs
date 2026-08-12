// ============================================================================
// DBTYCS — Análisis de Sangre
// Los PARÁMETROS (qué se mide) los define el usuario — no hay una lista fija.
// Se guardan en localStorage['dbtycs_analisis_parametros'] como
// [{ key, label, unidad }]. Cada análisis cargado (localStorage
// ['dbtycs_analisis']) guarda un valor por parámetro que exista en ese
// momento. Sincroniza con Firestore cuando hay sesión iniciada.
// ============================================================================

import { auth } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { guardarDocEnNube, eliminarDocDeNube, sincronizarColeccion, estaLogueado } from './firestore-sync.js';

const ANALISIS_KEY = 'dbtycs_analisis';
const PARAMETROS_KEY = 'dbtycs_analisis_parametros';

const COLORES_GRAFICO = ['#38bdf8', '#f472b6', '#4ade80', '#fb923c', '#a78bfa', '#facc15', '#2dd4bf', '#f87171'];
let graficosActivos = [];

document.addEventListener('DOMContentLoaded', () => {
  precargarFecha();
  generarFormulario();
  renderTodo();
  inicializarPanelParametro();

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

function cargarParametros() {
  try {
    const guardado = localStorage.getItem(PARAMETROS_KEY);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    console.error('No se pudieron leer los parámetros:', e);
    return [];
  }
}

function guardarParametrosCompleto(lista) {
  localStorage.setItem(PARAMETROS_KEY, JSON.stringify(lista));
}

function generarKeyParametro(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function agregarParametro(nombre, unidad) {
  const nombreLimpio = (nombre || '').trim();
  if (!nombreLimpio) {
    alert('Ingresá un nombre para el parámetro.');
    return null;
  }

  let key = generarKeyParametro(nombreLimpio);
  if (!key) key = `param_${Date.now()}`;

  const parametros = cargarParametros();
  if (parametros.some((p) => p.key === key)) {
    alert('Ya tenés un parámetro con ese nombre.');
    return null;
  }

  const nuevo = { key, label: nombreLimpio, unidad: (unidad || '').trim() };
  parametros.push(nuevo);
  guardarParametrosCompleto(parametros);
  return nuevo;
}

function eliminarParametro(key) {
  if (!confirm('¿Eliminar este parámetro? Los análisis ya cargados van a conservar el valor guardado, pero no vas a poder cargarlo de nuevo salvo que lo vuelvas a crear.')) return;
  const parametros = cargarParametros().filter((p) => p.key !== key);
  guardarParametrosCompleto(parametros);
  generarFormulario();
  renderTodo();
}

function inicializarPanelParametro() {
  const btnToggle = document.getElementById('btnToggleAgregarParametro');
  const panel = document.getElementById('panelAgregarParametro');
  const btnGuardar = document.getElementById('btnGuardarParametro');

  if (btnToggle && panel) {
    btnToggle.addEventListener('click', () => {
      const visible = panel.style.display !== 'none';
      panel.style.display = visible ? 'none' : 'block';
      if (!visible) document.getElementById('inputNombreParametro')?.focus();
    });
  }

  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => {
      const nombre = document.getElementById('inputNombreParametro').value;
      const unidad = document.getElementById('inputUnidadParametro').value;

      const nuevo = agregarParametro(nombre, unidad);
      if (!nuevo) return;

      document.getElementById('inputNombreParametro').value = '';
      document.getElementById('inputUnidadParametro').value = '';
      panel.style.display = 'none';

      generarFormulario();
    });
  }
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

  const parametros = cargarParametros();

  if (!parametros.length) {
    contenedor.innerHTML = '<div class="empty-state">Todavía no creaste ningún parámetro. Usá "+ Agregar parámetro" arriba para empezar — por ejemplo, Hemoglobina Glicosilada, o lo que vos quieras medir.</div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="form-grid">
      ${parametros.map((p) => `
        <div class="form-group">
          <label for="campo_${p.key}" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${p.label}${p.unidad ? ` (${p.unidad})` : ''}</span>
            <button type="button" class="entry-delete" data-eliminar-parametro="${p.key}" title="Eliminar este parámetro">✕</button>
          </label>
          <input type="number" step="0.01" id="campo_${p.key}" placeholder="Ej. --">
        </div>
      `).join('')}
    </div>
  `;

  contenedor.querySelectorAll('[data-eliminar-parametro]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      eliminarParametro(btn.dataset.eliminarParametro);
    });
  });
}

function guardarNuevoAnalisis() {
  const fecha = document.getElementById('inputFechaAnalisis').value;
  const notas = document.getElementById('inputNotasAnalisis').value.trim();
  const parametros = cargarParametros();

  if (!fecha) {
    alert('Ingresá la fecha del análisis.');
    return;
  }

  if (!parametros.length) {
    alert('Creá al menos un parámetro antes de cargar un análisis (botón "+ Agregar parámetro").');
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
  parametros.forEach((p) => {
    const el = document.getElementById(`campo_${p.key}`);
    const valor = el ? parseFloat(el.value) : NaN;
    entrada[p.key] = isNaN(valor) ? null : valor;
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
  const parametros = cargarParametros();

  if (!lista.length) {
    contenedor.innerHTML = '<div class="empty-state">Todavía no cargaste ningún análisis.</div>';
    return;
  }

  const parametrosConDatos = parametros.filter((p) => lista.some((a) => a[p.key] !== null && a[p.key] !== undefined));

  if (!parametrosConDatos.length) {
    contenedor.innerHTML = '<div class="empty-state">Tenés análisis cargados, pero sin valores en los parámetros actuales.</div>';
    return;
  }

  contenedor.innerHTML = `
    <table class="ins-tabla" style="min-width: 600px;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border);">
          <td style="font-weight: 700; color: var(--text-main); padding: 9px 10px;">Fecha</td>
          ${parametrosConDatos.map((p) => `<td style="font-weight: 700; color: var(--text-main); padding: 9px 10px; white-space: nowrap;">${p.label}</td>`).join('')}
          <td></td>
        </tr>
      </thead>
      <tbody>
        ${lista.map((a) => `
          <tr>
            <td class="ins-td-hora" style="white-space: nowrap;">${formatearFecha(a.fecha)}</td>
            ${parametrosConDatos.map((p) => `<td class="ins-td-unidades">${a[p.key] !== null && a[p.key] !== undefined ? `${a[p.key]}${p.unidad ? ' ' + p.unidad : ''}` : '—'}</td>`).join('')}
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
  const parametros = cargarParametros();

  const parametrosConDatos = parametros.filter((p) => lista.filter((a) => a[p.key] !== null && a[p.key] !== undefined).length > 0);

  if (!parametrosConDatos.length) {
    contenedor.innerHTML = '<div class="empty-state">Los gráficos van a aparecer acá a medida que cargues análisis con valores.</div>';
    return;
  }

  contenedor.innerHTML = parametrosConDatos.map((p) => `
    <div class="form-card" style="margin-bottom: 16px;">
      <div style="font-weight: 700; color: var(--text-main); margin-bottom: 10px; font-size: 0.9rem;">${p.label}${p.unidad ? ` <span style="color: var(--text-muted); font-weight: 400;">(${p.unidad})</span>` : ''}</div>
      <canvas id="grafico_${p.key}" height="90"></canvas>
    </div>
  `).join('');

  parametrosConDatos.forEach((p, i) => {
    const puntos = lista.filter((a) => a[p.key] !== null && a[p.key] !== undefined);
    const canvas = document.getElementById(`grafico_${p.key}`);
    if (!canvas) return;

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: puntos.map((pt) => formatearFecha(pt.fecha)),
        datasets: [{
          label: p.label,
          data: puntos.map((pt) => pt[p.key]),
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