const express = require('express');
const twilio = require('twilio');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Firebase Admin init
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

initializeApp({ credential: cert(firebaseConfig) });
const db = getFirestore();

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Sesiones de conversacion en memoria
const sesiones = {};

// ---- FLUJO DEL BOT ----
const MENU_PRINCIPAL = `🚖 *Bienvenido a Wazzi*
Tu servicio de taxis en Villanueva, Casanare.

¿Qué necesitas?
1️⃣ Pedir taxi
2️⃣ Ver taxistas disponibles
3️⃣ Viajes intermunicipales
4️⃣ Negocios de Villanueva

Responde con el número de tu opción.`;

const MENU_TIPO_SERVICIO = `¿Qué tipo de servicio necesitas?
1️⃣ Local — dentro de Villanueva
2️⃣ Expreso — a corregimientos
   (Caribayona, San Agustín, Santa Helena)
3️⃣ Volver al menú principal`;

const CORREGIMIENTOS = ['caribayona', 'san agustín', 'san agustin', 'santa helena', 'santa helena de upía'];
const INTERMUNICIPALES = ['yopal', 'monterrey', 'tauramena', 'aguazul', 'barranca de upía', 'barranca de upia', 'villavicencio', 'cumaral', 'restrepo'];

// ---- WEBHOOK PRINCIPAL ----
app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body?.trim().toLowerCase();
  const bodyOriginal = req.body.Body?.trim();

  if (!from || !body) return res.sendStatus(200);

  // Iniciar sesion si no existe
  if (!sesiones[from]) {
    sesiones[from] = { paso: 'menu' };
  }

  const sesion = sesiones[from];
  let respuesta = '';

  try {
    // ---- MENU PRINCIPAL ----
    if (sesion.paso === 'menu' || body === 'menu' || body === '0') {
      sesiones[from] = { paso: 'menu' };
      respuesta = MENU_PRINCIPAL;
    }

    // ---- OPCION 1: PEDIR TAXI ----
    else if (sesion.paso === 'menu' && body === '1' || sesion.paso === 'eligiendo_servicio' && sesion.accion === 'pedir') {
      sesiones[from] = { paso: 'tipo_servicio', accion: 'pedir' };
      respuesta = MENU_TIPO_SERVICIO;
    }

    else if (sesion.paso === 'tipo_servicio') {
      if (body === '1') {
        sesiones[from] = { ...sesion, paso: 'pedir_origen', tipo: 'local' };
        respuesta = '📍 ¿Desde dónde te recogemos?\n\nEscribe tu dirección o referencia.\nEjemplo: _Frente al parque principal_';
      } else if (body === '2') {
        sesiones[from] = { ...sesion, paso: 'pedir_origen', tipo: 'expreso' };
        respuesta = '📍 ¿Desde dónde te recogemos?\n\nEscribe tu dirección o referencia.';
      } else if (body === '3') {
        sesiones[from] = { paso: 'menu' };
        respuesta = MENU_PRINCIPAL;
      } else {
        respuesta = '⚠️ Por favor responde con 1, 2 o 3.';
      }
    }

    else if (sesion.paso === 'pedir_origen') {
      sesiones[from] = { ...sesion, paso: 'pedir_destino', origen: bodyOriginal };
      respuesta = `📍 Recojo en: *${bodyOriginal}*\n\n¿A dónde vas?\n\nEscribe tu destino.`;
    }

    else if (sesion.paso === 'pedir_destino') {
      sesiones[from] = { ...sesion, paso: 'confirmar_pedido', destino: bodyOriginal };
      respuesta = `✅ *Confirma tu pedido:*\n\n🚖 Tipo: ${sesion.tipo === 'local' ? 'Local' : 'Expreso'}\n📍 Desde: ${sesion.origen}\n📍 Hasta: ${bodyOriginal}\n\n¿Confirmas?\n1️⃣ Sí, pedir taxi\n2️⃣ No, cancelar`;
    }

    else if (sesion.paso === 'confirmar_pedido') {
      if (body === '1') {
        // Guardar pedido en Firebase
        const pedidoRef = await db.collection('pedidos').add({
          cliente_telefono: from,
          cliente_nombre: 'Cliente WhatsApp',
          origen: sesion.origen,
          destino: sesion.destino,
          tipo: sesion.tipo,
          estado: 'pendiente',
          ciudad: 'Villanueva',
          taxista_id: 'sin asignar',
          canal: 'whatsapp',
          fecha: Timestamp.now()
        });

        // Notificar a taxistas disponibles
        await notificarTaxistas(sesion.origen, sesion.destino, sesion.tipo, pedidoRef.id, from);

        sesiones[from] = { paso: 'menu' };
        respuesta = `✅ *¡Pedido enviado!*\n\nTu solicitud ya la ven los taxistas disponibles en Villanueva.\n\nTe avisamos cuando alguien la tome. 🚖\n\nEscribe *menu* para volver al inicio.`;
      } else {
        sesiones[from] = { paso: 'menu' };
        respuesta = `❌ Pedido cancelado.\n\n${MENU_PRINCIPAL}`;
      }
    }

    // ---- OPCION 2: VER TAXISTAS ----
    else if (sesion.paso === 'menu' && body === '2') {
      const taxistas = await db.collection('taxistas').where('disponible', '==', true).get();
      if (taxistas.empty) {
        respuesta = '😔 No hay taxistas disponibles en este momento.\n\nIntenta en unos minutos o escribe *menu* para volver.';
      } else {
        let lista = '🚖 *Taxistas disponibles ahora:*\n\n';
        taxistas.forEach(doc => {
          const t = doc.data();
          lista += `👤 *${t.nombre} ${t.apellido || ''}*\n`;
          lista += `🚗 Placa: ${t.placa || 'N/A'} · ${t.paradero || 'N/A'}\n`;
          lista += `📋 Servicio: ${t.tipo === 'intermunicipal' ? 'Intermunicipal' : 'Local/Expreso'}\n\n`;
        });
        lista += 'Escribe *1* para pedir un taxi o *menu* para volver.';
        respuesta = lista;
      }
      sesiones[from] = { paso: 'menu' };
    }

    // ---- OPCION 3: INTERMUNICIPALES ----
    else if (sesion.paso === 'menu' && body === '3') {
      sesiones[from] = { paso: 'intermunicipal' };
      respuesta = `🚌 *Viajes intermunicipales*\n\n¿A qué ciudad vas?\n\n• Yopal\n• Monterrey\n• Tauramena\n• Aguazul\n• Barranca de Upía\n• Villavicencio\n• Cumaral\n• Restrepo\n\nEscribe el nombre de la ciudad.`;
    }

    else if (sesion.paso === 'intermunicipal') {
      // Buscar viajes disponibles a ese destino
      const destino = bodyOriginal;
      sesiones[from] = { paso: 'menu' };
      respuesta = `🔍 Buscando viajes disponibles a *${destino}*...\n\nEn este momento no hay viajes publicados a ${destino}.\n\nPuedes pedir un taxi privado respondiendo *1* en el menú principal.\n\nEscribe *menu* para volver.`;
    }

    // ---- OPCION 4: NEGOCIOS ----
    else if (sesion.paso === 'menu' && body === '4') {
      const negocios = await db.collection('negocios').where('activo', '==', true).get();
      if (negocios.empty) {
        respuesta = '🏪 Próximamente el directorio de negocios de Villanueva.\n\nEscribe *menu* para volver.';
      } else {
        let lista = '🏪 *Negocios de Villanueva:*\n\n';
        negocios.forEach(doc => {
          const n = doc.data();
          lista += `*${n.nombre}* — ${n.tipo}\n`;
          lista += `📞 ${n.telefono}\n`;
          if (n.domicilio) lista += `🛵 Hace domicilios\n`;
          lista += '\n';
        });
        lista += 'Escribe *menu* para volver.';
        respuesta = lista;
      }
      sesiones[from] = { paso: 'menu' };
    }

    // ---- RESPUESTA DESCONOCIDA ----
    else {
      sesiones[from] = { paso: 'menu' };
      respuesta = MENU_PRINCIPAL;
    }

  } catch (error) {
    console.error('Error en bot:', error);
    respuesta = '⚠️ Hubo un error. Por favor escribe *menu* para reiniciar.';
    sesiones[from] = { paso: 'menu' };
  }

  // Enviar respuesta
  await twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
    to: from,
    body: respuesta
  });

  res.sendStatus(200);
});

