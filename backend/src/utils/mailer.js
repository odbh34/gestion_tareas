const nodemailer = require('nodemailer');
const env = require('../config/env');

// En pruebas se usa una bandeja en memoria para no depender de SMTP ni de
// archivos. En desarrollo local se espera Mailpit; en producción, si no hay
// SMTP configurado, el restablecimiento queda inoperante pero el endpoint
// responde igual.
const outbox = [];
let warnedAboutMissingSmtp = false;

let transporter = null;

if (env.isTest) {
  transporter = {
    sendMail: async (message) => {
      outbox.push(message);
      return { messageId: 'in-memory' };
    },
  };
} else if (env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
}

async function sendPasswordResetEmail({ to, token }) {
  if (!transporter) {
    if (!warnedAboutMissingSmtp) {
      warnedAboutMissingSmtp = true;
      // Nunca se registra el token ni el enlace completo.
      console.warn(
        'SMTP no configurado: no se envió el correo de restablecimiento.',
      );
    }
    return;
  }

  // El token viaja en el fragmento (#) para que no llegue en la URL al
  // servidor ni a los logs de proxies y CDNs.
  const resetUrl = `${env.FRONTEND_URL}/restablecer#token=${token}`;

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: 'Restablece tu contraseña de SportReserve Tasks',
    text: [
      'Recibimos una solicitud para restablecer tu contraseña.',
      `Abre este enlace: ${resetUrl}`,
      `El enlace caduca en ${env.RESET_TOKEN_TTL_MINUTES} minutos y solo se puede usar una vez.`,
      'Si no solicitaste el cambio, ignora este mensaje.',
    ].join('\n'),
    html: [
      '<p>Recibimos una solicitud para restablecer tu contraseña.</p>',
      `<p><a href="${resetUrl}">Restablecer contraseña</a></p>`,
      `<p>El enlace caduca en ${env.RESET_TOKEN_TTL_MINUTES} minutos y solo se puede usar una vez.</p>`,
      '<p>Si no solicitaste el cambio, ignora este mensaje.</p>',
    ].join(''),
  });
}

function clearOutbox() {
  outbox.length = 0;
}

module.exports = {
  sendPasswordResetEmail,
  outbox,
  clearOutbox,
};
