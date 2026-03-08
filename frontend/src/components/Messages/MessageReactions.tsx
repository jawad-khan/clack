import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { PortalEmojiPicker } from '@/components/ui/emoji-picker';
import type { Reaction } from '@/lib/types';
import data from '@emoji-mart/data';

const SHORTCODE_ALIASES: Record<string, string> = {
  mind_blown: 'exploding_head',
};

function shortcodeToNative(emoji: string): string {
  const key = SHORTCODE_ALIASES[emoji] ?? emoji;
  const emojiData = (data as any).emojis?.[key];
  if (emojiData?.skins?.[0]?.native) return emojiData.skins[0].native;
  return emoji;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  messageId: number;
  onAddReaction: (messageId: number, emoji: string) => void;
  onRemoveReaction: (messageId: number, emoji: string) => void;
}

export function MessageReactions({ reactions, messageId, onAddReaction, onRemoveReaction }: MessageReactionsProps) {
  const user = useAuthStore((s) => s.user);
  const [showPicker, setShowPicker] = useState(false);
  const currentUserId = user?.id ?? -1;

  const handleReactionClick = (emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      onRemoveReaction(messageId, emoji);
    } else {
      onAddReaction(messageId, emoji);
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    onAddReaction(messageId, emoji.native);
    setShowPicker(false);
  };

  return (
    <div className="relative mt-[6px] inline-flex flex-wrap items-center gap-[4px]">
      {reactions.map((reaction) => {
        const hasReacted = reaction.userIds.includes(currentUserId);
        const names = reaction.userNames.filter(Boolean);
        const tooltip = names.length > 0
          ? `${names.join(', ')} reacted with ${shortcodeToNative(reaction.emoji)}`
          : undefined;
        return (
          <div key={reaction.emoji} className="group/reaction relative">
            <button
              onClick={() => handleReactionClick(reaction.emoji, hasReacted)}
              className={cn(
                'inline-flex h-[22px] items-center gap-1 rounded-[12px] border px-[6px] text-[12px] transition-colors',
                hasReacted
                  ? 'border-slack-link bg-slack-highlight text-slack-link'
                  : 'border-slack-border bg-white text-slack-primary hover:bg-slack-hover'
              )}
            >
              <span data-testid="reaction-emoji" className="text-sm leading-none">{shortcodeToNative(reaction.emoji)}</span>
              <span className="text-[13px] font-medium">{reaction.count}</span>
            </button>
            {tooltip && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover/reaction:block">
                {tooltip}
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[12px] border border-slack-border bg-white text-slack-secondary hover:bg-slack-hover"
      >
        <Plus className="h-[12px] w-[12px]" />
      </button>
      {showPicker && (
        <PortalEmojiPicker
          anchorClassName="absolute bottom-full left-0 mb-2"
          onEmojiSelect={handleEmojiSelect}
          onClickOutside={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
