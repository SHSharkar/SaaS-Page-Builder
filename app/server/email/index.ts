import "server-only";
import { Body, Container, Html, render, Text } from "@react-email/components";
import nodemailer from "nodemailer";
import { createElement } from "react";
import { getEnv } from "@/app/server/env";

export function createMailTransport() {
  const env = getEnv();
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export function renderShortLinkEmailText(input: {
  heading: string;
  shortUrl: string;
}): string {
  return `${input.heading}\n\nOpen secure link: ${input.shortUrl}\n`;
}

export async function renderShortLinkEmailHtml(input: {
  heading: string;
  shortUrl: string;
}): Promise<string> {
  const element = createElement(
    Html,
    { lang: "en" },
    createElement(
      Body,
      null,
      createElement(
        Container,
        null,
        createElement(Text, null, input.heading),
        createElement(Text, null, input.shortUrl),
      ),
    ),
  );
  return render(element);
}
