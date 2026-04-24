"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { enable } from "@tauri-apps/plugin-autostart";
import { setAutoLaunchDialogShown } from "@/lib/tauri";

interface FirstLaunchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function FirstLaunchDialog({ open, onClose }: FirstLaunchDialogProps) {
  const handleAccept = async () => {
    try {
      await enable();
    } catch {
      // Non-critical -- autostart may not be available in dev
    }
    await setAutoLaunchDialogShown();
    onClose();
  };

  const handleDecline = async () => {
    await setAutoLaunchDialogShown();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleDecline();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Wallflower on login?</DialogTitle>
          <DialogDescription>
            Wallflower can start automatically when you log in so it's ready to
            record whenever inspiration strikes.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          You can change this later in Settings.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={handleDecline}>
            Not now
          </Button>
          <Button onClick={handleAccept}>Yes, auto-launch</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
