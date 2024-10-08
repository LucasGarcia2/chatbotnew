const { createBot, createProvider, addKeyword, addAnswer, createFlow } = require('@bot-whatsapp/bot');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const QRPortalWeb = require('@bot-whatsapp/portal');
const MockAdapter = require('@bot-whatsapp/database/mock');
const nodemailer = require('nodemailer');
const axios = require('axios');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
require('dotenv').config();

// Configuración base de datos
const adapter = new FileSync('database.json');
const db = low(adapter);
db.defaults({ tickets: 100 }).write();

// Configurar correo electrónico
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Función para enviar correo electrónico
const enviarCorreo = async (asunto, mensaje) => {
    const destinatarios = ['mauricio.aubone@sanjuaninnovase.com.ar'];
    const remitente = process.env.GMAIL_USER;

    const mailOptions = {
        from: remitente,
        to: destinatarios,
        subject: asunto,
        text: mensaje
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Correo electrónico enviado exitosamente');
    } catch (error) {
        console.error('Error al enviar el correo electrónico:', error);
    }
};

// Función para enviar mensaje a Telegram
const enviarMensajeTelegram = async (mensaje) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: chatId,
            text: mensaje
        });
        console.log('Mensaje enviado a Telegram exitosamente');
    } catch (error) {
        console.error('Error al enviar el mensaje a Telegram:', error);
    }
};

const flowAsistencia = addKeyword(['1'])  // Captura la opción 1
    .addAnswer('Ha seleccionado "Solicitar asistencia técnica". A continuación le pediremos los datos.', { delay: 1000 })
    .addAnswer('Por favor, ingrese sus datos separados por comas: Nombre, Teléfono, Institución, Dirección, Descripción del problema.', 
    { capture: true }, async (ctx, { flowDynamic }) => {
        const userData = ctx.body.trim();
        const ticketNumber = db.get('tickets').value();
        db.set('tickets', ticketNumber + 1).write();

        // Enviar mensaje a Telegram
        const telegramMessage = `
Nueva solicitud de asistencia técnica:
Ticket: #${ticketNumber}
Datos: ${userData}
        `;
        await enviarMensajeTelegram(telegramMessage);

        // Finaliza el flujo de asistencia y regresa al flujo principal
        await flowDynamic([
            `Su reclamo ha sido registrado con el ticket #${ticketNumber}. Nos pondremos en contacto en breve.`,
            'Regresando al menú principal...'
        ]);

        return await flowDynamic(flowPrincipal);  // Regresa al flujo principal
    });

    const flowNuevaConexion = addKeyword(['2'])  // Captura la opción 2
    .addAnswer('Ha seleccionado "Solicitar nueva conexión de servicio". A continuación le pediremos los datos.', { delay: 1000 })
    .addAnswer('Ingrese los siguientes datos separados por comas: Nombre y Apellido, Teléfono de contacto, Nombre de la institución, Dirección, Correo electrónico.', 
    { capture: true }, async (ctx, { flowDynamic }) => {
        const userData = ctx.body.trim();

        const mailSubject = 'Solicitud de nueva conexión de servicio';
        const mailMessage = `Nueva solicitud de conexión de servicio:\n\nDatos: ${userData}`;

        await enviarCorreo(mailSubject, mailMessage);

        // Finaliza el flujo de nueva conexión y regresa al flujo principal
        await flowDynamic([
            'Su solicitud de nueva conexión de servicio ha sido registrada. Nos pondremos en contacto en breve.',
            'Regresando al menú principal...'
        ]);

        return await flowDynamic(flowPrincipal);  // Regresa al flujo principal
    });

    const flowPrincipal = addKeyword(['hola', 'ole', 'alo','ola', 'ol', 'o', 'l', 'a', 'b', 'bu', 'buenas','buena', 'bue', 'wenas', 'saludos', '0', 'volver'])
    .addAnswer('¡👋 Hola soy Avi! El asistente virtual de San Juan Innova S.E.', {delay: 750})
    .addAnswer('Por favor ingrese el número de la opción que desea:', {delay: 750})
    .addAnswer('1) 🛠️ Solicitar asistencia técnica\n' +
        '2) 💼 Solicitar nueva conexión de servicio', 
        { capture: true }
    );

// Crear el bot y establecer los flujos
const main = async () => {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flowPrincipal, flowNuevaConexion, flowAsistencia]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb();
};

main();
