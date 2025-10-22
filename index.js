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
        return bot.chat(`/tell ${username} ${username}, انتظر ${remaining} دقيقة قبل إعادة الاستخدام.`);
      }

      tpaRequests[target] = { from: username, time: now };
      cooldowns[username] = now;

      bot.chat(`/tell ${target} 📨 ${target}, ${username} يريد الانتقال إليك!`);
      bot.chat(`/tell ${target} اكتب !ac ${username} لقبول الطلب أو !dn ${username} لرفضه.`);

      setTimeout(() => {
        if (tpaRequests[target] && tpaRequests[target].from === username) {
          bot.chat(`/tell ${target} ❌ ${target}, لم ترد على طلب ${username}، تم رفض الطلب تلقائيًا.`);
          bot.chat(`/tell ${username} ${username}, تم رفض طلبك تلقائيًا.`);
          delete tpaRequests[target];
        }
      }, 120000);
      return;
    }

    // ===== قبول =====
    if (args[0].toLowerCase() === '!ac') {
      const from = args[1];
      if (!from || !tpaRequests[username] || tpaRequests[username].from !== from)
        return bot.chat(`/tell${username} ${username}, لا يوجد طلب من ${from || 'أي لاعب'}.`);
      bot.chat(`/tell ${username} ✅ ${username} وافق على انتقال ${from} إليه!`);
      bot.chat(`/tp ${from} ${username}`);
      delete tpaRequests[username];
      return;
    }

    // ===== رفض =====
    if (args[0].toLowerCase() === '!dn') {
      const from = args[1];
      if (!from || !tpaRequests[username] || tpaRequests[username].from !== from)
        return bot.chat(`/tell ${username} ${username}, لا يوجد طلب من ${from || 'أي لاعب'}.`);
      bot.chat(`/tell ${username} ❌ ${username} رفض طلب ${from}.`);
      bot.chat(`/tell ${from} ${from}, تم رفض طلبك.`);
      delete tpaRequests[username];
      return;
    }

    // ===== أمر spawn =====
     if (args[0].toLowerCase() === '!sp') {
       // الإحداثيات اللي انت محددها مسبقًا
       const x = 373;
       const y = 63;
       const z = 446;

       bot.chat(`/tell ${username} 🚀 ${username} تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);
        
       bot.chat(`/tp ${username} ${x} ${y} ${z}`);
       return;
     }

     // ===== أمر spawn =====
       if (args[0].toLowerCase() === '!m') {
         // الإحداثيات اللي انت محددها مسبقًا
         const x = 249;
         const y = 63;
         const z = 501;

         bot.chat(`/tell ${username} 🚀 ${username} تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);

         bot.chat(`/tp ${username} ${x} ${y} ${z}`);
         return;
       }

     // ===== أمر spawn =====
      if (args[0].toLowerCase() === '!h') {
        // الإحداثيات اللي انت محددها مسبقًا
        const x = 498;
        const y = 64;
        const z = 399;

        bot.chat(`/tell ${username} 🚀 ${username} تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);

        bot.chat(`/tp ${username} ${x} ${y} ${z}`);
        return;
      }

       // ===== أمر spawn =====
        if (args[0].toLowerCase() === '!s') {
          // الإحداثيات اللي انت محددها مسبقًا
          const x = 550;
          const y = 69;
          const z = 528;

          bot.chat(`/tell ${username} 🚀 ${username} تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);

          bot.chat(`/tp ${username} ${x} ${y} ${z}`);
          return;
        }

      // ===== أمر spawn =====
       if (args[0].toLowerCase() === '!w') {
         // الإحداثيات اللي انت محددها مسبقًا
         const x = 617;
         const y = 72;
         const z = 330;

         bot.chat(`/tell ${username} 🚀 ${username} تم نقلك الآن إلى الإحداثيات: X:${x} Y:${y} Z:${z}`);

         bot.chat(`/tp ${username} ${x} ${y} ${z}`);
         return;
       }


     // ===== ردود المحادثة =====
     if (message.toLowerCase().includes('sp?')) {
       bot.chat(`Hi ${username} , Go to X:373 Y:63 Z:446`);
     }

     if (message.toLowerCase().includes('احداثيات السبون؟')) {
       bot.chat(`Hi ${username} , Go to X:373 Y:63 Z:446`);
     }

     if (message.toLowerCase().includes('هاي')) {
       bot.chat(`Hi ${username}`);
     }

     if (message === '!help') {
       bot.chat(`Commands: !t , !tpa <@> , !sp , !ho`);
     }

     if (message === '!time') {
       bot.chat(`The current time in the world is: ${Math.floor(bot.time.timeOfDay / 1000)}s`);
     }

     if (message === '!ho') {
       bot.chat(`Hi ${username} , mooklly : !m , rahuomee : !h , CDRSaloom : !s , Wedgead : !w`);
     }
 }); // <-- ضروري جداً



  // ===== Events =====
  bot.on('goal_reached', () => console.log(`[AfkBot] Bot arrived at ${bot.entity.position}`));
  bot.on('death', () => console.log(`[AfkBot] Bot died at ${bot.entity.position}`));
  if (config.utils['auto-reconnect'])
    bot.on('end', () => setTimeout(createBot, config.utils['auto-reconnect-delay']));
  bot.on('kicked', (reason) => console.log(`[AfkBot] Kicked. Reason: ${reason}`));
  bot.on('error', (err) => console.log(`[ERROR] ${err.message}`));
}

createBot();
