// Quick test script to check if bot responds to /start
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Please set TELEGRAM_BOT_TOKEN environment variable');
  process.exit(1);
}

async function testBot() {
  try {
    // Get bot info
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await response.json();
    
    if (botInfo.ok) {
      console.log('✅ Bot is accessible:', botInfo.result.username);
      console.log('🤖 Bot name:', botInfo.result.first_name);
      console.log('📱 Your bot link: https://t.me/' + botInfo.result.username);
    } else {
      console.error('❌ Bot error:', botInfo.description);
    }

    // Check webhook status
    const webhookResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await webhookResponse.json();
    
    if (webhookInfo.ok) {
      console.log('\n📡 Webhook status:');
      console.log('URL:', webhookInfo.result.url || 'Not set');
      console.log('Pending updates:', webhookInfo.result.pending_update_count);
      console.log('Last error:', webhookInfo.result.last_error_message || 'None');
    }

  } catch (error) {
    console.error('❌ Error testing bot:', error.message);
  }
}

testBot();
