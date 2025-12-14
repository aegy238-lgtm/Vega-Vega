
// ... existing imports ...
import React, { useState, useEffect, useRef, memo } from 'react';
import { ArrowLeft, Send, Heart, Share2, Gift as GiftIcon, Users, Crown, Mic, MicOff, Lock, Unlock, Settings, Image as ImageIcon, X, Info, Minimize2, LogOut, BadgeCheck, Loader2, Upload, Shield, Trophy, Bot, Volume2, VolumeX, ArrowDownCircle, Ban, Trash2, UserCog, UserMinus, Zap, BarChart3, Gamepad2, Clock, LayoutGrid, ListMusic, Plus, Check, Search, Circle, CheckCircle2, KeyRound, MoreVertical, Grid, Sprout, Car, RotateCw, Coins, History, Hand, Hexagon, Play, Pause, SkipForward, SkipBack, Music, Flag, HeartHandshake, Film, RefreshCw, FileText, Copy, AlertTriangle, Disc } from 'lucide-react';
import { Room, ChatMessage, Gift, Language, User, RoomSeat, WealthTransaction, StoreItem } from '../types';
import { GIFTS, STORE_ITEMS, ROOM_BACKGROUNDS, VIP_TIERS, ADMIN_ROLES } from '../constants';
import { listenToMessages, sendMessage, takeSeat, leaveSeat, updateRoomDetails, sendGiftTransaction, toggleSeatLock, toggleSeatMute, decrementViewerCount, listenToRoom, kickUserFromSeat, banUserFromRoom, unbanUserFromRoom, removeRoomAdmin, addRoomAdmin, searchUserByDisplayId, enterRoom, exitRoom, listenToRoomViewers, getUserProfile, changeRoomSeatCount, updateWalletForGame, distributeRoomWealth, getRoomWealthHistory, listenToDynamicGifts, listenToDynamicStoreItems, moveSeat, deleteRoom } from '../services/firebaseService';
import { joinVoiceChannel, leaveVoiceChannel, toggleMicMute, publishMicrophone, unpublishMicrophone, toggleAllRemoteAudio, listenToVolume, playMusicFile, stopMusic, setMusicVolume, seekMusic, pauseMusic, resumeMusic, getMusicTrack, preloadMicrophone } from '../services/agoraService';
import { generateAiHostResponse } from '../services/geminiService';
import { compressImage } from '../services/imageService';
import { saveSongToDB, getSongsFromDB, deleteSongFromDB, SavedSong } from '../services/musicStorageService';
import UserProfileModal from './UserProfileModal';
import RoomLeaderboard from './RoomLeaderboard';
import FullProfileView from './FullProfileView';
import { FruitWarGame } from './FruitWarGame';

