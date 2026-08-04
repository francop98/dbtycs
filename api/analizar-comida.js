// ============================================================================
// Proxy seguro DBTYCS -> Groq (gratis, sin tarjeta de crédito)
// Guarda la API key en la variable de entorno GROQ_API_KEY de Vercel
// (nunca en el código). El frontend solo le manda la descripción de la
// comida a esta función, nunca ve la key.
// ============================================================================

module.exports = async function handler(req, res) {
  // Permite que tu app (corriendo en localhost o donde la publiques) llame a este proxy
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { descripcion } = req.body || {};

  if (!descripcion || typeof descripcion !== 'string' || !descripcion.trim()) {
    return res.status(400).json({ error: 'Falta la descripción de la comida' });
  }

  try {
    const respuestaGroq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Sos un asistente nutricional para una app de manejo de diabetes tipo 1 en Argentina. Te van a describir una comida en español, muchas veces platos caseros argentinos (milanesa, guiso, fideos, empanadas, etc). Devolvé ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin markdown, con esta forma exacta:

{"categoria": "...", "carbohidratos_g": numero, "kcal": numero, "confianza": "alta|media|baja", "notas": "..."}

Reglas:
- "categoria": una frase corta que describa el tipo de comida (ej: "Pastas", "Carnes con guarnición", "Ensalada", "Frituras", "Panificados").
- "carbohidratos_g": tu mejor estimación de gramos totales de carbohidratos de la porción descripta, como número (no string, sin unidades).
- "kcal": tu mejor estimación de calorías totales de la porción, como número.
- "confianza": qué tan segura es tu estimación dada la información disponible (baja si la porción no está clara).
- "notas": una frase breve (máximo 20 palabras) aclarando qué porción o supuestos asumiste.

No agregues explicaciones fuera del JSON. No uses comillas simples. No agregues comas finales.`,
          },
          { role: 'user', content: descripcion },
        ],
      }),
    });

    if (!respuestaGroq.ok) {
      const errorBody = await respuestaGroq.text();
      console.error('Error de Groq:', errorBody);
      return res.status(502).json({ error: 'Error consultando la IA' });
    }

    const data = await respuestaGroq.json();
    const textoRespuesta = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

    let resultado;
    try {
      resultado = JSON.parse(textoRespuesta.trim());
    } catch (e) {
      console.error('No se pudo parsear la respuesta de la IA:', textoRespuesta);
      return res.status(502).json({ error: 'La IA devolvió un formato inesperado', crudo: textoRespuesta });
    }

    return res.status(200).json(resultado);
  } catch (e) {
    console.error('Error en el proxy:', e);
    return res.status(500).json({ error: 'Error interno del proxy' });
  }
};