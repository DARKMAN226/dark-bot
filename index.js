const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { Boom } = require('@hapi/boom');
const config = require('./config');



// ==== Paramètres globaux===

const PREFIX = config.PREFIX || '!';
const ADMINS = config.ADMINS || [];
const BOT_NAME = config.BOT_NAME || 'Dark-BOT';
const VERSION = config.VERSION || '1.0.0';

function formatNumber(number) {
  return number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
}
const adminFullNumbers = ADMINS.map(formatNumber);



//=== Dossiers sessions/plugins====
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
    // On tolère handler OU run comme entrée principale
    if ((plugin.command || plugin.name) && (typeof plugin.handler === 'function' || typeof plugin.run === 'function')) {
      const cmd = plugin.command || plugin.name;
      plugins[cmd] = plugin;
      console.log(`[PLUGIN] Chargé: ${cmd} (${file})`);
    }
  });


// === DEBUT BOT ===
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

  let reconnectAttempts = 0;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const err = new Boom(lastDisconnect?.error);
      const statusCode = err.output?.statusCode;
      console.log(`Session pour ${phoneNumber} fermée, code: ${statusCode}, raison: ${err.message}`);
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect && reconnectAttempts < 5) {
        reconnectAttempts++;
        console.log(`Reconnexion pour ${phoneNumber} dans 5 secondes... (Tentative ${reconnectAttempts}/5)`);
        await new Promise((res) => setTimeout(res, 5000));
        startSession(phoneNumber);
      } else if (reconnectAttempts >= 5) {
        console.log(`Échec de reconnexion pour ${phoneNumber} après 5 tentatives. Arrêt.`);
      } else {
        console.log(`Session pour ${phoneNumber} déconnectée volontairement.`);
      }
    } else if (connection === 'open') {
      reconnectAttempts = 0;
      console.log(`Session pour ${phoneNumber} connectée à WhatsApp.`);
    }
  });

  //===Fournit le contexte du bot à tous les plugins=== :
  
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
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;
    if (!text.startsWith(PREFIX)) return;

    const [command, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = command.toLowerCase();

    console.log(`Session ${phoneNumber} - Commande reçue: ${cmd} - Arguments: ${args.join(' ')}`);


    
    
    // ===Gestion plugins, supporte handler OU run===
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
        await sock.sendMessage(msg.key.remoteJid, { text: "Erreur lors de l'execution du plugin." });
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
  const phoneNumbers = config.PHONE_NUMBERS || ['+2250705607226', '+2250507646665'];
  for (const phoneNumber of phoneNumbers) {
    startSession(phoneNumber).catch((err) =>
      console.error(`Erreur au démarrage de la session pour ${phoneNumber}:`, err)
    );
  }
}

startBot().catch((err) => console.error('Erreur au démarrage du bot:', err));

// === BONUS: Export des plugins pour usage externe ===
module.exports = plugins;
