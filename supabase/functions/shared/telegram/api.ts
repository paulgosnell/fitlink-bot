import type { TelegramInlineKeyboardMarkup } from "../types.ts";

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  keyboard?: TelegramInlineKeyboardMarkup
): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

export async function sendTelegramMarkdownMessage(
  botToken: string,
  chatId: number,
  text: string,
  keyboard?: TelegramInlineKeyboardMarkup
): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

export async function editTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: TelegramInlineKeyboardMarkup
): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  
  const payload: any = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown'
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
  showAlert = false
): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  
  const payload: any = {
    callback_query_id: callbackQueryId,
    show_alert: showAlert
  };

  if (text) {
    payload.text = text;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken?: string
): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
  
  const payload: any = {
    url: webhookUrl,
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query']
  };

  if (secretToken) {
    payload.secret_token = secretToken;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

export async function deleteTelegramWebhook(botToken: string): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ drop_pending_updates: true }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}

export async function getTelegramMe(botToken: string): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/getMe`;
  
  const response = await fetch(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return response.json();
}
