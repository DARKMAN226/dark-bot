/**
 * Configuration principale du bot 😈Dark-BOT🔐
 * 
 * ⚠️ IMPORTANT :
 * - Mets ton numéro WhatsApp au format international sans le signe + ni espaces.
 * - La SESSION_ID correspond au nom du dossier de session Baileys (généré après pairing).
 * - Le préfixe est le caractère qui précède toutes les commandes.
 * - La liste ADMINS contient les numéros autorisés (sans + ni suffixe).
 * - OWNER_NAME correspond au nom affiché du propriétaire/admin du bot.
 */

module.exports = {
    /**
     * Numéro WhatsApp du bot (format international sans + ni suffixe)
     * Exemple : '22603582906' pour +226 03 58 29 06
     */
    BOT_NUMBER: '22677583530',
  
    /**
     * Liste des numéros WhatsApp supplémentaires (format international sans + ni suffixe)
     * Exemple : ['22603582906', '22612345678']
     */
    PHONE_NUMBERS: [
      '2260705607226',
      '2260507646665',
    ],
  
    /**
     * Nom du dossier où Baileys sauvegarde la session (dans ./session/)
     * Exemple : 'session' ou 'darkbot-session'
     * Ce dossier est créé automatiquement après le pairing initial.
     */
    SESSION_ID: 'session',
  
    /**
     * Préfixe utilisé pour toutes les commandes du bot.
     * Exemple : '!' ou '.' ou '/'
     */
    PREFIX: '!',
  
    /**
     * Liste des numéros WhatsApp des administrateurs autorisés
     * Format : tableau de chaînes, numéros sans + ni suffixe.
     */
    ADMINS: [
      '22603582906', // Ton numéro ou celui des admins
    ],
  
    /**
     * Nom affiché du bot dans les messages système ou menus.
     */
    BOT_NAME: '😈Dark-BOT🔐',

    /**
     * Nom du propriétaire/admin du bot (affiché dans les messages, menus, etc.)
     */
    OWNER_NAME: 'TonNom',  // <-- Mets ici ton prénom ou pseudo
  
    /**
     * Version du bot (utile pour le suivi des mises à jour).
     */
    VERSION: '1.0.0',
  
    /**
     * Mode debug : true pour afficher des logs détaillés, false pour mode production.
     */
    DEBUG: false,
  
    /**
     * Chemins des dossiers importants (relatifs à la racine du projet)
     */
    PATHS: {
      PLUGINS: './plugins',
      SESSION: './session',
      DATA: './data',
      ASSETS: './assets',
    },

    /**
     * Historique des mises à jour du bot
     * Utilisé pour garder une trace des modifications et ajouts.
     */
    CHANGELOG: [
      {
        version: '1.0.0',
        date: '2025-05-01',
        changes: [
          'Initialisation du bot avec les fonctionnalités de base.',
          'Ajout de la gestion des sessions.',
          'Mise en place du système de logs.',
        ],
      },
      
    ],
};
