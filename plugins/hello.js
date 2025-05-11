module.exports = {
  command: 'hello',
  description: 'Réponds avec un message de salutation',
  handler: async (sock, msg, args) => {
    await sock.sendMessage(msg.key.remoteJid, { text: 'Salut! Je suis ton bot Dark-BOT.' });
  }
};
