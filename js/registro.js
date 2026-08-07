// ============================================================================
// DBTYCS — Registro de Comidas
// Guarda eventos en localStorage['dbtycs_eventos'] como array de objetos.
// Sincroniza con Firestore cuando hay sesión iniciada.
//
// "Comidas Registradas" es el hub único para ver, buscar, elegir o agregar
// comidas a tu base de datos personal (recetario.js).
//
// El lector de código de barras está DESACTIVADO a pedido del usuario. El
// código queda comentado al final del archivo para reactivarlo fácilmente.
// ============================================================================

import { auth } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { guardarDocEnNube, eliminarDocDeNube, sincronizarColeccion, estaLogueado } from './firestore-sync.js';
import {
  buscarEnRecetario,
  registrarUsoOCrear,
  agregarOActualizarManual,
  eliminarReceta,
  cargarRecetario,
  obtenerCategorias,
  agregarCategoria,
} from './recetario.js';

const EVENTOS_KEY = 'dbtycs_eventos';
const USDA_API_KEY = 'VGps3fGihKwWQ2UYCgjoNQXHZDrXcBaOF3R91BCe';
const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

const PROXY_IA_URL = 'https://dbtycs.vercel.app/api/analizar-comida';

const ETIQUETAS_MOMENTO = {
  desayuno: 'Desayuno',
  colacion_manana: 'Colación mañana',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
  colacion_noche: 'Colación noche',
};

let carbsPor100gSeleccionado = null;
let debounceTimeoutBusqueda = null;
let ultimoResultadoIA = null;
let ultimoTerminoBuscado = '';

document.addEventListener('DOMContentLoaded', () => {
  precargarFechaHora();
  sugerirMomentoDelDia();
  poblarSelectCategorias();
  renderTodo();
  inicializarComidasRegistradas();
  inicializarAnalisisIA();

  const form = document.getElementById('formNuevoEvento');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      guardarNuevoEvento();
    });
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const bajoDatos = await sincronizarColeccion('eventos', EVENTOS_KEY, guardarEventos);
      if (bajoDatos) renderTodo();
    }
  });
});

function generarId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cargarEventos() {
  try {
    const guardado = localStorage.getItem(EVENTOS_KEY);
    return guardado ? JSON.parse(guardado) : [];
  } catch (e) {
    console.error('No se pudieron leer los eventos guardados:', e);
    return [];
  }
}

function guardarEventos(eventos) {
  localStorage.setItem(EVENTOS_KEY, JSON.stringify(eventos));
}

function precargarFechaHora() {
  const input = document.getElementById('inputFechaHora');
  if (!input) return;
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  input.value = ahora.toISOString().slice(0, 16);
}

function sugerirMomentoDelDia() {
  const select = document.getElementById('selectMomentoDia');
  if (!select) return;
  const hora = new Date().getHours();

  let momento = 'colacion_noche';
  if (hora >= 6 && hora < 10) momento = 'desayuno';
  else if (hora >= 10 && hora < 12) momento = 'colacion_manana';
  else if (hora >= 12 && hora < 15) momento = 'almuerzo';
  else if (hora >= 15 && hora < 18) momento = 'merienda';
  else if (hora >= 18 && hora < 22) momento = 'cena';

  select.value = momento;
}

function poblarSelectCategorias() {
  const select = document.getElementById('selectCategoriaComida');
  if (!select) return;
  const valorPrevio = select.value;
  select.innerHTML = obtenerCategorias().map((cat) => `<option value="${cat}">${cat}</option>`).join('');
  if (valorPrevio) select.value = valorPrevio;
}

function poblarSelectCategoriaNuevaComida() {
  const select = document.getElementById('selectCategoriaNuevaComida');
  if (!select) return;
  const valorPrevio = select.value;
  select.innerHTML = obtenerCategorias().map((cat) => `<option value="${cat}">${cat}</option>`).join('');
  if (valorPrevio) select.value = valorPrevio;
}

