import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Verify Device ID
    const allowedDeviceId = process.env.ALLOWED_DEVICE_ID;
    if (data.deviceId !== allowedDeviceId) {
      console.warn(`Unauthorized request from deviceId: ${data.deviceId}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (data.event === "sms:received" && data.payload) {
      const { sender, message, receivedAt } = data.payload;

      const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = process.env.TELEGRAM_CHAT_ID;

      if (!telegramBotToken || !telegramChatId) {
        console.error(
          "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables.",
        );
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500 },
        );
      }

      // Format the date if needed, or pass it as is.
      const formattedDate = new Date(receivedAt).toLocaleString("en-US", {
        timeZone: "UTC",
        dateStyle: "medium",
        timeStyle: "medium",
      });

      const notificationText = `📱 *New SMS Received*\n\n*Sender:* \`${sender}\`\n*Date:* ${formattedDate}\n*Message:* ${message}`;

      const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

      const response = await fetch(telegramUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: notificationText,
          parse_mode: "Markdown",
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error("Failed to send message to Telegram:", responseText);
        return NextResponse.json(
          { error: "Failed to send Telegram notification" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    // If it's a different event or missing payload, we can simply acknowledge it
    return NextResponse.json({ success: true, message: "Event ignored" });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
