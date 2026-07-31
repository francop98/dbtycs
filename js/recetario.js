// ============================================================================
// DBTYCS — Recetario Personal
// Base local de comidas (localStorage['dbtycs_recetario']), precargada con
// platos argentinos típicos y que se expande sola con lo que vas cargando.
//
// La "detección de duplicados" usa coincidencia difusa de texto (distancia
// de Levenshtein) — así "milanesa", "Milanesa!" y "milaneza" se reconocen
// como la misma comida, sin necesitar ningún servicio de IA externo.
//
// Los valores de carbohidratos son estimaciones típicas por porción media,
// pensadas como punto de partida — siempre editables al cargar el registro.
// ============================================================================

const RECETARIO_KEY = 'dbtycs_recetario';
const UMBRAL_SIMILITUD = 0.78; // 0 a 1. Más alto = exige coincidencia más exacta.

// --- Comidas argentinas típicas precargadas (carbohidratos estimados, porción media) ---
const RECETAS_PRECARGADAS = [
  ['Milanesa de carne (sola)', 5],
  ['Milanesa de carne con puré', 45],
  ['Milanesa de carne con papas fritas', 55],
  ['Milanesa de pollo', 8],
  ['Milanesa napolitana con papas fritas', 60],
  ['Milanesa de soja', 15],
  ['Puré de papas', 35],
  ['Papas fritas', 45],
  ['Fideos con salsa de tomate', 70],
  ['Fideos con manteca y queso', 65],
  ['Ñoquis con salsa', 65],
  ['Ravioles con salsa', 60],
  ['Canelones', 55],
  ['Arroz blanco', 45],
  ['Arroz con pollo', 50],
  ['Asado (carne sola)', 2],
  ['Asado con ensalada', 10],
  ['Choripán', 40],
  ['Empanada de carne', 20],
  ['Empanada de pollo', 20],
  ['Empanada de jamón y queso', 22],
  ['Empanada de humita', 25],
  ['Pizza muzzarella (2 porciones)', 60],
  ['Pizza fugazzeta (2 porciones)', 65],
  ['Tarta de jamón y queso', 30],
  ['Tarta de verdura', 25],
  ['Tarta pascualina', 28],
  ['Sándwich de milanesa', 55],
  ['Sándwich de jamón y queso', 35],
  ['Tostado (2 unidades)', 30],
  ['Hamburguesa completa', 40],
  ['Guiso de lentejas', 45],
  ['Guiso de arroz', 50],
  ['Locro', 40],
  ['Puchero', 30],
  ['Ensalada mixta', 8],
  ['Ensalada rusa', 25],
  ['Sopa de verduras', 15],
  ['Pastel de papa', 35],
  ['Polenta', 55],
  ['Medialunas (2 unidades)', 40],
  ['Tostadas con dulce de leche (2 unidades)', 40],
  ['Mate cocido con leche', 8],
  ['Yogur con cereal', 30],
  ['Flan con dulce de leche', 45],
  ['Alfajor', 30],
  ['Facturas (unidad)', 25],
  ['Helado (2 bochas)', 35],
  ['Fruta (1 unidad mediana)', 20],
];

// --- Normalización y similitud de texto ---

export function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos
    .replace(/[¡!¿?.,;:()"']/g, '') // saca puntuación común
    .replace(/\s+/g, ' ')
    .trim();
}

function distanciaLevenshtein(a, b) {
  const filas = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: filas }, () => new Array(cols).fill(0));

  for (let i = 0; i < filas; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < cols; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // borrar
        dp[i][j - 1] + 1,      // insertar
        dp[i - 1][j - 1] + costo // sustituir
      );
    }
  }
  return dp[filas - 1][cols - 1];
}

export function similitud(a, b) {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const distancia = distanciaLevenshtein(na, nb);
  const largoMax = Math.max(na.length, nb.length);
  return 1 - distancia / largoMax;
}

// --- CRUD del recetario ---

function generarIdReceta() {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function cargarRecetario() {
  try {
    const guardado = localStorage.getItem(RECETARIO_KEY);
    if (guardado) return JSON.parse(guardado);
  } catch (e) {
    console.error('No se pudo leer el recetario:', e);
  }

  // Primera vez: sembramos el recetario con las comidas precargadas
  const inicial = RECETAS_PRECARGADAS.map(([nombre, carbohidratos]) => ({
    id: generarIdReceta(),
    nombre,
    carbohidratos,
    vecesUsada: 0,
    origen: 'precargada',
    creadoEn: new Date().toISOString(),
  }));
  localStorage.setItem(RECETARIO_KEY, JSON.stringify(inicial));
  return inicial;
}

export function guardarRecetarioCompleto(lista) {
  localStorage.setItem(RECETARIO_KEY, JSON.stringify(lista));
}

// Busca coincidencias difusas en el recetario, ordenadas de más a menos parecidas
export function buscarEnRecetario(termino, minimo = UMBRAL_SIMILITUD) {
  const recetario = cargarRecetario();
  return recetario
    .map((receta) => ({ receta, score: similitud(termino, receta.nombre) }))
    .filter((r) => r.score >= minimo)
    .sort((a, b) => b.score - a.score);
}

// Se llama después de guardar una comida: si ya existe algo parecido en el
// recetario, solo le suma un uso (evita duplicados tipo "milanesa"/"Milaneza").
// Si no existe nada parecido, la agrega como receta nueva propia.
export function registrarUsoOCrear(nombreComida, carbohidratos) {
  const recetario = cargarRecetario();
  const coincidencias = buscarEnRecetario(nombreComida);

  if (coincidencias.length > 0) {
    const mejor = coincidencias[0].receta;
    const idx = recetario.findIndex((r) => r.id === mejor.id);
    if (idx >= 0) {
      recetario[idx].vecesUsada = (recetario[idx].vecesUsada || 0) + 1;
      recetario[idx].actualizadoEn = new Date().toISOString();
      guardarRecetarioCompleto(recetario);
    }
    return;
  }

  recetario.push({
    id: generarIdReceta(),
    nombre: nombreComida,
    carbohidratos,
    vecesUsada: 1,
    origen: 'personal',
    creadoEn: new Date().toISOString(),
  });
  guardarRecetarioCompleto(recetario);
}