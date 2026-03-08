import { Headphones } from 'lucide-react';
import { useHuddleStore } from '@/stores/useHuddleStore';
import { useAuthStore } from '@/stores/useAuthStore';

interface HuddleInviteProps {
  channelId: number;
  fromUserId: number;
}

export function HuddleInvite({ channelId, fromUserId }: HuddleInviteProps) {
  const { activeHuddles, currentChannelId, isJoining, joinHuddle } = useHuddleStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const huddleParticipants = activeHuddles[channelId];
  const isActive = huddleParticipants && huddleParticipants.length > 0;
  const isInThisHuddle = currentChannelId === channelId;
  const isInAnyHuddle = currentChannelId !== null;
  const isSender = currentUserId === fromUserId;

  const handleJoin = () => {
    if (isInThisHuddle || isJoining) return;
    if (isInAnyHuddle) {
      useHuddleStore.setState({ error: 'Leave your current huddle first' });
      return;
    }
    joinHuddle(channelId);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 my-1">
      <Headphones className="h-5 w-5 text-green-600 flex-shrink-0" />
      <span className="text-sm text-green-800">
        {isSender ? 'You started a huddle.' : 'Started a huddle.'}
      </span>
      {isActive && !isInThisHuddle && (
        <button
          onClick={handleJoin}
          disabled={isJoining}
          className={`ml-auto rounded-md px-3 py-1 text-sm font-medium transition-colors ${
            isInAnyHuddle
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          Join
        </button>
      )}
      {isInThisHuddle && (
        <span className="ml-auto text-xs font-medium text-green-600">Joined</span>
      )}
      {!isActive && !isInThisHuddle && (
        <span className="ml-auto text-xs text-gray-500">Ended</span>
      )}
    </div>
  );
}
