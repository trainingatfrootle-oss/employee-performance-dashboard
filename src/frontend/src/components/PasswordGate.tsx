import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CORRECT_PASSWORD = "FIPL@2016";
// Session-level cache so user only enters password once per session
const unlocked = new Set<string>();

interface PasswordGateProps {
  gateKey: string; // unique key per protected area
  onUnlock: () => void;
  onCancel: () => void;
}

export function PasswordGate({
  gateKey,
  onUnlock,
  onCancel,
}: PasswordGateProps) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // If already unlocked this session, grant immediately
  useEffect(() => {
    if (unlocked.has(gateKey)) {
      onUnlock();
    }
  }, [gateKey, onUnlock]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleSubmit = () => {
    if (value === CORRECT_PASSWORD) {
      unlocked.add(gateKey);
      setOpen(false);
      onUnlock();
    } else {
      setError("Incorrect password. Please try again.");
      setShake(true);
      setValue("");
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleClose = () => {
    setOpen(false);
    onCancel();
  };

  if (unlocked.has(gateKey)) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-primary" />
            <DialogTitle>Access Restricted</DialogTitle>
          </div>
        </DialogHeader>
        <div className={`space-y-4 ${shake ? "animate-shake" : ""}`}>
          <p className="text-sm text-muted-foreground">
            This area is password-protected. Enter the password to continue.
          </p>
          <div className="space-y-2">
            <Label htmlFor="pw-input">Password</Label>
            <Input
              id="pw-input"
              ref={inputRef}
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="Enter password"
              className={error ? "border-red-400" : ""}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Unlock</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook for inline use: returns whether access is granted
export function usePasswordGate(gateKey: string) {
  const [granted, setGranted] = useState(() => unlocked.has(gateKey));
  const grant = () => {
    unlocked.add(gateKey);
    setGranted(true);
  };
  const revoke = () => {
    unlocked.delete(gateKey);
    setGranted(false);
  };
  return { granted, grant, revoke };
}
