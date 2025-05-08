const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Boom } = require('@hapi/boom');
const config = require('./config');

const PREFIX = config.PREFIX || '!';
const ADMINS = config.ADMINS || [];

// Fonction pour formater un numéro WhatsApp
function formatNumber(number) {
  return number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
}

const adminFullNumbers = ADMINS.map(formatNumber);

// Dossier pour stocker les sessions
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);


async function startSession(phoneNumber) {
  console.log(`Démarrage de la session pour le numéro : ${phoneNumber}...`);

  
  const cleanedNumber = phoneNumber.replace(/[^0-9+]/g, '');
  const sessionPath = path.join(SESSIONS_DIR, cleanedNumber);

  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: config.DEBUG ? 'debug' : 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const err = new Boom(lastDisconnect?.error);
      const statusCode = err.output?.statusCode;
      console.log(`Session pour ${phoneNumber} fermée, code: ${statusCode}, raison: ${err.message}`);

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log(`Reconnexion pour ${phoneNumber} dans 5 secondes...`);
        await new Promise((res) => setTimeout(res, 5000));
        startSession(phoneNumber);
      } else {
        console.log(`Session pour ${phoneNumber} déconnectée volontairement.`);
      }
    } else if (connection === 'open') {
      console.log(`Session pour ${phoneNumber} connectée à WhatsApp.`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    if (!text.startsWith(PREFIX)) return;

    const [command, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = command.toLowerCase();

    console.log(`Session ${phoneNumber} - Commande reçue: ${cmd} - Arguments: ${args.join(' ')}`);

    
    // Exemple simple : répondre au message
    if (cmd === 'ping') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Pong 🏓' });
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❓ Commande inconnue: *${cmd}*.\nTape ${PREFIX}menu pour la liste des commandes.`,
      });
    }
  });
}

async function startBot() {
  console.log(`Démarrage du bot ${config.BOT_NAME || 'Dark-BOT'}...`);

  const phoneNumbers = ['+2250705607226', '+2250507646665'];

  for (const phoneNumber of phoneNumbers) {
    startSession(phoneNumber).catch((err) =>
      console.error(`Erreur au démarrage de la session pour ${phoneNumber}:`, err)
    );
  }
}

startBot().catch((err) => console.error('Erreur au démarrage du bot:', err));
