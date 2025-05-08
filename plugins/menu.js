const os = require('os');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'menu',
  description: 'Affiche le menu complet formaté avec les commandes existantes et le logo',
  async run(sock, msg, args, context) {
    const prefix = context.prefix || '.';
    const owner = context.ownerName || 'Dark-BOT';
    const botName = context.botName || '😈Dark-BOT🔐';
    const version = context.version || '1.0.0';

    const ping = Math.floor(Math.random() * 1000) + 100;

    const totalMem = os.totalmem() / 1024 / 1024;
    const freeMem = os.freemem() / 1024 / 1024;
    const usedMem = totalMem - freeMem;
    const memUsagePercent = Math.round((usedMem / totalMem) * 100);
    const memBar = '▣'.repeat(Math.floor(memUsagePercent / 20)) + '□'.repeat(5 - Math.floor(memUsagePercent / 20));

    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    let imageBuffer;
    try {
      imageBuffer = fs.readFileSync(logoPath);
    } catch (err) {
      console.warn('Logo non trouvé, envoi sans image.');
      imageBuffer = null;
    }

    const menuText = `
╔〘 *${botName}* 
║ 👑 *Owner:* ${owner}
║ 🧩 *Prefix:* [ ${prefix} ]
║ 🖥️ *Host:* ${os.type()}
║ 🧠 *Commands:* 20
║ ⚙️ *Mode:* Public
║ 🧪 *Version:* ${version}
║ ⚡ *Ping:* ${ping} ms
║ 📊 *Usage:* ${usedMem.toFixed(2)} MB of ${totalMem.toFixed(2)} MB
║ 🧬 *RAM:* [${memBar}] ${memUsagePercent}%
╚═〘 *System Status* 

⎾═╼▣ ◈ *GROUP MENU* ◈
︱➻ add
︱➻ addregles
︱➻ antibadword
︱➻ antibot
︱➻ antiaudio
︱➻ antiimage
︱➻ antilien
︱➻ antivirus
︱➻ antivideo
︱➻ close
︱➻ open
︱➻ resetlink
︱➻ regles
︱➻ tagadmin
︱➻ tagall
︱➻ tagalladmin
⎿═╼▣ 
`;

    if (imageBuffer) {
      await sock.sendMessage(msg.key.remoteJid, {
        image: imageBuffer,
        caption: menuText.trim(),
      });
    } else {
      await sock.sendMessage(msg.key.remoteJid, {
        text: menuText.trim(),
      });
    }
  },
};
