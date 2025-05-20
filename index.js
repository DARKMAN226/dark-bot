// index.js - Dark-BOT 

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import { File } from 'megajs';
import { 
  makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';

// === CONFIGURATION ===
const config = {
  PREFIX: process.env.PREFIX || '!',
  ADMINS: [ (process.env.ADMIN || '1234567890') + '@s.whatsapp.net' ],
  BOT_NAME: process.env.BOT_NAME || 'Dark-BOT',
  VERSION: '2.0.0',
  SESSION_ID: process.env.SESSION_ID,
  DEBUG: process.env.DEBUG === 'true'
};

const logger = pino({ level: config.DEBUG ? 'debug' : 'info' });

// === DOSSIERS SESSIONS & PLUGINS ===
const __dirname = path.resolve();
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

const credsPath = path.join(SESSIONS_DIR, 'creds.json');

const PLUGINS_DIR = path.join(__dirname, 'plugins');
if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR);



// === GESTION SESSION DARK-BOT (MEGA) ===
async function downloadSessionData() {
  if (!config.SESSION_ID) {
    logger.error('❌ SESSION_ID manquant dans .env');
    return false;
  }
  const sessdata = config.SESSION_ID.split("cloud-ai~")[1] || config.SESSION_ID.split("DARK-BOT~")[1];
  if (!sessdata || !sessdata.includes("#")) {
    logger.error('❌ Format SESSION_ID invalide, attendu: dark-bot~ID#KEY');
    return false;
  }
  const [fileID, decryptKey] = sessdata.split("#");
  try {
    logger.info("🔄 Téléchargement de la session MEGA...");
    const file = File.fromURL(`https://mega.nz/file/${fileID}#${decryptKey}`);
    const data = await new Promise((resolve, reject) => {
      file.download((err, data) => err ? reject(err) : resolve(data));
    });
    await fs.promises.writeFile(credsPath, data);
    logger.info("🔒 Session cloud chargée !");
    return true;
  } catch (error) {
    logger.error('❌ Echec téléchargement session:', error);
    return false;
  }
}

// === CHARGEMENT DYNAMIQUE DES PLUGINS ===
let plugins = {};
function loadPlugins() {
  plugins = {};
  if (!fs.existsSync(PLUGINS_DIR)) return;
  for (const file of fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'))) {
    try {
      delete require.cache[require.resolve(path.join(PLUGINS_DIR, file))];
      const plugin = require(path.join(PLUGINS_DIR, file));
      const cmd = plugin.command || plugin.name;
      if (cmd && typeof plugin.handler === 'function') {
        plugins[cmd.toLowerCase()] = plugin;
        logger.info(`[PLUGIN] Chargé: ${cmd} (${file})`);
      } else {
        logger.warn(`[PLUGIN] Ignoré (pas de handler): ${file}`);
      }
    } catch (e) {
      logger.error(`[PLUGIN] Erreur chargement ${file}:`, e);
    }
  }
}
loadPlugins();

// === DÉMARRAGE DU BOT ===
async function startBot() {
  // Gestion de la session cloud
  if (!fs.existsSync(credsPath)) {
    const ok = await downloadSessionData();
    if (!ok) {
      logger.warn("Pas de session cloud. QR code requis !");
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: !fs.existsSync(credsPath),
    browser: [config.BOT_NAME, "Chrome", "1.0"],
    auth: state,
    getMessage: async (key) => ({ conversation: "Bot WhatsApp" })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') {
      logger.info(`✅ Connecté ! ${config.BOT_NAME} prêt.`);
      await sock.sendMessage(sock.user.id, { text: `🤖 *${config.BOT_NAME}*\nTape ${config.PREFIX}menu pour la liste.` });
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        logger.warn("Reconnexion automatique...");
        startBot();
      }
    }
  });

  // === Gestion commandes/messages ===
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text || !text.startsWith(config.PREFIX)) return;

    const [command, ...args] = text.slice(config.PREFIX.length).trim().split(/\s+/);
    const cmd = command.toLowerCase();
    logger.info(`Commande reçue: ${cmd}`);

    // Commande menu intégrée
    if (cmd === "menu") {
      let reply = `🤖 *${config.BOT_NAME}* - v${config.VERSION}\n*Commandes :*\n`;
      for (const k in plugins) {
        const p = plugins[k];
        if (!p.adminOnly || config.ADMINS.includes(msg.key.participant || msg.key.remoteJid))
          reply += `- *${config.PREFIX}${p.command || k}* : ${p.description || ''}\n`;
      }
      return await sock.sendMessage(msg.key.remoteJid, { text: reply });
    }

    // Plugins dynamiques
    if (plugins[cmd]) {
      try {
        await plugins[cmd].handler(sock, msg, args, config);
      } catch (e) {
        logger.error(`[PLUGIN][${cmd}]`, e);
        await sock.sendMessage(msg.key.remoteJid, { text: "❗ Erreur plugin." });
      }
    } else {
      await sock.sendMessage(msg.key.remoteJid, { text: `❓ Commande inconnue: *${cmd}*` });
    }
  });
}

startBot().catch(e => logger.error("Erreur bot:", e));

export { plugins }; 
