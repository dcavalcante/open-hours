import React, { useEffect, useState, useCallback } from "react";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import prisma from "../db.server";
import shopify from "../shopify.server";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Toast,
  Frame,
} from "@shopify/polaris";

interface ActionResult {
  status?: "success" | "error";
  message?: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  const { admin, session } = await shopify.authenticate.admin(request);
  const shopId = session?.shop;
  if (!shopId) return json({ openHours: [] });

  const openHours = await prisma.openHours.findMany({
    where: { shopId },
    orderBy: { dayOfWeek: "asc" },
  });
  return json({ openHours });
};

export const action: ActionFunction = async ({ request }) => {
  const { admin, session } = await shopify.authenticate.admin(request);
  const shopId = session?.shop;
  if (!shopId)
    return json<ActionResult>({ status: "error", message: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  try {
    for (const day of days) {
      const openTime = formData.get(`${day.toLowerCase()}Open`);
      const closeTime = formData.get(`${day.toLowerCase()}Close`);
      if (typeof openTime !== "string" || typeof closeTime !== "string") continue;
      // (Optional) Add further validation logic here.
      await prisma.openHours.upsert({
        where: { shopId_dayOfWeek: { shopId, dayOfWeek: day } },
        update: { openTime, closeTime },
        create: { shopId, dayOfWeek: day, openTime, closeTime },
      });
    }
    return json<ActionResult>({ status: "success" });
  } catch (error) {
    console.error("Error saving open hours:", error);
    return json<ActionResult>({ status: "error", message: "Error saving open hours." }, { status: 500 });
  }
};

export default function OpenHoursPage() {
  const { openHours } = useLoaderData<{
    openHours: Array<{ dayOfWeek: string; openTime: string; closeTime: string }>;
  }>();
  const fetcher = useFetcher<ActionResult>();
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const defaultValues: Record<string, string> = {};
  days.forEach((day) => {
    defaultValues[`${day.toLowerCase()}Open`] = "09:00";
    defaultValues[`${day.toLowerCase()}Close`] = "17:00";
  });

  const [formValues, setFormValues] = useState<Record<string, string>>(defaultValues);

  // Update form state with loader data
  useEffect(() => {
    if (openHours && openHours.length > 0) {
      const updatedValues = { ...defaultValues };
      openHours.forEach((oh) => {
        updatedValues[`${oh.dayOfWeek.toLowerCase()}Open`] = oh.openTime;
        updatedValues[`${oh.dayOfWeek.toLowerCase()}Close`] = oh.closeTime;
      });
      setFormValues(updatedValues);
    }
  }, [openHours]);

  // Listen for fetcher action result
  useEffect(() => {
    if (fetcher.data?.status === "success") {
      setToastContent("Open hours saved successfully!");
      setToastActive(true);
    } else if (fetcher.data?.status === "error") {
      setToastContent(fetcher.data.message || "Error saving open hours.");
      setToastActive(true);
    }
  }, [fetcher.data]);

  const handleChange = useCallback((name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Use Polaris's Frame to show the toast on the same page.
  const toastMarkup = toastActive ? (
    <Toast content={toastContent} onDismiss={() => setToastActive(false)} duration={5000} />
  ) : null;

  return (
    <Frame>
      <Page title="Configure Store Open Hours">
        <fetcher.Form method="post">
          <Card>
              <FormLayout>
                {days.map((day) => (
                  <div key={day}>
                    <h2>{day}</h2>
                    <FormLayout.Group>
                      <TextField
                        label="Open"
                        type="time"
                        name={`${day.toLowerCase()}Open`}
                        value={formValues[`${day.toLowerCase()}Open`]}
                        onChange={(value) => handleChange(`${day.toLowerCase()}Open`, value)}
                        autoComplete="off"
                      />
                      <TextField
                        label="Close"
                        type="time"
                        name={`${day.toLowerCase()}Close`}
                        value={formValues[`${day.toLowerCase()}Close`]}
                        onChange={(value) => handleChange(`${day.toLowerCase()}Close`, value)}
                        autoComplete="off"
                      />
                    </FormLayout.Group>
                  </div>
                ))}
                <Button submit>Save Open Hours</Button>
              </FormLayout>
          </Card>
        </fetcher.Form>

        {toastMarkup}
      </Page>
    </Frame>
  );
}
