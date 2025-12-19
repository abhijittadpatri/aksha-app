"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="border rounded-xl p-3 bg-white flex items-center justify-between gap-3">
      <div className="text-sm">
        <div className="font-medium">Install Aksha</div>
        <div className="text-gray-600 text-xs">Faster access like an app.</div>
      </div>

      <div className="flex gap-2">
        <button
          className="border px-3 py-2 rounded-lg text-sm"
          onClick={() => setDismissed(true)}
        >
          Later
        </button>
        <button
          className="bg-black text-white px-3 py-2 rounded-lg text-sm"
          onClick={async () => {
            try {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            } catch {
              // ignore
            }
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
