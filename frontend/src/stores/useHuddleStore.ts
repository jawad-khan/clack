import { create } from 'zustand';
import { getSocket } from '@/lib/socket';

export interface HuddleParticipant {
  userId: number;
  name: string;
  avatar: string | null;
  isMuted: boolean;
  joinedAt: string;
}

interface PeerState {
  pc: RTCPeerConnection;
  audioElement: HTMLAudioElement | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface HuddleState {
  // Current user ID (set once on init)
  userId: number | null;

  // Huddle indicators for all channels (from server broadcasts)
  activeHuddles: Record<number, HuddleParticipant[]>;

  // Current user's active huddle
  currentChannelId: number | null;
  isMuted: boolean;
  isJoining: boolean;
  localStream: MediaStream | null;
  peers: Map<number, PeerState>;
  error: string | null;

  // Actions
  joinHuddle: (channelId: number) => Promise<void>;
  leaveHuddle: () => void;
  toggleMute: () => void;

  // Socket event handlers
  onHuddleState: (data: { channelId: number; participants: HuddleParticipant[] }) => void;
  onHuddleActive: (data: { channelId: number; participantCount: number; participants: HuddleParticipant[] }) => void;
  onParticipantJoined: (data: { channelId: number; participant: HuddleParticipant }) => void;
  onParticipantLeft: (data: { channelId: number; userId: number }) => void;
  onMuteChanged: (data: { channelId: number; userId: number; isMuted: boolean }) => void;
  onSignal: (data: { channelId: number; fromUserId: number; signal: { type: string; sdp?: string; candidate?: unknown } }) => void;
  onHuddleEnded: (data: { channelId: number }) => void;
  cleanup: () => void;
}

export const useHuddleStore = create<HuddleState>((set, get) => ({
  userId: null,
  activeHuddles: {},
  currentChannelId: null,
  isMuted: false,
  isJoining: false,
  localStream: null,
  peers: new Map(),
  error: null,

  joinHuddle: async (channelId: number) => {
    const state = get();
    if (state.isJoining) return;

    // If already in a different huddle, leave first
    if (state.currentChannelId && state.currentChannelId !== channelId) {
      get().leaveHuddle();
    }

    // If already in this huddle, ignore
    if (state.currentChannelId === channelId) return;

    set({ isJoining: true, error: null });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      set({ localStream: stream, currentChannelId: channelId, isJoining: false, isMuted: false });

      const socket = getSocket();
      if (socket) {
        socket.emit('huddle:join', { channelId });
      }
    } catch {
      set({ isJoining: false, error: 'Microphone access denied' });
    }
  },

  leaveHuddle: () => {
    const { currentChannelId } = get();
    if (!currentChannelId) return;

    const socket = getSocket();
    if (socket) {
      socket.emit('huddle:leave', { channelId: currentChannelId });
    }

    get().cleanup();
  },

  toggleMute: () => {
    const { isMuted, localStream, currentChannelId } = get();
    if (!localStream || !currentChannelId) return;

    const newMuted = !isMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });

    set({ isMuted: newMuted });

    const socket = getSocket();
    if (socket) {
      socket.emit('huddle:mute', { channelId: currentChannelId, isMuted: newMuted });
    }
  },

  onHuddleState: (data) => {
    // Full state received after joining — create peer connections to all existing participants
    const { currentChannelId, localStream } = get();
    if (data.channelId !== currentChannelId || !localStream) return;

    // Update participant list
    set((s) => ({
      activeHuddles: { ...s.activeHuddles, [data.channelId]: data.participants },
    }));

    const myUserId = get().userId;
    if (!myUserId) return;

    // Create peer connections to all other participants (we are the initiator)
    for (const participant of data.participants) {
      if (participant.userId !== myUserId) {
        createPeerConnection(participant.userId, true);
      }
    }
  },

  onHuddleActive: (data) => {
    // Channel indicator update (for all channel members, not just huddle participants)
    set((s) => ({
      activeHuddles: { ...s.activeHuddles, [data.channelId]: data.participants },
    }));
  },

  onParticipantJoined: (data) => {
    const { currentChannelId } = get();

    // Update participant list
    set((s) => {
      const existing = s.activeHuddles[data.channelId] || [];
      return {
        activeHuddles: {
          ...s.activeHuddles,
          [data.channelId]: [...existing.filter((p) => p.userId !== data.participant.userId), data.participant],
        },
      };
    });

    // If we're in this huddle, wait for the new participant to send us an offer (they are the initiator)
    if (data.channelId === currentChannelId) {
      // The new joiner will create connections to us as initiator
      // We don't need to do anything — their offer will arrive via onSignal
    }
  },

