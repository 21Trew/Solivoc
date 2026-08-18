import nodemailer from "nodemailer";

const POSTBOX_HOST = "postbox.cloud.yandex.net";
const POSTBOX_PORT = 587;
let transporter = null;

function postboxConfig() {
  return {
    user: String(process.env.POSTBOX_SMTP_USER || "").trim(),
    password: String(process.env.POSTBOX_SMTP_PASSWORD || ""),
    fromEmail: String(process.env.POSTBOX_FROM_EMAIL || "").trim().toLowerCase(),
  };
}

function smtpTransport() {
  if (transporter) return transporter;
  const { user, password } = postboxConfig();
  if (!user || !password) throw new Error("POSTBOX_NOT_CONFIGURED");
  transporter = nodemailer.createTransport({
    host: POSTBOX_HOST,
    port: POSTBOX_PORT,
    secure: false,
    requireTLS: true,
    auth: { user, pass: password },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 12000,
    tls: { minVersion: "TLSv1.2", servername: POSTBOX_HOST },
  });
  return transporter;
}

export function postboxReady() {
  const { user, password, fromEmail } = postboxConfig();
  return !!(user && password && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(fromEmail));
}

function normalizeCode(code) {
  const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);
  if (cleanCode.length !== 6) throw new Error("INVALID_VERIFICATION_CODE");
  return cleanCode;
}

function authEmailContent(kind, code) {
  if (kind === "recovery") {
    return {
      subject: "Код восстановления доступа Solivoc",
      heading: "Сброс пароля",
      intro: "Введи этот код в игре, чтобы задать новый пароль. Он действует 10 минут.",
      textIntro: "Используй этот код, чтобы сбросить пароль в Solivoc.",
      footer: "Если ты не запрашивал восстановление доступа, просто проигнорируй письмо. Пароль не изменится.",
    };
  }
  return {
    subject: "Код подтверждения Solivoc",
    heading: "Подтверди регистрацию",
    intro: "Введи этот код в игре. Он действует 10 минут.",
    textIntro: "Подтверди регистрацию в Solivoc.",
    footer: "Никому не сообщай код. Если ты не регистрировался в Solivoc, письмо можно проигнорировать.",
  };
}

async function sendAuthCode(to, code, kind) {
  const { fromEmail } = postboxConfig();
  if (!postboxReady()) throw new Error("POSTBOX_NOT_CONFIGURED");
  const cleanCode = normalizeCode(code);
  const content = authEmailContent(kind, cleanCode);

  await smtpTransport().sendMail({
    from: { name: "Solivoc", address: fromEmail },
    to,
    subject: content.subject,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
    text: [
      content.textIntro,
      "",
      `Код: ${cleanCode}`,
      "",
      "Код действует 10 минут. Никому его не сообщай.",
      content.footer,
      "",
      "На это письмо отвечать не нужно.",
    ].join("\n"),
    html: `<!doctype html><html lang="ru"><body style="margin:0;padding:32px 16px;background:#f6f5fb;font-family:Arial,sans-serif;color:#27233d"><div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e7e4f0;border-radius:20px;padding:28px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#7169a7">SOLIVOC</div><h1 style="margin:10px 0 8px;font-size:24px">${content.heading}</h1><p style="margin:0 0 22px;color:#6f6a7e;line-height:1.5">${content.intro}</p><div style="padding:18px;border-radius:16px;background:#f1efff;text-align:center;font-size:32px;font-weight:800;letter-spacing:.22em;color:#51489d">${cleanCode}</div><p style="margin:22px 0 0;color:#8b8795;font-size:13px;line-height:1.5">${content.footer}</p><p style="margin:10px 0 0;color:#aaa6b5;font-size:12px;line-height:1.5">На это письмо отвечать не нужно.</p></div></body></html>`,
  });
}

export function sendRegistrationCode(to, code) {
  return sendAuthCode(to, code, "registration");
}

export function sendPasswordResetCode(to, code) {
  return sendAuthCode(to, code, "recovery");
}
