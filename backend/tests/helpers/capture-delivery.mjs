// Test-only preload. Never imported by application code.
// Runs only with an explicitly isolated local database and an IPC parent.
const database = new URL(process.env.DATABASE_URL || "http://invalid");
if (process.env.NODE_ENV !== "test" || !process.send || !["127.0.0.1", "localhost"].includes(database.hostname)) {
  throw new Error("Delivery capture requires the isolated authentication audit runner");
}
const nativeFetch = globalThis.fetch;
let deliveryStatus = 201;
process.on("message", (message) => {
  if (message?.type === "delivery-status") {
    deliveryStatus = message.status;
    process.send({ type: "delivery-status-ready", status: deliveryStatus });
  }
});
globalThis.fetch = async (input, options) => {
  const url = String(input);
  if (url === "https://api.brevo.com/v3/smtp/email") {
    const body = JSON.parse(options.body);
    const otp = body.textContent.match(/ is (\d{6})\./)?.[1];
    const purpose = body.textContent.includes("reset your password") ? "forget-password" : body.textContent.includes("to sign in") ? "sign-in" : "email-verification";
    await new Promise((resolve) => process.send({ type: "captured-delivery", channel: "email", recipient: body.to[0].email,
      otp, purpose, subject: body.subject, sender: body.sender.email, status: deliveryStatus }, resolve));
    return new Response(JSON.stringify({ messageId: "isolated-audit-delivery" }), { status: deliveryStatus });
  }
  if (url.startsWith("https://api.twilio.com/2010-04-01/Accounts/")) {
    const body = new URLSearchParams(options.body);
    await new Promise((resolve) => process.send({ type: "captured-delivery", channel: "phone", recipient: body.get("To"),
      otp: body.get("Body").match(/ is (\d{6})\./)?.[1], status: deliveryStatus }, resolve));
    return new Response(JSON.stringify({ sid: "isolated-audit-sms" }), { status: deliveryStatus });
  }
  // A test must never silently contact a real external identity provider.
  if (/^https?:\/\//.test(url) && !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
    throw new Error("External network access blocked by the isolated audit");
  }
  return nativeFetch(input, options);
};
