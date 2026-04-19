"use client";

import { useState } from "react";
import { DeviceImportDialog } from "@/components/device-import-dialog";

export default function Home() {
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold">Wallflower</h1>
      <p className="mt-4 text-lg text-gray-500">
        Jam and sample manager for musicians
      </p>

      <div className="mt-8">
        <button
          onClick={() => setShowDeviceDialog(true)}
          className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Check Devices
        </button>
      </div>

      {showDeviceDialog && (
        <DeviceImportDialog onClose={() => setShowDeviceDialog(false)} />
      )}
    </main>
  );
}
