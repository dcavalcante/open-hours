// import type { Input, Output, UserError } from "@shopify/shopify_function";
interface LocalTime {
  hour: number;
  minute: number;
  second: number;
}

interface Cart {
  local_time?: LocalTime;
  created_at?: string; // ISO8601 string, e.g., "2025-03-01T21:30:00Z"
}

interface Input {
  config?: string; // JSON string containing open hours configuration
  cart: Cart;
}

interface UserError {
  message: string;
  target: string[];
}

interface Output {
  userErrors?: UserError[];
}


// Define the open hours for one day.
interface Hours {
  openTime: string;  // e.g., "09:00"
  closeTime: string; // e.g., "17:00"
}

// Define the overall configuration structure.
interface OpenHoursConfig {
  Monday: Hours;
  Tuesday: Hours;
  Wednesday: Hours;
  Thursday: Hours;
  Friday: Hours;
  Saturday: Hours;
  Sunday: Hours;
}

// Helper: Convert a "HH:mm" formatted string to minutes since midnight.
function parseTime(timeStr: string): number {
  const [hourStr, minuteStr] = timeStr.split(":");
  return parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
}

/**
 * The main function that validates checkout based on open hours.
 *
 * It reads configuration from input.config (a JSON string with open hours per day)
 * and compares the cart's local time (input.cart.local_time) to the allowed open hours.
 * If the current time is outside the allowed window, it returns a user error.
 */
export async function run(input: Input): Promise<Output> {
  // Ensure configuration is provided.
  if (!input.config) {
    return {
      userErrors: [{
        message: "Missing configuration.",
        target: []
      }] as UserError[],
    };
  }

  // Parse configuration JSON.
  let config: OpenHoursConfig;
  try {
    config = JSON.parse(input.config) as OpenHoursConfig;
  } catch (error) {
    return {
      userErrors: [{
        message: "Invalid configuration format.",
        target: []
      }] as UserError[],
    };
  }

  // Ensure the cart's local time exists.
  if (!input.cart.local_time) {
    return {
      userErrors: [{
        message: "Missing cart local time.",
        target: []
      }] as UserError[],
    };
  }
  const { hour, minute } = input.cart.local_time;
  const currentMinutes = hour * 60 + minute;

  // Ensure created_at timestamp exists.
  if (!input.cart.created_at) {
    return {
      userErrors: [{
        message: "Missing cart created_at timestamp.",
        target: []
      }] as UserError[],
    };
  }

  // Parse the created_at timestamp to determine the current day.
  const createdAt = new Date(input.cart.created_at);
  const dayOfWeek = createdAt.toLocaleString("en-US", { weekday: "long" });

  // Retrieve today's allowed hours.
  let todayHours: Hours | undefined;
  switch (dayOfWeek) {
    case "Monday":
      todayHours = config.Monday;
      break;
    case "Tuesday":
      todayHours = config.Tuesday;
      break;
    case "Wednesday":
      todayHours = config.Wednesday;
      break;
    case "Thursday":
      todayHours = config.Thursday;
      break;
    case "Friday":
      todayHours = config.Friday;
      break;
    case "Saturday":
      todayHours = config.Saturday;
      break;
    case "Sunday":
      todayHours = config.Sunday;
      break;
    default:
      todayHours = undefined;
  }

  if (!todayHours) {
    return {
      userErrors: [{
        message: `No open hours configuration found for ${dayOfWeek}.`,
        target: []
      }] as UserError[],
    };
  }

  // Convert the allowed times to minutes since midnight.
  const openMinutes = parseTime(todayHours.openTime);
  const closeMinutes = parseTime(todayHours.closeTime);

  // If current time is outside the allowed window, block checkout.
  if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
    return {
      userErrors: [{
        message: "The store is currently closed. Please try again during our open hours.",
        target: []
      }] as UserError[],
    };
  }

  // Otherwise, allow checkout.
  return {};
}
