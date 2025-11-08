const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const mcData = require('minecraft-data');
const express = require('express');
const config = require('./settings.json');

const app = express();
app.get('/', (req, res) => res.send('Bot has arrived'));
app.listen(8000, () => console.log('Server started'));

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account'].username,
    password: config['bot-account'].password,
    auth: config['bot-account'].type,
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version
  });

  // ✅ Patch لـ mineflayer-pathfinder لإصلاح blocksByName في 1.20.5+ / 1.21
const movementsModule = require('mineflayer-pathfinder/lib/movements');

movementsModule.prototype._initCantBreak = function () {
  // ✅ تخطي blocksCantBreak بالكامل لمنع الكراش
  this.blocksCantBreak = new Set();
  return;
};

  bot.loadPlugin(pathfinder);
const mcDataBot = mcData(bot.version);

// ✅ إصلاح مشكلة blocksByName في mineflayer-pathfinder
let defaultMove;
try {
  defaultMove = new Movements(bot, mcDataBot);
} catch (e) {
  console.log("⚠️ Patch applied: using safe movements");
  defaultMove = new Movements(bot, null);
}

  const tpaRequests = {};
  const cooldowns = {};

  // ======= حالة النوم التلقائي =======
  let autoSleepEnabled = false;

  // ======= تسجيل الدخول =======
  function sendRegister(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/register ${password} ${password}`);
      bot.once('chat', (username, message) => {
        if (message.includes('successfully registered') || message.includes('already registered')) resolve();
        else reject(`Registration failed: ${message}`);
      });
    });
  }

  function sendLogin(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/login ${password}`);
      bot.once('chat', (username, message) => {
        if (message.includes('successfully logged in')) resolve();
        else reject(`Login failed: ${message}`);
      });
    });
  }

  bot.once('spawn', () => {
    console.log('[AfkBot] Bot joined the server');

    // ===== Auto Auth =====
    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      sendRegister(password).then(() => sendLogin(password)).catch(console.error);
    }

    // ===== Chat Messages =====
    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      if (config.utils['chat-messages'].repeat) {
        let i = 0;
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, config.utils['chat-messages']['repeat-delay'] * 1000);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

    // ===== Position =====
    if (config.position.enabled) {
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
    }

    // Anti-AFK
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
    }
  });

  // ====== Chat Commands ======
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const args = message.trim().split(' ');
    const now = Date.now();
    const cooldown = cooldowns[username];

    // ===== أمر TPA إلى لاعب آخر =====
    if (args[0].toLowerCase() === '!tpa' && args[1]) {
      const target = args[1];
      if (cooldown && now - cooldown < 300000) {
        const remaining = Math.ceil((300000 - (now - cooldown)) / 60000);
        return bot.chat(`/tell ${username} ⌛ انتظر ${remaining}`);
      }

      tpaRequests[target] = { from: username, time: now };
      cooldowns[username] = now;
      bot.chat(`/tell ${username} 📨 ${target} تم ارسال طلبك ل`);
      bot.chat(`/tell ${target} 📨 ${username} يريد الانتقال إليك!`);
      bot.chat(`/tell ${target}  اكتب :`);
      bot.chat(`/tell ${target} !ac ${username} ل قبول طلبه`);
      bot.chat(`/tell ${target} او`);
      bot.chat(`/tell ${target} !dn ${username} ل رفض طلبه`);

      setTimeout(() => {
        if (tpaRequests[target] && tpaRequests[target].from === username) {
          bot.chat(`/tell ${target} ❌ لم ترد على طلب`);
          bot.chat(`/tell ${target} تم رفض طلبه تلقائي ${username}`);
          bot.chat(`/tell ${username} ❌ تم رفض طلبك تلقائيًا.`);
          delete tpaRequests[target];
        }
      }, 120000);
      return;
    }

    // ===== قبول =====
    if (args[0].toLowerCase() === '!ac') {
      const from = args[1];
      if (!from || !tpaRequests[username] || tpaRequests[username].from !== from)
        return bot.chat(`/tell${username} ❌ لا يوجد طلب من ${from || 'أي لاعب'}.`);
      bot.chat(`/tell ${from} ✅ تم قبول طلبك`);
      bot.chat(`/tp ${from} ${username}`);
      delete tpaRequests[username];
      return;
    }

    // ===== رفض =====
    if (args[0].toLowerCase() === '!dn') {
      const from = args[1];
      if (!from || !tpaRequests[username] || tpaRequests[username].from !== from)
        return bot.chat(`/tell ${username} ❌ لا يوجد طلب من ${from || 'أي لاعب'}.`);
      bot.chat(`/tell ${from} ❌ تم رفض طلبك.`);
      delete tpaRequests[username];
      return;
    }

    // ===== باقي أوامرك نفسها بدون أي تعديل =====
    if (args[0].toLowerCase() === '!m') {
      const x = -867, y = 76, z = -2959;
      bot.chat(`/tell ${username} 🚀 تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);
      bot.chat(`/tp ${username} ${x} ${y} ${z}`);
      return;
    }

        if (args[0].toLowerCase() === '!a') {
      const x = -649, y = 71, z = -3457;
      bot.chat(`/tell ${username} 🚀 تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);
      bot.chat(`/tp ${username} ${x} ${y} ${z}`);
      return;
    }

            if (args[0].toLowerCase() === '!s') {
      const x = -2136, y = 65, z = -74;
      bot.chat(`/tell ${username} 🚀 تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);
      bot.chat(`/tp ${username} ${x} ${y} ${z}`);
      return;
    }

    if (args[0].toLowerCase() === '!we') {
      bot.chat(`🌅 تم تنضيف الجو بنجاح `);
      bot.chat(`/weather clear`);
      return;
    }

    
    if (message.toLowerCase().includes('sp?')) bot.chat(`Hi ${username}`);
    if (message === '!help') bot.chat(`Commands: !tpa <@> ,!we`);
    if (message === '!time') bot.chat(`/tell ${username} ⌛ The current time in the world is: ${Math.floor(bot.time.timeOfDay / 1000)}`)
  }); // <-- لا تلمسها نهائيًا





  // ===== Events =====
  bot.on('goal_reached', () => console.log(`[AfkBot] Bot arrived at ${bot.entity.position}`));
  bot.on('death', () => console.log(`[AfkBot] Bot died at ${bot.entity.position}`));
  if (config.utils['auto-reconnect'])
    bot.on('end', () => setTimeout(createBot, config.utils['auto-reconnect-delay']));
  bot.on('kicked', (reason) => console.log(`[AfkBot] Kicked. Reason: ${reason}`));
  bot.on('error', (err) => console.log(`[ERROR] ${err.message}`));
}

createBot();
