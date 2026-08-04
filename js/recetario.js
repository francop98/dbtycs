// ============================================================================
// DBTYCS — Recetario Personal
// Base local de comidas (localStorage['dbtycs_recetario']), precargada con
// platos argentinos típicos y que se expande sola con lo que vas cargando.
// Cada receta guarda: nombre, categoría, cantidad (porción) y carbohidratos.
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

export const CATEGORIAS_COMIDA = [
  'Pastas', 'Carnes', 'Pollo y Aves', 'Pescados y Mariscos', 'Panificados',
  'Lácteos', 'Frutas', 'Verduras y Ensaladas', 'Legumbres', 'Arroz y Cereales',
  'Snacks y Frituras', 'Dulces y Postres', 'Bebidas', 'Otro',
];

// --- Comidas argentinas típicas precargadas ---
// [nombre, carbohidratos (g), categoría, cantidad/porción]
const RECETAS_PRECARGADAS = [
  ['Milanesa de carne (sola)', 5, 'Carnes', '1 unidad'],
  ['Milanesa de carne con puré', 45, 'Carnes', '1 porción'],
  ['Milanesa de carne con papas fritas', 55, 'Carnes', '1 porción'],
  ['Milanesa de pollo', 8, 'Pollo y Aves', '1 unidad'],
  ['Milanesa napolitana con papas fritas', 60, 'Carnes', '1 porción'],
  ['Milanesa de soja', 15, 'Legumbres', '1 unidad'],
  ['Puré de papas', 35, 'Verduras y Ensaladas', '1 plato'],
  ['Papas fritas', 45, 'Snacks y Frituras', '1 porción'],
  ['Fideos con salsa de tomate', 70, 'Pastas', '1 plato'],
  ['Fideos con manteca y queso', 65, 'Pastas', '1 plato'],
  ['Ñoquis con salsa', 65, 'Pastas', '1 plato'],
  ['Ravioles con salsa', 60, 'Pastas', '1 plato'],
  ['Canelones', 55, 'Pastas', '6 unidades'],
  ['Arroz blanco', 45, 'Arroz y Cereales', '1 plato'],
  ['Arroz con pollo', 50, 'Arroz y Cereales', '1 plato'],
  ['Asado (carne sola)', 2, 'Carnes', '200g'],
  ['Asado con ensalada', 10, 'Carnes', '1 porción'],
  ['Choripán', 40, 'Carnes', '1 unidad'],
  ['Empanada de carne', 20, 'Panificados', '1 unidad'],
  ['Empanada de pollo', 20, 'Panificados', '1 unidad'],
  ['Empanada de jamón y queso', 22, 'Panificados', '1 unidad'],
  ['Empanada de humita', 25, 'Panificados', '1 unidad'],
  ['Pizza muzzarella', 60, 'Panificados', '2 porciones'],
  ['Pizza fugazzeta', 65, 'Panificados', '2 porciones'],
  ['Tarta de jamón y queso', 30, 'Panificados', '1 porción'],
  ['Tarta de verdura', 25, 'Verduras y Ensaladas', '1 porción'],
  ['Tarta pascualina', 28, 'Verduras y Ensaladas', '1 porción'],
  ['Sándwich de milanesa', 55, 'Carnes', '1 unidad'],
  ['Sándwich de jamón y queso', 35, 'Lácteos', '1 unidad'],
  ['Tostado', 30, 'Panificados', '2 unidades'],
  ['Hamburguesa completa', 40, 'Carnes', '1 unidad'],
  ['Guiso de lentejas', 45, 'Legumbres', '1 plato'],
  ['Guiso de arroz', 50, 'Arroz y Cereales', '1 plato'],
  ['Locro', 40, 'Legumbres', '1 plato'],
  ['Puchero', 30, 'Carnes', '1 plato'],
  ['Ensalada mixta', 8, 'Verduras y Ensaladas', '1 plato'],
  ['Ensalada rusa', 25, 'Verduras y Ensaladas', '1 porción'],
  ['Sopa de verduras', 15, 'Verduras y Ensaladas', '1 plato'],
  ['Pastel de papa', 35, 'Carnes', '1 porción'],
  ['Polenta', 55, 'Arroz y Cereales', '1 plato'],
  ['Medialunas', 40, 'Panificados', '2 unidades'],
  ['Tostadas con dulce de leche', 40, 'Panificados', '2 unidades'],
  ['Mate cocido con leche', 8, 'Bebidas', '1 taza'],
  ['Yogur con cereal', 30, 'Lácteos', '1 porción'],
  ['Flan con dulce de leche', 45, 'Dulces y Postres', '1 porción'],
  ['Alfajor', 30, 'Dulces y Postres', '1 unidad'],
  ['Facturas', 25, 'Panificados', '1 unidad'],
  ['Helado', 35, 'Dulces y Postres', '2 bochas'],
  ['Fruta', 20, 'Frutas', '1 unidad mediana'],
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
  const inicial = RECETAS_PRECARGADAS.map(([nombre, carbohidratos, categoria, cantidad]) => ({
    id: generarIdReceta(),
    nombre,
    categoria,
    cantidad,
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

// Se llama desde el "Registro Manual de Comidas": agrega una receta nueva a
// la base, o actualiza los datos de una existente si ya había algo parecido
// (sin sumarle un uso, porque no se registró ninguna comida real todavía).
export function agregarOActualizarManual(nombre, categoria, cantidad, carbohidratos) {
  const recetario = cargarRecetario();
  const coincidencias = buscarEnRecetario(nombre);

  if (coincidencias.length > 0) {
    const existente = coincidencias[0].receta;
    const idx = recetario.findIndex((r) => r.id === existente.id);
    if (idx >= 0) {
      recetario[idx].categoria = categoria || recetario[idx].categoria;
      recetario[idx].cantidad = cantidad || recetario[idx].cantidad;
      recetario[idx].carbohidratos = carbohidratos;
      recetario[idx].actualizadoEn = new Date().toISOString();
      guardarRecetarioCompleto(recetario);
      return { actualizada: true, receta: recetario[idx] };
    }
  }

  const nueva = {
    id: generarIdReceta(),
    nombre,
    categoria: categoria || 'Otro',
    cantidad: cantidad || null,
    carbohidratos,
    vecesUsada: 0,
    origen: 'personal',
    creadoEn: new Date().toISOString(),
  };
  recetario.push(nueva);
  guardarRecetarioCompleto(recetario);
  return { actualizada: false, receta: nueva };
}

export function eliminarReceta(id) {
  const recetario = cargarRecetario().filter((r) => r.id !== id);
  guardarRecetarioCompleto(recetario);
}
// recetario, solo le suma un uso y actualiza categoría/cantidad si cambiaron
// (evita duplicados tipo "milanesa"/"Milaneza"). Si no existe nada parecido,
// la agrega como receta nueva propia.
export function registrarUsoOCrear(nombreComida, carbohidratos, categoria, cantidad) {
  const recetario = cargarRecetario();
  const coincidencias = buscarEnRecetario(nombreComida);

  if (coincidencias.length > 0) {
    const mejor = coincidencias[0].receta;
    const idx = recetario.findIndex((r) => r.id === mejor.id);
    if (idx >= 0) {
      recetario[idx].vecesUsada = (recetario[idx].vecesUsada || 0) + 1;
      if (categoria) recetario[idx].categoria = categoria;
      if (cantidad) recetario[idx].cantidad = cantidad;
      recetario[idx].actualizadoEn = new Date().toISOString();
      guardarRecetarioCompleto(recetario);
    }
    return;
  }

  recetario.push({
    id: generarIdReceta(),
    nombre: nombreComida,
    categoria: categoria || 'Otro',
    cantidad: cantidad || null,
    carbohidratos,
    vecesUsada: 1,
    origen: 'personal',
    creadoEn: new Date().toISOString(),
  });
  guardarRecetarioCompleto(recetario);
}