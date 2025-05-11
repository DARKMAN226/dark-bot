// index.js - Bot WhatsApp avec baileys v5+ - Dark-BOT sans problème

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('baileys');



// === LES CONFIGURATIONS ===
const config = {
  PREFIX: '!',
  ADMINS: ['1234567890@s.whatsapp.net'],
  BOT_NAME: 'Dark-BOT',
  VERSION: '1.0.0',
  DEBUG: true,
  PHONE_NUMBERS: [],
};



// === CONSTANTES & UTILITAIRES ===
const PREFIX = config.PREFIX;
const ADMINS = config.ADMINS;
const BOT_NAME = config.BOT_NAME;
const VERSION = config.VERSION;

const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

const PLUGINS_DIR = path.join(__dirname, 'plugins');
if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR);

const logger = pino({ level: config.DEBUG ? 'debug' : 'info' });

function formatNumber(number) {
  return number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
}

const adminFullNumbers = ADMINS.map(formatNumber);



// === CHARGEMENT DYNAMIQUE DES PLUGINS ===
let plugins = {};

function loadPlugins() {
  plugins = {}; 
  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(PLUGINS_DIR, file))];
      const plugin = require(path.join(PLUGINS_DIR, file));
      const cmd = plugin.command || plugin.name;
      if (cmd && (typeof plugin.handler === 'function' || typeof plugin.run === 'function')) {
        plugins[cmd.toLowerCase()] = plugin;
        logger.info(`[PLUGIN] Chargé: ${cmd} (${file})`);
      } else {
        logger.warn(`[PLUGIN] Ignoré (pas de handler/run) : ${file}`);
      }
    } catch (e) {
      logger.error(`[PLUGIN] Erreur chargement ${file}:`, e);
    }
  }
}
loadPlugins();



// === SAISIE INTERACTIVE DES NUMÉROS ===
async function askPhoneNumbers() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  let numbers = [];
  while (true) {
    const answer = await question("Entrez un numéro WhatsApp (format international, ex: 225xxxxxxxxx), ou vide pour finir : ");
    if (!answer.trim()) break;
    numbers.push(formatNumber(answer.trim()));
  }
  rl.close();
  return numbers;
}



// === FONCTION DE DÉMARRAGE D'UNE SESSION AVEC RECONNEXION PROPRE ===
async function startSession(phoneNumber) {
  logger.info(`Démarrage session pour: ${phoneNumber}`);

  const cleanedNumber = phoneNumber.replace(/[^0-9+]/g, '');
  const sessionId = crypto.createHash('sha256').update(cleanedNumber).digest('hex');
  const sessionPath = path.join(SESSIONS_DIR, sessionId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  let reconnectAttempts = 0;
  let sock;

  async function connect() {
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: config.DEBUG ? 'debug' : 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info(`QR code généré pour ${phoneNumber}, scanne-le avec WhatsApp :`);
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const err = new Boom(lastDisconnect?.error);
        const statusCode = err.output?.statusCode;
        logger.warn(`Session ${phoneNumber} fermée. Code: ${statusCode}, raison: ${err.message}`);

        if (statusCode === DisconnectReason.loggedOut) {
          logger.error(`Session ${phoneNumber} déconnectée (logout). Supprime le dossier ${sessionPath} pour reconnecter.`);
          return;
        }

        if (reconnectAttempts < 5) {
          reconnectAttempts++;
          logger.info(`Reconnexion ${phoneNumber} dans 5s (tentative ${reconnectAttempts}/5)`);
          await new Promise(res => setTimeout(res, 5000));
          await connect(); 
        } else {
          logger.error(`Échec reconnexion ${phoneNumber} après ${reconnectAttempts} tentatives.`);
        }
      } else if (connection === 'open') {
        reconnectAttempts = 0;
        logger.info(`Session ${phoneNumber} connectée à WhatsApp.`);
      }
    });

    // Gestion des messages entrants
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      const msg = messages[0];
      if (!msg.message || msg.key.fromMe) return;

      logger.info(`Message reçu de ${msg.key.remoteJid}`);

      const text = (msg.message.conversation) || (msg.message.extendedTextMessage?.text);
      if (!text) return;
      if (!text.startsWith(PREFIX)) return;

      const [command, ...args] = text.slice(PREFIX.length).trim().split(/\s+/);
      const cmd = command.toLowerCase();

      logger.info(`Session ${phoneNumber} - Commande reçue: ${cmd} - Args: ${args.join(' ')}`);

      if (!plugins[cmd]) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: `❓ Commande inconnue: *${cmd}*\nTape ${PREFIX}menu pour la liste.`,
        });
        return;
      }

      if (plugins[cmd].adminOnly && !adminFullNumbers.includes(msg.key.participant || msg.key.remoteJid)) {
        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Tu n'as pas la permission d'utiliser cette commande.` });
        logger.warn(`Utilisateur non admin tenté la commande admin ${cmd}`);
        return;
      }

      try {
        if (typeof plugins[cmd].handler === 'function') {
          await plugins[cmd].handler(sock, msg, args, { prefix: PREFIX, ownerNumbers: adminFullNumbers, botName: BOT_NAME, version: VERSION, phoneNumber, logger });
        } else if (typeof plugins[cmd].run === 'function') {
          await plugins[cmd].run(sock, msg, args, { prefix: PREFIX, ownerNumbers: adminFullNumbers, botName: BOT_NAME, version: VERSION, phoneNumber, logger });
        } else {
          await sock.sendMessage(msg.key.remoteJid, { text: "Plugin sans fonction handler/run." });
        }
      } catch (e) {
        logger.error(`[PLUGIN][${cmd}] Erreur:`, e);
        await sock.sendMessage(msg.key.remoteJid, { text: "❗ Erreur durant l'exécution de la commande." });
      }
    });
  }

  await connect();

  return sock;
}



// === COMMANDE MENU  ===
plugins['menu'] = {
  command: 'menu',
  description: 'Affiche la liste des commandes disponibles',
  handler: async (sock, msg, args, ctx) => {
    let text = `🤖 *${ctx.botName}* - Version ${ctx.version}\n\n*Commandes disponibles :*\n`;
    for (const key of Object.keys(plugins)) {
      if (plugins[key].description && (!plugins[key].adminOnly || ctx.ownerNumbers.includes(msg.key.participant || msg.key.remoteJid))) {
        text += `- *${ctx.prefix}${key}* : ${plugins[key].description}\n`;
      }
    }
    await sock.sendMessage(msg.key.remoteJid, { text });
  }
};



// === FONCTION PRINCIPALE ===
async function startBot() {
  logger.info(`Démarrage de ${BOT_NAME}...`);

  let phoneNumbers = config.PHONE_NUMBERS;
  if (!phoneNumbers || phoneNumbers.length === 0) {
    phoneNumbers = await askPhoneNumbers();
    if (!phoneNumbers.length) {
      logger.error("Aucun numéro saisi. Arrêt du bot.");
      process.exit(1);
    }
  }

  // On démarre toutes les sessions en série (pour éviter conflits)
  for (const phone of phoneNumbers) {
    try {
      await startSession(formatNumber(phone));
    } catch (e) {
      logger.error(`Erreur démarrage session ${phone}:`, e);
    }
  }
}



// Lancement
startBot().catch(err => logger.error("Erreur au démarrage du bot:", err));



// === EXPORT Plugins pour usage externe ===
module.exports = plugins;
