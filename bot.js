const express = require('express');
const twilio = require('twilio');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

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

// Sesiones en memoria
const sesiones = {};

// Menus
const MENU = 'Wazzi - Tu servicio de taxis en Villanueva\n\n1. Pedir taxi\n2. Ver taxistas disponibles\n3. Viajes intermunicipales\n4. Negocios de Villanueva\n\nResponde con el numero de tu opcion.';
const MENU_TIPO = 'Que tipo de servicio necesitas?\n\n1. Local - dentro de Villanueva\n2. Expreso - a corregimientos\n3. Volver al menu principal';

// Enviar mensaje WhatsApp
async function enviar(to, body) {
  await twilioClient.messages.create({
    from: 'whatsapp:' + process.env.TWILIO_SANDBOX_NUMBER,
    to: to,
    body: body
  });
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

// Webhook principal
app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || '').trim().toLowerCase();
  const bodyOriginal = (req.body.Body || '').trim();

  if (!from || !body) return res.sendStatus(200);

  if (!sesiones[from]) {
    sesiones[from] = { paso: 'inicio' };
  }

  const sesion = sesiones[from];
  let respuesta = '';

  try {

    // PASO: INICIO - verificar si esta registrado
    if (sesion.paso === 'inicio' || body === 'menu' || body === 'hola' || body === 'inicio') {
      const cliente = await buscarCliente(from);
      if (cliente) {
        sesiones[from] = { paso: 'menu', nombre: cliente.nombre, registrado: true };
        respuesta = 'Hola de nuevo ' + cliente.nombre + '!\n\n' + MENU;
      } else {
        sesiones[from] = { paso: 'pedir_nombre' };
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
        sesiones[from] = { paso: 'menu', nombre: nombre, registrado: true };
        respuesta = 'Hola ' + nombre + '! Ya quedaste registrado en Wazzi.\n\n' + MENU;
      }
    }

    // MENU PRINCIPAL
    else if (sesion.paso === 'menu') {

      if (body === '1') {
        sesiones[from] = { ...sesion, paso: 'tipo_servicio' };
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
        sesiones[from] = { ...sesion, paso: 'intermunicipal' };
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
      else {
        respuesta = 'No entendi esa opcion.\n\n' + MENU;
      }
    }

    // TIPO DE SERVICIO
    else if (sesion.paso === 'tipo_servicio') {
      if (body === '1') {
        sesiones[from] = { ...sesion, paso: 'pedir_origen', tipo: 'local' };
        respuesta = 'Desde donde te recogemos?\n\nEscribe tu direccion o referencia.\nEjemplo: Frente al parque principal';
      } else if (body === '2') {
        sesiones[from] = { ...sesion, paso: 'pedir_origen', tipo: 'expreso' };
        respuesta = 'Desde donde te recogemos?\n\nEscribe tu direccion o referencia.';
      } else if (body === '3') {
        sesiones[from] = { ...sesion, paso: 'menu' };
        respuesta = MENU;
      } else {
        respuesta = 'Por favor responde con 1, 2 o 3.';
      }
    }

    // PEDIR ORIGEN
    else if (sesion.paso === 'pedir_origen') {
      sesiones[from] = { ...sesion, paso: 'pedir_destino', origen: bodyOriginal };
      respuesta = 'Recojo en: ' + bodyOriginal + '\n\nA donde vas?\n\nEscribe tu destino.';
    }

    // PEDIR DESTINO
    else if (sesion.paso === 'pedir_destino') {
      sesiones[from] = { ...sesion, paso: 'confirmar_pedido', destino: bodyOriginal };
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
        sesiones[from] = { paso: 'menu', nombre: sesion.nombre, registrado: true };
        respuesta = 'Pedido enviado! Los taxistas ya lo ven.\n\nTe avisamos cuando alguien lo tome.\n\nEscribe menu si necesitas algo mas.';
      } else {
        sesiones[from] = { ...sesion, paso: 'menu' };
        respuesta = 'Pedido cancelado.\n\n' + MENU;
      }
    }

    // INTERMUNICIPAL
    else if (sesion.paso === 'intermunicipal') {
      sesiones[from] = { ...sesion, paso: 'menu' };
      respuesta = 'Buscando viajes a ' + bodyOriginal + '...\n\nEn este momento no hay viajes publicados a ' + bodyOriginal + '.\n\nPuedes pedir un taxi privado respondiendo 1 en el menu.\n\nEscribe menu para volver.';
    }

    // RESPUESTA DESCONOCIDA
    else {
      sesiones[from] = { paso: 'inicio' };
      respuesta = MENU;
    }

  } catch (error) {
    console.error('Error en bot:', error);
    respuesta = 'Hubo un error. Por favor escribe menu para reiniciar.';
    sesiones[from] = { paso: 'inicio' };
  }

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
  res.json({ status: 'Wazzi Bot corriendo', version: '1.0' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Wazzi Bot corriendo en puerto ' + PORT));
