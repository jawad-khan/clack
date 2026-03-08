import { Mic, MicOff, PhoneOff, Headphones } from 'lucide-react';
import { useHuddleStore } from '@/stores/useHuddleStore';
import { useChannelStore } from '@/stores/useChannelStore';
import { Avatar } from '@/components/ui/avatar';

export function HuddleBar() {
  const { currentChannelId, isMuted, activeHuddles, leaveHuddle, toggleMute, error } = useHuddleStore();
  const channels = useChannelStore((s) => s.channels);

  if (!currentChannelId) return null;

  const channel = channels.find((c) => c.id === currentChannelId);
  const participants = activeHuddles[currentChannelId] || [];

  return (
    <div className="border-t border-slack-border bg-green-50 px-3 py-2">
      {error && (
        <div className="text-xs text-red-600 mb-1">{error}</div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Headphones className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-xs font-medium text-green-700 truncate">
            #{channel?.name || 'unknown'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Participant avatars */}
          <div className="flex -space-x-1.5 mr-1">
            {participants.slice(0, 4).map((p) => (
              <Avatar
                key={p.userId}
                src={p.avatar ?? undefined}
                alt={p.name}
                fallback={p.name}
                size="sm"
                className="ring-1 ring-green-50"
              />
            ))}
            {participants.length > 4 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-200 text-[10px] font-medium text-green-700 ring-1 ring-green-50">
                +{participants.length - 4}
              </span>
            )}
          </div>

          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
              isMuted
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-green-200 text-green-700 hover:bg-green-300'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>

          {/* Leave */}
          <button
            onClick={leaveHuddle}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            title="Leave huddle"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