// ---- NOTIFICAR TAXISTAS ----
async function notificarTaxistas(origen, destino, tipo, pedidoId, clienteTel) {
  try {
    const taxistas = await db.collection('taxistas')
      .where('disponible', '==', true)
      .get();

    const promesas = [];
    taxistas.forEach(doc => {
      const t = doc.data();
      if (!t.telefono) return;

      const msg = `🚖 *Nuevo pedido en Wazzi*\n\n📍 Desde: ${origen}\n📍 Hasta: ${destino}\n📋 Tipo: ${tipo}\n\nResponde *SI ${pedidoId}* para tomar este servicio.`;

      promesas.push(
        twilioClient.messages.create({
          from: `whatsapp:${process.env.TWILIO_SANDBOX_NUMBER}`,
          to: `whatsapp:+57${t.telefono.replace(/\s/g,'')}`,
          body: msg
        }).catch(e => console.log('Error notificando taxista:', t.telefono, e.message))
      );
    });

    await Promise.all(promesas);
  } catch (e) {
    console.error('Error notificando taxistas:', e);
  }
}

// ---- HEALTH CHECK ----
app.get('/', (req, res) => {
  res.json({ status: 'Wazzi Bot corriendo 🚖', version: '1.0' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Wazzi Bot corriendo en puerto ${PORT}`));
