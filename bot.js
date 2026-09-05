const express = require('express');
const twilio = require('twilio');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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
      if (!cuentaAlDia(t)) continue;
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
    pin: datos.pin || null,
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

// ===== SUSCRIPCIONES Y PAGOS (taxistas y negocios) =====

// Bandera: mientras este en false, nadie se bloquea por falta de pago.
// Se activa cuando empecemos a cobrar (en unos meses).
const COBRO_HABILITADO = false;

// Clave simple para proteger los endpoints del panel de administrador.
// Se puede sobreescribir con la variable de entorno ADMIN_API_KEY en Railway sin tocar el codigo.
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'wazzi-panel-2024';

function verificarAdmin(req, res) {
  const clave = req.headers['x-admin-key'];
  if (clave !== ADMIN_KEY) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

function telefonoBase(from) {
  return (from || '').replace('whatsapp:', '').replace('+57', '').replace(/\s/g, '');
}

function sumarUnMes(fecha) {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// Revisa si una cuenta (taxista o negocio) esta al dia. Si COBRO_HABILITADO es false, siempre esta al dia.
function cuentaAlDia(datos) {
  if (!COBRO_HABILITADO) return true;
  const s = datos.suscripcion;
  if (!s || !s.activa) return false;
  if (s.vence && s.vence.toDate() < new Date()) return false;
  return true;
}

// Busca si un numero de telefono pertenece a un taxista o a un negocio registrado
async function buscarCuentaPorTelefono(from) {
  const tel = telefonoBase(from);
  let snap = await db.collection('taxistas').where('telefono', '==', tel).limit(1).get();
  if (!snap.empty) return { tipo: 'taxista', id: snap.docs[0].id, datos: snap.docs[0].data() };
  snap = await db.collection('negocios').where('telefono', '==', tel).limit(1).get();
  if (!snap.empty) return { tipo: 'negocio', id: snap.docs[0].id, datos: snap.docs[0].data() };
  return null;
}

// Guarda un reporte de pago como pendiente de revision
async function crearPagoPendiente(cuenta, metodo, monto, mediaUrl, mediaContentType) {
  const ref = await db.collection('pagos').add({
    cuenta_tipo: cuenta.tipo,
    cuenta_id: cuenta.id,
    cuenta_nombre: cuenta.nombre,
    cuenta_telefono: cuenta.telefono,
    metodo: metodo,
    monto: monto || null,
    media_url: mediaUrl || null,
    media_content_type: mediaContentType || null,
    estado: 'pendiente',
    fecha_subida: Timestamp.now(),
    fecha_revision: null
  });
  return ref.id;
}

// Avisa al numero de WhatsApp del administrador que llego un comprobante para revisar
async function notificarAdminPago(cuenta, metodo, monto) {
  const admin = process.env.ADMIN_WHATSAPP_NUMBER;
  if (!admin) { console.log('ADMIN_WHATSAPP_NUMBER no esta configurado, no se pudo avisar del pago.'); return; }
  const metodoLabel = metodo === 'nequi' ? 'Nequi' : (metodo === 'chancera' ? 'Casa chancera' : 'Efectivo');
  const montoTexto = monto ? '$' + parseInt(monto).toLocaleString('es-CO') : 'No especificado';
  const msg = 'Nuevo comprobante de pago en Wazzi\n\n' + (cuenta.tipo === 'taxista' ? 'Taxista' : 'Negocio') + ': ' + cuenta.nombre + '\nMetodo: ' + metodoLabel + '\nValor: ' + montoTexto + '\n\nRevisalo en el panel de administrador, seccion Pagos pendientes.';
  try {
    await twilioClient.messages.create({ from: 'whatsapp:' + process.env.TWILIO_SANDBOX_NUMBER, to: admin, body: msg });
  } catch (e) {
    console.log('Error notificando pago al admin: ' + e.message);
  }
}
// Webhook principal
app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || '').trim().toLowerCase();
  const bodyOriginal = (req.body.Body || '').trim();
  const numMedia = parseInt(req.body.NumMedia || '0');
  const mediaUrl0 = req.body.MediaUrl0 || null;
  const mediaContentType0 = req.body.MediaContentType0 || null;

         if (!from || (!body && numMedia === 0)) return res.sendStatus(200);

         const sesion = await obtenerSesion(from);
  let nuevaSesion = sesion;
  let respuesta = '';

         try {

  // PAGOS: un taxista o negocio puede escribir "pagar" desde cualquier momento para reportar un pago
  if ((body === 'pagar' || body === 'pago') && !['pago_metodo', 'pago_monto', 'pago_comprobante'].includes(sesion.paso)) {
    const cuenta = await buscarCuentaPorTelefono(from);
    if (!cuenta) {
      respuesta = 'No encontramos una cuenta de taxista o negocio asociada a este numero en Wazzi.\n\nSi eres cliente, escribe menu.';
    } else {
      nuevaSesion = { paso: 'pago_metodo', cuenta_tipo: cuenta.tipo, cuenta_id: cuenta.id, cuenta_nombre: cuenta.datos.nombre || cuenta.datos.nombre_negocio || 'Sin nombre' };
      respuesta = 'Vamos a registrar tu pago de Wazzi.\n\nComo pagaste?\n\n1. Efectivo\n2. Nequi\n3. Casa chancera\n\nResponde con el numero.';
    }
  }

  // PASO: INICIO - verificar si esta registrado
  else if (sesion.paso === 'inicio' || body === 'menu' || body === 'hola' || body === 'inicio') {
    const cliente = await buscarCliente(from);
    if (cliente) {
      nuevaSesion = { paso: 'menu', nombre: cliente.nombre, registrado: true };
      respuesta = 'Hola de nuevo ' + cliente.nombre + '!\n\n' + MENU;
    } else {
      nuevaSesion = { paso: 'pedir_nombre' };
      respuesta = 'Bienvenido a Wazzi! Tu servicio de taxis en Villanueva, Casanare.\n\nPor seguridad, cual es tu nombre y apellido completos?';
    }
  }

  // PASO: PEDIR NOMBRE
  else if (sesion.paso === 'pedir_nombre') {
    const nombre = bodyOriginal.trim();
    const partes = nombre.split(/\s+/).filter(p => p.length > 0);
    if (partes.length < 2 || partes.some(p => p.length < 2)) {
      respuesta = 'Por favor escribe tu nombre y apellido completos (ejemplo: Juan Perez).';
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
          if (!cuentaAlDia(t)) return;
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
          if (!cuentaAlDia(n)) return;
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
    nuevaSesion = { ...sesion, paso: 'empresa_registro_pin', nuevo_nit: bodyOriginal };
    respuesta = 'Crea un PIN de 4 numeros para entrar al panel web de tu empresa (para ver cupos y pasajeros).';
  }

  else if (sesion.paso === 'empresa_registro_pin') {
    const pinEmpresa = body.replace(/\D/g, '');
    if (pinEmpresa.length !== 4) {
      respuesta = 'El PIN debe ser exactamente 4 numeros. Intenta de nuevo.';
    } else {
      await registrarEmpresa(from, { nombre: sesion.nuevo_nombre, tipo: sesion.nuevo_tipo, nit: sesion.nuevo_nit, pin: pinEmpresa });
      nuevaSesion = { paso: 'empresa_menu', empresa_nombre: sesion.nuevo_nombre };
      respuesta = 'Listo, ' + sesion.nuevo_nombre + ' ya esta registrada en Wazzi!\n\nPuedes entrar a tu panel web en wazzi-app.vercel.app con tu numero de WhatsApp y este PIN.\n\n' + textoMenuEmpresa(sesion.nuevo_nombre);
    }
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

  // ===== PAGOS: METODO =====
  else if (sesion.paso === 'pago_metodo') {
    if (body === '1' || body === '2' || body === '3') {
      const metodo = body === '1' ? 'efectivo' : (body === '2' ? 'nequi' : 'chancera');
      nuevaSesion = { ...sesion, paso: 'pago_monto', metodo: metodo };
      respuesta = 'Cuanto pagaste? (Solo el numero, ejemplo: 30000)';
    } else {
      respuesta = 'Por favor responde con 1, 2 o 3.';
    }
  }

  // ===== PAGOS: MONTO =====
  else if (sesion.paso === 'pago_monto') {
    const monto = parseInt(body.replace(/\D/g, ''));
    if (isNaN(monto) || monto <= 0) {
      respuesta = 'Por favor escribe solo el numero del valor pagado, ejemplo: 30000';
    } else {
      nuevaSesion = { ...sesion, paso: 'pago_comprobante', monto: monto };
      respuesta = 'Ahora envia la foto del comprobante (captura de Nequi, foto del recibo, o una foto del pago en efectivo).\n\nSi no tienes foto, escribe NO TENGO.';
    }
  }

  // ===== PAGOS: COMPROBANTE =====
  else if (sesion.paso === 'pago_comprobante') {
    if (numMedia > 0 || normalizar(body) === 'no tengo') {
      const cuenta = { tipo: sesion.cuenta_tipo, id: sesion.cuenta_id, nombre: sesion.cuenta_nombre, telefono: telefonoBase(from) };
      await crearPagoPendiente(cuenta, sesion.metodo, sesion.monto, mediaUrl0, mediaContentType0);
      await notificarAdminPago(cuenta, sesion.metodo, sesion.monto);
      nuevaSesion = { paso: 'inicio' };
      respuesta = 'Listo! Recibimos tu reporte de pago.\n\nEn menos de 24 horas lo confirmamos y tu cuenta de Wazzi queda activa. Gracias!';
    } else {
      respuesta = 'Envia la foto del comprobante, o escribe NO TENGO si no tienes una.';
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

// Muestra el comprobante de un pago (Twilio pide autenticacion, por eso este servidor hace de intermediario)
app.get('/comprobante/:pagoId', async (req, res) => {
  try {
    const doc = await db.collection('pagos').doc(req.params.pagoId).get();
    if (!doc.exists || !doc.data().media_url) return res.status(404).send('No encontrado');
    const pago = doc.data();
    const auth = Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64');
    const twilioRes = await fetch(pago.media_url, { headers: { Authorization: 'Basic ' + auth } });
    if (!twilioRes.ok) return res.status(502).send('No se pudo cargar el comprobante');
    res.set('Content-Type', pago.media_content_type || 'image/jpeg');
    const buffer = Buffer.from(await twilioRes.arrayBuffer());
    res.send(buffer);
  } catch (e) {
    console.error('Error cargando comprobante:', e);
    res.status(500).send('Error');
  }
});

// Aprueba o rechaza un pago (llamado desde el panel de administrador)
app.post('/revisar-pago', async (req, res) => {
  if (!verificarAdmin(req, res)) return;
  const { pagoId, decision } = req.body;
  if (!pagoId || !decision) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const pagoRef = db.collection('pagos').doc(pagoId);
    const pagoDoc = await pagoRef.get();
    if (!pagoDoc.exists) return res.status(404).json({ error: 'Pago no encontrado' });
    const pago = pagoDoc.data();

  if (decision === 'aprobado') {
    const coleccion = pago.cuenta_tipo === 'taxista' ? 'taxistas' : 'negocios';
    const cuentaRef = db.collection(coleccion).doc(pago.cuenta_id);
    const cuentaDoc = await cuentaRef.get();
    const suscripcionActual = (cuentaDoc.exists && cuentaDoc.data().suscripcion) || {};
    const venceActual = suscripcionActual.vence ? suscripcionActual.vence.toDate() : null;
    const base = (venceActual && venceActual > new Date()) ? venceActual : new Date();
    const nuevoVence = sumarUnMes(base);
    await cuentaRef.update({ suscripcion: { activa: true, vence: Timestamp.fromDate(nuevoVence) } });
    await pagoRef.update({ estado: 'aprobado', fecha_revision: Timestamp.now() });
    if (pago.cuenta_telefono) {
      const fechaTexto = nuevoVence.toLocaleDateString('es-CO');
      await enviar('whatsapp:+57' + pago.cuenta_telefono, 'Tu pago en Wazzi fue confirmado!\n\nTu cuenta esta activa hasta el ' + fechaTexto + '.\n\nGracias por seguir con nosotros.');
    }
  } else {
    await pagoRef.update({ estado: 'rechazado', fecha_revision: Timestamp.now() });
    if (pago.cuenta_telefono) {
      await enviar('whatsapp:+57' + pago.cuenta_telefono, 'No pudimos confirmar tu ultimo pago reportado en Wazzi.\n\nEscribe PAGAR para intentarlo de nuevo, o contactanos si crees que es un error.');
    }
  }
    res.json({ ok: true });
  } catch (e) {
    console.error('Error revisando pago:', e);
    res.status(500).json({ error: e.message });
  }
});

// Revisa periodicamente si alguna suscripcion vencio y la desactiva (solo actua si COBRO_HABILITADO)
async function revisarVencimientos() {
  if (!COBRO_HABILITADO) return;
  const ahora = new Date();
  for (const coleccion of ['taxistas', 'negocios']) {
    const snap = await db.collection(coleccion).where('suscripcion.activa', '==', true).get();
    for (const doc of snap.docs) {
      const datos = doc.data();
      const vence = datos.suscripcion && datos.suscripcion.vence ? datos.suscripcion.vence.toDate() : null;
      if (vence && vence < ahora) {
        await doc.ref.update({ 'suscripcion.activa': false });
        if (datos.telefono) {
          await enviar('whatsapp:+57' + datos.telefono, 'Tu suscripcion de Wazzi vencio.\n\nEscribe PAGAR para renovarla y seguir recibiendo pedidos.');
        }
      }
    }
  }
}
setInterval(revisarVencimientos, 1000 * 60 * 60 * 6);

// Resumen para el panel de administrador: pagos, empresas de transporte, rutas, salidas y reservas.
// Junta todo en una sola llamada para que el panel cargue rapido.
app.get('/admin/resumen', async (req, res) => {
  if (!verificarAdmin(req, res)) return;
  try {
    const [pagosSnap, empresasSnap, rutasSnap, salidasSnap, reservasSnap] = await Promise.all([
      db.collection('pagos').orderBy('fecha_subida', 'desc').limit(200).get(),
      db.collection('empresas_transporte').get(),
      db.collection('rutas').get(),
      db.collection('salidas').get(),
      db.collection('reservas_intermunicipales').get()
      ]);

  const pagos = pagosSnap.docs.map(d => {
    const p = d.data();
    return {
      id: d.id,
      cuenta_tipo: p.cuenta_tipo || null,
      cuenta_nombre: p.cuenta_nombre || null,
      cuenta_telefono: p.cuenta_telefono || null,
      metodo: p.metodo || null,
      monto: p.monto || null,
      estado: p.estado || 'pendiente',
      tiene_foto: !!p.media_url,
      fecha_subida: p.fecha_subida && p.fecha_subida.toDate ? p.fecha_subida.toDate().toISOString() : null,
      fecha_revision: p.fecha_revision && p.fecha_revision.toDate ? p.fecha_revision.toDate().toISOString() : null
    };
  });

  const empresas = empresasSnap.docs.map(d => {
    const e = d.data();
    return {
      id: d.id,
      nombre: e.nombre || null,
      nit: e.nit || null,
      tipo: e.tipo || null,
      telefono: e.telefono || null,
      activa: !!e.activa,
      fecha_registro: e.fecha_registro && e.fecha_registro.toDate ? e.fecha_registro.toDate().toISOString() : null
    };
  });

  const rutas = rutasSnap.docs.map(d => {
    const r = d.data();
    return {
      id: d.id,
      empresa_id: r.empresa_id || null,
      empresa_nombre: r.empresa_nombre || null,
      origen: r.origen || null,
      destino: r.destino || null,
      precio: r.precio || null,
      duracion: r.duracion || null,
      tipo: r.tipo || null,
      activa: !!r.activa
    };
  });

  const salidas = salidasSnap.docs.map(d => {
    const s = d.data();
    return {
      id: d.id,
      empresa_nombre: s.empresa_nombre || null,
      destino: s.destino || null,
      hora_salida: s.hora_salida || null,
      precio: s.precio || null,
      cupos_totales: s.cupos_totales || 0,
      cupos_disponibles: s.cupos_disponibles || 0,
      activa: !!s.activa
    };
  });

  const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    let ingresosMes = 0;
    let reservasMes = 0;
    pagosSnap.docs.forEach(d => {
      const p = d.data();
      if (p.estado === 'aprobado' && p.fecha_revision && p.fecha_revision.toDate && p.fecha_revision.toDate() >= inicioMes) {
        ingresosMes += (p.monto || 0);
      }
    });
    reservasSnap.docs.forEach(d => {
      const r = d.data();
      if (r.fecha && r.fecha.toDate && r.fecha.toDate() >= inicioMes) reservasMes++;
    });

  res.json({
    pagos,
    empresas,
    rutas,
    salidas,
    reservas_total: reservasSnap.size,
    reservas_mes: reservasMes,
    ingresos_mes: ingresosMes,
    pagos_pendientes: pagos.filter(p => p.estado === 'pendiente').length
  });
  } catch (e) {
    console.error('Error en /admin/resumen:', e);
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Wazzi Bot corriendo', version: '1.3' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Wazzi Bot corriendo en puerto ' + PORT));
