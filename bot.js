const express = require('express');
const twilio = require('twilio');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  })
});
const db = getFirestore();

// Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
  );

// Sesiones (persistidas en Firestore para sobrevivir reinicios del servidor)
async function obtenerSesion(from) {
  const doc = await db.collection('sesiones').doc(from).get();
  if (doc.exists) return doc.data();
  return { paso: 'inicio' };
}

async function guardarSesion(from, sesion) {
  await db.collection('sesiones').doc(from).set(sesion);
}

// Menus
const MENU = 'Wazzi - Tu servicio de taxis en Villanueva\n\n1. Pedir taxi\n2. Ver taxistas disponibles\n3. Viajes intermunicipales\n4. Negocios de Villanueva\n5. Soy empresa de transporte\n\nResponde con el numero de tu opcion.';
const MENU_TIPO = 'Que tipo de servicio necesitas?\n\n1. Local - dentro de Villanueva\n2. Expreso - a corregimientos\n3. Volver al menu principal';

// Enviar mensaje WhatsApp
async function enviar(to, body) {
  await twilioClient.messages.create({
    from: 'whatsapp:' + process.env.TWILIO_SANDBOX_NUMBER,
    to: to,
    body: body
  });
}

// Quitar tildes y pasar a minusculas, para poder comparar nombres de municipios
function normalizar(texto) {
  return (texto || '').toString().normalize('NFD').replace(/[^\x00-\x7F]/g, '').toLowerCase().trim();
}

// Buscar cliente en Firebase
async function buscarCliente(telefono) {
  const snap = await db.collection('usuarios').where('telefono', '==', telefono).limit(1).get();
  if (!snap.empty) return snap.docs[0].data();
  return null;
}

// Registrar cliente
async function registrarCliente(telefono, nombre) {
  await db.collection('usuarios').add({
    nombre: nombre,
    telefono: telefono,
    rol: 'client',
    ciudad: 'Villanueva',
    canal: 'whatsapp',
    fecha_registro: Timestamp.now()
  });
}

// Notificar taxistas
async function notificarTaxistas(origen, destino, tipo, pedidoId) {
  try {
    const snap = await db.collection('taxistas').where('disponible', '==', true).get();
    for (const doc of snap.docs) {
      const t = doc.data();
      if (!t.telefono) continue;
      const tel = t.telefono.toString().replace(/\s/g, '');
      const msg = 'Nuevo pedido en Wazzi\n\nDesde: ' + origen + '\nHasta: ' + destino + '\nTipo: ' + tipo + '\n\nResponde SI ' + pedidoId + ' para tomar este servicio.';
      try {
        await twilioClient.messages.create({
          from: 'whatsapp:' + process.env.TWILIO_SANDBOX_NUMBER,
          to: 'whatsapp:+57' + tel,
          body: msg
        });
      } catch(e) {
        console.log('Error notificando taxista ' + tel + ': ' + e.message);
      }
    }
  } catch(e) {
    console.error('Error notificando taxistas:', e);
  }
}

// ===== EMPRESAS DE TRANSPORTE (buses / carros por puesto) =====

async function buscarEmpresa(telefono) {
  const doc = await db.collection('empresas_transporte').doc(telefono).get();
  if (doc.exists) return doc.data();
  return null;
}

async function registrarEmpresa(telefono, datos) {
  await db.collection('empresas_transporte').doc(telefono).set({
    nombre: datos.nombre,
    nit: datos.nit,
    tipo: datos.tipo,
    telefono: telefono,
    activa: true,
    fecha_registro: Timestamp.now()
  });
}

async function crearRuta(empresaId, empresaNombre, datos) {
  const ref = await db.collection('rutas').add({
    empresa_id: empresaId,
    empresa_nombre: empresaNombre,
    origen: 'Villanueva',
    destino: datos.destino,
    destino_normalizado: normalizar(datos.destino),
    precio: datos.precio,
    duracion: datos.duracion,
    tipo: datos.tipo,
    activa: true,
    fecha_creacion: Timestamp.now()
  });
  return ref.id;
}