function manejarNuevaCategoria(selectAActualizar) {
  const nombre = prompt('Nombre de la nueva categoría:');
  if (!nombre || !nombre.trim()) return;

  agregarCategoria(nombre);
  poblarSelectCategorias();
  poblarSelectCategoriaNuevaComida();

  const select = document.getElementById(selectAActualizar);
  if (select) select.value = nombre.trim();
}

function inicializarComidasRegistradas() {
  const btnAbrir = document.getElementById('btnAbrirComidasRegistradas');
  const btnCerrar = document.getElementById('btnCerrarComidasRegistradas');
  const modal = document.getElementById('modalComidasRegistradas');
  const inputBuscar = document.getElementById('inputBuscarComidaRegistrada');
  const inputComida = document.getElementById('inputCategoriaComida');
  const btnNuevaCategoria = document.getElementById('btnNuevaCategoria');
  const btnNuevaCategoriaModal = document.getElementById('btnNuevaCategoriaModal');
  const btnToggleAgregar = document.getElementById('btnToggleAgregarComida');
  const panelAgregar = document.getElementById('panelAgregarComida');
  const btnGuardarNuevaComida = document.getElementById('btnGuardarNuevaComida');

  poblarSelectCategoriaNuevaComida();

  if (inputComida) {
    inputComida.addEventListener('input', () => {
      carbsPor100gSeleccionado = null;
      ocultarCamposPorcion();
    });
  }

  if (btnNuevaCategoria) {
    btnNuevaCategoria.addEventListener('click', () => manejarNuevaCategoria('selectCategoriaComida'));
  }
  if (btnNuevaCategoriaModal) {
    btnNuevaCategoriaModal.addEventListener('click', () => manejarNuevaCategoria('selectCategoriaNuevaComida'));
  }

  if (btnAbrir && modal) {
    btnAbrir.addEventListener('click', () => {
      modal.classList.add('active');
      modal.style.display = 'flex';
      if (panelAgregar) panelAgregar.style.display = 'none';
      if (inputBuscar) {
        inputBuscar.value = '';
        inputBuscar.focus();
      }
      ultimoTerminoBuscado = '';
      mostrarTodoElRecetarioEnModal();
    });
  }

  if (btnCerrar && modal) {
    btnCerrar.addEventListener('click', () => {
      modal.classList.remove('active');
      modal.style.display = 'none';
    });
  }

  if (btnToggleAgregar && panelAgregar) {
    btnToggleAgregar.addEventListener('click', () => {
      const visible = panelAgregar.style.display !== 'none';
      panelAgregar.style.display = visible ? 'none' : 'block';
      if (!visible) document.getElementById('inputNombreNuevaComida')?.focus();
    });
  }

  if (btnGuardarNuevaComida) {
    btnGuardarNuevaComida.addEventListener('click', () => {
      const nombre = document.getElementById('inputNombreNuevaComida').value.trim();
      const categoria = document.getElementById('selectCategoriaNuevaComida').value;
      const cantidad = document.getElementById('inputCantidadNuevaComida').value.trim();
      const carbohidratos = parseFloat(document.getElementById('inputCarbsNuevaComida').value);

      if (!nombre || isNaN(carbohidratos)) {
        alert('Completá al menos el nombre de la comida y los carbohidratos.');
        return;
      }

      const resultado = agregarOActualizarManual(nombre, categoria, cantidad, carbohidratos);

      document.getElementById('inputNombreNuevaComida').value = '';
      document.getElementById('inputCantidadNuevaComida').value = '';
      document.getElementById('inputCarbsNuevaComida').value = '';
      panelAgregar.style.display = 'none';

      if (ultimoTerminoBuscado) {
        buscarEnBasesDeDatos(ultimoTerminoBuscado);
      } else {
        mostrarTodoElRecetarioEnModal();
      }

      if (resultado.actualizada) {
        alert(`Ya tenías algo parecido a "${nombre}" guardado — actualicé sus datos en vez de crear una entrada duplicada.`);
      }
    });
  }

  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      const termino = inputBuscar.value.trim();
      clearTimeout(debounceTimeoutBusqueda);

      if (termino.length < 2) {
        ultimoTerminoBuscado = '';
        mostrarTodoElRecetarioEnModal();
        return;
      }

      debounceTimeoutBusqueda = setTimeout(() => buscarEnBasesDeDatos(termino), 400);
    });
  }
}

