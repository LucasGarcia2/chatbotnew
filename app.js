/* eslint-disable bot-whatsapp/func-prefix-dynamic-flow-await */
const { createBot, createProvider, createFlow, addKeyword, addAnswer } = require('@bot-whatsapp/bot');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const QRPortalWeb = require('@bot-whatsapp/portal');
const MockAdapter = require('@bot-whatsapp/database/mock');
const nodemailer = require('nodemailer');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
require('dotenv').config();

// Creamos la base de datos JSON
const adapter = new FileSync('database.json');
const db = low(adapter);

// Inicializamos la base de datos con un objeto vacío si está vacía
db.defaults({}).write();

// Configurar el transportador SMTP para enviar correos
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Flujo principal y saludo
const flowPrincipal = addKeyword(['hola', 'ole', 'alo','ola', 'ol', 'o', 'l', 'a', 'b', 'bu', 'buenas','buena', 'bue', 'wenas', 'saludos', '0', 'volver',])
    .addAnswer('👋 ¡Bienvenido al servicio de autogestión de incidentes de *San Juan Innova S.E.*! Por favor, elige el número que corresponda a tu entidad.')
    .addAnswer('*1)* 💼 Cliente')
    .addAnswer('*2)* 🏫 Institución pública o educativa');

// Función para enviar correo electrónico con el correo del usuario como remitente
const enviarCorreo = async (asunto, mensaje, correoUsuario) => {

    // Agrega el correo del usuario al arreglo de destinatarios
    const destinatarios = process.env.GMAIL_RECEPTORS.split(',');

    const mailOptions = {
        from: correoUsuario,
        to: destinatarios, // Usa el correo configurado en el archivo .env
        subject: asunto,
        text: mensaje
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Correo electrónico enviado exitosamente');
    } catch (error) {
        console.error('Error al enviar el correo electrónico:', error);
        throw error;
    }
};

// Flujo para clientes
const flowCliente = addKeyword(['1', 'cliente'])
    .addAction(async (_, { flowDynamic, state }) => {
        // Verificar si ya se completó el flujo
        const clienteFlowCompleted = state.clienteFlowCompleted || db.get('clienteFlowCompleted').value();
        if (clienteFlowCompleted) {
            // Si ya se completó el flujo, enviar el mensaje de cierre y salir del flujo
            return await flowDynamic('Muchas gracias por usar nuestro sistema de autogestión de incidentes 🛠️. Su reclamo fue derivado al área técnica, en breve nos comunicaremos con usted.');
        } else {
            // Si no se ha completado el flujo, solicitar el número de cliente
            return await flowDynamic('🔢 Por favor, ingrese su número de CUIT sin puntos ni guiones. También puedes escribir *volver* o *0* para regresar al menú anterior.');
        }
    })
    .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
        // Capturar el número de cliente proporcionado por el usuario
        const numeroCliente = ctx.body.trim();

        // Verificar si el usuario quiere volver al menú anterior
        if (numeroCliente.toLowerCase() === 'volver' || numeroCliente === '0') {
            return await flowDynamic(flowPrincipal); // Volver al menú principal
        }

        // Verificar a quién corresponde el número de cliente
        const cliente = obtenerNombreCliente(numeroCliente); // Función para obtener el nombre del cliente
        if (cliente) {
            // Cliente reconocido
            state.cliente = cliente; // Guardar el nombre del cliente en el estado
            db.set('cliente', cliente).write(); // Guardar el nombre del cliente en la base de datos
            state.clienteFlowCompleted = true; // Marcar el flujo como completado en el estado
            db.set('clienteFlowCompleted', true).write(); // Marcar el flujo como completado en la base de datos
            
            // Enviar mensaje de bienvenida personalizado
            const mensajeBienvenida = `Bienvenido ${cliente} 🌐\n\nPor favor, complete este formulario 📝 (https://san-juan-innova.odoo.com/helpdesk/atencion-al-cliente-2) con sus datos para que podamos generar su reclamo. ⚠️ Por favor conserve su número de ticket que le será solicitado.\n\nTambién puede consultar el cronograma 🗓️ de la guardia aquí (https://drive.google.com/drive/folders/1UNuSopa_iPfaYNADgC7BQPXke40FZQRr). \n\n📩 Recuerde revisar su bandeja de correo para ver el estado de su reclamo. Si no encuentra el correo, revise en su bandeja de spam.`;
            await flowDynamic(mensajeBienvenida);
            
            // Enviar correo con mensaje adicional
            const asunto = `Nueva incidencia generada del cliente ${cliente}, a través de whatsapp`;
            const mensaje = `Por favor, atender la solicitud del cliente ${cliente} CUIT nro ${numeroCliente}, recuerde revisar el ticket generado en https://san-juan-innova.odoo.com/web#action=597&active_id=2&model=helpdesk.ticket&view_type=kanban&menu_id=383&cids=1`;
            await enviarCorreo(asunto, mensaje, ctx.from); // ctx.from contiene el correo del usuario
            
            // Eliminar el cliente de la base de datos al finalizar el flujo
            state.clienteFlowCompleted = false;
            db.unset('cliente').write();
            db.unset('clienteFlowCompleted').write();

            // Enviar mensaje de cierre
            return await flowDynamic('Muchas gracias por usar nuestro sistema de autogestión de incidentes 🛠️. Su reclamo fue derivado al área técnica, en breve nos comunicaremos con usted.');
        } else {
            // Cliente no reconocido
            return await flowDynamic('Lo siento, el número de CUIT ingresado no corresponde a ningún cliente registrado.');
        }        
    });