  onParticipantLeft: (data) => {
    // Update participant list
    set((s) => {
      const existing = s.activeHuddles[data.channelId] || [];
      return {
        activeHuddles: {
          ...s.activeHuddles,
          [data.channelId]: existing.filter((p) => p.userId !== data.userId),
        },
      };
    });

    // Close peer connection if we were connected
    const { peers } = get();
    const peer = peers.get(data.userId);
    if (peer) {
      peer.pc.close();
      if (peer.audioElement) {
        peer.audioElement.pause();
        peer.audioElement.srcObject = null;
      }
      const newPeers = new Map(peers);
      newPeers.delete(data.userId);
      set({ peers: newPeers });
    }
  },

  onMuteChanged: (data) => {
    set((s) => {
      const existing = s.activeHuddles[data.channelId] || [];
      return {
        activeHuddles: {
          ...s.activeHuddles,
          [data.channelId]: existing.map((p) =>
            p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p
          ),
        },
      };
    });
  },

  onSignal: (data) => {
    const { currentChannelId, peers } = get();
    if (data.channelId !== currentChannelId) return;

    const { fromUserId, signal } = data;

    if (signal.type === 'offer') {
      // Received offer — create peer connection as answerer, then respond
      const existingPeer = peers.get(fromUserId);
      if (existingPeer) {
        existingPeer.pc.close();
        if (existingPeer.audioElement) {
          existingPeer.audioElement.pause();
          existingPeer.audioElement.srcObject = null;
        }
      }
      const pc = createPeerConnection(fromUserId, false);
      if (!pc) return;

      const sdpDesc = new RTCSessionDescription({ type: 'offer', sdp: signal.sdp! });
      pc.setRemoteDescription(sdpDesc)
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => {
          const socket = getSocket();
          if (socket && pc.localDescription) {
            socket.emit('huddle:signal', {
              channelId: currentChannelId,
              toUserId: fromUserId,
              signal: { type: 'answer', sdp: pc.localDescription.sdp },
            });
          }
        })
        .catch((err) => console.error('Huddle answer error:', err));
    } else if (signal.type === 'answer') {
      const peer = peers.get(fromUserId);
      if (peer) {
        const sdpDesc = new RTCSessionDescription({ type: 'answer', sdp: signal.sdp! });
        peer.pc.setRemoteDescription(sdpDesc).catch((err) => console.error('Huddle set answer error:', err));
      }
    } else if (signal.type === 'ice-candidate') {
      const peer = peers.get(fromUserId);
      if (peer && signal.candidate) {
        peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate as RTCIceCandidateInit))
          .catch((err) => console.error('Huddle ICE error:', err));
      }
    }
  },

  onHuddleEnded: (data) => {
    const { currentChannelId } = get();

    // Remove from active huddles
    set((s) => {
      const updated = { ...s.activeHuddles };
      delete updated[data.channelId];
      return { activeHuddles: updated };
    });

    // If we were in this huddle, clean up
    if (data.channelId === currentChannelId) {
      get().cleanup();
    }
  },

  cleanup: () => {
    const { peers, localStream } = get();

    // Close all peer connections
    for (const [, peer] of peers) {
      peer.pc.close();
      if (peer.audioElement) {
        peer.audioElement.pause();
        peer.audioElement.srcObject = null;
      }
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }

    set({
      currentChannelId: null,
      isMuted: false,
      localStream: null,
      peers: new Map(),
      error: null,
    });
  },
}));

// Helper function to create a peer connection (extracted for reuse in onSignal)
function createPeerConnection(remoteUserId: number, isInitiator: boolean): RTCPeerConnection | null {
  const state = useHuddleStore.getState();
  const { localStream, currentChannelId, peers } = state;
  if (!localStream || !currentChannelId) return null;

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Add local audio tracks
  localStream.getAudioTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const socket = getSocket();
      if (socket) {
        socket.emit('huddle:signal', {
          channelId: currentChannelId,
          toUserId: remoteUserId,
          signal: { type: 'ice-candidate', candidate: event.candidate.toJSON() },
        });
      }
    }
  };

  // Handle incoming audio stream
  pc.ontrack = (event) => {
    const audio = document.createElement('audio');
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    audio.play().catch(() => {/* autoplay may be blocked */});

    const currentPeers = new Map(useHuddleStore.getState().peers);
    const existing = currentPeers.get(remoteUserId);
    if (existing) {
      existing.audioElement = audio;
    }
    useHuddleStore.setState({ peers: currentPeers });
  };

  // Store peer
  const newPeers = new Map(peers);
  newPeers.set(remoteUserId, { pc, audioElement: null });
  useHuddleStore.setState({ peers: newPeers });

  // If initiator, create and send offer
  if (isInitiator) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        const socket = getSocket();
        if (socket && pc.localDescription) {
          socket.emit('huddle:signal', {
            channelId: currentChannelId,
            toUserId: remoteUserId,
            signal: { type: 'offer', sdp: pc.localDescription.sdp },
          });
        }
      })
      .catch((err) => console.error('Huddle offer error:', err));
  }

  return pc;
}

// Helper to set the current user ID (called from App.tsx)
export function setHuddleUserId(userId: number): void {
  useHuddleStore.setState({ userId });
}
