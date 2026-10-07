import { APIError } from "better-auth/api";

export function createDelivery(env = process.env) {
  const emailEnabled = Boolean(env.BREVO_API_KEY && env.AUTH_EMAIL_FROM);
  const phoneEnabled = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
  return {
    emailEnabled, phoneEnabled,
    async sendPhone({ phoneNumber, code }) {
      if (!phoneEnabled) throw new APIError("SERVICE_UNAVAILABLE", { message: "SMS verification is temporarily unavailable." });
      let response;
      try {
        response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST", signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: phoneNumber, From: env.TWILIO_FROM_NUMBER,
            Body: `Your Vidyarthi verification code is ${code}. Valid for 5 minutes. Never share this code.` }),
        });
      } catch { throw new APIError("SERVICE_UNAVAILABLE", { message: "We could not send your code. Please try again later." }); }
      if (!response.ok) throw new APIError("SERVICE_UNAVAILABLE", { message: "We could not send your code. Please try again later." });
    },
    async sendEmail({ email, otp, type }) {
      if (!emailEnabled) throw new APIError("SERVICE_UNAVAILABLE", { message: "Email verification is temporarily unavailable." });
      const label = type === "forget-password" ? "reset your password" : type === "sign-in" ? "sign in" : "verify your email";
      let response;
      try {
        response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST", signal: AbortSignal.timeout(10000),
          headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sender: { email: env.AUTH_EMAIL_FROM, name: env.AUTH_EMAIL_FROM_NAME || "Vidyarthi Book Depot" },
            to: [{ email }], subject: "Your Vidyarthi verification code",
            textContent: `Your code to ${label} is ${otp}. It expires in 5 minutes. Never share this code. If you did not request it, ignore this email.` }),
        });
      } catch { throw new APIError("SERVICE_UNAVAILABLE", { message: "We could not send your code. Please try again later." }); }
      if (!response.ok) throw new APIError("SERVICE_UNAVAILABLE", { message: "We could not send your code. Please try again later." });
    },
  };
}
