import { getAvatarColor, getInitials } from "../lib/dateUtils";

interface EmployeeAvatarProps {
  name: string;
  avatar?: string | null; // initials e.g. "PS" — if provided, shown instead of derived initials
  size?: "sm" | "md" | "lg";
}

export function EmployeeAvatar({
  name,
  avatar,
  size = "md",
}: EmployeeAvatarProps) {
  const display =
    avatar && /^[A-Z]{1,3}$/i.test(avatar.trim())
      ? avatar.trim().toUpperCase()
      : getInitials(name);
  const color = getAvatarColor(name);
  const sizeClass =
    size === "sm"
      ? "w-7 h-7 text-xs"
      : size === "lg"
        ? "w-10 h-10 text-sm"
        : "w-8 h-8 text-xs";

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: color }}
    >
      {display}
    </div>
  );
}