// Función para obtener el nombre del cliente
function obtenerNombreCliente(numeroCliente) {

    if (numeroCliente === '20291026908') {
        return 'Hugo Leandro Leiria';
    } else if (numeroCliente === '30681700281') {
        return 'Interredes S.A';
    } else if (numeroCliente === '20355088287') {
        return 'Facundo Javier Caselles Costa';
    } else if (numeroCliente === '20164591388') {
        return 'Cesar Augusto Vega';
    } else if (numeroCliente === '20301117400') {
        return 'Raul Omar Cortez';
    } else if (numeroCliente === '30709457477') {
        return 'XF Comunicaciones S.A.';
    } else if (numeroCliente === '30708794763') {
        return 'InterSat S.A';
    } else if (numeroCliente === '30665234114') {
        return 'Genneia';
    } else if (numeroCliente === '30717517292') {
        return 'Ethernet';
    } else if (numeroCliente === '30707719105') {
        return 'Netropolis';
    } else if (numeroCliente === '30716741512') {
        return 'Red Soft S.A.S';
    } else if (numeroCliente === '13572468') {
        return 'Admin';
    } else {
        return null; // Retorna null si el número de cliente no corresponde a ninguno reconocido
    }
}

// Flujo para instituciones
const flowInstituciones = addKeyword(['2', 'institución'])
    .addAction(async (_, { flowDynamic, state }) => {
        if (state.institucionFlowCompleted) {
            return await flowDynamic('Muchas gracias por usar nuestro sistema de autogestión de incidentes 🛠️. Su reclamo fue derivado al área técnica.');
        } else {
            return await flowDynamic('Por favor, ingrese el número de CUE de su institución. También puedes escribir *volver* o *0* para regresar al menú principal.');
        }
    })
    .addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
        const cue = ctx.body.trim();

        if (cue.toLowerCase() === 'volver' || cue === '0') {
            return await flowDynamic(flowPrincipal);
        }

        const instituciones = require('./instituciones.json');
        const nombreInstitucion = instituciones[cue];

        if (nombreInstitucion) {
            state.institucion = nombreInstitucion;
            state.institucionFlowCompleted = true;
            
            const mensajeBienvenida = `Bienvenido ${nombreInstitucion}`;
            await flowDynamic(mensajeBienvenida);

            await flowDynamic('Por favor, complete este formulario 📝 (https://san-juan-innova.odoo.com/helpdesk/instituciones-3) con sus datos para que podamos generar su reclamo.\n\n📩 Recuerde revisar su bandeja de correo para ver el estado de su reclamo. Si no encuentra el correo, revise en su bandeja de spam.');

            state.institucionFlowCompleted = false;

            return await flowDynamic('Muchas gracias por usar nuestro sistema de autogestión de incidentes 🛠️. Su reclamo fue derivado al área técnica.');
        } else {
            return await flowDynamic('El número de CUE ingresado no corresponde a ninguna institución registrada. Por favor, intente nuevamente.');
        }
    });

// Crear el bot y establecer los flujos
const main = async () => {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flowPrincipal, flowCliente, flowInstituciones]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb();
};

main();
