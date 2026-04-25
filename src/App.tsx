/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Play, 
  Send, 
  User as UserIcon, 
  Tv, 
  Link as LinkIcon, 
  MessageSquare,
  Users,
  LogOut,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User, ChatMessage, SyncEvent } from './types';

const SOCKET_URL = window.location.origin;

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isMissionStarted, setIsMissionStarted] = useState(false); // To fix Autoplay
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [showAgentList, setShowAgentList] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [targetTime, setTargetTime] = useState<number | null>(null); // To store sync time while loading

  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
              if (event.currentTime) setTargetTime(event.currentTime);
            }
            break;
        }

        setTimeout(() => { isRemoteUpdate.current = false; }, 200);
      });

      socket.on('user-joined', (user: User) => {
        setConnectedUsers(prev => [...prev.filter(u => u.id !== user.id), user]);
      });

      return () => { socket.disconnect(); };
    }
  }, [isJoined, roomId, username]);

  // CRITICAL: This ensures the video jumps to the right spot only AFTER it loads
  const handleLoadedMetadata = () => {
    if (targetTime !== null && videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setTargetTime(null);
    }
  };

  const requestForceSync = () => {
    socketRef.current?.emit('request-sync', { roomId });
  };

  const handlePlay = () => {
    if (isRemoteUpdate.current) return;
    socketRef.current?.emit('sync-video', {
      roomId, action: 'play', currentTime: videoRef.current?.currentTime
    });
  };

  const handlePause = () => {
    if (isRemoteUpdate.current) return;
    socketRef.current?.emit('sync-video', {
      roomId, action: 'pause', currentTime: videoRef.current?.currentTime
    });
  };

  const handleSeeked = () => {
    if (isRemoteUpdate.current) return;
    socketRef.current?.emit('sync-video', {
      roomId, action: 'seek', currentTime: videoRef.current?.currentTime
    });
  };

  const handleUrlSubmit = (e: FormEvent) => {
    e.preventDefault();
    const urlInput = (e.currentTarget as HTMLFormElement).elements.namedItem('url') as HTMLInputElement;
    const newUrl = urlInput.value;
    if (newUrl) {
      setVideoUrl(newUrl);
      socketRef.current?.emit('sync-video', { roomId, action: 'url-change', videoUrl: newUrl });
      urlInput.value = '';
    }
  };

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg: ChatMessage = { id: Math.random().toString(), username, text: newMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    socketRef.current?.emit('chat-message', { roomId, ...msg });
    setNewMessage('');
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-morphism p-10 rounded-3xl relative z-10 cinematic-glow">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-brand rounded-full flex items-center justify-center mb-6 shadow-2xl border-4 border-black">
              <Tv className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl hero-text tracking-tighter bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent uppercase">Marvelus</h1>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setIsJoined(true); }} className="space-y-6">
            <input required type="text" placeholder="MISSION CHANNEL" className="w-full bg-black/60 border border-slate-800 rounded-xl py-4 px-6 focus:border-brand outline-none transition-all text-sm uppercase tracking-widest" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
            <input required type="text" placeholder="AGENT ALIAS" className="w-full bg-black/60 border border-slate-800 rounded-xl py-4 px-6 focus:border-brand outline-none transition-all text-sm uppercase tracking-widest" value={username} onChange={(e) => setUsername(e.target.value)} />
            <button type="submit" className="w-full marvel-gradient hover:scale-[1.02] text-white font-black py-5 rounded-xl shadow-2xl transition-all uppercase tracking-widest">Assemble Room</button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <div className="hidden lg:flex w-20 flex-col items-center py-8 bg-[#050505] border-r border-slate-900 space-y-8 z-50">
        <div className="w-12 h-12 bg-brand text-white rounded-xl flex items-center justify-center shadow-lg"><Tv className="w-6 h-6" /></div>
        <button onClick={() => setShowAgentList(!showAgentList)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showAgentList ? 'bg-brand text-white' : 'bg-slate-900 text-slate-400'}`}><Users className="w-5 h-5" /></button>
        <button onClick={() => setIsChatVisible(!isChatVisible)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isChatVisible ? 'bg-brand text-white' : 'bg-slate-900 text-slate-400'}`}><MessageSquare className="w-5 h-5" /></button>
        <div className="flex-1" />
        <button onClick={() => window.location.reload()} className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center hover:bg-red-600 transition-colors"><LogOut className="w-5 h-5" /></button>
      </div>

      {/* Main Mission Center */}
      <div className="flex-1 flex flex-col h-screen bg-black relative transition-all duration-500">
        <header className="p-4 flex items-center justify-between border-b border-slate-900 bg-black/80 backdrop-blur-md z-10">
          <div className="flex items-center space-x-6">
            <h2 className="text-xl hero-text tracking-tighter text-brand uppercase">CHANNEL: {roomId}</h2>
            <button onClick={requestForceSync} className="flex items-center text-[10px] text-brand uppercase font-black tracking-widest bg-brand/10 px-3 py-1.5 rounded-full border border-brand/30 hover:bg-brand/20 transition-all">
              <RefreshCw className="w-3 h-3 mr-2 animate-spin-slow" /> Force Sync Feed
            </button>
          </div>
          
          <form onSubmit={handleUrlSubmit} className="hidden sm:flex items-center space-x-2">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand" />
              <input name="url" type="text" placeholder="Cinematic Data Feed URL..." className="bg-black border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs w-72 focus:border-brand outline-none" />
            </div>
            <button className="bg-brand text-white p-2 rounded-lg"><Play className="w-4 h-4" /></button>
          </form>
        </header>

        {/* Video Player + Start Mission Overlay */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black/40 relative">
          <AnimatePresence>
            {videoUrl && !isMissionStarted && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black/95 flex flex-col items-center justify-center backdrop-blur-xl">
                <ShieldAlert size={64} className="text-brand mb-4 animate-pulse" />
                <h2 className="text-2xl font-black text-white mb-2 tracking-tighter uppercase">Incursion Detected</h2>
                <p className="text-slate-500 text-sm mb-8 tracking-widest uppercase">Click below to establish secure link</p>
                <button 
                  onClick={() => setIsMissionStarted(true)} 
                  className="marvel-gradient text-white px-10 py-4 rounded-full font-black hover:scale-105 transition-all shadow-[0_0_30px_rgba(226,54,54,0.4)] uppercase tracking-widest"
                >
                  Join Mission & Sync
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                controls={isMissionStarted}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeeked={handleSeeked}
                onLoadedMetadata={handleLoadedMetadata}
                autoPlay={false}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
                <Tv className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-xs font-bold tracking-widest uppercase">Awaiting Cinematic Signal...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comms Hub Sidebar */}
      <AnimatePresence>
        {isChatVisible && (
          <motion.div initial={{ width: 0 }} animate={{ width: 380 }} exit={{ width: 0 }} className="flex flex-col bg-[#080808] border-l border-slate-900 h-screen shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-900 flex justify-between bg-black">
              <h3 className="hero-text text-xs text-brand tracking-widest flex items-center"><MessageSquare className="w-4 h-4 mr-2" /> COMMS HUB</h3>
              <span className="text-[10px] text-slate-800 font-black tracking-widest">ENCRYPTED</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#050505] scrollbar-hide">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.username === username ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                    msg.username === 'System' ? 'text-brand italic text-center w-full text-[10px] opacity-60' :
                    msg.username === username ? 'bg-brand text-white border border-white/10' : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}>
                    {msg.username !== username && msg.username !== 'System' && <div className="text-[9px] font-black uppercase text-brand/80 mb-1">{msg.username}</div>}
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 bg-black border-t border-slate-900">
              <div className="relative">
                <input type="text" placeholder="BROADCAST TO AGENTS..." className="w-full bg-[#0a0a0a] border border-slate-800 rounded-xl py-3.5 px-4 pr-12 text-xs focus:border-brand outline-none transition-all" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-brand hover:text-white"><Send className="w-5 h-5" /></button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
