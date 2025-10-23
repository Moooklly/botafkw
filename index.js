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

  bot.loadPlugin(pathfinder);
  const mcDataBot = mcData(bot.version);
  const defaultMove = new Movements(bot, mcDataBot);

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

    // ===== أوامر النوم التلقائي =====
    if (message.toLowerCase() === '!sleepon') {
      autoSleepEnabled = true;
      bot.chat(`💤 تم تفعيل النوم التلقائي! البوت سينام تلقائي عندما يأتي الليل.`);
      return;
    }

    if (message.toLowerCase() === '!sleepoff') {
      autoSleepEnabled = false;
      bot.chat(`🌅 تم إيقاف النوم التلقائي.`);
      return;
    }

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
    if (args[0].toLowerCase() === '!w23213123123123123124 5453434rtrgfsfse') {
      const x = 373, y = 63, z = 446;
      bot.chat(`/tell ${username} 🚀 تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);
      bot.chat(`/tp ${username} ${x} ${y} ${z}`);
      return;
    }

    if (args[0].toLowerCase() === '!we') {
      bot.chat(`🌅 تم تنضيف الجو بنجاح `);
      bot.chat(`/weather clear`);
      return;
    }

    
    if (message.toLowerCase().includes('sp?')) bot.chat(`Hi ${username} , Go to X:373 Y:63 Z:446`);
    if (message.toLowerCase().includes('!sp')) bot.chat(`Hi ${username} , Go to X:373 Y:63 Z:446`);
    if (message.toLowerCase().includes('احداثيات السبون؟')) bot.chat(`Hi ${username} , Go to X:373 Y:63 Z:446`);
    if (message === '!help') bot.chat(`Commands: !tpa <@> , !sp , !ho , !sleepon , !sleepoff , !we`);
    if (message === '!time') bot.chat(`/tell ${username} ⌛ The current time in the world is: ${Math.floor(bot.time.timeOfDay / 1000)}`);
    if (message === '!ho') bot.chat(`/tell ${username} 🏠 mooklly : !m , rahuomee : !h , CDRSaloom : !s , Wedgead : !w`);
  }); // <-- لا تلمسها نهائيًا


  // ===== نظام النوم التلقائي =====
  bot.on('time', () => {
    if (!autoSleepEnabled) return;

    const time = bot.time.timeOfDay;
    const isNight = bot.time.isNight;

    if (isNight || (time > 13000 && time < 23000)) {
      bot.chat('/time set day');
      bot.chat('💤 نام في السرير بسبب تفعيل النوم التلقائي !');
      bot.chat('تقدر توقف هاذا الشي عن طريق ( !sleepoff )');
      console.log('[AutoSleep] الليل جاء، تم تحويل الوقت إلى صباح.');
    }
  });


  // ===== Events =====
  bot.on('goal_reached', () => console.log(`[AfkBot] Bot arrived at ${bot.entity.position}`));
  bot.on('death', () => console.log(`[AfkBot] Bot died at ${bot.entity.position}`));
  if (config.utils['auto-reconnect'])
    bot.on('end', () => setTimeout(createBot, config.utils['auto-reconnect-delay']));
  bot.on('kicked', (reason) => console.log(`[AfkBot] Kicked. Reason: ${reason}`));
  bot.on('error', (err) => console.log(`[ERROR] ${err.message}`));
}

createBot();
