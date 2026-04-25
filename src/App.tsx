/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Play, 
  Pause, 
  Send, 
  User as UserIcon, 
  Tv, 
  Link as LinkIcon, 
  MessageSquare,
  Users,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User, ChatMessage, SyncEvent, SyncAction } from './types';

const SOCKET_URL = window.location.origin;

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [showAgentList, setShowAgentList] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isRemoteUpdate = useRef(false);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize Socket
  useEffect(() => {
    if (isJoined) {
      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join-room', { roomId, username });
      });

      socket.on('chat-message', (msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
      });

      socket.on('sync-video', (event: SyncEvent) => {
        if (!videoRef.current) return;

        isRemoteUpdate.current = true;
        
        switch (event.action) {
          case 'play':
            videoRef.current.play().catch(() => {});
            break;
          case 'pause':
            videoRef.current.pause();
            break;
          case 'seek':
            if (event.currentTime !== undefined) {
              videoRef.current.currentTime = event.currentTime;
            }
            break;
          case 'url-change':
            if (event.videoUrl) {
              setVideoUrl(event.videoUrl);
            }
            break;
        }

        // Reset the flag after a brief delay
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 100);
      });

      socket.on('user-joined', (user: User) => {
        setConnectedUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          username: 'System',
          text: `${user.username} joined the party!`,
          timestamp: Date.now()
        }]);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isJoined, roomId, username]);

  // Video Event Handlers
  const handlePlay = () => {
    if (isRemoteUpdate.current) return;
    socketRef.current?.emit('sync-video', {
      roomId,
      action: 'play',
      currentTime: videoRef.current?.currentTime
    });
  };

  const handlePause = () => {
    if (isRemoteUpdate.current) return;
    socketRef.current?.emit('sync-video', {
      roomId,
      action: 'pause',
      currentTime: videoRef.current?.currentTime
    });
  };

  const handleSeeked = () => {
    if (isRemoteUpdate.current) return;
    socketRef.current?.emit('sync-video', {
      roomId,
      action: 'seek',
      currentTime: videoRef.current?.currentTime
    });
  };

  const handleUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    const urlInput = (e.currentTarget as HTMLFormElement).elements.namedItem('url') as HTMLInputElement;
    const newUrl = urlInput.value;
    if (newUrl) {
      setVideoUrl(newUrl);
      socketRef.current?.emit('sync-video', {
        roomId,
        action: 'url-change',
        videoUrl: newUrl
      });
      urlInput.value = '';
    }
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msg: ChatMessage = {
      id: Math.random().toString(),
      username,
      text: newMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, msg]);
    socketRef.current?.emit('chat-message', { roomId, ...msg });
    setNewMessage('');
  };


  if (!isJoined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-sans text-slate-100 overflow-hidden relative">
        {/* Background Atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#e2363633,transparent_70%)]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-morphism p-10 rounded-3xl relative z-10 cinematic-glow"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-brand rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-brand/40 border-4 border-black ring-2 ring-brand/50">
              <Tv className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl hero-text tracking-tighter bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              MARVELUS
            </h1>
            <p className="text-slate-500 mt-2 text-sm font-medium uppercase tracking-[0.2em]">The Ultimate Watch Party</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setIsJoined(true); }} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-2 ml-1">Mission Channel</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input
                  required
                  type="text"
                  placeholder="e.g. AVENGERS-HQ"
                  className="w-full bg-black/60 border border-slate-800 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-sm font-medium"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-2 ml-1">Agent Alias</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                <input
                  required
                  type="text"
                  placeholder="Enter Alias"
                  className="w-full bg-black/60 border border-slate-800 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all text-sm font-medium"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full marvel-gradient hover:scale-[1.02] text-white font-black py-5 rounded-xl shadow-2xl shadow-brand/20 active:scale-95 transition-all mt-4 uppercase tracking-widest"
            >
              Assemble Room
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Sidebar (Hidden on mobile) */}
      <div className="hidden lg:flex w-20 flex-col items-center py-8 bg-[#050505] border-r border-slate-900 space-y-8 z-50">
        <div className="w-12 h-12 bg-brand text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
          <Tv className="w-6 h-6" />
        </div>
        <div className="flex-1 flex flex-col space-y-6">
          <div className="relative group">
            <button 
              onClick={() => setShowAgentList(!showAgentList)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                showAgentList ? 'bg-brand text-white' : 'bg-slate-900 text-slate-400 hover:bg-brand/20 hover:text-brand'
              }`}
            >
              <Users className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showAgentList && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 10 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute left-full top-0 ml-4 w-48 bg-[#0a0a0a] border border-slate-800 rounded-xl p-4 shadow-2xl z-50 glass-morphism"
                >
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-3 border-b border-slate-800 pb-2">Active Agents</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <div className="flex items-center space-x-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                      <span className="font-bold text-white">{username} (You)</span>
                    </div>
                    {connectedUsers.map(u => (
                      <div key={u.id} className="flex items-center space-x-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        <span className="text-slate-400">{u.username}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button 
            onClick={() => setIsChatVisible(!isChatVisible)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isChatVisible ? 'bg-brand text-white' : 'bg-slate-900 text-slate-400 hover:bg-brand/20 hover:text-brand'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
        <button 
          onClick={() => setIsJoined(false)}
          className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center hover:bg-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Video Area */}
      <div className={`flex-1 flex flex-col h-screen bg-black relative transition-all duration-500 ease-in-out`}>
        {/* Header */}
        <header className="p-4 flex items-center justify-between border-b border-slate-900 bg-black/80 backdrop-blur-md z-10">
          <div className="flex items-center space-x-6">
            <h2 className="text-xl hero-text tracking-tighter text-brand">
              CHANNEL: {roomId}
            </h2>
            <div className="flex items-center text-[10px] text-slate-500 uppercase font-black tracking-widest bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
              {connectedUsers.length + 1} AGENTS ACTIVE
            </div>
          </div>
          
          <form onSubmit={handleUrlSubmit} className="hidden sm:flex items-center space-x-2">
            <button 
              onClick={() => setIsChatVisible(!isChatVisible)}
              className="bg-slate-900 border border-slate-800 text-slate-400 p-2 rounded-lg transition-all hover:text-brand hover:border-brand/40 mr-2 flex items-center space-x-2 px-3"
              type="button"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">{isChatVisible ? 'Hide Hub' : 'Show Hub'}</span>
            </button>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand" />
              <input
                name="url"
                type="text"
                placeholder="Cinematic Data Feed URL..."
                className="bg-black border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs w-72 focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none transition-all"
              />
            </div>
            <button className="bg-brand text-white p-2 rounded-lg transition-colors hover:scale-105 active:scale-95">
              <Play className="w-4 h-4" />
            </button>
          </form>
        </header>

        {/* Video Player */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative group">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                controls
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-4 text-slate-500">
                <div className="w-20 h-20 border-2 border-dashed border-slate-800 rounded-full flex items-center justify-center">
                  <Play className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">No video loaded. Use the bar above.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      <AnimatePresence>
        {isChatVisible && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="w-full md:w-80 lg:w-96 flex flex-col bg-[#080808] border-l border-slate-900 h-screen shadow-2xl relative"
          >
            <div className="p-5 border-b border-slate-900 flex items-center justify-between bg-black">
              <h3 className="hero-text text-sm flex items-center space-x-3 text-brand tracking-widest">
                <MessageSquare className="w-4 h-4" />
                <span>COMMS HUB</span>
              </h3>
              <span className="text-[10px] uppercase tracking-widest text-[#444] font-black">ENCRYPTED</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-[#050505]">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col ${msg.username === username ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[90%] rounded-xl p-3 text-sm shadow-lg ${
                      msg.username === 'System' 
                        ? 'bg-brand/5 border border-brand/20 text-brand italic text-[10px] w-full text-center py-2' 
                        : msg.username === username 
                          ? 'bg-brand text-white font-medium border border-white/10' 
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                    }`}>
                      {msg.username !== username && msg.username !== 'System' && (
                        <div className="font-black text-[9px] uppercase tracking-[0.2em] mb-1.5 text-brand/80">
                          {msg.username}
                        </div>
                      )}
                      {msg.text}
                    </div>
                    {msg.username !== 'System' && (
                      <span className="text-[9px] text-slate-700 mt-1.5 px-2 font-bold uppercase tracking-tighter">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </motion.div>
                ))}
                <div ref={chatEndRef} />
              </AnimatePresence>
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-black border-t border-slate-900">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Broadcast to agents..."
                  className="w-full bg-[#0a0a0a] border border-slate-800 rounded-xl py-3.5 pl-4 pr-12 text-xs focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none transition-all placeholder:text-slate-700"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand hover:text-white transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
