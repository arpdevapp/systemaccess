import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const RemoteAccessHost = () => {
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [connectionCode, setConnectionCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteClient, setRemoteClient] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('disconnected');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // Generate a random room ID
  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  useEffect(() => {
    const roomId = generateRoomId();
    setConnectionCode(roomId);
    
    // Connect to signaling server
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Register as host
    newSocket.emit('register', {
      clientId: `host-${roomId}`,
      clientType: 'host',
      roomId: roomId
    });

    // Listen for client joining
    newSocket.on('clientJoined', (data) => {
      if (data.clientType === 'client') {
        setRemoteClient(data);
        setStatus('client-connected');
        setError('');
      }
    });

    // Listen for client leaving
    newSocket.on('clientLeft', (data) => {
      setRemoteClient(null);
      setIsConnected(false);
      setStatus('client-disconnected');
      if (peer) {
        peer.destroy();
        setPeer(null);
      }
    });

    // Listen for WebRTC offers
    newSocket.on('offer', async (data) => {
      try {
        setStatus('establishing-connection');
        
        // Create peer connection
        const newPeer = new Peer({
          initiator: false,
          trickle: false,
          stream: localStreamRef.current
        });

        newPeer.on('signal', (signal) => {
          // Send answer back to client
          newSocket.emit('answer', {
            targetId: data.from,
            answer: signal,
            roomId: roomId
          });
        });

        newPeer.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        newPeer.on('connect', () => {
          setIsConnected(true);
          setStatus('connected');
          setError('');
        });

        newPeer.on('error', (err) => {
          setError(`WebRTC Error: ${err.message}`);
          setStatus('error');
        });

        // Set the offer
        newPeer.signal(data.offer);
        setPeer(newPeer);

      } catch (err) {
        setError(`Failed to establish connection: ${err.message}`);
        setStatus('error');
      }
    });

    // Listen for ICE candidates
    newSocket.on('iceCandidate', (data) => {
      if (peer) {
        peer.signal(data.candidate);
      }
    });

    return () => {
      newSocket.disconnect();
      if (peer) {
        peer.destroy();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startScreenShare = async () => {
    try {
      setStatus('starting-screen-share');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsScreenSharing(true);
      setStatus('screen-sharing');
      setError('');

      // If we have a peer, update their stream
      if (peer) {
        peer.replaceTrack(
          peer.streams[0].getVideoTracks()[0],
          stream.getVideoTracks()[0],
          peer.streams[0]
        );
      }

      // Handle stream ending
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        setStatus('screen-share-ended');
      };

    } catch (err) {
      setError(`Failed to start screen sharing: ${err.message}`);
      setStatus('error');
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setStatus('screen-share-stopped');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'client-connected': return '#2196F3';
      case 'establishing-connection': return '#FF9800';
      case 'error': return '#F44336';
      default: return '#757575';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'disconnected': return 'Waiting for client to connect...';
      case 'client-connected': return 'Client connected, waiting for WebRTC...';
      case 'establishing-connection': return 'Establishing secure connection...';
      case 'connected': return 'Connected! Client can now control your system';
      case 'screen-sharing': return 'Screen sharing active';
      case 'error': return 'Connection error occurred';
      default: return status;
    }
  };

  return (
    <div className="remote-access-host">
      <div className="host-header">
        <h2>🖥️ Host Mode - Screen Sharing</h2>
        <div className="status-indicator" style={{ backgroundColor: getStatusColor() }}>
          {getStatusText()}
        </div>
      </div>

      <div className="connection-info">
        <h3>Connection Code</h3>
        <div className="connection-code">
          <span className="code">{connectionCode}</span>
          <button 
            className="copy-btn"
            onClick={() => navigator.clipboard.writeText(connectionCode)}
          >
            📋 Copy
          </button>
        </div>
        <p>Share this code with the person who wants to connect to your system</p>
      </div>

      <div className="video-container">
        <div className="local-video">
          <h3>Your Screen</h3>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline
            className={isScreenSharing ? 'active' : 'inactive'}
          />
          {!isScreenSharing && (
            <div className="video-placeholder">
              <p>Click "Start Screen Share" to begin</p>
            </div>
          )}
        </div>

        <div className="remote-video">
          <h3>Remote Client</h3>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline
            className={isConnected ? 'active' : 'inactive'}
          />
          {!isConnected && (
            <div className="video-placeholder">
              <p>Waiting for client connection...</p>
            </div>
          )}
        </div>
      </div>

      <div className="controls">
        {!isScreenSharing ? (
          <button 
            className="control-btn primary"
            onClick={startScreenShare}
            disabled={status === 'disconnected'}
          >
            🖥️ Start Screen Share
          </button>
        ) : (
          <button 
            className="control-btn danger"
            onClick={stopScreenShare}
          >
            ⏹️ Stop Screen Share
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {remoteClient && (
        <div className="client-info">
          <h3>Connected Client</h3>
          <p><strong>ID:</strong> {remoteClient.clientId}</p>
          <p><strong>Status:</strong> {isConnected ? 'Active' : 'Connecting...'}</p>
        </div>
      )}
    </div>
  );
};

export default RemoteAccessHost;
