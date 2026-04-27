import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuthStore } from '../stores/authStore';

export function useScreenShare(roomId: string | undefined, localUsers: any[]) {
  const { socket } = useSocket();
  const currentUser = useAuthStore(s => s.user);
  
  const [isSharing, setIsSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, { stream: MediaStream, username: string }>>({});
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  const myUserId = currentUser?._id || socket?.id;
  const myUsername = currentUser?.username || 'Guest';

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const createPeerConnection = (targetUserId: string, username: string) => {
    if (peerConnectionsRef.current[targetUserId]) return peerConnectionsRef.current[targetUserId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetUserId] = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && socket && myUserId) {
        socket.emit('webrtc:ice-candidate', {
          targetUserId,
          candidate: e.candidate,
          senderId: myUserId
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: { stream, username }
      }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        cleanupPeerConnection(targetUserId);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
      });
    }

    return pc;
  };

  const cleanupPeerConnection = (userId: string) => {
    if (peerConnectionsRef.current[userId]) {
      peerConnectionsRef.current[userId].close();
      delete peerConnectionsRef.current[userId];
    }
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const startShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setIsSharing(true);

      // Stop sharing when user clicks "Stop Sharing" on browser UI
      stream.getVideoTracks()[0].onended = () => stopShare();

      // Offer to all current users
      localUsers.forEach(async (user) => {
        if (user.id === myUserId) return;
        const pc = createPeerConnection(user.id, user.name);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        socket?.emit('webrtc:offer', {
          roomId,
          targetUserId: user.id,
          sdp: pc.localDescription,
          callerId: myUserId,
          callerUsername: myUsername
        });
      });
    } catch (err) {
      console.error('Error sharing screen:', err);
      setIsSharing(false);
    }
  };

  const stopShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setIsSharing(false);
    socket?.emit('webrtc:stop-share', { roomId, userId: myUserId });
    
    // Close all PCs
    Object.keys(peerConnectionsRef.current).forEach(cleanupPeerConnection);
  };

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on('webrtc:offer', async ({ roomId: rId, sdp, callerId, callerUsername }) => {
      if (rId !== roomId) return;
      const pc = createPeerConnection(callerId, callerUsername);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('webrtc:answer', {
        targetUserId: callerId,
        sdp: pc.localDescription,
        answererId: myUserId
      });
    });

    socket.on('webrtc:answer', async ({ sdp, answererId }) => {
      const pc = peerConnectionsRef.current[answererId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    socket.on('webrtc:ice-candidate', async ({ candidate, senderId }) => {
      const pc = peerConnectionsRef.current[senderId];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('webrtc:stop-share', ({ userId }) => {
      cleanupPeerConnection(userId);
    });

    socket.on('room:left', ({ userId }) => {
      cleanupPeerConnection(userId);
    });

    return () => {
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      socket.off('webrtc:stop-share');
    };
  }, [socket, roomId, myUserId, myUsername]);

  return { isSharing, startShare, stopShare, remoteStreams };
}
