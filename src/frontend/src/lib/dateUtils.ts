export function formatTime(time: bigint): string {
  const ms = Number(time / BigInt(1_000_000));
  if (Number.isNaN(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTimeShort(time: bigint): string {
  const ms = Number(time / BigInt(1_000_000));
  if (Number.isNaN(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getMonthYear(time: bigint): string {
  const ms = Number(time / BigInt(1_000_000));
  if (Number.isNaN(ms) || ms <= 0) return "Unknown";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#1F6FEB",
  "#0D9488",
  "#7C3AED",
  "#D97706",
  "#DC2626",
  "#059669",
  "#DB2777",
  "#2563EB",
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
