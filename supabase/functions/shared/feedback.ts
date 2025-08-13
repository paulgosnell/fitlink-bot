import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { sendTelegramMessage } from "./telegram/api.ts";

export interface FeedbackData {
  type: 'bug_report' | 'feature_request' | 'general_feedback' | 'complaint' | 'compliment';
  category?: string;
  message: string;
  rating?: number;
  context?: Record<string, any>;
}

export interface AdminUser {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  role: 'admin' | 'support' | 'developer';
  is_active: boolean;
  can_receive_feedback: boolean;
  notification_types: string[];
}

/**
 * Submit user feedback and forward to admin on Telegram
 */
export async function submitFeedback(
  userId: string,
  userTelegramId: number,
  userMessageId: number | undefined,
  feedbackData: FeedbackData,
  supabase: SupabaseClient,
  botToken: string
): Promise<{ success: boolean; error?: string; feedbackId?: string }> {
  try {
    // Get user details for context
    const { data: user } = await supabase
      .from('users')
      .select('first_name, username')
      .eq('id', userId)
      .single();

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from('user_feedback')
      .insert([{
        user_id: userId,
        user_telegram_id: userTelegramId,
        user_message_id: userMessageId,
        type: feedbackData.type,
        category: feedbackData.category,
        message: feedbackData.message,
        rating: feedbackData.rating,
        context: feedbackData.context || {},
        status: 'open',
        priority: determinePriority(feedbackData),
        tags: extractTags(feedbackData)
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting feedback:', insertError);
      return { success: false, error: 'Failed to save feedback' };
    }

    // Get admin users who should receive this type of feedback
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('is_active', true)
      .eq('can_receive_feedback', true);

    if (adminError || !adminUsers?.length) {
      console.error('Error getting admin users:', adminError);
      return { success: false, error: 'No admin users available' };
    }

    // Forward to relevant admins
    const forwardPromises = adminUsers
      .filter(admin => shouldNotifyAdmin(admin, feedbackData))
      .map(admin => forwardToAdmin(feedback, user, admin, supabase, botToken));

    await Promise.allSettled(forwardPromises);

    return { success: true, feedbackId: feedback.id };

  } catch (error) {
    console.error('Error submitting feedback:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Forward feedback to admin on Telegram
 */
async function forwardToAdmin(
  feedback: any,
  user: any,
  admin: AdminUser,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    const userName = user?.first_name || user?.username || 'Unknown User';
    const typeEmoji = getTypeEmoji(feedback.type);
    const priorityEmoji = getPriorityEmoji(feedback.priority);
    
    const adminMessage = `${typeEmoji} **New ${feedback.type.replace('_', ' ')} Feedback**

👤 **From:** ${userName} (ID: ${feedback.user_telegram_id})
${priorityEmoji} **Priority:** ${feedback.priority}
📂 **Category:** ${feedback.category || 'General'}
${feedback.rating ? `⭐ **Rating:** ${feedback.rating}/5` : ''}

💬 **Message:**
"${feedback.message}"

🔍 **Context:**
${feedback.context ? Object.entries(feedback.context).map(([k, v]) => `• ${k}: ${v}`).join('\n') : 'None provided'}

📊 **Feedback ID:** \`${feedback.id}\`
⏰ **Received:** ${new Date(feedback.created_at).toLocaleString()}

**Reply options:**
• Reply to this message with: \`/reply ${feedback.id} Your response here\`
• Mark resolved: \`/resolve ${feedback.id}\`
• Set priority: \`/priority ${feedback.id} high|medium|low\``;

    // Send to admin
    await sendTelegramMessage(botToken, admin.telegram_id, adminMessage);

    // Update feedback record with admin notification
    await supabase
      .from('user_feedback')
      .update({
        admin_notified_at: new Date().toISOString()
      })
      .eq('id', feedback.id);

  } catch (error) {
    console.error(`Error forwarding to admin ${admin.telegram_id}:`, error);
  }
}

/**
 * Handle admin response to feedback
 */
export async function handleAdminResponse(
  adminTelegramId: number,
  command: string,
  args: string[],
  supabase: SupabaseClient,
  botToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Verify admin user
    const { data: admin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('telegram_id', adminTelegramId)
      .eq('is_active', true)
      .single();

    if (!admin) {
      return { success: false, message: 'You are not authorized as an admin.' };
    }

    const feedbackId = args[0];
    if (!feedbackId) {
      return { success: false, message: 'Please provide a feedback ID.' };
    }

    // Get feedback record
    const { data: feedback, error } = await supabase
      .from('user_feedback')
      .select('*, users!inner(first_name, telegram_id)')
      .eq('id', feedbackId)
      .single();

    if (error || !feedback) {
      return { success: false, message: 'Feedback not found.' };
    }

    switch (command) {
      case '/reply':
        return await handleReply(feedback, admin, args.slice(1).join(' '), supabase, botToken);
      
      case '/resolve':
        return await handleResolve(feedback, admin, supabase, botToken);
      
      case '/priority':
        return await handleSetPriority(feedback, admin, args[1], supabase);
      
      default:
        return { success: false, message: 'Unknown command.' };
    }

  } catch (error) {
    console.error('Error handling admin response:', error);
    return { success: false, message: 'Internal error occurred.' };
  }
}

async function handleReply(
  feedback: any, 
  admin: AdminUser, 
  response: string, 
  supabase: SupabaseClient, 
  botToken: string
): Promise<{ success: boolean; message: string }> {
  if (!response.trim()) {
    return { success: false, message: 'Please provide a response message.' };
  }

  // Update feedback with admin response
  await supabase
    .from('user_feedback')
    .update({
      admin_response: response,
      admin_response_at: new Date().toISOString(),
      admin_user_telegram_id: admin.telegram_id,
      status: 'in_progress'
    })
    .eq('id', feedback.id);

  // Send response to user
  const userMessage = `📬 **Response to your feedback:**

"${response}"

*- ${admin.first_name || 'Support Team'}*

If you have any follow-up questions, feel free to send another message!`;

  try {
    await sendTelegramMessage(botToken, feedback.users.telegram_id, userMessage);
    
    // Update that response was forwarded
    await supabase
      .from('user_feedback')
      .update({ response_forwarded_at: new Date().toISOString() })
      .eq('id', feedback.id);

    return { 
      success: true, 
      message: `✅ Response sent to ${feedback.users.first_name || 'user'}` 
    };
  } catch (error) {
    console.error('Error sending response to user:', error);
    return { 
      success: false, 
      message: 'Response saved but failed to send to user. They may have blocked the bot.' 
    };
  }
}

async function handleResolve(
  feedback: any,
  admin: AdminUser,
  supabase: SupabaseClient,
  botToken: string
): Promise<{ success: boolean; message: string }> {
  await supabase
    .from('user_feedback')
    .update({
      status: 'resolved',
      admin_user_telegram_id: admin.telegram_id
    })
    .eq('id', feedback.id);

  return { success: true, message: `✅ Feedback marked as resolved` };
}

async function handleSetPriority(
  feedback: any,
  admin: AdminUser,
  priority: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; message: string }> {
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    return { success: false, message: 'Priority must be: low, medium, high, or urgent' };
  }

  await supabase
    .from('user_feedback')
    .update({ priority })
    .eq('id', feedback.id);

  return { success: true, message: `✅ Priority updated to ${priority}` };
}

// Helper functions
function determinePriority(feedback: FeedbackData): string {
  if (feedback.type === 'complaint' || feedback.rating === 1) return 'high';
  if (feedback.type === 'bug_report') return 'medium';
  if (feedback.type === 'feature_request') return 'medium';
  return 'low';
}

function extractTags(feedback: FeedbackData): string[] {
  const tags: string[] = [];
  const message = feedback.message.toLowerCase();
  
  if (message.includes('oura') || message.includes('sleep')) tags.push('oura');
  if (message.includes('strava') || message.includes('activity')) tags.push('strava');
  if (message.includes('dashboard') || message.includes('web')) tags.push('dashboard');
  if (message.includes('briefing') || message.includes('ai')) tags.push('briefing');
  if (message.includes('slow') || message.includes('loading')) tags.push('performance');
  if (message.includes('error') || message.includes('bug')) tags.push('bug');
  
  return tags;
}

function shouldNotifyAdmin(admin: AdminUser, feedback: FeedbackData): boolean {
  return admin.notification_types.includes(feedback.type) || 
         admin.notification_types.includes('all');
}

function getTypeEmoji(type: string): string {
  const emojis = {
    bug_report: '🐛',
    feature_request: '💡',
    general_feedback: '💬',
    complaint: '😞',
    compliment: '🎉'
  };
  return emojis[type as keyof typeof emojis] || '💬';
}

function getPriorityEmoji(priority: string): string {
  const emojis = {
    urgent: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };
  return emojis[priority as keyof typeof emojis] || '🟡';
}