function mostrarTodoElRecetarioEnModal() {
  const recetario = cargarRecetario()
    .slice()
    .sort((a, b) => (b.vecesUsada || 0) - (a.vecesUsada || 0) || a.nombre.localeCompare(b.nombre));

  const resultados = recetario.map((receta) => ({
    tipo: 'recetario',
    id: receta.id,
    description: receta.nombre,
    carbohidratosAbsolutos: receta.carbohidratos,
    categoria: receta.categoria,
    cantidad: receta.cantidad,
    source: 'Tu base de datos',
  }));

  renderResultadosBusqueda(resultados);
}

async function buscarEnBasesDeDatos(termino) {
  ultimoTerminoBuscado = termino;
  const resultadosDiv = document.getElementById('resultadosComidasRegistradas');
  if (!resultadosDiv) return;

  const coincidenciasRecetario = buscarEnRecetario(termino).map(({ receta }) => ({
    tipo: 'recetario',
    id: receta.id,
    description: receta.nombre,
    carbohidratosAbsolutos: receta.carbohidratos,
    categoria: receta.categoria,
    cantidad: receta.cantidad,
    source: 'Tu base de datos',
  }));

  renderResultadosBusqueda(coincidenciasRecetario);

  if (coincidenciasRecetario.length > 0) {
    resultadosDiv.insertAdjacentHTML('beforeend', '<div style="padding: 8px 12px; font-size: 0.78rem; color: var(--text-muted);">Buscando también en USDA y Open Food Facts...</div>');
  } else {
    resultadosDiv.innerHTML = '<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">Buscando en USDA y Open Food Facts...</div>';
  }

  const [usda, off] = await Promise.allSettled([
    buscarEnUSDA(termino),
    buscarEnOpenFoodFacts(termino),
  ]);

  const resultadosExternos = [
    ...(off.status === 'fulfilled' ? off.value : []),
    ...(usda.status === 'fulfilled' ? usda.value : []),
  ].map((item) => ({ ...item, tipo: 'externo' }));

  renderResultadosBusqueda([...coincidenciasRecetario, ...resultadosExternos]);
}

async function buscarEnUSDA(termino) {
  try {
    const url = `${USDA_SEARCH_URL}?api_key=${USDA_API_KEY}&query=${encodeURIComponent(termino)}&pageSize=6&dataType=Foundation,SR%20Legacy`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`USDA respondió ${resp.status}`);

    const data = await resp.json();
    return (data.foods || [])
      .map((f) => ({ description: f.description, carbs: extraerCarbohidratosPor100gUSDA(f), source: 'USDA' }))
      .filter((f) => f.carbs !== null);
  } catch (e) {
    console.error('Error consultando USDA FoodData Central:', e);
    return [];
  }
}