async function rutasDeEmpresa(empresaId) {
  const snap = await db.collection('rutas').where('empresa_id', '==', empresaId).where('activa', '==', true).get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function crearSalida(ruta, datos) {
  await db.collection('salidas').add({
    ruta_id: ruta.id,
    empresa_id: ruta.empresa_id,
    empresa_nombre: ruta.empresa_nombre,
    origen: ruta.origen,
    destino: ruta.destino,
    destino_normalizado: ruta.destino_normalizado,
    precio: ruta.precio,
    tipo: ruta.tipo,
    hora_salida: datos.hora,
    cupos_totales: datos.cupos,
    cupos_disponibles: datos.cupos,
    activa: true,
    fecha_creacion: Timestamp.now()
  });
}

// Busca salidas con cupos disponibles hacia un destino (de cualquier empresa)
async function buscarSalidasPorDestino(destino) {
  const destinoNorm = normalizar(destino);
  const snap = await db.collection('salidas').where('destino_normalizado', '==', destinoNorm).where('activa', '==', true).get();
  const salidas = snap.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .filter(s => s.cupos_disponibles > 0);
  salidas.sort((a, b) => (a.hora_salida || '').localeCompare(b.hora_salida || ''));
  return salidas;
}

// Reserva un cupo de forma segura (transaccion, para no vender el mismo cupo dos veces)
async function reservarCupo(salidaId, cliente) {
  const salidaRef = db.collection('salidas').doc(salidaId);
  const resultado = await db.runTransaction(async (t) => {
    const doc = await t.get(salidaRef);
    if (!doc.exists) return { ok: false, motivo: 'no_existe' };
    const salida = doc.data();
    if (!salida.cupos_disponibles || salida.cupos_disponibles < 1) {
      return { ok: false, motivo: 'sin_cupos' };
    }
    t.update(salidaRef, { cupos_disponibles: FieldValue.increment(-1) });
    return { ok: true, salida: salida };
  });
  if (resultado.ok) {
    await db.collection('reservas_intermunicipales').add({
      cliente_telefono: cliente.telefono,
      cliente_nombre: cliente.nombre || 'Cliente WhatsApp',
      salida_id: salidaId,
      empresa_nombre: resultado.salida.empresa_nombre,
      destino: resultado.salida.destino,
      hora_salida: resultado.salida.hora_salida,
      precio: resultado.salida.precio,
      estado: 'confirmada',
      canal: 'whatsapp',
      fecha: Timestamp.now()
    });
  }
  return resultado;
}

function textoMenuEmpresa(nombreEmpresa) {
  return 'Panel de empresa de transporte - ' + nombreEmpresa + '\n\n1. Agregar nueva ruta\n2. Publicar salida (horario y cupos)\n3. Ver mis rutas activas\n4. Volver al menu principal\n\nResponde con el numero.';
}
// Webhook principal
app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || '').trim().toLowerCase();
  const bodyOriginal = (req.body.Body || '').trim();

         if (!from || !body) return res.sendStatus(200);

         const sesion = await obtenerSesion(from);
  let nuevaSesion = sesion;
  let respuesta = '';

         try {

  // PASO: INICIO - verificar si esta registrado
  if (sesion.paso === 'inicio' || body === 'menu' || body === 'hola' || body === 'inicio') {
    const cliente = await buscarCliente(from);
    if (cliente) {
      nuevaSesion = { paso: 'menu', nombre: cliente.nombre, registrado: true };
      respuesta = 'Hola de nuevo ' + cliente.nombre + '!\n\n' + MENU;
    } else {
      nuevaSesion = { paso: 'pedir_nombre' };
      respuesta = 'Bienvenido a Wazzi! Tu servicio de taxis en Villanueva, Casanare.\n\nCual es tu nombre?';
    }
  }

  // PASO: PEDIR NOMBRE
  else if (sesion.paso === 'pedir_nombre') {
    const nombre = bodyOriginal.trim();
    if (nombre.length < 2) {
      respuesta = 'Por favor escribe tu nombre completo.';
    } else {
      await registrarCliente(from, nombre);
      nuevaSesion = { paso: 'menu', nombre: nombre, registrado: true };
      respuesta = 'Hola ' + nombre + '! Ya quedaste registrado en Wazzi.\n\n' + MENU;
    }
  }

  // MENU PRINCIPAL
  else if (sesion.paso === 'menu') {

           if (body === '1') {
             nuevaSesion = { ...sesion, paso: 'tipo_servicio' };
             respuesta = MENU_TIPO;
           }
    else if (body === '2') {
      const snap = await db.collection('taxistas').where('disponible', '==', true).get();
      if (snap.empty) {
        respuesta = 'No hay taxistas disponibles ahora. Intenta en unos minutos.\n\nEscribe menu para volver.';
      } else {
        let lista = 'Taxistas disponibles ahora:\n\n';
        snap.forEach(doc => {
          const t = doc.data();
          lista += t.nombre + ' ' + (t.apellido || '') + '\n';
          lista += 'Placa: ' + (t.placa || 'N/A') + ' - ' + (t.paradero || 'N/A') + '\n';
          lista += 'Servicio: ' + (t.tipo === 'intermunicipal' ? 'Intermunicipal' : 'Local/Expreso') + '\n\n';
        });
        lista += 'Escribe 1 para pedir un taxi.';
        respuesta = lista;
      }
    }
    else if (body === '3') {
      nuevaSesion = { ...sesion, paso: 'intermunicipal_destino' };
      respuesta = 'Viajes intermunicipales disponibles:\n\nYopal\nMonterrey\nTauramena\nAguazul\nBarranca de Upia\nVillavicencio\nCumaral\nRestrepo\n\nEscribe el nombre de la ciudad a donde vas.';
    }
    else if (body === '4') {
      const snap = await db.collection('negocios').where('activo', '==', true).get();
      if (snap.empty) {
        respuesta = 'Proximamente el directorio de negocios de Villanueva.\n\nEscribe menu para volver.';
      } else {
        let lista = 'Negocios de Villanueva:\n\n';
        snap.forEach(doc => {
          const n = doc.data();
          lista += n.nombre + ' - ' + n.tipo + '\n';
          lista += 'Tel: ' + n.telefono + '\n';
          if (n.domicilio) lista += 'Hace domicilios\n';
          lista += '\n';
        });
        respuesta = lista;
      }
    }
    else if (body === '5') {
      const empresa = await buscarEmpresa(from);
      if (empresa) {
        nuevaSesion = { paso: 'empresa_menu', empresa_nombre: empresa.nombre };
        respuesta = textoMenuEmpresa(empresa.nombre);
      } else {
        nuevaSesion = { ...sesion, paso: 'empresa_registro_nombre' };
        respuesta = 'Vamos a registrar tu empresa de transporte en Wazzi.\n\nCual es el nombre de la empresa?';
      }
    }
    else {
      respuesta = 'No entendi esa opcion.\n\n' + MENU;
    }
  }

  // TIPO DE SERVICIO
  else if (sesion.paso === 'tipo_servicio') {
    if (body === '1') {
      nuevaSesion = { ...sesion, paso: 'pedir_origen', tipo: 'local' };
      respuesta = 'Desde donde te recogemos?\n\nEscribe tu direccion o referencia.\nEjemplo: Frente al parque principal';
    } else if (body === '2') {
      nuevaSesion = { ...sesion, paso: 'pedir_origen', tipo: 'expreso' };
      respuesta = 'Desde donde te recogemos?\n\nEscribe tu direccion o referencia.';
    } else if (body === '3') {
      nuevaSesion = { ...sesion, paso: 'menu' };
      respuesta = MENU;
    } else {
      respuesta = 'Por favor responde con 1, 2 o 3.';
    }
  }

  // PEDIR ORIGEN
  else if (sesion.paso === 'pedir_origen') {
    nuevaSesion = { ...sesion, paso: 'pedir_destino', origen: bodyOriginal };
    respuesta = 'Recojo en: ' + bodyOriginal + '\n\nA donde vas?\n\nEscribe tu destino.';
  }

  // PEDIR DESTINO
  else if (sesion.paso === 'pedir_destino') {
    nuevaSesion = { ...sesion, paso: 'confirmar_pedido', destino: bodyOriginal };
    const tipoLabel = sesion.tipo === 'local' ? 'Local' : 'Expreso';
    respuesta = 'Confirma tu pedido:\n\nTipo: ' + tipoLabel + '\nDesde: ' + sesion.origen + '\nHasta: ' + bodyOriginal + '\n\n1. Si, pedir taxi\n2. No, cancelar';
  }

  // CONFIRMAR PEDIDO
  else if (sesion.paso === 'confirmar_pedido') {
    if (body === '1') {
      const pedidoRef = await db.collection('pedidos').add({
        cliente_telefono: from,
        cliente_nombre: sesion.nombre || 'Cliente WhatsApp',
        origen: sesion.origen,
        destino: sesion.destino,
        tipo: sesion.tipo,
        estado: 'pendiente',
        ciudad: 'Villanueva',
        taxista_id: 'sin asignar',
        canal: 'whatsapp',
        fecha: Timestamp.now()
      });
      await notificarTaxistas(sesion.origen, sesion.destino, sesion.tipo, pedidoRef.id);
      nuevaSesion = { paso: 'menu', nombre: sesion.nombre, registrado: true };
      respuesta = 'Pedido enviado! Los taxistas ya lo ven.\n\nTe avisamos cuando alguien lo tome.\n\nEscribe menu si necesitas algo mas.';
    } else {
      nuevaSesion = { ...sesion, paso: 'menu' };
      respuesta = 'Pedido cancelado.\n\n' + MENU;
    }
  }

  // ===== INTERMUNICIPALES: CLIENTE BUSCANDO VIAJE =====
  // Cliente escribio la ciudad de destino
  else if (sesion.paso === 'intermunicipal_destino') {
    const salidas = await buscarSalidasPorDestino(bodyOriginal);
    if (salidas.length === 0) {
      nuevaSesion = { paso: 'menu', nombre: sesion.nombre, registrado: sesion.registrado };
      respuesta = 'En este momento no hay viajes publicados a ' + bodyOriginal + '.\n\nPuedes pedir un taxi privado respondiendo 1 en el menu.\n\nEscribe menu para volver.';
    } else {
      let lista = 'Viajes disponibles a ' + bodyOriginal + ':\n\n';
      salidas.forEach((s, i) => {
        lista += (i + 1) + '. ' + s.empresa_nombre + ' - ' + s.hora_salida + ' - $' + parseInt(s.precio || 0).toLocaleString('es-CO') + ' - Cupos: ' + s.cupos_disponibles + '\n';
      });
      lista += '\nEscribe el numero del viaje que quieres reservar.';
      nuevaSesion = { ...sesion, paso: 'intermunicipal_elegir', opciones: salidas.map(s => ({ id: s.id, empresa_nombre: s.empresa_nombre, hora_salida: s.hora_salida, precio: s.precio, destino: s.destino })) };
      respuesta = lista;
    }
  }

  // Cliente elige un numero de la lista de salidas
  else if (sesion.paso === 'intermunicipal_elegir') {
    const opciones = sesion.opciones || [];
    const idx = parseInt(body) - 1;
    if (isNaN(idx) || idx < 0 || idx >= opciones.length) {
      respuesta = 'Por favor responde con el numero del viaje que quieres reservar, o escribe menu para volver.';
    } else {
      const elegida = opciones[idx];
      nuevaSesion = { ...sesion, paso: 'intermunicipal_confirmar', salida_elegida: elegida };
      respuesta = 'Confirma tu reserva:\n\nEmpresa: ' + elegida.empresa_nombre + '\nDestino: ' + elegida.destino + '\nHora: ' + elegida.hora_salida + '\nPrecio: $' + parseInt(elegida.precio || 0).toLocaleString('es-CO') + '\n\n1. Si, reservar cupo\n2. No, cancelar';
    }
  }

  // Cliente confirma o cancela la reserva
  else if (sesion.paso === 'intermunicipal_confirmar') {
    if (body === '1') {
      const elegida = sesion.salida_elegida;
      const resultado = await reservarCupo(elegida.id, { telefono: from, nombre: sesion.nombre });
      nuevaSesion = { paso: 'menu', nombre: sesion.nombre, registrado: sesion.registrado };
      if (resultado.ok) {
        respuesta = 'Cupo reservado!\n\nEmpresa: ' + elegida.empresa_nombre + '\nHora: ' + elegida.hora_salida + '\nPrecio: $' + parseInt(elegida.precio || 0).toLocaleString('es-CO') + '\n\nLlega a tiempo al punto de salida. Escribe menu si necesitas algo mas.';
      } else {
        respuesta = 'Justo se agotaron los cupos de ese viaje. Escribe 3 en el menu para ver otras opciones.\n\n' + MENU;
      }
    } else {
      nuevaSesion = { paso: 'menu', nombre: sesion.nombre, registrado: sesion.registrado };
      respuesta = 'Reserva cancelada.\n\n' + MENU;
    }
  }

  // ===== EMPRESAS DE TRANSPORTE: REGISTRO =====
  else if (sesion.paso === 'empresa_registro_nombre') {
    if (bodyOriginal.length < 2) {
      respuesta = 'Por favor escribe el nombre completo de la empresa.';
    } else {
      nuevaSesion = { ...sesion, paso: 'empresa_registro_tipo', nuevo_nombre: bodyOriginal };
      respuesta = 'Que tipo de servicio prestan?\n\n1. Bus o buseta (ruta fija)\n2. Carro por puesto (colectivo)';
    }
  }

  else if (sesion.paso === 'empresa_registro_tipo') {
    if (body === '1' || body === '2') {
      const tipo = body === '1' ? 'bus' : 'carro';
      nuevaSesion = { ...sesion, paso: 'empresa_registro_nit', nuevo_tipo: tipo };
      respuesta = 'Cual es el NIT de la empresa? (Si no tienes, escribe NA)';
    } else {
      respuesta = 'Por favor responde con 1 o 2.';
    }
  }

  else if (sesion.paso === 'empresa_registro_nit') {
    await registrarEmpresa(from, { nombre: sesion.nuevo_nombre, tipo: sesion.nuevo_tipo, nit: bodyOriginal });
    nuevaSesion = { paso: 'empresa_menu', empresa_nombre: sesion.nuevo_nombre };
    respuesta = 'Listo, ' + sesion.nuevo_nombre + ' ya esta registrada en Wazzi!\n\n' + textoMenuEmpresa(sesion.nuevo_nombre);
  }

  // ===== EMPRESAS DE TRANSPORTE: PANEL =====

  else if (sesion.paso === 'empresa_menu') {
    if (body === '1') {
      nuevaSesion = { ...sesion, paso: 'empresa_ruta_destino' };
      respuesta = 'A que ciudad va la nueva ruta? (Salida desde Villanueva)\n\nEscribe el nombre del municipio destino.';
    } else if (body === '2') {
      const rutas = await rutasDeEmpresa(from);
      if (rutas.length === 0) {
        respuesta = 'Todavia no tienes rutas creadas. Escribe 1 para agregar una ruta primero.\n\n' + textoMenuEmpresa(sesion.empresa_nombre);
      } else {
        let lista = 'Elige la ruta para publicar una salida:\n\n';
        rutas.forEach((r, i) => { lista += (i + 1) + '. Villanueva - ' + r.destino + ' ($' + parseInt(r.precio || 0).toLocaleString('es-CO') + ')\n'; });
        nuevaSesion = { ...sesion, paso: 'empresa_salida_ruta', rutas_disponibles: rutas };
        respuesta = lista;
      }
    } else if (body === '3') {
      const rutas = await rutasDeEmpresa(from);
      if (rutas.length === 0) {
        respuesta = 'Todavia no tienes rutas activas.\n\n' + textoMenuEmpresa(sesion.empresa_nombre);
      } else {
        let lista = 'Tus rutas activas:\n\n';
        rutas.forEach(r => { lista += 'Villanueva - ' + r.destino + '\nPrecio: $' + parseInt(r.precio || 0).toLocaleString('es-CO') + ' - Duracion: ' + r.duracion + '\n\n'; });
        respuesta = lista + textoMenuEmpresa(sesion.empresa_nombre);
      }
          } else if (body === '4') {
      nuevaSesion = { paso: 'menu' };
      respuesta = MENU;
    } else {
      respuesta = 'No entendi esa opcion.\n\n' + textoMenuEmpresa(sesion.empresa_nombre);
    }
  }

  // ===== EMPRESAS DE TRANSPORTE: CREAR RUTA =====

  else if (sesion.paso === 'empresa_ruta_destino') {
    nuevaSesion = { ...sesion, paso: 'empresa_ruta_precio', nueva_ruta_destino: bodyOriginal };
    respuesta = 'Cual es el precio del pasaje a ' + bodyOriginal + '? (Solo el numero, ejemplo: 25000)';
  }

  else if (sesion.paso === 'empresa_ruta_precio') {
    const precio = parseInt(body.replace(/\D/g, ''));
    if (isNaN(precio) || precio <= 0) {
      respuesta = 'Por favor escribe solo el numero del precio, ejemplo: 25000';
    } else {
      nuevaSesion = { ...sesion, paso: 'empresa_ruta_duracion', nueva_ruta_precio: precio };
      respuesta = 'Cuanto dura aproximadamente el viaje? (ejemplo: 2 horas)';
    }
  }

  else if (sesion.paso === 'empresa_ruta_duracion') {
    await crearRuta(from, sesion.empresa_nombre, {
      destino: sesion.nueva_ruta_destino,
      precio: sesion.nueva_ruta_precio,
      duracion: bodyOriginal,
      tipo: sesion.nuevo_tipo || 'bus'
    });
    nuevaSesion = { paso: 'empresa_menu', empresa_nombre: sesion.empresa_nombre };
    respuesta = 'Ruta creada: Villanueva - ' + sesion.nueva_ruta_destino + ' ($' + parseInt(sesion.nueva_ruta_precio || 0).toLocaleString('es-CO') + ')\n\n' + textoMenuEmpresa(sesion.empresa_nombre);
  }

  // ===== EMPRESAS DE TRANSPORTE: PUBLICAR SALIDA =====

  else if (sesion.paso === 'empresa_salida_ruta') {
    const rutas = sesion.rutas_disponibles || [];
    const idx = parseInt(body) - 1;
    if (isNaN(idx) || idx < 0 || idx >= rutas.length) {
      respuesta = 'Por favor responde con el numero de la ruta.';
    } else {
      nuevaSesion = { ...sesion, paso: 'empresa_salida_hora', ruta_elegida: rutas[idx] };
      respuesta = 'A que hora sale? (ejemplo: 6:00 AM)';
    }
  }

  else if (sesion.paso === 'empresa_salida_hora') {
    nuevaSesion = { ...sesion, paso: 'empresa_salida_cupos', nueva_salida_hora: bodyOriginal };
    respuesta = 'Cuantos cupos disponibles tiene esta salida?';
  }

  else if (sesion.paso === 'empresa_salida_cupos') {
    const cupos = parseInt(body.replace(/\D/g, ''));
    if (isNaN(cupos) || cupos <= 0) {
      respuesta = 'Por favor escribe solo el numero de cupos disponibles, ejemplo: 15';
    } else {
      await crearSalida(sesion.ruta_elegida, { hora: sesion.nueva_salida_hora, cupos: cupos });
      nuevaSesion = { paso: 'empresa_menu', empresa_nombre: sesion.empresa_nombre };
      respuesta = 'Salida publicada: Villanueva - ' + sesion.ruta_elegida.destino + ' a las ' + sesion.nueva_salida_hora + ' (' + cupos + ' cupos)\n\n' + textoMenuEmpresa(sesion.empresa_nombre);
    }
  }

  // RESPUESTA DESCONOCIDA
  else {
    nuevaSesion = { paso: 'inicio' };
    respuesta = MENU;
  }

         } catch (error) {
           console.error('Error en bot:', error);
           respuesta = 'Hubo un error. Por favor escribe menu para reiniciar.';
           nuevaSesion = { paso: 'inicio' };
         }

         await guardarSesion(from, nuevaSesion);
  await enviar(from, respuesta);
  res.sendStatus(200);
});

// Notificar cliente cuando taxista acepta
app.post('/notificar-cliente', async (req, res) => {
  const { cliente_telefono, taxista_nombre, placa, taxista_telefono, precio, minutos } = req.body;
  if (!cliente_telefono) return res.status(400).json({ error: 'Falta telefono del cliente' });
  try {
    const precioFormateado = parseInt(precio || 0).toLocaleString('es-CO');
    const msg = 'Tu taxi esta en camino!\n\nTaxista: ' + taxista_nombre + '\nPlaca: ' + placa + '\nPrecio acordado: $' + precioFormateado + '\nLlega en aproximadamente: ' + minutos + ' minutos\n\nNumero del taxista: +57' + (taxista_telefono || '').replace(/\s/g, '') + '\n\nEscribe menu si necesitas algo mas.';
    await enviar(cliente_telefono, msg);
    res.json({ ok: true });
  } catch(e) {
    console.error('Error notificando cliente:', e);
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Wazzi Bot corriendo', version: '1.1' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Wazzi Bot corriendo en puerto ' + PORT));
