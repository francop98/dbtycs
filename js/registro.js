// ============================================================================
// DBTYCS — Registro de Comidas
// Guarda eventos en localStorage['dbtycs_eventos'] como array de objetos.
// Cada evento es la unidad base que va a alimentar el motor de análisis que
// sugiere ajustes de Ratio I:C y FSI (agrupando por categoría de comida y/o
// momento del día). Acá solo nos encargamos de la carga y edición de datos.
// ============================================================================

const EVENTOS_KEY = 'dbtycs_eventos';
const USDA_API_KEY = 'VGps3fGihKwWQ2UYCgjoNQXHZDrXcBaOF3R91BCe';
const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

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

document.addEventListener('DOMContentLoaded', () => {
  precargarFechaHora();
  sugerirMomentoDelDia();
  renderTodo();
  inicializarBusquedaUSDA();

  const form = document.getElementById('formNuevoEvento');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      guardarNuevoEvento();
    });
  }
});

// --- Utilidades ---

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

// --- Buscador combinado: USDA FoodData Central + Open Food Facts ---

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v0/product';

let zxingReader = null;

function inicializarBusquedaUSDA() {
  const input = document.getElementById('inputCategoriaComida');
  const resultadosDiv = document.getElementById('resultadosBusquedaComida');
  if (!input || !resultadosDiv) return;

  input.addEventListener('input', () => {
    // Si el usuario vuelve a escribir, invalidamos la selección previa
    carbsPor100gSeleccionado = null;
    ocultarCamposPorcion();

    const termino = input.value.trim();
    clearTimeout(debounceTimeoutBusqueda);

    if (termino.length < 3) {
      resultadosDiv.style.display = 'none';
      resultadosDiv.innerHTML = '';
      return;
    }

    debounceTimeoutBusqueda = setTimeout(() => buscarEnBasesDeDatos(termino), 450);
  });

  // Cerrar el desplegable si se hace clic afuera
  document.addEventListener('click', (e) => {
    if (!resultadosDiv.contains(e.target) && e.target !== input) {
      resultadosDiv.style.display = 'none';
    }
  });

  inicializarScanner();
}

async function buscarEnBasesDeDatos(termino) {
  const resultadosDiv = document.getElementById('resultadosBusquedaComida');
  if (!resultadosDiv) return;

  resultadosDiv.style.display = 'block';
  resultadosDiv.innerHTML = '<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">Buscando en USDA y Open Food Facts...</div>';

  const [usda, off] = await Promise.allSettled([
    buscarEnUSDA(termino),
    buscarEnOpenFoodFacts(termino),
  ]);

  const resultados = [
    ...(off.status === 'fulfilled' ? off.value : []),   // priorizamos Open Food Facts: mejor cobertura de productos argentinos
    ...(usda.status === 'fulfilled' ? usda.value : []),
  ];

  renderResultadosBusqueda(resultados);
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
  const resultadosDiv = document.getElementById('resultadosBusquedaComida');
  if (!resultadosDiv) return;

  if (!resultados.length) {
    resultadosDiv.innerHTML = '<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">Sin resultados con datos de carbohidratos en USDA ni Open Food Facts. Podés cargar el nombre y los gramos a mano.</div>';
    return;
  }

  resultadosDiv.innerHTML = resultados.map((item, i) => `
    <div class="resultado-busqueda" data-index="${i}" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border); font-size: 0.85rem;">
      <div style="color: var(--text-main); font-weight: 600;">${item.description}</div>
      <div style="color: var(--text-muted); font-size: 0.78rem;">${item.carbs.toFixed(1)} g de carbohidratos por 100g · <span style="color: var(--accent);">${item.source}</span></div>
    </div>
  `).join('');

  resultadosDiv.querySelectorAll('.resultado-busqueda').forEach((el, i) => {
    el.addEventListener('mouseenter', () => { el.style.background = 'rgba(56, 189, 248, 0.08)'; });
    el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
    el.addEventListener('click', () => seleccionarAlimento(resultados[i]));
  });
}

