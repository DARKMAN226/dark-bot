const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, useSingleFileAuthState } = require('baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');
const config = require('./config');

// ==== Paramètres globaux ====
const PREFIX = config.PREFIX || '!';
const ADMINS = config.ADMINS || [];
const BOT_NAME = config.BOT_NAME || 'Dark-BOT';
const VERSION = config.VERSION || '1.0.0';

// Formatage du numéro
function formatNumber(number) {
  return number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
}
const adminFullNumbers = ADMINS.map(formatNumber);

// === Dossiers sessions/plugins ====
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

const PLUGINS_DIR = path.join(__dirname, 'plugins');
if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR);

// === CHARGEMENT DES PLUGINS ===
const plugins = {};

fs.readdirSync(PLUGINS_DIR)
  .filter((file) => file.endsWith('.js'))
  .forEach((file) => {
    const plugin = require(path.join(PLUGINS_DIR, file));
    if ((plugin.command || plugin.name) && (typeof plugin.handler === 'function' || typeof plugin.run === 'function')) {
      const cmd = plugin.command || plugin.name;
      plugins[cmd] = plugin;
      console.log(`[PLUGIN] THOMAS TECH Chargé: ${cmd} (${file})`);
    }
  });

// === DÉBUT BOT ===
async function startSession(phoneNumber) {
  console.log(`Démarrage de la session pour le numéro : ${phoneNumber}...`);
  const cleanedNumber = phoneNumber.replace(/[^0-9+]/g, '');
  // Hash SHA-256 du numéro pour anonymiser le dossier de session
  const sessionId = crypto.createHash('sha256').update(cleanedNumber).digest('hex');
  console.log(`Session ID (SHA-256): ${sessionId}`);
  const sessionPath = path.join(SESSIONS_DIR, sessionId);

  const { state, saveCreds } = await useSingleFileAuthState(path.join(sessionPath, 'auth_info.json'));

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: config.DEBUG ? 'debug' : 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  let reconnectAttempts = 0;

  // QR code en ASCII dans le terminal
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Scanne ce QR code avec WhatsApp pour connecter le bot :");
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const err = new Boom(lastDisconnect?.error);
      const statusCode = err.output?.statusCode;
      console.log(`Session pour ${phoneNumber} fermée, code: ${statusCode}, raison: ${err.message}`);
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect && reconnectAttempts < 5) {
        reconnectAttempts++;
        console.log(`Reconnexion pour ${phoneNumber} dans 5 secondes... (Tentative ${reconnectAttempts}/5)`);
        setTimeout(() => startSession(phoneNumber), 5000);
      } else {
        console.log(`Échec de reconnexion pour ${phoneNumber} après ${reconnectAttempts} tentatives.`);
      }
    } else if (connection === 'open') {
      reconnectAttempts = 0;
      console.log(`Session pour ${phoneNumber} connectée à WhatsApp.`);
    }
  });

  // === Fournit le contexte du bot à tous les plugins ===
  const context = {
    prefix: PREFIX,
    ownerNumbers: adminFullNumbers,
    botName: BOT_NAME,
    version: VERSION,
    phoneNumber,
  };

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text || !text.startsWith(PREFIX)) return;

    const [command, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = command.toLowerCase();

    console.log(`Session ${phoneNumber} - Commande reçue: ${cmd} - Arguments: ${args.join(' ')}`);

    // === Gestion des plugins ===
    if (plugins[cmd]) {
      try {
        if (typeof plugins[cmd].handler === 'function') {
          await plugins[cmd].handler(sock, msg, args, context);
        } else if (typeof plugins[cmd].run === 'function') {
          await plugins[cmd].run(sock, msg, args, context);
        } else {
          await sock.sendMessage(msg.key.remoteJid, { text: "Plugin sans handler ni run !" });
        }
      } catch (e) {
        await sock.sendMessage(msg.key.remoteJid, { text: "Erreur lors de l'exécution du plugin." });
        console.error(`[PLUGIN][${cmd}]`, e);
      }
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❓ Commande inconnue: *${cmd}*.\nTape ${PREFIX}menu pour la liste des commandes.`,
      });
    }
  });
}

async function startBot() {
  console.log(`Démarrage du bot ${BOT_NAME}...`);
  const phoneNumber = config.PHONE_NUMBER;
  if (!phoneNumber) {
    console.error("Aucun numéro configuré. Arrêt.");
    process.exit(1);
  }

  startSession(phoneNumber).catch((err) =>
    console.error(`Erreur au démarrage de la session pour ${phoneNumber}:`, err)
  );
}

// ==== CHANGELOG ====
const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2025-05-01',
    changes: [
      'Initialisation du bot avec les fonctionnalités de base.',
      'Ajout de la gestion des sessions.',
      'Mise en place du système de logs.',
      'Affichage du QR code en ASCII avec qrcode-terminal.',
      'Hashage SHA-256 du numéro pour anonymiser les dossiers de session.',
      'Utilisation de useSingleFileAuthState pour stocker les informations d\'authentification dans un seul fichier.',
    ],
  },
];

startBot().catch((err) => console.error('Erreur au démarrage du bot:', err));

// === BONUS: Export des plugins pour usage externe ===
module.exports = plugins;
