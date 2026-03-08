import { Headphones } from 'lucide-react';
import { useHuddleStore } from '@/stores/useHuddleStore';

interface HuddleButtonProps {
  channelId: number;
}

export function HuddleButton({ channelId }: HuddleButtonProps) {
  const { activeHuddles, currentChannelId, isJoining, joinHuddle } = useHuddleStore();
  const huddleParticipants = activeHuddles[channelId];
  const isActive = huddleParticipants && huddleParticipants.length > 0;
  const isInThisHuddle = currentChannelId === channelId;

  const handleClick = () => {
    if (isInThisHuddle || isJoining) return;
    joinHuddle(channelId);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isJoining}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors ${
        isInThisHuddle
          ? 'bg-green-100 text-green-700'
          : isActive
            ? 'text-green-600 hover:bg-green-50'
            : 'text-slack-secondary hover:bg-slack-hover'
      }`}
      title={isInThisHuddle ? 'In huddle' : isActive ? 'Join huddle' : 'Start huddle'}
    >
      <Headphones className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />
      {isActive && (
        <span className="text-xs font-medium">{huddleParticipants.length}</span>
      )}
    </button>
  );
}
