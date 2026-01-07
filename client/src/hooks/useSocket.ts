import { useEffect } from 'react';
import { getSocket, disconnectSocket } from '../utils/socket';

export const useSocket = (eventName: string, handler: (...args: any[]) => void) => {
  useEffect(() => {
    const socket = getSocket();

    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
    };
  }, [eventName, handler]);
};

export const useSocketConnection = () => {
  useEffect(() => {
    getSocket();

    return () => {
      disconnectSocket();
    };
  }, []);
};

export default useSocket;