function seleccionarAlimento(item) {
  const input = document.getElementById('inputCategoriaComida');
  const resultadosDiv = document.getElementById('resultadosBusquedaComida');

  if (input) input.value = item.description;
  carbsPor100gSeleccionado = item.carbs;

  if (resultadosDiv) {
    resultadosDiv.style.display = 'none';
    resultadosDiv.innerHTML = '';
  }

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

// --- Lector de código de barras (ZXing + Open Food Facts) ---

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
    const dispositivos = await ZXing.BrowserCodeReader.listVideoInputDevices();
    // La cámara trasera suele quedar última en la lista de dispositivos en celulares
    const deviceId = dispositivos.length ? dispositivos[dispositivos.length - 1].deviceId : undefined;

    zxingReader.decodeFromVideoDevice(deviceId, 'videoScanner', (resultado, error) => {
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
    try { zxingReader.reset(); } catch (e) { /* no-op */ }
    zxingReader = null;
  }
}

async function procesarCodigoBarras(codigo) {
  const resultadosDiv = document.getElementById('resultadosBusquedaComida');
  if (resultadosDiv) {
    resultadosDiv.style.display = 'block';
    resultadosDiv.innerHTML = `<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">Buscando producto con código ${codigo} en Open Food Facts...</div>`;
  }

  try {
    const resp = await fetch(`${OFF_PRODUCT_URL}/${codigo}.json`);
    const data = await resp.json();

    if (data.status !== 1 || !data.product) {
      if (resultadosDiv) resultadosDiv.innerHTML = '<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">No se encontró ningún producto con ese código en Open Food Facts. Podés cargarlo a mano.</div>';
      return;
    }

    const nombre = data.product.product_name || data.product.generic_name || `Producto ${codigo}`;
    const carbs = data.product.nutriments ? data.product.nutriments.carbohydrates_100g : null;

    document.getElementById('inputCategoriaComida').value = nombre;

    if (carbs === null || carbs === undefined) {
      if (resultadosDiv) resultadosDiv.innerHTML = `<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">Encontramos "${nombre}" pero no tiene datos de carbohidratos cargados en Open Food Facts. Completalo a mano.</div>`;
      return;
    }

    carbsPor100gSeleccionado = carbs;
    if (resultadosDiv) {
      resultadosDiv.style.display = 'none';
      resultadosDiv.innerHTML = '';
    }
    mostrarCamposPorcion(carbs, 'Open Food Facts (código de barras)');
  } catch (e) {
    console.error('Error consultando Open Food Facts:', e);
    if (resultadosDiv) resultadosDiv.innerHTML = '<div style="padding: 10px; font-size: 0.85rem; color: var(--text-muted);">No se pudo conectar con Open Food Facts.</div>';
  }
}

// --- Alta de eventos ---

function guardarNuevoEvento() {
  const categoria = document.getElementById('inputCategoriaComida').value.trim();
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

  document.getElementById('formNuevoEvento').reset();
  precargarFechaHora();
  sugerirMomentoDelDia();
  carbsPor100gSeleccionado = null;
  ocultarCamposPorcion();

  renderTodo();
}

// --- Completar controles pendientes ---

function guardarControl(id, campo, valor) {
  const eventos = cargarEventos();
  const evento = eventos.find((e) => e.id === id);
  if (!evento) return;

  const num = parseFloat(valor);
  if (isNaN(num)) return;

  evento[campo] = num;
  evento.actualizadoEn = new Date().toISOString();

  guardarEventos(eventos);
  renderTodo();
}

function eliminarEvento(id) {
  if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  const eventos = cargarEventos().filter((e) => e.id !== id);
  guardarEventos(eventos);
  renderTodo();
}

// --- Render ---

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
  // El punto "Pre" siempre está lleno (es obligatorio al cargar), lo forzamos:
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
          <div class="event-card-title">${evento.categoriaComida}</div>
          <div class="event-card-meta">${ETIQUETAS_MOMENTO[evento.momentoDia] || evento.momentoDia} · ${formatearFechaHora(evento.fechaHora)}</div>
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