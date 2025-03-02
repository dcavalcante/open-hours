import { type LoaderFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import prisma from "../db.server";
import shopify from "../shopify.server";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

export const loader: LoaderFunction = async ({ request }) => {
  // const shopId = request.headers.get("origin");
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shop");
  // If shop is not authenticated or doesn't exist, return closed
  if (!shopId) {
    return new Response(JSON.stringify({ isOpen: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  const openHours = await prisma.openHours.findMany({ where: { shopId } });
  if (!openHours.length) {
    // If no settings, either assume open or closed. We’ll assume open:
    return new Response(JSON.stringify({ isOpen: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Todo: abstract timezone
  const timeZone = "America/New_York";

  const now = dayjs().tz(timeZone);
  const currentDay = now.format("dddd"); // e.g. "Monday"
  const currentTime = now.format("HH:mm"); // e.g. "14:30"

  // Find matching day in DB
  const todayHours = openHours.find((oh) => oh.dayOfWeek === currentDay);
  if (!todayHours) {
    // If no entry for today, default to open
    return new Response(JSON.stringify({ isOpen: true }), {
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
