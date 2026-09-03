// TopEng Agent Harness - Central Plugin Registry & Dispatcher

import { ROOM_BOOKING_SCHEMA, handleRoomBookingTool } from './roomBookingPlugin';
import { TASK_PLUGIN_SCHEMA, handleTaskTool } from './taskPlugin';
import { DAILY_REPORT_SCHEMA, handleDailyReportTool } from './dailyReportPlugin';

// Aggregated tools schema for all AI Models (DeepSeek, 9Router, OpenAI, etc.)
export const ALL_PLUGINS_SCHEMA = [
  ...ROOM_BOOKING_SCHEMA,
  ...TASK_PLUGIN_SCHEMA,
  ...DAILY_REPORT_SCHEMA
];

// Unified Plugin Executor
export async function executePluginTool(toolName, args, context) {
  // 1. Room Booking Plugin
  if (['book_meeting_room', 'cancel_meeting_room', 'check_room_availability'].includes(toolName)) {
    return await handleRoomBookingTool(toolName, args, context);
  }

  // 2. Task Management Plugin
  if (['list_my_tasks', 'create_task'].includes(toolName)) {
    return await handleTaskTool(toolName, args, context);
  }

  // 3. Daily Report Plugin
  if (['generate_daily_report'].includes(toolName)) {
    return await handleDailyReportTool(toolName, args, context);
  }

  return {
    success: false,
    reply: `⚠️ Không tìm thấy handler cho công cụ: \`${toolName}\`.`
  };
}
