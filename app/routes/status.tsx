// app/routes/store-status.ts
import { type LoaderFunction } from "@remix-run/node";
// If your older `json` is deprecated, use Response.json or new Response as shown below
import { redirect } from "@remix-run/node";
import prisma from "../db.server";
import shopify from "../shopify.server";

// Optional: dayjs or date-fns for time checks
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

export const loader: LoaderFunction = async ({ request }) => {
  const { session } = await shopify.authenticate.admin(request);
  const shopId = session?.shop;

  // If shop is not authenticated or doesn't exist, return closed
  if (!shopId) {
    return new Response(JSON.stringify({ isOpen: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Grab the open hours for this shop
  const openHours = await prisma.openHours.findMany({ where: { shopId } });
  if (!openHours.length) {
    // If no settings, either assume open or closed. We’ll assume open:
    return new Response(JSON.stringify({ isOpen: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // You might store time zone somewhere (in a separate table or field).
  // For now, let's hardcode it to "America/New_York".
  const timeZone = "America/New_York";

  const now = dayjs().tz(timeZone);
  const currentDay = now.format("dddd"); // e.g. "Monday"
  const currentTime = now.format("HH:mm"); // e.g. "14:30"

  // Find matching day in DB
  const todayHours = openHours.find((oh) => oh.dayOfWeek === currentDay);
  if (!todayHours) {
    // If no entry for today, default to closed
    return new Response(JSON.stringify({ isOpen: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { openTime, closeTime } = todayHours;
  // Simple range check (no overnight logic):
  const isOpen = openTime <= currentTime && currentTime <= closeTime;

  return new Response(JSON.stringify({ isOpen }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