async function buscarEnOpenFoodFacts(termino) {
  try {
    const url = `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(termino)}&search_simple=1&action=process&json=1&page_size=8&lc=es`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Open Food Facts respondió ${resp.status}`);

    const data = await resp.json();
    return (data.products || [])
      .map((p) => ({
        description: p.product_name || p.generic_name || null,
        carbs: p.nutriments ? p.nutriments.carbohydrates_100g : null,
        source: 'Open Food Facts',
      }))
      .filter((p) => p.description && p.carbs !== null && p.carbs !== undefined);
  } catch (e) {
    console.error('Error consultando Open Food Facts:', e);
    return [];
  }
}

function extraerCarbohidratosPor100gUSDA(food) {
  if (!Array.isArray(food.foodNutrients)) return null;
  const nutriente = food.foodNutrients.find(
    (n) => n.nutrientNumber === '205' || n.nutrientName === 'Carbohydrate, by difference'
  );
  return nutriente ? nutriente.value : null;
}

function renderResultadosBusqueda(resultados) {
  const resultadosDiv = document.getElementById('resultadosComidasRegistradas');
  if (!resultadosDiv) return;

  if (!resultados.length) {
    resultadosDiv.innerHTML = '<div class="empty-state">Todavía no hay nada acá. Usá "+ Agregar" para empezar a construir tu base de datos.</div>';
    return;
  }

  resultadosDiv.innerHTML = resultados.map((item, i) => {
    const esRecetario = item.tipo === 'recetario';
    const detalle = esRecetario
      ? `${item.categoria ? item.categoria + ' · ' : ''}${item.cantidad ? item.cantidad + ' · ' : ''}${item.carbohidratosAbsolutos} g de carbohidratos`
      : `${item.carbs.toFixed(1)} g de carbohidratos por 100g · ${item.source}`;
    return `
      <div class="resultado-busqueda" data-index="${i}" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 0.85rem; ${esRecetario ? 'background: rgba(56, 189, 248, 0.05);' : ''}">
        <div style="flex: 1;">
          <div style="color: var(--text-main); font-weight: 600;">${esRecetario ? '📖 ' : ''}${item.description}</div>
          <div style="color: var(--text-muted); font-size: 0.78rem;">${detalle}</div>
        </div>
        ${esRecetario ? `<button type="button" class="entry-delete" data-eliminar="${item.id}" title="Eliminar de tu base">✕</button>` : ''}
      </div>
    `;
  }).join('');

  resultadosDiv.querySelectorAll('.resultado-busqueda').forEach((el, i) => {
    el.addEventListener('mouseenter', () => { el.style.background = 'rgba(56, 189, 248, 0.12)'; });
    el.addEventListener('mouseleave', () => { el.style.background = resultados[i].tipo === 'recetario' ? 'rgba(56, 189, 248, 0.05)' : 'transparent'; });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-eliminar]')) return;
      seleccionarAlimento(resultados[i]);
    });
  });

  resultadosDiv.querySelectorAll('[data-eliminar]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.eliminar;
      if (!confirm('¿Eliminar esta comida de tu base de datos? No se puede deshacer.')) return;
      eliminarReceta(id);
      if (ultimoTerminoBuscado) {
        buscarEnBasesDeDatos(ultimoTerminoBuscado);
      } else {
        mostrarTodoElRecetarioEnModal();
      }
    });
  });
}

function seleccionarAlimento(item) {
  const input = document.getElementById('inputCategoriaComida');
  const modal = document.getElementById('modalComidasRegistradas');
  const inputCarbs = document.getElementById('inputCarbohidratos');
  const selectCategoria = document.getElementById('selectCategoriaComida');
  const inputCantidad = document.getElementById('inputCantidad');

  if (input) input.value = item.description;

  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }

  if (item.tipo === 'recetario') {
    carbsPor100gSeleccionado = null;
    ocultarCamposPorcion();
    if (inputCarbs) inputCarbs.value = item.carbohidratosAbsolutos;
    if (selectCategoria && item.categoria) {
      poblarSelectCategorias();
      selectCategoria.value = item.categoria;
    }
    if (inputCantidad && item.cantidad) inputCantidad.value = item.cantidad;
    return;
  }

  carbsPor100gSeleccionado = item.carbs;
  mostrarCamposPorcion(item.carbs, item.source);
}

function mostrarCamposPorcion(carbsPor100g, fuente) {
  const grupo = document.getElementById('grupoGramosPorcion');
  const lbl = document.getElementById('lblCarbsPor100g');
  const inputGramos = document.getElementById('inputGramosPorcion');

  if (grupo) grupo.style.display = 'block';
  if (lbl) lbl.textContent = `Fuente: ${fuente || 'base de datos'} — ${carbsPor100g.toFixed(1)} g de carbohidratos por cada 100g`;
  if (inputGramos) {
    inputGramos.value = '';
    inputGramos.oninput = () => calcularCarbohidratosDesdePorcion();
  }
}

function ocultarCamposPorcion() {
  const grupo = document.getElementById('grupoGramosPorcion');
  if (grupo) grupo.style.display = 'none';
}

function calcularCarbohidratosDesdePorcion() {
  const inputGramos = document.getElementById('inputGramosPorcion');
  const inputCarbs = document.getElementById('inputCarbohidratos');
  if (!inputGramos || !inputCarbs || carbsPor100gSeleccionado === null) return;

  const gramos = parseFloat(inputGramos.value);
  if (isNaN(gramos) || gramos <= 0) {
    inputCarbs.value = '';
    return;
  }

  const carbsCalculados = (carbsPor100gSeleccionado * gramos) / 100;
  inputCarbs.value = Math.round(carbsCalculados * 10) / 10;
}

function guardarNuevoEvento() {
  const categoria = document.getElementById('inputCategoriaComida').value.trim();
  const tipoCategoria = document.getElementById('selectCategoriaComida').value;
  const cantidad = document.getElementById('inputCantidad').value.trim();
  const momentoDia = document.getElementById('selectMomentoDia').value;
  const fechaHora = document.getElementById('inputFechaHora').value;
  const carbohidratos = parseFloat(document.getElementById('inputCarbohidratos').value);
  const insulinaAplicada = parseFloat(document.getElementById('inputInsulinaAplicada').value);
  const glucosaPre = parseFloat(document.getElementById('inputGlucosaPre').value);
  const notas = document.getElementById('inputNotas').value.trim();

  if (!categoria || !fechaHora || isNaN(carbohidratos) || isNaN(insulinaAplicada) || isNaN(glucosaPre)) {
    alert('Completá todos los campos obligatorios para guardar el registro.');
    return;
  }

  const evento = {
    id: generarId(),
    categoriaComida: categoria,
    categoriaNormalizada: categoria.toLowerCase(),
    tipoCategoria: tipoCategoria || 'Otro',
    cantidad: cantidad || null,
    momentoDia,
    fechaHora,
    carbohidratos,
    insulinaAplicada,
    glucosaPre,
    glucosaPost1h: null,
    glucosaPost2h: null,
    glucosaPost3h: null,
    notas: notas || null,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };

  const eventos = cargarEventos();
  eventos.push(evento);
  guardarEventos(eventos);
  if (estaLogueado()) guardarDocEnNube('eventos', evento);

  registrarUsoOCrear(categoria, carbohidratos, tipoCategoria, cantidad);

  document.getElementById('formNuevoEvento').reset();
  precargarFechaHora();
  sugerirMomentoDelDia();
  poblarSelectCategorias();
  carbsPor100gSeleccionado = null;
  ocultarCamposPorcion();
  ocultarResultadoIA();

  renderTodo();
}

function guardarControl(id, campo, valor) {
  const eventos = cargarEventos();
  const evento = eventos.find((e) => e.id === id);
  if (!evento) return;

  const num = parseFloat(valor);
  if (isNaN(num)) return;

  evento[campo] = num;
  evento.actualizadoEn = new Date().toISOString();

  guardarEventos(eventos);
  if (estaLogueado()) guardarDocEnNube('eventos', evento);
  renderTodo();
}

function eliminarEvento(id) {
  if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  const eventos = cargarEventos().filter((e) => e.id !== id);
  guardarEventos(eventos);
  if (estaLogueado()) eliminarDocDeNube('eventos', id);
  renderTodo();
}

function inicializarAnalisisIA() {
  const btnAnalizar = document.getElementById('btnAnalizarIA');
  const btnUsar = document.getElementById('btnUsarResultadoIA');

  if (btnAnalizar) {
    btnAnalizar.addEventListener('click', analizarConIA);
  }
  if (btnUsar) {
    btnUsar.addEventListener('click', aplicarResultadoIA);
  }
}

async function analizarConIA() {
  const textarea = document.getElementById('inputDescripcionIA');
  const btnAnalizar = document.getElementById('btnAnalizarIA');
  const descripcion = textarea ? textarea.value.trim() : '';

  if (!descripcion) {
    alert('Describí qué comiste antes de analizar.');
    return;
  }

  btnAnalizar.disabled = true;
  btnAnalizar.textContent = 'Analizando...';
  ocultarResultadoIA();

  try {
    const resp = await fetch(PROXY_IA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion }),
    });

    const data = await resp.json();

    if (!resp.ok || data.error) {
      console.error('Error del proxy de IA:', data);
      alert('No se pudo analizar la comida. Revisá que el proxy esté desplegado y la API key configurada.');
      return;
    }

    ultimoResultadoIA = data;
    renderResultadoIA(data);
  } catch (e) {
    console.error('Error llamando al proxy de IA:', e);
    alert('No se pudo conectar con el proxy de IA. Verificá la URL y tu conexión a internet.');
  } finally {
    btnAnalizar.disabled = false;
    btnAnalizar.textContent = 'Analizar con IA';
  }
}

function renderResultadoIA(resultado) {
  const contenedor = document.getElementById('resultadoAnalisisIA');
  if (!contenedor) return;

  document.getElementById('iaCategoria').textContent = resultado.categoria || '—';
  document.getElementById('iaCarbs').textContent = `${resultado.carbohidratos_g ?? '--'} g`;
  document.getElementById('iaConfianza').textContent = resultado.confianza || '—';
  document.getElementById('iaNotas').textContent = resultado.notas || '';

  contenedor.style.display = 'block';
}

function ocultarResultadoIA() {
  const contenedor = document.getElementById('resultadoAnalisisIA');
  if (contenedor) contenedor.style.display = 'none';
  ultimoResultadoIA = null;
}

function aplicarResultadoIA() {
  if (!ultimoResultadoIA) return;

  const inputCategoria = document.getElementById('inputCategoriaComida');
  const inputCarbs = document.getElementById('inputCarbohidratos');

  if (inputCategoria && ultimoResultadoIA.categoria) inputCategoria.value = ultimoResultadoIA.categoria;
  if (inputCarbs && typeof ultimoResultadoIA.carbohidratos_g === 'number') inputCarbs.value = ultimoResultadoIA.carbohidratos_g;

  carbsPor100gSeleccionado = null;
  ocultarCamposPorcion();
}

function estaCompleto(evento) {
  return evento.glucosaPost1h !== null && evento.glucosaPost2h !== null && evento.glucosaPost3h !== null;
}

function formatearFechaHora(fechaHoraStr) {
  const fecha = new Date(fechaHoraStr);
  if (isNaN(fecha.getTime())) return fechaHoraStr;
  return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function renderPuntoGlucosa(label, valor, id, campo) {
  if (valor !== null && valor !== undefined) {
    return `
      <div class="glucose-point filled">
        <span class="gp-label">${label}</span>
        <span class="gp-value">${valor}</span>
      </div>
    `;
  }
  return `
    <div class="glucose-point pending">
      <span class="gp-label">${label}</span>
      <input type="number" placeholder="--" min="20" max="600"
        onchange="guardarControl('${id}', '${campo}', this.value)">
    </div>
  `;
}

function renderTarjetaEvento(evento, mostrarAcciones) {
  const puntos = [
    renderPuntoGlucosa('Pre', evento.glucosaPre, evento.id, null),
    renderPuntoGlucosa('+1h', evento.glucosaPost1h, evento.id, 'glucosaPost1h'),
    renderPuntoGlucosa('+2h', evento.glucosaPost2h, evento.id, 'glucosaPost2h'),
    renderPuntoGlucosa('+3h', evento.glucosaPost3h, evento.id, 'glucosaPost3h'),
  ];
  puntos[0] = `
    <div class="glucose-point filled">
      <span class="gp-label">Pre</span>
      <span class="gp-value">${evento.glucosaPre}</span>
    </div>
  `;

  return `
    <div class="event-card">
      <div class="event-card-top">
        <div>
          <div class="event-card-title">${evento.categoriaComida}${evento.cantidad ? ` <span style="color: var(--text-muted); font-weight: 400; font-size: 0.82rem;">· ${evento.cantidad}</span>` : ''}</div>
          <div class="event-card-meta">${evento.tipoCategoria ? `${evento.tipoCategoria} · ` : ''}${ETIQUETAS_MOMENTO[evento.momentoDia] || evento.momentoDia} · ${formatearFechaHora(evento.fechaHora)}</div>
        </div>
      </div>
      <div class="event-card-stats">
        <span>Carbs: <strong>${evento.carbohidratos} g</strong></span>
        <span>Insulina: <strong>${evento.insulinaAplicada} U</strong></span>
      </div>
      <div class="glucose-points">
        ${puntos.join('')}
      </div>
      ${evento.notas ? `<div class="event-card-meta" style="margin-bottom: 10px;">📝 ${evento.notas}</div>` : ''}
      ${mostrarAcciones ? `
        <div class="event-card-actions">
          <button class="btn btn-secondary btn-small" onclick="eliminarEvento('${evento.id}')">Eliminar</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTodo() {
  const eventos = cargarEventos().sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));

  const pendientes = eventos.filter((e) => !estaCompleto(e));
  const historial = eventos.filter((e) => estaCompleto(e));

  const listaPendientes = document.getElementById('listaPendientes');
  const badgePendientes = document.getElementById('badgePendientes');
  const listaHistorial = document.getElementById('listaHistorial');

  if (badgePendientes) badgePendientes.textContent = pendientes.length;

  if (listaPendientes) {
    listaPendientes.innerHTML = pendientes.length
      ? pendientes.map((e) => renderTarjetaEvento(e, true)).join('')
      : '<div class="empty-state">No tenés controles pendientes. Cuando cargues una comida nueva, va a aparecer acá hasta que completes los 3 controles.</div>';
  }

  if (listaHistorial) {
    listaHistorial.innerHTML = historial.length
      ? historial.slice(0, 20).map((e) => renderTarjetaEvento(e, true)).join('')
      : '<div class="empty-state">Todavía no tenés registros completos. Van a aparecer acá una vez que tengan los 3 controles de glucosa cargados.</div>';
  }
}

window.eliminarEvento = eliminarEvento;
window.guardarControl = guardarControl;

// ============================================================================
// LECTOR DE CÓDIGO DE BARRAS — DESACTIVADO a pedido del usuario.
// El HTML correspondiente (botón + modal + script de ZXing) también está
// comentado en registro.html. Para reactivarlo:
//   1) Descomentar el bloque de HTML en registro.html
//   2) Descomentar el bloque de JS acá abajo
//   3) Agregar de nuevo `buscarPorCodigoBarras, guardarConCodigoBarras` al
//      import de recetario.js al principio de este archivo
//   4) Llamar a inicializarScanner() dentro de inicializarComidasRegistradas()
// ============================================================================

/*
let zxingReader = null;

function inicializarScanner() {
  const btn = document.getElementById('btnEscanearCodigo');
  const modal = document.getElementById('modalScanner');
  const btnCerrar = document.getElementById('btnCerrarScanner');
  if (!btn || !modal || !btnCerrar) return;

  btn.addEventListener('click', () => {
    modal.classList.add('active');
    iniciarLecturaCodigoBarras();
  });

  btnCerrar.addEventListener('click', () => {
    detenerScanner();
    modal.classList.remove('active');
  });
}

async function iniciarLecturaCodigoBarras() {
  const estado = document.getElementById('estadoScanner');

  if (typeof ZXing === 'undefined') {
    if (estado) estado.textContent = 'No se pudo cargar el lector de códigos (revisá tu conexión a internet).';
    return;
  }

  if (estado) estado.textContent = 'Apuntá la cámara al código de barras del producto.';

  try {
    zxingReader = new ZXing.BrowserMultiFormatReader();
    const constraints = { video: { facingMode: { ideal: 'environment' } } };

    zxingReader.decodeFromConstraints(constraints, 'videoScanner', (resultado, error) => {
      if (resultado) {
        const codigo = resultado.getText();
        detenerScanner();
        document.getElementById('modalScanner').classList.remove('active');
        procesarCodigoBarras(codigo);
      }
    });
  } catch (e) {
    console.error('Error iniciando el escáner:', e);
    if (estado) estado.textContent = 'No se pudo acceder a la cámara. Revisá los permisos del navegador.';
  }
}

function detenerScanner() {
  if (zxingReader) {
    try { zxingReader.reset(); } catch (e) { }
    zxingReader = null;
  }
}

const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v0/product';

async function procesarCodigoBarras(codigo) {
  const resultadosDiv = document.getElementById('resultadosComidasRegistradas');
  const modal = document.getElementById('modalComidasRegistradas');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  const enMiBase = buscarPorCodigoBarras(codigo);
  if (enMiBase) {
    seleccionarAlimento({
      tipo: 'recetario',
      description: enMiBase.nombre,
      carbohidratosAbsolutos: enMiBase.carbohidratos,
      categoria: enMiBase.categoria,
      cantidad: enMiBase.cantidad,
    });
    return;
  }

  if (resultadosDiv) {
    resultadosDiv.innerHTML = `<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">Buscando producto con código ${codigo} en Open Food Facts...</div>`;
  }

  try {
    const resp = await fetch(`${OFF_PRODUCT_URL}/${codigo}.json`);
    const data = await resp.json();

    const encontroProducto = data.status === 1 && data.product;
    const nombre = encontroProducto ? (data.product.product_name || data.product.generic_name || `Producto ${codigo}`) : '';
    const carbs = encontroProducto && data.product.nutriments ? data.product.nutriments.carbohydrates_100g : null;

    if (encontroProducto && carbs !== null && carbs !== undefined) {
      document.getElementById('inputCategoriaComida').value = nombre;
      carbsPor100gSeleccionado = carbs;
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      mostrarCamposPorcion(carbs, 'Open Food Facts (código de barras)');
      return;
    }

    mostrarFormularioCodigoNoEncontrado(codigo, nombre);
  } catch (e) {
    console.error('Error consultando Open Food Facts:', e);
    mostrarFormularioCodigoNoEncontrado(codigo, '');
  }
}

function mostrarFormularioCodigoNoEncontrado(codigo, nombreSugerido) {
  const resultadosDiv = document.getElementById('resultadosComidasRegistradas');
  if (!resultadosDiv) return;

  resultadosDiv.innerHTML = `
    <div style="padding: 4px;">
      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
        No encontramos datos completos para el código <strong>${codigo}</strong>. Completalo una vez y lo guardamos en tu base.
      </p>
      <div class="form-group" style="margin-bottom: 10px;">
        <label>Nombre</label>
        <input type="text" id="inputNombreCodigoNuevo" value="${nombreSugerido || ''}" placeholder="Ej. Galletitas Traviata">
      </div>
      <div class="form-group" style="margin-bottom: 10px;">
        <label>Categoría</label>
        <select id="selectCategoriaCodigoNuevo"></select>
      </div>
      <div class="form-group" style="margin-bottom: 10px;">
        <label>Cantidad / porción</label>
        <input type="text" id="inputCantidadCodigoNuevo" placeholder="Ej. 1 paquete, 5 galletitas">
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label>Carbohidratos (g)</label>
        <input type="number" id="inputCarbsCodigoNuevo" min="0" step="1" placeholder="Ej. 19">
      </div>
      <button type="button" id="btnGuardarCodigoNuevo" class="btn" style="width: 100%;">Guardar en mi base con este código</button>
    </div>
  `;

  const selectCategoria = document.getElementById('selectCategoriaCodigoNuevo');
  if (selectCategoria) {
    selectCategoria.innerHTML = obtenerCategorias().map((cat) => `<option value="${cat}">${cat}</option>`).join('');
  }

  document.getElementById('btnGuardarCodigoNuevo')?.addEventListener('click', () => {
    const nombre = document.getElementById('inputNombreCodigoNuevo').value.trim();
    const categoria = document.getElementById('selectCategoriaCodigoNuevo').value;
    const cantidad = document.getElementById('inputCantidadCodigoNuevo').value.trim();
    const carbohidratos = parseFloat(document.getElementById('inputCarbsCodigoNuevo').value);

    if (!nombre || isNaN(carbohidratos)) {
      alert('Completá al menos el nombre y los carbohidratos.');
      return;
    }

    const nueva = guardarConCodigoBarras(nombre, categoria, cantidad, carbohidratos, codigo);

    seleccionarAlimento({
      tipo: 'recetario',
      description: nueva.nombre,
      carbohidratosAbsolutos: nueva.carbohidratos,
      categoria: nueva.categoria,
      cantidad: nueva.cantidad,
    });
  });
}
*/