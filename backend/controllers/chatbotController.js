const chatbotModel = require('../models/chatbotModel');

const SINONIMOS = {
  toyota: 'Toyota',
  honda: 'Honda',
  nissan: 'Nissan',
  hyundai: 'Hyundai',
  kia: 'Kia',
  mazda: 'Mazda',
  ford: 'Ford',
  chevrolet: 'Chevrolet',
  volkswagen: 'Volkswagen',
  bmw: 'BMW',
  mercedes: 'Mercedes-Benz',
  audi: 'Audi',
  suzuki: 'Suzuki',
  mitsubishi: 'Mitsubishi',
  renault: 'Renault',
};

function detectarIntencion(mensaje) {
  const m = mensaje.toLowerCase().trim();

  // 1. MARCA — nombre directo o sinónimo
  for (const [clave, nombre] of Object.entries(SINONIMOS)) {
    if (m.includes(clave)) {
      return { tipo: 'marca', valor: nombre };
    }
  }

  // 2. RANGO DE PRECIO CON NÚMEROS
  let match = m.match(/(?:entre|de)\s*(\d+[\.\d]*)\s*(?:y|a)\s*(\d+[\.\d]*)/i);
  if (match) {
    return { tipo: 'rango_precio', valor: [parseFloat(match[1]), parseFloat(match[2])] };
  }
  match = m.match(/(?:menos|inferior|debajo|maximo|hasta|max|menor)\s*(?:de)?\s*(\d+[\.\d]*)/i);
  if (match) {
    return { tipo: 'rango_precio', valor: [0, parseFloat(match[1])] };
  }
  match = m.match(/(?:mas|más|superior|arriba|encima|minimo|desde|min|mayor)\s*(?:de)?\s*(\d+[\.\d]*)/i);
  if (match) {
    return { tipo: 'rango_precio', valor: [parseFloat(match[1]), 999999] };
  }
  match = m.match(/\b(\d{4,7})\b/);
  if (match && (m.includes('precio') || m.includes('cuesta') || m.includes('vale') || m.includes('cuestan') || m.includes('valen') || m.includes('cueste') || m.includes('valor'))) {
    const n = parseInt(match[1]);
    return { tipo: 'rango_precio', valor: [n - 5000, n + 5000] };
  }

  // 3. CONDICIÓN
  if (/\b(?:nuevos?|nuevo|0km|cero km|nuevito|nuevitos|estrenar|nuevecito)\b/i.test(m) && !/\b(?:usados?|seminuevo|segunda mano|ocasion|usado|de segunda)\b/i.test(m)) {
    return { tipo: 'condicion', valor: 'Nuevo' };
  }
  if (/\b(?:usados?|seminuevo|segunda mano|ocasion|usado|de segunda)\b/i.test(m)) {
    return { tipo: 'condicion', valor: 'Usado' };
  }

  // 4. MODELO — solo si la palabra después de "modelo"/"del" no es genérica
  const GENERICOS = ['auto','carro','coche','vehiculo','vehículo','camioneta','suv','pickup','camion','camión','moto','motocicleta','bicicleta','cuatrimoto','lancha','barco','tractor','maquinaria','remolque'];
  match = m.match(/(?:modelo|del)\s+([a-záéíóúñ]{3,})/i);
  if (match && match[1].length > 2 && !Object.keys(SINONIMOS).includes(match[1]) && !GENERICOS.includes(match[1])) {
    return { tipo: 'modelo', valor: match[1] };
  }

  // 5. TODOS / INVENTARIO / CUÁNTOS
  if (/(?:todos?|lista|inventario|mostrar|ver|enseñar|enseñame|muéstrame|muestra|catálogo|catalogo|stock|disponibles?|completo|registrados?|vehiculos|autos|coches|variedad|modelos|marcas|productos|unidades|existencia|inventario completo|todos los|que hay|que tienes|cuantos|cuántos|dime|dame|quiero ver|quiero que me muestres|qué hay|qué tienes|hay alguno|hay algún)\b/i.test(m)) {
    return { tipo: 'todos' };
  }

  // 6. RECOMENDAR / SUGERIR
  if (/(?:recomienda|recomiéndame|recomiendame|recomendar|sugiere|sugerir|sugerencia|aconseja|aconsejar|que me recomiendas|qué me recomiendas|cual me recomiendas|cuál me recomiendas|el mejor|la mejor|lo mejor|mas vendido|más vendido|popular|destacado|bueno bonito|mejor valorado)\b/i.test(m)) {
    return { tipo: 'recomendar' };
  }

  // 7. PREGUNTAS CON CUESTION WORDS — mapear a ayuda/contexto
  if (/\b(?:cómo|como|cuándo|cuando|dónde|donde|por qué|porque|porque|para qué|para que|a qué|a que|de qué|de que|en qué|en que)\b/i.test(m)) {
    return { tipo: 'ayuda' };
  }

  // 8. AYUDA / SALUDO
  if (/\b(?:hola|ayuda|help|que puedes hacer|comandos|buenas|buen[oa]s|saludos|qué tal|como estas|quien eres|funcionas|sabes hacer|que haces|información|info|puedes ayudarme|necesito ayuda|orientame|orienta|que sabes hacer|tus funciones|cómo funciona|como funciona|explicame|explica|quien sos)\b/i.test(m)) {
    return { tipo: 'ayuda' };
  }

  // 9. PREGUNTAR MARCA — pide vehículo sin especificar marca
  if (/(?:marca|marcas|por marca|de marca|buscar.*marca|búsqueda|busca.*marca|quiero.*marca|alguna marca|que marca|qué marca|busqueda|buscar.*marcas|cualquier marca|cuál marca)/i.test(m) ||
      /(?:quiero|necesito|busco|dame|quisiera|me gustaría|me gustaria|andaba buscando|ando buscando|estoy buscando)\s+(?:un|una|uno|unos|unas|comprar|adquirir|conseguir|encontrar|ver|tener|saber)\s+(?:auto|carro|coche|vehículo|vehiculo|camioneta|suv|pickup|van|camión|camion|moto)/i.test(m)) {
    return { tipo: 'preguntar_marca' };
  }

  // 10. PREGUNTAR PRECIO — pregunta por precio sin dar número
  if (/\b(?:precio|precios|cuanto cuesta|cuanto vale|cuesta|rango.*precio|por.*precio|presupuesto|caro|barato|económico|accesible|valor|cuanto|cuánto|qué precio|que precio|cuál es su precio|cual es su precio|en cuánto|en cuanto|cuanto sale|cuanto está|costó|costo|cueste|costar|cotización|cotizar)\b/i.test(m)) {
    return { tipo: 'preguntar_precio' };
  }

  // 11. BÚSQUEDA GENÉRICA — TODAS las palabras relevantes
  const STOP_WORDS = ['los','las','que','por','para','con','del','una','sus','son','pero','mas','más','muy','tan','asi','así','fue','era','está','esta','entre','tiene','como','cómo','qué','hay','todo','toda','todos','todas','uno','una','unos','unas','ese','esa','eso','este','esta','esto','eres','sea','ser','sin','sobre','durante','mediante','también','tambien','solo','sólo','cada','mismo','otro','otra','otros','otras','poco','poca','pocos','pocas','dicho','dicha','si','no','ni','ya','bien','mal','aun','aún','siempre','nunca','algo','nada','ambos','ambas','ante','tras','cabe','so','contra','hacia','hasta','desde','ambas','ambos','quien','quienes','cual','cuales','donde','cuando'];
  const palabras = m.split(/\s+/).filter(p => p.length > 2 && !STOP_WORDS.includes(p));
  if (palabras.length > 0) {
    return { tipo: 'texto', valor: palabras.join(' ') };
  }

  return { tipo: 'desconocido' };
}

