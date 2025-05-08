// plugins/tagall.js
module.exports = {
    name: 'tagall',
    description: 'Mentionne tous les membres du groupe',
    async run(sock, msg) {
      try {
        const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
        const participants = groupMetadata.participants;
  
        const mentions = participants.map(p => p.id);
        const text = `📢 Mention de tous les membres :\n`;
  
        await sock.sendMessage(msg.key.remoteJid, { text, mentions });
      } catch (error) {
        console.error('Erreur tagall:', error);
        await sock.sendMessage(msg.key.remoteJid, { text: '❌ Impossible de mentionner tous les membres.' });
      }
    },
  };
  