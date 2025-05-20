module.exports = {
  command: "ping",
  description: "Renvoie pong et le temps de réponse",
  handler: async (sock, msg, args, config) => {
    const start = Date.now();
    await sock.sendMessage(msg.key.remoteJid, { text: "🏓 Pong !" });
    const end = Date.now();
    await sock.sendMessage(msg.key.remoteJid, { text: `Réponse en ${end - start}ms` });
  }
};

