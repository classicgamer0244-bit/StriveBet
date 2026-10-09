"use client";

import Link from "next/link";
import { Mail, Send } from "lucide-react";

const CHANNELS = [
  {
    icon: Mail,
    label: "Send us an email",
    value: "maxbetsupport@gmail.com",
    href: "mailto:maxbetsupport@gmail.com",
    note: "We'll get back to you within 24 hours",
  },
  {
    icon: Send,
    label: "Chat on Telegram",
    value: "@MaxBetAgentGH",
    href: "https://t.me/MaxBetAgentGH",
    note: "Usually reply within a few minutes",
  },
];

export default function SupportPage() {
  return (
    <div className="flex flex-col bg-background pb-6">

      {/* Intro */}
      <div className="bg-navy px-5 py-7">
        <p className="text-lg font-bold text-white">Got a question?</p>
        <p className="mt-1 text-sm text-white/50 leading-relaxed">
          Our team is available every day from 8am to 10pm. Pick any channel below and we&apos;ll sort you out.
        </p>
      </div>

      {/* Channels */}
      <div className="flex flex-col divide-y divide-border bg-card mt-3 border-y border-border">
        {CHANNELS.map(({ icon: Icon, label, value, href, note }) => (
          <Link
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted active:bg-background"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground/50 group-hover:bg-[#1F6BFF] group-hover:text-white transition-colors">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-sm text-[#1F6BFF] underline underline-offset-2">{value}</p>
              <p className="text-xs text-foreground/40 mt-0.5">{note}</p>
            </div>

          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="px-5 pt-5 text-xs text-foreground/40 leading-relaxed">
        We don&apos;t use bots. When you reach out, you&apos;re talking to someone on our actual team.
      </p>
    </div>
  );
}
