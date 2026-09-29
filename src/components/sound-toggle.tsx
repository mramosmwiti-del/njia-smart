import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundMuted, setSoundMuted } from "@/lib/sound";

export function SoundToggle() {
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(isSoundMuted()); }, []);

  return (
    <button
      onClick={() => { const next = !muted; setSoundMuted(next); setMuted(next); }}
      title={muted ? "Unmute notification sounds" : "Mute notification sounds"}
      className="p-2 rounded-md hover:bg-muted text-muted-foreground"
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
