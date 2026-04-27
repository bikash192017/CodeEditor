import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuthStore } from '../stores/authStore';

export function useWebRTC(roomId: string | undefined, localUsers: any[]) {
  const { socket } = useSocket();
  const currentUser = useAuthStore((s) => s.user);

  const myUserId = currentUser?._id || socket?.id;
  const myUsername = currentUser?.username || 'Guest';

  const [inCall, setInCall] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);

  const [remoteStreams, setRemoteStreams] = useState<Record<string, { streams: MediaStream[]; username: string }>>({});

  const localCameraRef = useRef<MediaStream | null>(null);
  const localScreenRef = useRef<MediaStream | null>(null);
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  
  // To avoid renegotiation loops
  const makingOffer = useRef<Record<string, boolean>>({});

  const ICE_SERVERS = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
  };

  const createPeer = (targetUserId: string, username: string) => {
    if (pcs.current[targetUserId]) return pcs.current[targetUserId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcs.current[targetUserId] = pc;
    makingOffer.current[targetUserId] = false;

    // Add existing local tracks
    if (localCameraRef.current) {
      localCameraRef.current.getTracks().forEach((t) => pc.addTrack(t, localCameraRef.current!));
    }
    if (localScreenRef.current) {
      localScreenRef.current.getTracks().forEach((t) => pc.addTrack(t, localScreenRef.current!));
    }

    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current[targetUserId] = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('webrtc:offer', {
          roomId,
          targetUserId,
          sdp: pc.localDescription,
          callerId: myUserId,
          callerUsername: myUsername,
        });
      } catch (err) {
        console.error('Negotiation error', err);
      } finally {
        makingOffer.current[targetUserId] = false;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socket && myUserId) {
        socket.emit('webrtc:ice-candidate', {
          targetUserId,
          candidate: e.candidate,
          senderId: myUserId,
        });
      }
    };

    pc.ontrack = (e) => {
      setRemoteStreams((prev) => {
        const userObj = prev[targetUserId] || { username, streams: [] };
        const existing = [...userObj.streams];

        if (e.track.kind === 'video') {
          // Every video track gets its own player
          const newStream = new MediaStream([e.track]);
          // Include any audio tracks that came in the same original stream
          if (e.streams[0]) {
            e.streams[0].getAudioTracks().forEach(a => newStream.addTrack(a));
          }
          return {
            ...prev,
            [targetUserId]: { username, streams: [...existing, newStream] }
          };
        } else if (e.track.kind === 'audio') {
          // If audio arrives separately, attach it to the first available stream or create a hidden one
          if (existing.length > 0) {
            if (!existing[0].getAudioTracks().find(t => t.id === e.track.id)) {
              existing[0].addTrack(e.track);
            }
            return prev;
          } else {
            const newStream = new MediaStream([e.track]);
            return {
              ...prev,
              [targetUserId]: { username, streams: [newStream] }
            };
          }
        }
        return prev;
      });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        cleanupPeer(targetUserId);
      }
    };

    return pc;
  };

  const cleanupPeer = (userId: string) => {
    if (pcs.current[userId]) {
      pcs.current[userId].close();
      delete pcs.current[userId];
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const joinCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localCameraRef.current = stream;
      setInCall(true);
      setIsCameraOn(true);
      setIsMicOn(true);

      // Connect to everyone currently in the room
      localUsers.forEach((user) => {
        if (user.id !== myUserId) {
          createPeer(user.id, user.name);
        }
      });
    } catch (err) {
      console.error('Failed to get camera/mic', err);
    }
  };

  const leaveCall = () => {
    if (localCameraRef.current) {
      localCameraRef.current.getTracks().forEach((t) => t.stop());
      localCameraRef.current = null;
    }
    if (localScreenRef.current) {
      localScreenRef.current.getTracks().forEach((t) => t.stop());
      localScreenRef.current = null;
    }
    setInCall(false);
    setIsCameraOn(false);
    setIsMicOn(false);
    setIsSharingScreen(false);

    Object.keys(pcs.current).forEach(cleanupPeer);
    socket?.emit('webrtc:leave-call', { roomId, userId: myUserId });
  };

  const toggleCamera = () => {
    if (localCameraRef.current) {
      const videoTrack = localCameraRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localCameraRef.current) {
      const audioTrack = localCameraRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localScreenRef.current = stream;
      setIsSharingScreen(true);

      stream.getVideoTracks()[0].onended = () => stopScreenShare();

      // Add the screen track to all existing peers to trigger renegotiation
      Object.values(pcs.current).forEach((pc) => {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      });
    } catch (err) {
      console.error('Failed to share screen', err);
    }
  };

  const stopScreenShare = () => {
    if (localScreenRef.current) {
      const tracks = localScreenRef.current.getTracks();
      tracks.forEach((t) => t.stop());

      // Remove the screen tracks from all peers
      Object.values(pcs.current).forEach((pc) => {
        const senders = pc.getSenders();
        tracks.forEach((track) => {
          const sender = senders.find((s) => s.track?.id === track.id);
          if (sender) pc.removeTrack(sender);
        });
      });

      localScreenRef.current = null;
      setIsSharingScreen(false);
    }
  };

  // Handle incoming signaling
  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on('webrtc:offer', async ({ roomId: rId, sdp, callerId, callerUsername }) => {
      if (rId !== roomId) return;
      const pc = createPeer(callerId, callerUsername);
      
      const offerCollision = makingOffer.current[callerId] && sdp.type === 'offer';
      if (offerCollision) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          targetUserId: callerId,
          sdp: pc.localDescription,
          answererId: myUserId,
        });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('webrtc:answer', async ({ sdp, answererId }) => {
      const pc = pcs.current[answererId];
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          console.error('Error handling answer:', err);
        }
      }
    });

    socket.on('webrtc:ice-candidate', async ({ candidate, senderId }) => {
      const pc = pcs.current[senderId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    });

    socket.on('webrtc:leave-call', ({ userId }) => {
      cleanupPeer(userId);
    });

    socket.on('room:left', ({ userId }) => {
      cleanupPeer(userId);
    });

    return () => {
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      socket.off('webrtc:leave-call');
      socket.off('room:left');
    };
  }, [socket, roomId, myUserId, myUsername]);

  return {
    inCall,
    isCameraOn,
    isMicOn,
    isSharingScreen,
    localCameraStream: localCameraRef.current,
    localScreenStream: localScreenRef.current,
    remoteStreams,
    joinCall,
    leaveCall,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
  };
}
