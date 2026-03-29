import { NextResponse } from "next/server";

const OTP_REGEX = /\b\d{4,8}\b|otp|code|verification/i;

async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing Telegram configuration");
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${errorText}`);
  }
}

function isOtpMessage(message: string): boolean {
  return OTP_REGEX.test(message);
}

function formatNotification(sender: string, message: string, receivedAt: string) {
  const date = new Date(receivedAt).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "medium",
  });

  return `🔐 *OTP Received*\n\n*From:* \`${sender}\`\n*At:* ${date}\n\n*Message:*\n${message}`;
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 1. Validate Device ID
    if (data.deviceId !== process.env.ALLOWED_DEVICE_ID) {
      console.warn(`Unauthorized device: ${data.deviceId}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Filter for SMS events with payload
    if (data.event !== "sms:received" || !data.payload) {
      return NextResponse.json({ success: true, message: "Ignored event" });
    }

    const { sender, message, receivedAt } = data.payload;

    // 3. Filter for OTP messages only
    if (!isOtpMessage(message)) {
      console.log("Non-OTP message filtered out.");
      return NextResponse.json({ success: true, message: "Not an OTP message" });
    }

    // 4. Send Notification
    const notification = formatNotification(sender, message, receivedAt);
    await sendTelegramMessage(notification);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
