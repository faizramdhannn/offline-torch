// Badge lingkaran berwarna per platform sosial media — dipilih daripada
// path SVG logo asli (rawan tidak presisi kalau ditulis manual tanpa aset
// resmi) supaya selalu render benar dan tetap mudah dikenali di tabel kecil.

const PLATFORM_STYLE: Record<string, { bg: string; fg: string }> = {
  Instagram: { bg: "#E1306C", fg: "#ffffff" },
  Threads: { bg: "#000000", fg: "#ffffff" },
  TikTok: { bg: "#000000", fg: "#ffffff" },
  X: { bg: "#000000", fg: "#ffffff" },
  Facebook: { bg: "#1877F2", fg: "#ffffff" },
  WhatsApp: { bg: "#25D366", fg: "#ffffff" },
  "WhatsApp Channel": { bg: "#25D366", fg: "#ffffff" },
};

function PlatformGlyph({ platform, size }: { platform: string; size: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none" } as const;
  switch (platform) {
    case "Instagram":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
        </svg>
      );
    case "Threads":
      return (
        <svg {...common}>
          <path
            d="M12 3c-4.5 0-6.5 2.8-6.5 6.2 0 2.1.9 3.7 2.3 4.8-1.2.6-2.3 1.7-2.3 3.4C5.5 20 7.7 21 10 21c3.4 0 5.6-1.6 6.4-4.3.3-1 .4-2.1.3-3.2 1 .6 1.8 1.5 1.8 2.9 0 2-1.7 3.1-3.7 3.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M9 11c0-2.2 1.4-3.5 3.3-3.5 1.9 0 3.2 1.2 3.2 3 0 1.7-1.1 2.6-2.7 2.9-2 .4-3.3 1.1-3.3 2.6 0 1.2 1 1.9 2.4 1.9 1.8 0 3-.9 3.4-2.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "TikTok":
      return (
        <svg {...common}>
          <path
            d="M14 4v9.6a2.9 2.9 0 11-2.3-2.84"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 4c.3 2 1.7 3.4 3.7 3.7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "X":
      return (
        <svg {...common}>
          <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "Facebook":
      return (
        <svg {...common}>
          <path
            d="M14 21v-7h2.3l.4-2.7H14V9.4c0-.8.2-1.4 1.4-1.4h1.5V5.5c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7v2.2H9v2.7h2.2V21"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "WhatsApp":
    case "WhatsApp Channel":
      return (
        <svg {...common}>
          <path
            d="M7 17.5l-1.4 3 3.1-1.4A7.5 7.5 0 1012 4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 9.8c0-.5.4-.9.9-.9h.4c.3 0 .5.2.6.4l.5 1.2c.1.2 0 .5-.1.6l-.5.6c.4.9 1.1 1.6 2 2l.6-.5c.2-.1.4-.2.6-.1l1.2.5c.2.1.4.3.4.6v.4c0 .5-.4.9-.9.9-2.8 0-5.7-2.9-5.7-5.7z"
            fill="currentColor"
          />
          {platform === "WhatsApp Channel" && (
            <path d="M16 5.5a4 4 0 010 5.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          )}
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
  }
}

export function SocialMediaIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const style = PLATFORM_STYLE[platform] || { bg: "#94a3b8", fg: "#ffffff" };
  const box = size + 8;
  return (
    <span
      title={platform}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: box,
        height: box,
        borderRadius: "999px",
        background: style.bg,
        color: style.fg,
        flexShrink: 0,
      }}
    >
      <PlatformGlyph platform={platform} size={size} />
    </span>
  );
}