const SeatItem = memo(({ seat, isSpeaking, isLoading, onClick, isHostSeat, isRoomAdmin, frameItem }: any) => {
    // INCREASED SIZE HERE: Host 80px (w-20), User 62px (custom)
    const sizeClass = isHostSeat ? "w-20 h-20" : "w-[62px] h-[62px]";
    
    // Determine frame styles
    const isImageFrame = !!frameItem?.svgaUrl;
    // If it's an image frame, remove border. If it's CSS frame, apply class. Fallback to basic border.
    const frameClass = isImageFrame 
        ? 'border-none' 
        : (frameItem?.previewClass || (seat.userId ? 'border border-white/20' : 'border-2 border-white/20 border-dashed'));

    const nameClass = seat.vipLevel === 8 ? "text-red-500 font-black drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" : "text-white/90 font-medium";
    const charLimit = isHostSeat ? 10 : 7;
    const shouldScroll = (seat.userName?.length || 0) > charLimit;

    return (
        <div className="flex flex-col items-center relative group w-full">
            <div onClick={() => onClick(seat.index, seat.userId)} className={`${sizeClass} rounded-full relative bg-black/40 backdrop-blur overflow-visible cursor-pointer transition transform active:scale-95 p-[3px] ${frameClass} flex items-center justify-center`}>
                {isLoading ? (
                    <Loader2 className={`${isHostSeat ? 'w-6 h-6' : 'w-5 h-5'} text-brand-500 animate-spin absolute inset-0 m-auto`} />
                ) : seat.userId ? (
                    <>
                        <img src={seat.userAvatar!} className="w-full h-full rounded-full object-cover relative z-10" loading="lazy" />
                        
                        {/* Image Frame Overlay */}
                        {isImageFrame && (
                            <img 
                                src={frameItem.svgaUrl} 
                                className="absolute -top-[25%] -left-[25%] w-[150%] h-[150%] max-w-none object-contain pointer-events-none z-20" 
                                alt="Frame"
                            />
                        )}

                        {!seat.isMuted && isSpeaking && (
                            <>
                                <div className={`absolute inset-0 rounded-full border-2 ${isHostSeat ? 'border-brand-400' : 'border-green-400'} opacity-60 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] z-0`}></div>
                                <div className={`absolute inset-0 rounded-full border-2 ${isHostSeat ? 'border-brand-300' : 'border-green-300'} opacity-40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] z-0`}></div>
                            </>
                        )}
                        {seat.isMuted && <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center z-20"><MicOff className={`${isHostSeat ? 'w-4 h-4' : 'w-3 h-3'} text-red-500`}/></div>}
                        {isHostSeat && <div className="absolute -top-3 -right-1 bg-yellow-500 p-1 rounded-full z-20"><Crown className="w-2.5 h-2.5 text-black" /></div>}
                        {!isHostSeat && isRoomAdmin && <div className="absolute -top-2 -right-1 bg-blue-600 p-1 rounded-full z-20 shadow-sm border border-blue-400"><Shield className="w-2 h-2 text-white fill-blue-300" /></div>}
                    </>
                ) : (
                    isHostSeat ? <div className="text-gray-400 text-[10px] text-center">Host</div> 
                    : (seat.isLocked ? <Lock className="w-3 h-3 text-red-400/70" /> : <span className="text-white/20 text-[9px] font-bold">{seat.index}</span>)
                )}
            </div>
            {seat.userId ? (
                <div className={`mt-1 ${isHostSeat ? 'w-[70px]' : 'w-[55px]'} bg-white/10 rounded-full px-2 py-0.5 overflow-hidden flex justify-center relative z-30`}>
                    <div className={`text-[${isHostSeat ? '9px' : '8px'}] ${nameClass} whitespace-nowrap ${shouldScroll ? 'animate-marquee inline-block' : 'truncate'}`}>
                        {seat.userName}
                    </div>
                </div>
            ) : (
                <div className="mt-1 text-[8px] text-white/50">{seat.isLocked ? 'Locked' : ''}</div>
            )}
            <div className="mt-0.5 bg-black/50 backdrop-blur px-2 py-0.5 rounded-full text-[8px] text-yellow-300 border border-yellow-500/30 flex items-center gap-1">
                {seat.giftCount > 0 && <><GiftIcon className="w-2 h-2" /> {seat.giftCount}</>}
            </div>
        </div>
    );
}, (prev, next) => {
    return (
        prev.seat.userId === next.seat.userId && 
        prev.seat.userAvatar === next.seat.userAvatar && 
        prev.seat.userName === next.seat.userName && 
        prev.seat.isMuted === next.seat.isMuted && 
        prev.seat.isLocked === next.seat.isLocked && 
        prev.seat.giftCount === next.seat.giftCount && 
        prev.seat.frameId === next.seat.frameId && 
        prev.seat.vipLevel === next.seat.vipLevel && 
        prev.isSpeaking === next.isSpeaking && 
        prev.isLoading === next.isLoading && 
        prev.isRoomAdmin === next.isRoomAdmin &&
        prev.frameItem === next.frameItem
    );
});

// ...

interface RoomViewProps {
  room: Room;
  currentUser: User;
  onAction: (action: 'minimize' | 'leave' | 'chat', data?: any) => void;
  language: Language;
}

export const RoomView: React.FC<RoomViewProps> = ({ room: initialRoom, currentUser, onAction, language }) => {
  // ... (keep existing state hooks) ...
  const [room, setRoom] = useState<Room>(initialRoom);
  
  // Dynamic Content State
  const [allGifts, setAllGifts] = useState<Gift[]>(GIFTS);
  const [storeItems, setStoreItems] = useState<StoreItem[]>(STORE_ITEMS); // Store Items including Frames
  const [dynamicEffects, setDynamicEffects] = useState<{id: string, url: string}[]>([]);

  // ... (Existing States) ...
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [giftTab, setGiftTab] = useState<'static' | 'animated'>('static');
  const [giftCategory, setGiftCategory] = useState<'standard' | 'cp'>('standard');
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [giftTargets, setGiftTargets] = useState<string[]>(['all']); 
  const [giftMultiplier, setGiftMultiplier] = useState<number>(1);
  const [isSendingGift, setIsSendingGift] = useState(false);

  const [activeAnimations, setActiveAnimations] = useState<{id: string, icon: string, class: string}[]>([]);
  const [joinNotification, setJoinNotification] = useState<{name: string, id: string} | null>(null);

  // ... (Rest of states) ...
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [showRoomInfoModal, setShowRoomInfoModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showGamesModal, setShowGamesModal] = useState(false);
  const [showFruitWar, setShowFruitWar] = useState(false);
  const [showMusicMiniPlayer, setShowMusicMiniPlayer] = useState(false);
  const [showMusicPlaylist, setShowMusicPlaylist] = useState(false);
  const [showImportView, setShowImportView] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<any[]>([]);
  const [importSearch, setImportSearch] = useState('');
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentSong, setCurrentSong] = useState<any | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolumeState] = useState(70);
  const [musicProgress, setMusicProgress] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [selectedUser, setSelectedUser] = useState<RoomSeat | null>(null);
  const [fullProfileUser, setFullProfileUser] = useState<User | null>(null);
  const [seatToConfirm, setSeatToConfirm] = useState<number | null>(null);
  const [loadingSeatIndex, setLoadingSeatIndex] = useState<number | null>(null);
  const loadingSeatRef = useRef<number | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<{id: number, left: number}[]>([]);
  const [editTitle, setEditTitle] = useState(room.title);
  const [editDesc, setEditDesc] = useState(room.description || '');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(room.isAiHost || false);
  const [settingsTab, setSettingsTab] = useState<'info' | 'background' | 'banned' | 'admins'>('info');
  const [bgType, setBgType] = useState<'inner' | 'outer'>('inner');
  const [showBanDurationModal, setShowBanDurationModal] = useState(false);
  const [userToBan, setUserToBan] = useState<string | null>(null);
  const [showLockSetupModal, setShowLockSetupModal] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [adminProfiles, setAdminProfiles] = useState<User[]>([]);
  const [bannedProfiles, setBannedProfiles] = useState<User[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [viewers, setViewers] = useState<User[]>([]);
  const viewersRef = useRef<User[]>([]);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const lastSpeakingUpdate = useRef<number>(0);
  const [distributeTargetId, setDistributeTargetId] = useState('');
  const [distributeAmount, setDistributeAmount] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [showWealthHistory, setShowWealthHistory] = useState(false);
  const [wealthHistory, setWealthHistory] = useState<WealthTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isProcessingSeat, setIsProcessingSeat] = useState(false); // Global seat action lock
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const joinTimestamp = useRef(Date.now());
  const hasSentJoinMsg = useRef(false);
  const currentUserRef = useRef(currentUser);

  // ... (keep seat handlers and effects as is) ...
  const seats = room.seats || [];
  const activeSeats = seats.filter(s => s.userId);
  const mySeat = seats.find(s => s.userId === currentUser.id);

  // ... (keep rest of logic) ...
  const handleSeatClick = async (index: number, userId: string | null) => {
      // ... (logic for taking seat) ...
      if (isProcessingSeat) return; // Prevent concurrent actions

      if (userId) {
          // Open profile
          const seat = seats[index];
          setSelectedUser(seat);
      } else {
          // Empty Seat Logic
          if (mySeat) {
              // User is ALREADY on a seat, try to MOVE
              const isTargetLocked = seats[index].isLocked;
              const isHost = room.hostId === currentUser.id;
              const isAdmin = room.admins?.includes(currentUser.uid || '');
              
              if (isTargetLocked && !isHost && !isAdmin) {
                  alert(language === 'ar' ? 'المقعد مقفل' : 'Seat is locked');
                  return;
              }

              setIsProcessingSeat(true);
              // --- OPTIMISTIC UI UPDATE: Move Instantly ---
              const updatedSeats = [...seats];
              // Clear old seat
              updatedSeats[mySeat.index] = { ...mySeat, userId: null, userName: null, userAvatar: null, frameId: null, giftCount: 0, vipLevel: 0 };
              // Fill new seat
              updatedSeats[index] = { ...seats[index], userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatar, frameId: currentUser.equippedFrame, vipLevel: currentUser.vipLevel };
              
              setRoom(prev => ({ ...prev, seats: updatedSeats })); // Update Local State Immediately

              // Background Server Call
              try {
                  if (currentUser.uid) {
                      await moveSeat(room.id, mySeat.index, index, currentUser);
                  }
              } catch (e: any) {
                  console.error(e);
              } finally {
                  setIsProcessingSeat(false);
              }
              return;
          }
          
          // User is NOT on a seat, try to TAKE
          const isSeatLocked = seats[index].isLocked;
          const isHost = room.hostId === currentUser.id;
          const isAdmin = room.admins?.includes(currentUser.uid || '');
          
          if (isSeatLocked && !isHost && !isAdmin) {
              alert(language === 'ar' ? 'المقعد مقفل' : 'Seat is locked');
              return;
          }

          setIsProcessingSeat(true);

          // --- OPTIMISTIC UI UPDATE: Take Seat Instantly ---
          const updatedSeats = [...seats];
          updatedSeats[index] = { 
              ...seats[index], 
              userId: currentUser.id, 
              userName: currentUser.name, 
              userAvatar: currentUser.avatar, 
              frameId: currentUser.equippedFrame, 
              vipLevel: currentUser.vipLevel 
          };
          setRoom(prev => ({ ...prev, seats: updatedSeats })); // Instant Update

          // Background Server Call
          try {
              if (currentUser.uid) {
                  await takeSeat(room.id, index, currentUser);
                  // Join Voice Channel & Unmute by default
                  await joinVoiceChannel(room.id, currentUser.uid);
                  await publishMicrophone(true); 
              }
          } catch (e: any) {
              console.error(e);
              alert(language === 'ar' ? 'فشل صعود المايك' : 'Failed to take seat');
          } finally {
              setIsProcessingSeat(false);
          }
      }
  };

  // ... (keep handleMicToggle, handleSpeakerToggle, handleConfirmExit, etc.) ...
  const handleMicToggle = async () => {
      // Optimistic Mic Toggle
      if (mySeat) {
          const updatedSeats = [...seats];
          updatedSeats[mySeat.index] = { ...mySeat, isMuted: !mySeat.isMuted };
          setRoom(prev => ({ ...prev, seats: updatedSeats })); // Instant UI Update
          
          // Hardware Mute
          await toggleMicMute(!mySeat.isMuted); 
          // Server Update
          await toggleSeatMute(room.id, mySeat.index, !mySeat.isMuted);
      }
  };

  const handleSpeakerToggle = () => {
      const newState = !isSpeakerMuted;
      setIsSpeakerMuted(newState);
      toggleAllRemoteAudio(newState); // Actual Agora Mute
  };

  const handleConfirmExit = async () => {
      try {
          if (mySeat) {
              await leaveSeat(room.id, currentUser);
              await toggleMicMute(true);
              await leaveVoiceChannel();
          }
          if (room.hostId === currentUser.id) {
              await deleteRoom(room.id);
          } else {
              if (currentUser.uid) {
                  await exitRoom(room.id, currentUser.uid);
              }
          }
          onAction('leave');
      } catch (e) {
          console.error("Exit failed", e);
          onAction('leave');
      }
      setShowExitModal(false);
  };

  const handleSaveSettings = async () => {
      if (!room.id) return;
      try {
          await updateRoomDetails(room.id, {
              title: editTitle,
              description: editDesc,
              isLocked: !!newRoomPassword,
              password: newRoomPassword,
          });
          alert(language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings Saved');
          setShowRoomSettings(false);
      } catch (e) {
          alert('Error saving settings');
      }
  };

  const handleRoomBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const base64 = await compressImage(file, 720, 0.5); 
              if (base64.length > 950000) throw new Error("Image still too large after compression");
              setRoom(prev => ({ ...prev, backgroundImage: base64, backgroundType: 'image' }));
              await updateRoomDetails(room.id, { backgroundImage: base64, backgroundType: 'image' });
          } catch (e: any) {
              console.error("Failed to update background", e);
              alert(language === 'ar' ? 'فشل تحديث الخلفية: الصورة كبيرة جداً' : 'Failed to update background: Image too large');
          }
      }
  };

  const handleSendMessage = async () => {
      if (!inputValue.trim() || !currentUser.uid) return;
      const text = inputValue.trim();
      setInputValue(''); 
      const newMessage: ChatMessage = {
          id: Date.now().toString(),
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          text: text,
          timestamp: Date.now(),
          frameId: currentUser.equippedFrame,
          bubbleId: currentUser.equippedBubble,
          vipLevel: currentUser.vipLevel,
          adminRole: currentUser.adminRole
      };
      try {
          await sendMessage(room.id, newMessage);
      } catch (e) {
          console.error("Failed to send message", e);
      }
  };

  const triggerFloatingHeart = () => {
      const id = Date.now();
      const left = Math.random() * 80 + 10;
      setFloatingHearts(prev => [...prev, { id, left }]);
      setTimeout(() => {
          setFloatingHearts(prev => prev.filter(h => h.id !== id));
      }, 4000);
  };

  useEffect(() => {
     if (!room || !room.id) return;
     joinTimestamp.current = Date.now();
     const unsubscribe = listenToMessages(room.id, (realTimeMsgs) => {
         const displayMessages = realTimeMsgs.filter(msg => msg.timestamp >= joinTimestamp.current && !msg.isJoin);
         setMessages(displayMessages);
         const latestMsg = realTimeMsgs[realTimeMsgs.length - 1];
         const now = Date.now();
         if (latestMsg && (now - latestMsg.timestamp < 3000)) {
             if (latestMsg.isJoin && (!joinNotification || joinNotification.id !== latestMsg.id)) { setJoinNotification({ name: latestMsg.userName, id: latestMsg.id }); setTimeout(() => setJoinNotification(null), 3000); }
             if (latestMsg.isGift) {
                 if (latestMsg.svgaUrl) {
                     playDynamicEffect(latestMsg.svgaUrl);
                 } else if (latestMsg.giftType === 'animated' && latestMsg.giftIcon) {
                     triggerAnimation(latestMsg.giftIcon, latestMsg.text.includes('Rocket') ? 'animate-fly-up' : 'animate-bounce-in');
                 }
             }
         }
     });
     return () => { if (unsubscribe) unsubscribe(); };
  }, [room?.id]);

  const executeSendGift = async () => {
    if (!selectedGift) { alert(t('selectGift')); return; }
    if (isSendingGift) return;
    if (giftTargets.length === 0) { alert(t('selectTarget')); return; }
    if (!currentUser.uid || currentUser.uid === 'guest') { alert("Please login first"); return; }
    const multiplier = giftMultiplier;
    const targets = giftTargets.includes('all') ? activeSeats : activeSeats.filter(s => s.userId && giftTargets.includes(s.userId));
    if (targets.length === 0 && !giftTargets.includes('all')) { alert("Selected users are no longer on mic"); return; }
    const totalCost = selectedGift.cost * multiplier * (giftTargets.includes('all') ? activeSeats.length : targets.length);
    const userBalance = currentUser.wallet?.diamonds || 0;
    if (userBalance < totalCost) { alert(t('noFunds')); return; }
    
    setIsSendingGift(true);

    try {
        setShowGiftPanel(false);
        let targetName = ''; 
        if (giftTargets.includes('all')) targetName = t('everyone'); 
        else if (targets.length === 1) targetName = targets[0].userName || 'User'; 
        else targetName = `${targets.length} Users`;
        
        const giftMsg: ChatMessage = { 
            id: 'optimistic_' + Date.now().toString(), 
            userId: currentUser.id, 
            userName: currentUser.name, 
            userAvatar: currentUser.avatar || 'https://picsum.photos/200', 
            text: `Sent ${selectedGift.name} x${multiplier} to ${targetName} 🎁`, 
            isGift: true, 
            giftType: selectedGift.type, 
            giftIcon: selectedGift.icon, 
            svgaUrl: selectedGift.svgaUrl, 
            timestamp: Date.now(), 
            frameId: currentUser.equippedFrame || null, 
            bubbleId: currentUser.equippedBubble || null, 
            vipLevel: currentUser.vipLevel || 0, 
            adminRole: currentUser.adminRole || null 
        };
        setMessages(prev => [giftMsg, ...prev]); 
        
        if (selectedGift.svgaUrl) {
            playDynamicEffect(selectedGift.svgaUrl);
        } else if (selectedGift.type === 'animated') {
            triggerAnimation(selectedGift.icon, selectedGift.animationClass); 
        } else {
            triggerFloatingHeart();
        }

        sendMessage(room.id, { ...giftMsg, id: Date.now().toString() }); 
        const promises = targets.map(seat => sendGiftTransaction(room.id, currentUser.uid!, seat.index, selectedGift.cost * multiplier, selectedGift.id));
        await Promise.all(promises);
        
    } catch (e: any) { 
        const msg = typeof e === 'string' ? e : (e.message || ''); 
        if (msg.includes("Insufficient funds")) alert(t('noFunds')); 
        else console.error(e);
    } finally { 
        setIsSendingGift(false); 
    }
  };

  const triggerAnimation = (icon: string, animationClass: string = '') => {
      const id = Date.now().toString() + Math.random().toString();
      setActiveAnimations(prev => [...prev, { id, icon, class: animationClass }]);
      setTimeout(() => {
          setActiveAnimations(prev => prev.filter(a => a.id !== id));
      }, 3000);
  };

  const handleShareRoom = () => {
      const shareText = `Join me in room ${room.title} (ID: ${room.displayId}) on Flex Fun!`;
      if (navigator.clipboard) {
          navigator.clipboard.writeText(shareText);
          alert(t('copied'));
      }
      setShowOptionsMenu(false);
  };

  const handleClearChat = () => {
      setMessages([]);
      setShowOptionsMenu(false);
  };

  useEffect(() => {
      const unsubGifts = listenToDynamicGifts((dynamicGifts) => {
          setAllGifts([...GIFTS, ...dynamicGifts]);
      });
      const unsubStore = listenToDynamicStoreItems((dynamicItems) => {
          setStoreItems([...STORE_ITEMS, ...dynamicItems]);
      });
      return () => {
          unsubGifts();
          unsubStore();
      };
  }, []);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const playDynamicEffect = (url: string) => {
      const id = Date.now().toString() + Math.random();
      setDynamicEffects(prev => [...prev, { id, url }]);
      setTimeout(() => {
          setDynamicEffects(prev => prev.filter(e => e.id !== id));
      }, 5000); 
  };

  const t = (key: string) => {
      const dict: Record<string, { ar: string, en: string }> = {
          placeholder: { ar: 'اكتب رسالة...', en: 'Type a message...' },
          pinned: { ar: 'أهلاً بك في فليكس فن! يرجى الالتزام بالاحترام المتبادل.', en: 'Welcome to Flex Fun!' },
          roomDesc: { ar: 'وصف الغرفة / القوانين', en: 'Room Rules / Description' },
          gift: { ar: 'إهداء', en: 'Send Gift' },
          send: { ar: 'إرسال', en: 'Send' },
          selectGift: { ar: 'اختر هدية', en: 'Select a gift' },
          selectTarget: { ar: 'اختر مستلم الهدية', en: 'Select gift recipient' },
          noFunds: { ar: 'رصيد غير كاف', en: 'Insufficient funds' },
          everyone: { ar: 'الجميع', en: 'Everyone' },
          standard: { ar: 'عادي', en: 'Standard' },
          cp: { ar: 'CP', en: 'CP' },
          cup: { ar: 'الكأس', en: 'Cup' },
          onMic: { ar: 'على المايك', en: 'On Mic' },
          settings: { ar: 'الإعدادات', en: 'Settings' },
          share: { ar: 'مشاركة', en: 'Share' },
          minimize: { ar: 'تصغير', en: 'Minimize' },
          leave: { ar: 'مغادرة', en: 'Leave' },
          report: { ar: 'إبلاغ', en: 'Report' },
          clearChat: { ar: 'مسح الشات', en: 'Clear Chat' },
          menu: { ar: 'القائمة', en: 'Menu' },
          copied: { ar: 'تم النسخ!', en: 'Copied!' },
          roomSettings: { ar: 'إعدادات الغرفة', en: 'Room Settings' },
          music: { ar: 'موسيقى', en: 'Music' },
          games: { ar: 'ألعاب', en: 'Games' },
          title: { ar: 'عنوان الغرفة', en: 'Room Title' },
          desc: { ar: 'الوصف', en: 'Description' },
          pass: { ar: 'كلمة المرور (اختياري للقفل)', en: 'Password (Optional to lock)' },
          save: { ar: 'حفظ', en: 'Save' },
          uploadBg: { ar: 'تغيير الخلفية', en: 'Change Background' },
          exitConfirm: { ar: 'هل أنت متأكد من الخروج؟', en: 'Are you sure you want to exit?' },
          closeRoomConfirm: { ar: 'أنت المضيف. الخروج سيؤدي إلى إغلاق الغرفة وحذفها. هل أنت متأكد؟', en: 'You are the host. Exiting will CLOSE and DELETE the room. Are you sure?' },
          confirm: { ar: 'تأكيد', en: 'Confirm' },
          cancel: { ar: 'إلغاء', en: 'Cancel' }
      };
      return dict[key]?.[language] || key;
  };

  const getBubbleClass = (id?: string | null) => { 
      if (!id) return 'bg-white/10 text-white rounded-2xl'; 
      const item = storeItems.find(i => i.id === id); 
      return item?.previewClass ? `${item.previewClass} rounded-2xl` : 'bg-white/10 text-white rounded-2xl'; 
  };
  
  const getChatFrameClass = (id?: string | null) => {
      if (!id) return 'border border-white/20';
      const item = storeItems.find(i => i.id === id);
      return item?.previewClass || 'border border-white/20';
  };

  const filteredGifts = allGifts.filter(g => {
      if (giftCategory === 'cp') return g.category === 'cp';
      return g.type === giftTab && g.category !== 'cp';
  });

  return (
    <div className="relative h-[100dvh] w-full bg-black flex flex-col overflow-hidden">
      
      {/* FULL SCREEN BACKGROUND */}
      <div className="absolute inset-0 z-0 bg-gray-900 overflow-hidden">
        {room.backgroundType === 'video' ? (
            <video src={room.backgroundImage} autoPlay loop muted playsInline className="w-full h-full object-cover object-center transition-opacity duration-700" />
        ) : (
            <img src={room.backgroundImage || room.thumbnail} className="w-full h-full object-cover object-center transition-opacity duration-700" alt="Room Background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 z-0 pointer-events-none"></div>
      </div>

      {/* STANDARD ANIMATIONS OVERLAY */}
      {activeAnimations.map(anim => (
          <div key={anim.id} className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
              <div className={`text-9xl filter drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] ${anim.class}`}>
                  {anim.icon}
              </div>
          </div>
      ))}

      {/* DYNAMIC SVGA EFFECTS OVERLAY */}
      {dynamicEffects.map(effect => (
          <div key={effect.id} className="absolute inset-0 z-[110] flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-500">
              <img src={effect.url} className="max-w-full max-h-full object-contain" alt="Effect" />
          </div>
      ))}

      {/* Header Bar... */}
      <div className="relative z-50 pt-safe-top px-3 pb-2 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent w-full shrink-0 h-[60px]">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <div onClick={() => setShowRoomInfoModal(true)} className="flex items-center gap-2 bg-black/30 backdrop-blur px-2 py-1 rounded-xl border border-white/10 min-w-0 max-w-full cursor-pointer hover:bg-black/40 transition active:scale-95">
                <img src={room.thumbnail} className="w-8 h-8 rounded-lg object-cover" />
                <div className="text-white drop-shadow-md pr-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1">
                        <h2 className="font-bold text-xs truncate leading-tight">{room.title}</h2>
                        {room.isActivities && <Gamepad2 className="w-3 h-3 text-red-500 fill-white" />}
                        {room.isLocked && <Lock className="w-3 h-3 text-white/70" />}
                    </div>
                    <div className="text-[9px] text-gray-200 truncate">ID: {room.displayId || room.id.slice(-6)}</div>
                </div>
            </div>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
            {/* Minimize Button */}
            <button 
                onClick={() => onAction('minimize')} 
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 backdrop-blur border border-white/5 text-white shadow-sm"
                title="تصغير"
            >
                <Minimize2 className="w-4 h-4" />
            </button>
            
            {/* User List */}
            <button onClick={() => setShowUserList(true)} className="bg-white/10 backdrop-blur px-2 py-1.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1 border border-white/5">
                <Users className="w-3 h-3" /> {viewers.length}
            </button>
            
            {/* Exit (Logout of Room) */}
            <button 
                onClick={() => setShowExitModal(true)} 
                className="p-2 bg-red-500/20 rounded-full hover:bg-red-500/40 backdrop-blur border border-red-500/30 text-red-400 hover:text-white shadow-sm transition-all"
                title="خروج"
            >
                <LogOut className="w-4 h-4 rtl:rotate-180" />
            </button>
        </div>
      </div>

      <button onClick={() => setShowLeaderboard(true)} className="absolute top-[65px] z-40 rtl:right-3 ltr:left-3 bg-yellow-500/20 backdrop-blur px-2 py-1.5 rounded-full text-[10px] font-black text-yellow-400 border border-yellow-500/50 flex gap-1 shadow-lg"><Trophy className="w-3 h-3"/> {t('cup')}</button>

      {/* SEATS GRID */}
      <div className="relative z-10 w-full px-2 pt-1 pb-1 shrink-0 flex flex-col items-center">
          <div className="flex justify-center mb-2 shrink-0">
             {seats.slice(0, 1).map((seat) => (
                 <SeatItem 
                    key={seat.index} 
                    seat={seat} 
                    isSpeaking={seat.userId && speakingUsers.has(seat.userId) || false}
                    isLoading={loadingSeatIndex === seat.index}
                    onClick={handleSeatClick}
                    isHostSeat={true}
                    isRoomAdmin={room.admins?.includes(seat.userId || '')}
                    frameItem={storeItems.find(i => i.id === seat.frameId)}
                 />
             ))}
          </div>
          <div className="grid grid-cols-5 gap-y-5 gap-x-3 justify-items-center w-full max-w-sm shrink-0">
             {seats.slice(1).map((seat) => (
                 <SeatItem 
                    key={seat.index} 
                    seat={seat} 
                    isSpeaking={seat.userId && speakingUsers.has(seat.userId) || false}
                    isLoading={loadingSeatIndex === seat.index}
                    onClick={handleSeatClick}
                    isRoomAdmin={room.admins?.includes(seat.userId || '')}
                    frameItem={storeItems.find(i => i.id === seat.frameId)}
                 />
             ))}
          </div>
          <div className="mt-2 w-full max-w-sm p-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-2 shrink-0">
              <div className="flex items-center gap-2"><div className="p-1 bg-brand-500/20 rounded-full text-brand-400 border border-brand-500/30"><BarChart3 className="w-3 h-3" /></div><span className="text-[10px] font-bold text-white/90">{activeSeats.length} {t('onMic')}</span></div>
              <div className="flex -space-x-1.5 rtl:space-x-reverse">{activeSeats.slice(0, 3).map((seat) => (<img key={seat.index} src={seat.userAvatar!} className="w-6 h-6 rounded-full border border-gray-900 object-cover" />))}{activeSeats.length > 3 && (<div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-900 flex items-center justify-center text-[8px] font-bold text-white">+{activeSeats.length - 3}</div>)}</div>
          </div>
      </div>

      <div className="relative z-20 flex-1 flex flex-col min-h-0 bg-gradient-to-t from-black via-black/80 to-transparent w-full">
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto px-4 space-y-2 scrollbar-hide pb-2 mask-image-gradient relative w-full">
              {messages.map((msg) => {
                  const isOfficial = msg.userId === 'OFFECAL' || (msg.userId === room.hostId && room.hostId === 'OFFECAL');
                  const isAi = msg.userId === 'AI_HOST';
                  const isYellowMsg = msg.text.startsWith('🎉 تهانينا');

                  if (msg.isGift) {
                      return (
                          <div key={msg.id} className="flex justify-center my-2 animate-pulse">
                              <div className={`bg-gradient-to-r ${msg.giftType === 'animated' ? 'from-purple-600/80 to-pink-600/80 border-purple-400' : 'from-yellow-600/60 to-orange-600/60 border-yellow-500/50'} text-white text-xs px-4 py-1.5 rounded-full border shadow-lg backdrop-blur font-bold flex items-center gap-2`}>
                                  <GiftIcon className="w-3 h-3 text-white" />
                                  <span className="text-yellow-200">{msg.userName}</span>
                                  <span>{msg.text.replace(/Sent .* to .* x1/, 'sent a gift')}</span>
                                  {(msg.giftIcon && !msg.svgaUrl) && <span>{msg.giftIcon}</span>} 
                                  {msg.svgaUrl && <img src={msg.svgaUrl} className="w-6 h-6 object-contain" />}
                              </div>
                          </div>
                      );
                  }
                  
                  const bubbleClass = getBubbleClass(msg.bubbleId);
                  
                  return (
                      <div key={msg.id} className="flex items-start gap-2 animate-in slide-in-from-bottom-2">
                          <div className={`relative w-8 h-8 shrink-0 p-[2px] rounded-full ${isAi ? 'border-2 border-brand-400 shadow-lg' : getChatFrameClass(msg.frameId)}`}>
                              {msg.userAvatar ? <img src={msg.userAvatar} className="w-full h-full rounded-full object-cover" /> : <div className="w-full h-full bg-gray-600 rounded-full"></div>}
                              {isOfficial && <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[1px]"><BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-100" /></div>}
                              {isAi && <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-[2px]"><Bot className="w-3 h-3 text-brand-400" /></div>}
                          </div>
                          <div className="flex flex-col items-start max-w-[80%]">
                              <div className="flex items-center gap-1 mb-0.5 px-1 flex-wrap">
                                   {(msg.vipLevel || 0) > 0 && <span className="bg-gradient-to-r from-gold-400 to-orange-500 text-black text-[8px] font-black px-1 rounded">V{msg.vipLevel}</span>}
                                   {msg.adminRole && ADMIN_ROLES[msg.adminRole] && (<span className={`text-[8px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${ADMIN_ROLES[msg.adminRole].class}`}><Shield className="w-2 h-2" /> {ADMIN_ROLES[msg.adminRole].name[language]}</span>)}
                                   <span className={`text-[10px] font-bold flex items-center gap-1 text-white`}>{msg.userName}{isOfficial && <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-100 inline" />}{isAi && <span className="text-[8px] bg-brand-600 text-white px-1 rounded">BOT</span>}</span>
                              </div>
                              <div className={`px-3 py-1.5 text-xs leading-relaxed text-white shadow-sm break-words border border-white/5 backdrop-blur-md ${bubbleClass} rounded-tr-none ${isYellowMsg ? 'text-yellow-300 font-bold border-yellow-500/50 bg-yellow-900/20' : ''}`}>
                                  {msg.text}
                              </div>
                          </div>
                      </div>
                  );
              })}
              <div ref={messagesEndRef} />
          </div>
          {floatingHearts.map((h) => (<Heart key={h.id} className="absolute bottom-20 w-6 h-6 text-pink-500 fill-pink-500 animate-float pointer-events-none z-50 drop-shadow-lg" style={{ left: `${h.left}%` }}/>))}
          {/* Bottom Controls */}
          <div className="p-3 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center gap-3 shrink-0">
              <button onClick={handleMicToggle} className={`p-2 rounded-full shadow-lg transition duration-75 active:scale-95 ${mySeat?.isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{mySeat?.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
              <button onClick={handleSpeakerToggle} className={`p-2 rounded-full shadow-lg transition ${isSpeakerMuted ? 'bg-gray-700 text-gray-400' : 'bg-white/10 text-brand-400 hover:bg-white/20'}`}>{isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
              <button onClick={() => setShowGiftPanel(true)} disabled={isSendingGift} className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20 hover:scale-105 transition disabled:opacity-50"><GiftIcon className="w-5 h-5" /></button>
              <div className="flex-1 relative">
                  <input 
                    ref={chatInputRef} 
                    type="text" 
                    value={inputValue} 
                    onChange={(e) => setInputValue(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                    placeholder={t('placeholder')} 
                    className={`w-full bg-white/10 border border-white/10 rounded-full py-2.5 px-4 text-sm text-white focus:border-brand-500 outline-none placeholder-gray-400 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                  />
                  <button 
                    onClick={handleSendMessage} 
                    disabled={!inputValue.trim()} 
                    className="absolute right-2 top-1.5 p-1.5 bg-brand-600 rounded-full text-white disabled:opacity-0 transition hover:bg-brand-500 rtl:right-auto rtl:left-2"
                  >
                    <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
              </div>
              <button onClick={() => setShowOptionsMenu(true)} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><LayoutGrid className="w-5 h-5" /></button>
          </div>
      </div>

      {/* GIFT PANEL */}
      {showGiftPanel && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm animate-in slide-in-from-bottom-10">
              <div className="bg-gray-900/30 backdrop-blur-3xl border-t border-white/20 rounded-t-3xl p-4 shadow-2xl h-[60vh] flex flex-col">
                  {/* Category Tabs */}
                  <div className="flex gap-2 mb-3 bg-black/20 p-1 rounded-xl">
                      <button onClick={() => setGiftCategory('standard')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${giftCategory === 'standard' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>{t('standard') || 'Standard'}</button>
                      <button onClick={() => setGiftCategory('cp')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${giftCategory === 'cp' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><HeartHandshake className="w-3 h-3" /> {t('cp') || 'CP'}</button>
                  </div>
                  
                  <div className="flex gap-4 overflow-x-auto p-2 mb-2 border-b border-white/5 no-scrollbar min-h-[60px] items-center flex-row">
                        <div onClick={() => setGiftTargets(['all'])} className={`flex flex-col items-center gap-1 cursor-pointer shrink-0 transition-transform active:scale-95 ${giftTargets.includes('all') ? 'opacity-100 scale-105' : 'opacity-60'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${giftTargets.includes('all') ? 'border-brand-500 bg-brand-500/20 text-white' : 'border-gray-600 bg-gray-800 text-gray-400'}`}><Users className="w-5 h-5" /></div>
                            <span className={`text-[9px] font-bold ${giftTargets.includes('all') ? 'text-brand-400' : 'text-gray-400'}`}>All</span>
                        </div>
                        {activeSeats.map(seat => (
                            <div key={seat.index} onClick={() => setGiftTargets([seat.userId!])} className={`flex flex-col items-center gap-1 cursor-pointer shrink-0 transition-transform active:scale-95 relative ${giftTargets.includes(seat.userId!) ? 'opacity-100 scale-105' : 'opacity-60'}`}>
                                <div className={`w-10 h-10 rounded-full p-[2px] relative ${giftTargets.includes(seat.userId!) ? 'border-2 border-brand-500' : 'border border-gray-600'}`}>
                                    <img src={seat.userAvatar!} className="w-full h-full rounded-full object-cover" />
                                </div>
                                <span className={`text-[9px] max-w-[60px] truncate ${giftTargets.includes(seat.userId!) ? 'text-brand-400 font-bold' : 'text-gray-400'}`}>{seat.userName}</span>
                            </div>
                        ))}
                  </div>

                  {giftCategory === 'standard' && (
                      <div className="flex justify-between items-center mb-2">
                          <div className="flex gap-2">
                              <button onClick={() => setGiftTab('static')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${giftTab === 'static' ? 'bg-white text-black' : 'bg-gray-800/50 text-gray-400'}`}>Classic</button>
                              <button onClick={() => setGiftTab('animated')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${giftTab === 'animated' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' : 'bg-gray-800/50 text-gray-400'}`}>Animated</button>
                          </div>
                          <button onClick={() => setShowGiftPanel(false)}><X className="w-5 h-5 text-gray-500" /></button>
                      </div>
                  )}

                  <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-3 pb-2 content-start custom-scrollbar">
                      {filteredGifts.map(gift => (
                          <button key={gift.id} onClick={() => setSelectedGift(gift)} disabled={isSendingGift} className={`flex flex-col items-center p-2 rounded-xl border transition relative group ${selectedGift?.id === gift.id ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:bg-white/5'} ${isSendingGift ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              {(gift.svgaUrl || gift.icon.startsWith('data:') || gift.icon.startsWith('http')) ? (
                                  <img src={gift.icon} className={`w-10 h-10 object-contain mb-1 transition ${selectedGift?.id === gift.id ? 'scale-110' : 'group-hover:scale-105'}`} />
                              ) : (
                                  <span className={`text-4xl mb-1 filter drop-shadow-md transition ${selectedGift?.id === gift.id ? 'scale-110' : 'group-hover:scale-105'}`}>{gift.icon}</span>
                              )}
                              <span className="text-[10px] text-gray-300 font-medium truncate w-full text-center">{gift.name}</span>
                              <div className="flex items-center gap-0.5 mt-1 bg-black/30 px-1.5 py-0.5 rounded text-[9px]"><span className="text-yellow-500">💎</span><span className="text-yellow-100 font-bold">{gift.cost}</span></div>
                          </button>
                      ))}
                  </div>
                  <div className="pt-3 border-t border-white/5 flex gap-2 items-center">
                      <div className="flex items-center gap-1 bg-black/40 px-3 py-2 rounded-full border border-white/10 shrink-0">
                          <span className="text-xs text-yellow-500">💎</span>
                          <span className="text-xs font-bold text-white">{currentUser.wallet?.diamonds || 0}</span>
                      </div>
                      <button onClick={executeSendGift} disabled={isSendingGift || !selectedGift} className="flex-1 bg-gradient-to-r from-brand-600 to-accent-600 text-white font-bold py-2 px-6 rounded-full shadow-lg hover:shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95 flex items-center justify-center gap-2 shrink-0">
                          {isSendingGift ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4 rtl:rotate-180"/>} {t('send')}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* OPTIONS MENU (GRID BOX) */}
      {showOptionsMenu && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in slide-in-from-bottom-10" onClick={() => setShowOptionsMenu(false)}>
              <div className="bg-gray-900 border-t border-white/10 rounded-t-3xl p-5 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                      <h3 className="text-white font-bold text-lg">{t('menu')}</h3>
                      <button onClick={() => setShowOptionsMenu(false)} className="p-1 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-gray-400"/></button>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                      {/* Standard User Controls */}
                      <button onClick={handleShareRoom} className="flex flex-col items-center gap-2 group">
                          <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-brand-600 group-hover:text-white transition text-brand-400 border border-white/5"><Share2 className="w-6 h-6"/></div>
                          <span className="text-xs text-gray-400 group-hover:text-white">{t('share')}</span>
                      </button>
                      <button onClick={() => { setShowMusicPlaylist(true); setShowOptionsMenu(false); }} className="flex flex-col items-center gap-2 group">
                          <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition text-purple-400 border border-white/5"><Music className="w-6 h-6"/></div>
                          <span className="text-xs text-gray-400 group-hover:text-white">{t('music')}</span>
                      </button>
                      <button onClick={() => { setShowGamesModal(true); setShowOptionsMenu(false); }} className="flex flex-col items-center gap-2 group">
                          <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-yellow-600 group-hover:text-white transition text-yellow-400 border border-white/5"><Gamepad2 className="w-6 h-6"/></div>
                          <span className="text-xs text-gray-400 group-hover:text-white">{t('games')}</span>
                      </button>
                      <button onClick={handleClearChat} className="flex flex-col items-center gap-2 group">
                          <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-red-600 group-hover:text-white transition text-red-400 border border-white/5"><RefreshCw className="w-6 h-6"/></div>
                          <span className="text-xs text-gray-400 group-hover:text-white">{t('clearChat')}</span>
                      </button>

                      {/* Admin/Host Controls */}
                      {(room.hostId === currentUser.id || room.admins?.includes(currentUser.uid || '')) && (
                          <button onClick={() => { setShowRoomSettings(true); setShowOptionsMenu(false); }} className="flex flex-col items-center gap-2 group">
                              <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition text-blue-400 border border-white/5"><Settings className="w-6 h-6"/></div>
                              <span className="text-xs text-gray-400 group-hover:text-white">{t('roomSettings')}</span>
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* GAMES MODAL */}
      {showGamesModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="w-full max-w-sm bg-gray-900 border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-4 bg-purple-900/20 border-b border-purple-500/20 flex justify-between items-center">
                      <h3 className="text-purple-300 font-bold flex items-center gap-2"><Gamepad2 className="w-5 h-5"/> {t('games')}</h3>
                      <button onClick={() => setShowGamesModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                      <button onClick={() => { setShowFruitWar(true); setShowGamesModal(false); }} className="aspect-square bg-gray-800 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-gray-700 transition border border-white/5 relative overflow-hidden group">
                          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=300')] bg-cover opacity-40 group-hover:scale-110 transition duration-500"></div>
                          <div className="relative z-10 bg-black/50 p-3 rounded-full backdrop-blur-sm"><span className="text-3xl">🍒</span></div>
                          <span className="relative z-10 font-bold text-white text-sm">Fruit War</span>
                      </button>
                      {/* UNLOCKED BUTTON - Previously Disabled */}
                      <button onClick={() => { alert('Coming Soon!'); setShowGamesModal(false); }} className="aspect-square bg-gray-800 rounded-2xl flex flex-col items-center justify-center gap-2 border border-white/5 hover:bg-gray-700 transition relative overflow-hidden group cursor-pointer">
                          <span className="text-3xl">🎡</span>
                          <span className="font-bold text-white text-sm">Lucky Wheel</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ... (rest of modals like exit confirmation) ... */}
      {showExitModal && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-3xl overflow-hidden shadow-2xl text-center">
                  <div className="p-6">
                      <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                          <LogOut className="w-8 h-8 text-red-500" />
                      </div>
                      <h3 className="text-white font-bold text-lg mb-2">{t('exitConfirm')}</h3>
                      {room.hostId === currentUser.id && (
                          <p className="text-red-400 text-xs mb-4">{t('closeRoomConfirm')}</p>
                      )}
                      
                      <div className="flex gap-3">
                          <button 
                              onClick={() => setShowExitModal(false)}
                              className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold hover:bg-gray-700"
                          >
                              {t('cancel')}
                          </button>
                          <button 
                              onClick={handleConfirmExit}
                              className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 shadow-lg"
                          >
                              {t('confirm')}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showRoomSettings && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in zoom-in-95">
              <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                      <h3 className="text-white font-bold text-lg">{t('roomSettings')}</h3>
                      <button onClick={() => setShowRoomSettings(false)} className="p-1 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-gray-400"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block font-bold">{t('title')}</label>
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-black/40 border border-gray-600 rounded-xl p-3 text-white focus:border-brand-500 outline-none text-sm"/>
                      </div>
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block font-bold">{t('desc')}</label>
                          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="w-full bg-black/40 border border-gray-600 rounded-xl p-3 text-white focus:border-brand-500 outline-none text-sm resize-none"/>
                      </div>
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block font-bold">{t('pass')}</label>
                          <div className="relative">
                              <Lock className="absolute top-3 left-3 w-4 h-4 text-gray-500"/>
                              <input type="text" value={newRoomPassword} onChange={(e) => setNewRoomPassword(e.target.value)} className="w-full bg-black/40 border border-gray-600 rounded-xl p-3 pl-10 text-white focus:border-brand-500 outline-none text-sm" placeholder="Leave empty to unlock"/>
                          </div>
                      </div>
                      
                      {/* Background Upload Section */}
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block font-bold">{t('uploadBg')}</label>
                          <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-brand-500 bg-black/20">
                              <div className="flex flex-col items-center">
                                  <ImageIcon className="w-5 h-5 text-gray-400" />
                                  <span className="text-[9px] text-gray-500 mt-1">Select Image</span>
                              </div>
                              <input type="file" accept="image/*" className="hidden" onChange={handleRoomBackgroundUpload} />
                          </label>
                      </div>

                      <button onClick={handleSaveSettings} className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold shadow-lg mt-2">{t('save')}</button>
                  </div>
              </div>
          </div>
      )}

      {showFruitWar && <FruitWarGame room={room} currentUser={currentUser} language={language} onClose={() => setShowFruitWar(false)} onUpdateBalance={() => { /* Balance updates via listener usually */ }} />}

      {selectedUser && (<UserProfileModal user={selectedUser} currentUser={currentUser} language={language} onClose={() => setSelectedUser(null)} onMessage={() => {}} onGift={() => { setGiftTargets([selectedUser.userId!]); setSelectedUser(null); setShowGiftPanel(true); }} onOpenFullProfile={() => {}} />)}
    </div>
  );
};