function formatearVehiculos(rows) {
  if (rows.length === 0) return '';
  let texto = '<br><strong>Resultados:</strong><br>';
  rows.slice(0, 5).forEach((v, i) => {
    texto += `${i + 1}. <strong>${v.marca} ${v.modelo}</strong> (${v.anio}) — $${Number(v.precio).toLocaleString()}`;
    if (v.sucursal_nombre) texto += ` — ${v.sucursal_nombre}`;
    texto += '<br>';
  });
  if (rows.length > 5) texto += `<br>... y ${rows.length - 5} más.`;
  return texto;
}

async function procesarMensaje(req, res) {
  try {
    const { mensaje, isGuest } = req.body;

    // Guest limitation — solo se activa si el frontend envía explícitamente isGuest: true
    if (isGuest === true) {
      return res.json({
        respuesta: 'Para usar el asistente virtual, <strong>inicia sesión</strong> o <strong>regístrate</strong>. Mientras tanto, puedes explorar el inventario.',
        botones: ['Iniciar sesión', 'Ver inventario completo'],
      });
    }

    if (!mensaje || !mensaje.trim()) {
      return res.json({
        respuesta: 'Por favor escribe algo para poder ayudarte.',
        botones: ['Ver inventario', 'Buscar por marca Toyota', 'Rango de precio'],
      });
    }

    const intencion = detectarIntencion(mensaje);
    let respuesta = '';
    let vehiculos = [];
    let botones = [];

    switch (intencion.tipo) {
      case 'marca': {
        const result = await chatbotModel.buscarPorMarca(intencion.valor);
        vehiculos = result.rows;
        if (vehiculos.length === 0) {
          respuesta = `No encontré vehículos de la marca <strong>${intencion.valor}</strong>.`;
        } else {
          respuesta = `Encontré ${vehiculos.length} vehículo(s) de <strong>${intencion.valor}</strong>:`;
          respuesta += formatearVehiculos(vehiculos);
        }
        botones = ['Buscar por otra marca', 'Ver inventario completo'];
        break;
      }

      case 'rango_precio': {
        const [min, max] = intencion.valor;
        const result = await chatbotModel.buscarPorRangoPrecio(min, max);
        vehiculos = result.rows;
        if (vehiculos.length === 0) {
          respuesta = `No encontré vehículos entre <strong>$${min.toLocaleString()}</strong> y <strong>$${max.toLocaleString()}</strong>.`;
        } else {
          respuesta = `Encontré ${vehiculos.length} vehículo(s) en ese rango de precio:`;
          respuesta += formatearVehiculos(vehiculos);
        }
        botones = ['Rango de precio entre 5000 y 15000', 'Ver inventario completo'];
        break;
      }

      case 'condicion': {
        const result = await chatbotModel.buscarPorCondicion(intencion.valor);
        vehiculos = result.rows;
        if (vehiculos.length === 0) {
          respuesta = `No hay vehículos <strong>${intencion.valor}</strong> registrados.`;
        } else {
          const label = intencion.valor === 'Nuevo' ? 'nuevos' : 'usados';
          respuesta = `Estos son los vehículos <strong>${label}</strong> disponibles:`;
          respuesta += formatearVehiculos(vehiculos);
        }
        botones = ['Ver nuevos', 'Ver usados', 'Buscar por marca'];
        break;
      }

      case 'modelo': {
        const result = await chatbotModel.buscarPorModelo(intencion.valor);
        vehiculos = result.rows;
        if (vehiculos.length === 0) {
          respuesta = `No encontré el modelo <strong>${intencion.valor}</strong>.`;
        } else {
          respuesta = `Encontré ${vehiculos.length} vehículo(s) del modelo <strong>${intencion.valor}</strong>:`;
          respuesta += formatearVehiculos(vehiculos);
        }
        botones = ['Buscar por otro modelo', 'Buscar por marca'];
        break;
      }

      case 'todos': {
        const result = await chatbotModel.obtenerTodos();
        const countResult = await chatbotModel.contarVehiculos();
        const total = countResult.rows[0]?.total || 0;
        vehiculos = result.rows;
        if (vehiculos.length === 0) {
          respuesta = 'No hay vehículos registrados en el inventario.';
        } else {
          respuesta = `Hay <strong>${total}</strong> vehículo(s) en total. Estos son los últimos registrados:`;
          respuesta += formatearVehiculos(vehiculos);
        }
        botones = ['Buscar por marca', 'Rango de precio', 'Ver nuevos'];
        break;
      }

      case 'recomendar': {
        const result = await chatbotModel.obtenerTodos();
        const countResult = await chatbotModel.contarVehiculos();
        const total = countResult.rows[0]?.total || 0;
        vehiculos = result.rows;
        if (vehiculos.length === 0) {
          respuesta = 'Actualmente no tengo vehículos para recomendarte.';
        } else {
          respuesta = `Claro, estos son los vehículos que tenemos. Hay <strong>${total}</strong> en inventario:`;
          respuesta += formatearVehiculos(vehiculos);
        }
        botones = ['Buscar por marca', 'Rango de precio', 'Ver nuevos', 'Ver usados'];
        break;
      }

      case 'ayuda': {
        let botonesAyuda = ['Ver inventario', 'Buscar por marca Toyota', 'Rango de precio', 'Ver nuevos', 'Ver usados'];
        respuesta = `Puedes preguntarme cosas como:<br><br>
          • "<strong>muéstrame los Toyota</strong>" — buscar por marca<br>
          • "<strong>entre 10000 y 50000</strong>" — buscar por precio<br>
          • "<strong>vehículos nuevos/usados</strong>" — filtrar por condición<br>
          • "<strong>modelo Hilux</strong>" — buscar por modelo<br>
          • "<strong>ver inventario</strong>" — listar todos<br><br>
          O usa los botones de abajo.`;
        botones = botonesAyuda;
        break;
      }

      case 'preguntar_marca': {
        respuesta = '¿Qué marca te gustaría buscar? Tengo vehículos de Toyota, Honda, Nissan, Hyundai y más.';
        botones = ['Toyota', 'Honda', 'Nissan', 'Ver inventario completo'];
        break;
      }

      case 'preguntar_precio': {
        respuesta = '¿Qué rango de precio te interesa? Por ejemplo: entre 10000 y 30000.';
        botones = ['entre 10000 y 30000', 'entre 30000 y 50000', 'Ver inventario completo'];
        break;
      }

      case 'texto': {
        const result = await chatbotModel.buscarPorPalabras(intencion.valor.split(' '));
        vehiculos = result.rows;
        if (vehiculos.length === 0) {
          respuesta = `No encontré resultados para "<strong>${intencion.valor}</strong>". Intenta con otras palabras.`;
        } else {
          respuesta = `Encontré ${vehiculos.length} vehículo(s) relacionados con "<strong>${intencion.valor}</strong>":`;
          respuesta += formatearVehiculos(vehiculos);
        }
        botones = ['Ver inventario completo', 'Buscar por marca', 'Ayuda'];
        break;
      }

      default: {
        respuesta = 'No entendí tu mensaje. Puedes preguntar por marca, modelo, precio, o usar los botones.';
        botones = ['Ver inventario', 'Buscar por marca Toyota', 'Rango de precio', 'Ayuda'];
      }
    }

    res.json({ respuesta, vehiculos, botones });
  } catch (err) {
    console.error('Error en chatbot:', err);
    res.status(500).json({
      respuesta: 'Ocurrió un error al procesar tu mensaje. Intenta de nuevo.',
      botones: ['Ver inventario', 'Ayuda'],
    });
  }
}

module.exports = { procesarMensaje };
