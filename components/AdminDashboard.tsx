
import React, { useState, useEffect } from 'react';
import { Shield, Trash2, Ban, Search, Gift, Crown, ArrowLeft, RefreshCw, CheckCircle, Megaphone, Edit3, Send, Home, XCircle, Flame, Image as ImageIcon, Plus, X, Database, Clock, Gamepad2, BadgeCheck, Coins, Trophy, Ghost, Lock, Unlock, Percent, AlertTriangle, MessageCircle, Sparkles, Check, X as XIcon, Gavel, MinusCircle, Upload, Save, Layers, UserPlus, Zap, Loader2 } from 'lucide-react';
import { getAllUsers, adminUpdateUser, deleteAllRooms, sendSystemNotification, broadcastOfficialMessage, searchUserByDisplayId, getRoomsByHostId, adminBanRoom, deleteRoom, toggleRoomHotStatus, toggleRoomActivitiesStatus, addBanner, deleteBanner, listenToBanners, syncRoomIdsWithUserIds, toggleRoomOfficialStatus, resetAllUsersCoins, resetAllRoomCups, resetAllGhostUsers, updateRoomGameConfig, resetAllChats, deleteUserProfile, listenToWelcomeRequests, approveWelcomeRequest, rejectWelcomeRequest, addSvgaGift, addSvgaStoreItem, listenToDynamicGifts, listenToDynamicStoreItems, deleteGift, updateGift, deleteStoreItem, updateStoreItem } from '../services/firebaseService';
import { Language, User, Room, Banner, WelcomeRequest, Gift as GiftType, StoreItem } from '../types';
import { VIP_TIERS, ADMIN_ROLES } from '../constants';
import { compressImage } from '../services/imageService';

interface AdminDashboardProps {
  onBack: () => void;
  language: Language;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, language }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'agencies' | 'welcome' | 'system' | 'official' | 'banners' | 'svga' | 'vip_control'>('users');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isUploadingItem, setIsUploadingItem] = useState(false);
  
  // Search Results
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [searchedRooms, setSearchedRooms] = useState<Room[]>([]); 

  // VIP Control Tab State
  const [vipTargetId, setVipTargetId] = useState('');
  const [vipTargetUser, setVipTargetUser] = useState<User | null>(null);

  // Banners
  const [banners, setBanners] = useState<Banner[]>([]);
  const [newBannerImage, setNewBannerImage] = useState('');
  const [newBannerTitle, setNewBannerTitle] = useState('');

  // SVGA Panel State
  const [svgaType, setSvgaType] = useState<'gift' | 'entry' | 'frame' | 'bubble'>('gift');
  const [listFilter, setListFilter] = useState<'gifts' | 'store'>('store');
  
  // Gift Specific Options
  const [giftTabType, setGiftTabType] = useState<'static' | 'animated'>('static');
  const [giftCategoryType, setGiftCategoryType] = useState<'standard' | 'cp'>('standard');

  const [svgaName, setSvgaName] = useState('');
  const [svgaPrice, setSvgaPrice] = useState('');
  const [svgaIcon, setSvgaIcon] = useState('');
  const [svgaFileUrl, setSvgaFileUrl] = useState('');
  const [dynamicGifts, setDynamicGifts] = useState<GiftType[]>([]);
  const [dynamicStoreItems, setDynamicStoreItems] = useState<StoreItem[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemData, setEditItemData] = useState<{name: string, cost: string}>({name: '', cost: ''});

  // Welcome Requests
  const [welcomeRequests, setWelcomeRequests] = useState<WelcomeRequest[]>([]);

  // Modals / Inputs
  const [showVipModal, setShowVipModal] = useState<string | null>(null);
  const [vipDuration, setVipDuration] = useState<'permanent' | 'week' | 'month'>('permanent'); 

  const [showGiftModal, setShowGiftModal] = useState<string | null>(null);
  const [giftAmount, setGiftAmount] = useState('');

  const [showDeductModal, setShowDeductModal] = useState<string | null>(null);
  const [deductAmount, setDeductAmount] = useState('');
  
  const [showIdModal, setShowIdModal] = useState<string | null>(null);
  const [newCustomId, setNewCustomId] = useState('');

  // Ban Modal
  const [showBanModal, setShowBanModal] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<number>(-1); 

  const [officialTitle, setOfficialTitle] = useState('');
  const [officialBody, setOfficialBody] = useState('');

  // Luck State
  const [roomLuck, setRoomLuckState] = useState<number>(50);
  const [gameMode, setGameModeState] = useState<'FAIR' | 'DRAIN' | 'HOOK'>('FAIR');
  const [hookThreshold, setHookThresholdState] = useState<string>('50000');

  useEffect(() => {
    fetchUsers();
    const unsubBanners = listenToBanners((data) => setBanners(data));
    const unsubWelcome = listenToWelcomeRequests((data) => setWelcomeRequests(data));
    const unsubGifts = listenToDynamicGifts((data) => setDynamicGifts(data));
    const unsubStore = listenToDynamicStoreItems((data) => setDynamicStoreItems(data));
    return () => {
        unsubBanners();
        unsubWelcome();
        unsubGifts();
        unsubStore();
    };
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  const handleSearch = async () => {
      if(!searchTerm) return;
      setLoading(true);
      setSearchedUser(null);
      setSearchedRooms([]);

      // Search User
      const user = await searchUserByDisplayId(searchTerm);
      if (user) {
          setSearchedUser(user);
          // If user found, find ALL their rooms
          if (user.uid) {
              const rooms = await getRoomsByHostId(user.uid);
              setSearchedRooms(rooms);
          }
      } else {
          alert("المستخدم غير موجود");
      }
      setLoading(false);
  };

  // --- Handlers ---
  const initiateBanAction = (user: User) => { 
      if (user.isBanned) { 
          confirmBanUser(user.uid!, false); 
      } else { 
          setShowBanModal(user.uid!); 
          setBanDuration(-1); 
      } 
  };

  const confirmBanUser = async (uid: string, shouldBan: boolean) => { 
      setActionLoading(uid); 
      try { 
          const updateData: Partial<User> = { 
              isBanned: shouldBan, 
              isPermanentBan: shouldBan && banDuration === -1 
          }; 
          
          if (shouldBan && banDuration !== -1) { 
              const d = new Date(); 
              d.setDate(d.getDate() + banDuration); 
              updateData.banExpiresAt = d.getTime(); 
          } else { 
              updateData.banExpiresAt = 0; 
          } 
          
          await adminUpdateUser(uid, updateData); 
          
          // Update Local State Immediately
          if (searchedUser && searchedUser.uid === uid) {
              setSearchedUser({...searchedUser, ...updateData});
          }
          
          setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updateData } : u));
          
          alert(shouldBan ? "تم حظر المستخدم" : "تم فك الحظر"); 
      } catch (e) { 
          alert("فشل العملية"); 
      } 
      setActionLoading(null); 
      setShowBanModal(null); 
  };

  const handleSelectVip = async (lvl: number) => { 
      if (!showVipModal) return; 
      setActionLoading('vip_loading');
      try {
          const updates = { vip: lvl > 0, vipLevel: lvl };
          await adminUpdateUser(showVipModal, updates); 
          
          // Update Local State Immediately
          if (searchedUser && searchedUser.uid === showVipModal) {
              setSearchedUser({...searchedUser, ...updates});
          }
          setUsers(prev => prev.map(u => u.uid === showVipModal ? { ...u, ...updates } : u));

          alert("تم تحديث VIP بنجاح"); 
          setShowVipModal(null); 
      } catch (e) {
          alert("فشل التحديث");
      }
      setActionLoading(null);
  };

  // --- New Handlers for VIP Control Tab ---
  const handleSearchVipUser = async () => {
      if (!vipTargetId) return;
      setActionLoading('vip_search');
      setVipTargetUser(null);
      try {
          const user = await searchUserByDisplayId(vipTargetId);
          if (user) {
              setVipTargetUser(user);
          } else {
              alert("المستخدم غير موجود");
          }
      } catch (e) {
          alert("حدث خطأ أثناء البحث");
      }
      setActionLoading(null);
  };

  const handleQuickVipUpdate = async (level: number) => {
      if (!vipTargetUser || !vipTargetUser.uid) return;
      setActionLoading(`vip_update_${level}`);
      try {
          const updates = { vip: level > 0, vipLevel: level };
          await adminUpdateUser(vipTargetUser.uid, updates);
          setVipTargetUser({ ...vipTargetUser, ...updates });
          alert(level > 0 ? `تم تعيين VIP ${level} بنجاح` : "تم إزالة VIP بنجاح");
      } catch (e) {
          alert("فشل تحديث المستوى");
      }
      setActionLoading(null);
  };

  const handleToggleBanPermission = async (uid: string, currentStatus: boolean) => { await adminUpdateUser(uid, { canBanUsers: !currentStatus }); if (searchedUser && searchedUser.uid === uid) setSearchedUser({...searchedUser, canBanUsers: !currentStatus}); await fetchUsers(); alert("تم التحديث"); };
  const handleSetAdminRole = async (uid: string, role: any) => { await adminUpdateUser(uid, { adminRole: role, isAdmin: role !== null }); if (searchedUser && searchedUser.uid === uid) setSearchedUser({...searchedUser, adminRole: role, isAdmin: role !== null}); await fetchUsers(); alert("تم التحديث"); };
  const handleToggleRoomCreation = async (uid: string, currentStatus: boolean) => { await adminUpdateUser(uid, { canCreateRoom: !currentStatus }); if (searchedUser && searchedUser.uid === uid) setSearchedUser({...searchedUser, canCreateRoom: !currentStatus}); await fetchUsers(); alert("تم التحديث"); };
  const handleDeleteUser = async (uid: string) => { if (!confirm("حذف؟")) return; await deleteUserProfile(uid); setSearchedUser(null); await fetchUsers(); alert("تم الحذف"); };
  
  const handleBanRoom = async (roomId: string, currentStatus: boolean) => { await adminBanRoom(roomId, !currentStatus); setSearchedRooms(prev => prev.map(r => r.id === roomId ? { ...r, isBanned: !currentStatus } : r)); alert("تم التحديث"); };
  const handleToggleHot = async (roomId: string, s: boolean) => { await toggleRoomHotStatus(roomId, !s); setSearchedRooms(prev => prev.map(r => r.id === roomId ? { ...r, isHot: !s } : r)); };
  const handleToggleActivities = async (roomId: string, s: boolean) => { await toggleRoomActivitiesStatus(roomId, !s); setSearchedRooms(prev => prev.map(r => r.id === roomId ? { ...r, isActivities: !s } : r)); };
  const handleToggleOfficial = async (roomId: string, s: boolean) => { await toggleRoomOfficialStatus(roomId, !s); setSearchedRooms(prev => prev.map(r => r.id === roomId ? { ...r, isOfficial: !s } : r)); };
  const handleUpdateRoomGameConfig = async (roomId: string) => { await updateRoomGameConfig(roomId, roomLuck, gameMode, parseInt(hookThreshold)); alert("تم التحديث"); };
  const handleDeleteSingleRoom = async (roomId: string) => { if (!confirm("حذف؟")) return; await deleteRoom(roomId); setSearchedRooms(prev => prev.filter(r => r.id !== roomId)); };
  
  const handleGiftSubmit = async () => { 
      if (!showGiftModal || !giftAmount) return; 
      const u = users.find(x => x.uid === showGiftModal) || searchedUser; 
      const newAmount = (u?.wallet?.diamonds || 0) + parseInt(giftAmount);
      await adminUpdateUser(showGiftModal, { wallet: { diamonds: newAmount, coins: u?.wallet?.coins || 0 } }); 
      
      // Local Update
      if (searchedUser && searchedUser.uid === showGiftModal) {
          setSearchedUser({...searchedUser, wallet: { ...searchedUser.wallet!, diamonds: newAmount }});
      }
      
      await fetchUsers(); alert("تم"); setShowGiftModal(null); 
  };

  const handleDeductSubmit = async () => { 
      if (!showDeductModal || !deductAmount) return; 
      const u = users.find(x => x.uid === showDeductModal) || searchedUser; 
      const newAmount = Math.max(0, (u?.wallet?.diamonds || 0) - parseInt(deductAmount));
      await adminUpdateUser(showDeductModal, { wallet: { diamonds: newAmount, coins: u?.wallet?.coins || 0 } }); 
      
      // Local Update
      if (searchedUser && searchedUser.uid === showDeductModal) {
          setSearchedUser({...searchedUser, wallet: { ...searchedUser.wallet!, diamonds: newAmount }});
      }

      await fetchUsers(); alert("تم"); setShowDeductModal(null); 
  };

  const handleAssignAgent = async (uid: string) => { await adminUpdateUser(uid, { isAgent: true, agencyBalance: 200000000 }); if(searchedUser?.uid === uid) setSearchedUser({...searchedUser!, isAgent: true}); await fetchUsers(); alert("تم"); };
  const handleRevokeAgent = async (uid: string) => { await adminUpdateUser(uid, { isAgent: false }); if(searchedUser?.uid === uid) setSearchedUser({...searchedUser!, isAgent: false}); await fetchUsers(); alert("تم"); };
  const handleRechargeAgency = async (uid: string) => { const amt = prompt("Amount?"); if(!amt) return; const u = users.find(x => x.uid === uid) || searchedUser; await adminUpdateUser(uid, { agencyBalance: (u?.agencyBalance || 0) + parseInt(amt) }); await fetchUsers(); alert("تم"); };
  const handleAssignWelcomeAgent = async (uid: string) => { await adminUpdateUser(uid, { isWelcomeAgent: true }); if(searchedUser?.uid === uid) setSearchedUser({...searchedUser!, isWelcomeAgent: true}); await fetchUsers(); alert("تم"); };
  const handleRevokeWelcomeAgent = async (uid: string) => { await adminUpdateUser(uid, { isWelcomeAgent: false }); if(searchedUser?.uid === uid) setSearchedUser({...searchedUser!, isWelcomeAgent: false}); await fetchUsers(); alert("تم"); };
  
  const handleApproveRequest = async (req: WelcomeRequest) => { await approveWelcomeRequest(req.id, req.targetDisplayId); alert("تم"); };
  const handleRejectRequest = async (id: string) => { await rejectWelcomeRequest(id); alert("تم"); };
  
  const handleUpdateId = async () => { if (!showIdModal || !newCustomId) return; await adminUpdateUser(showIdModal, { id: newCustomId }); if(searchedUser?.uid === showIdModal) setSearchedUser({...searchedUser!, id: newCustomId}); await fetchUsers(); alert("تم"); setShowIdModal(null); };
  
  const handleBroadcast = async () => { await broadcastOfficialMessage(officialTitle, officialBody); alert("تم"); setOfficialTitle(''); setOfficialBody(''); };
  const handleDeleteRooms = async () => { await deleteAllRooms(); alert("تم"); };
  const handleResetAllCups = async () => { await resetAllRoomCups(); alert("تم"); };
  const handleSyncRoomIds = async () => { await syncRoomIdsWithUserIds(); alert("تم"); };
  const handleResetAllCoins = async () => { await resetAllUsersCoins(); alert("تم"); };
  const handleResetGhostUsers = async () => { await resetAllGhostUsers(); alert("تم"); };
  const handleResetChats = async () => { await resetAllChats(); alert("تم"); };
  const handleAddBanner = async () => { await addBanner(newBannerImage, newBannerTitle); alert("تم"); setNewBannerImage(''); setNewBannerTitle(''); };
  const handleDeleteBanner = async (id: string) => { await deleteBanner(id); };
  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { if(typeof ev.target?.result === 'string') setNewBannerImage(ev.target.result); }; reader.readAsDataURL(file); };

  // --- SVGA Logic ---
  const handleSvgaIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader(); reader.onload = (event) => { if (typeof event.target?.result === 'string') { setSvgaIcon(event.target.result); } }; reader.readAsDataURL(file);
  };

  const handleSvgaFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader(); reader.onload = (event) => { if (typeof event.target?.result === 'string') { setSvgaFileUrl(event.target.result); } }; reader.readAsDataURL(file);
  };

  // REAL SERVER UPLOAD HANDLER (WAIT FOR SUCCESS)
  const handleAddSvgaItem = async () => {
      if (!svgaName || !svgaPrice || !svgaIcon) { alert("يرجى ملء الاسم والسعر والصورة"); return; }
      
      setIsUploadingItem(true);

      try {
          if (svgaType === 'gift') {
              const newGift: GiftType = { 
                  id: Date.now().toString(), // Temp ID, server will assign unique if used addDoc, but here we provide structure
                  name: svgaName, 
                  icon: svgaIcon, 
                  cost: parseInt(svgaPrice), 
                  type: giftTabType, 
                  category: giftCategoryType, 
                  svgaUrl: svgaFileUrl || undefined 
              };
              // Wait for server to confirm
              await addSvgaGift(newGift);
          } else {
              const newStoreItem: StoreItem = { 
                  id: Date.now().toString(), 
                  type: svgaType as any, 
                  name: { ar: svgaName, en: svgaName }, 
                  price: parseInt(svgaPrice), 
                  currency: 'diamonds', 
                  previewClass: '', 
                  svgaUrl: svgaFileUrl || svgaIcon 
              };
              // Wait for server to confirm
              await addSvgaStoreItem(newStoreItem);
          }

          // Reset inputs only after success
          setSvgaName(''); 
          setSvgaPrice(''); 
          setSvgaIcon(''); 
          setSvgaFileUrl('');
          alert("تم تحميل العنصر على السيرفر بنجاح وسيظهر في القوائم الآن");

      } catch (e: any) {
          console.error("Upload failed", e);
          alert("فشل الرفع على السيرفر: " + e.message);
      } finally {
          setIsUploadingItem(false);
      }
  };

  const handleDeleteItem = async (id: string, type: 'gift' | 'store') => {
      if(confirm('هل أنت متأكد من الحذف؟')) {
          try {
              // Optimistic Remove
              if (type === 'gift') { 
                  setDynamicGifts(prev => prev.filter(i => i.id !== id));
                  deleteGift(id); // Background
              } else { 
                  setDynamicStoreItems(prev => prev.filter(i => i.id !== id));
                  deleteStoreItem(id); // Background
              }
          } catch (e: any) {
              console.error("Delete failed", e);
          }
      }
  };

  const handleUpdateItem = async (id: string, type: 'gift' | 'store') => {
      if(!editItemData.name || !editItemData.cost) return;
      
      const name = editItemData.name;
      const cost = parseInt(editItemData.cost);

      // Optimistic Update
      if (type === 'gift') {
          setDynamicGifts(prev => prev.map(i => i.id === id ? { ...i, name, cost } : i));
          updateGift(id, { name, cost }); // Background
      } else {
          setDynamicStoreItems(prev => prev.map(i => i.id === id ? { ...i, name: { ...i.name, ar: name, en: name }, price: cost } : i));
          updateStoreItem(id, { name: { ar: name, en: name }, price: cost }); // Background
      }
      setEditingItem(null);
  };

  const handleDeleteAllItems = async (type: 'gift' | 'store') => {
      if (!confirm(`هل أنت متأكد من حذف جميع ${type === 'gift' ? 'الهدايا' : 'عناصر المتجر'}؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
      
      const itemsToDelete = type === 'gift' ? dynamicGifts : dynamicStoreItems;
      if (itemsToDelete.length === 0) return;

      // Optimistic Clear
      if (type === 'gift') setDynamicGifts([]);
      else setDynamicStoreItems([]);

      // Background Process
      itemsToDelete.forEach(item => {
          if (type === 'gift') deleteGift(item.id);
          else deleteStoreItem(item.id);
      });
  };

  const agents = users.filter(u => u.isAgent);

  return (
    <div dir="rtl" className="h-full bg-black text-gold-400 flex flex-col font-sans relative">
      {/* Header */}
      <div className="p-4 bg-gray-900 border-b border-gold-500/30 flex flex-col gap-4 shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-l from-gold-500/10 to-transparent pointer-events-none"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 text-gold-400">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2 text-gold-100 mx-auto">
                <Shield className="w-6 h-6 text-gold-500" />
                لوحة التحكم
            </h1>
            <div className="w-9"></div>
        </div>

        <div className="flex gap-2 relative z-10 overflow-x-auto w-full scrollbar-hide justify-start no-scrollbar px-1 pb-1">
            <button onClick={() => setActiveTab('users')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'users' ? 'bg-gold-500 text-black shadow-[0_0_10px_gold]' : 'text-gold-500 hover:bg-white/5'}`}>المستخدمين</button>
            <button onClick={() => setActiveTab('vip_control')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'vip_control' ? 'bg-yellow-600 text-black shadow-[0_0_10px_yellow]' : 'text-yellow-500 hover:bg-white/5'}`}>إدارة VIP</button>
            <button onClick={() => setActiveTab('welcome')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'welcome' ? 'bg-purple-600 text-white shadow-[0_0_10px_purple]' : 'text-purple-500 hover:bg-white/5'}`}>الترحيب</button>
            <button onClick={() => setActiveTab('agencies')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'agencies' ? 'bg-blue-500 text-white shadow-[0_0_10px_blue]' : 'text-blue-500 hover:bg-white/5'}`}>الوكالات</button>
            <button onClick={() => setActiveTab('svga')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'svga' ? 'bg-cyan-600 text-white shadow-[0_0_10px_cyan]' : 'text-cyan-500 hover:bg-white/5'}`}>لوحة المتجر</button>
            <button onClick={() => setActiveTab('banners')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'banners' ? 'bg-pink-600 text-white shadow-[0_0_10px_pink]' : 'text-pink-500 hover:bg-white/5'}`}>البنرات</button>
            <button onClick={() => setActiveTab('official')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'official' ? 'bg-green-600 text-white shadow-[0_0_10px_green]' : 'text-green-500 hover:bg-white/5'}`}>رسائل</button>
            <button onClick={() => setActiveTab('system')} className={`px-3 py-1.5 rounded-lg border border-gold-500/30 text-[10px] font-bold whitespace-nowrap transition-all ${activeTab === 'system' ? 'bg-red-600 text-white shadow-[0_0_10px_red]' : 'text-red-500 hover:bg-white/5'}`}>النظام</button>
        </div>
      </div>

      {activeTab === 'users' && (
          <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 bg-gray-900/50">
                  <div className="relative flex gap-2">
                      <div className="relative flex-1">
                          <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" />
                          <input type="text" placeholder="بحث عن ID المستخدم..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg py-2 pr-10 pl-4 text-white text-sm focus:border-gold-500 outline-none"/>
                      </div>
                      <button onClick={handleSearch} className="bg-gold-600 text-black px-4 rounded-lg font-bold text-sm hover:bg-gold-500">بحث</button>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {(searchedUser || searchedRooms.length > 0) && (
                      <div className="bg-gray-800/50 border border-gold-500/30 rounded-xl p-4 mb-4">
                          <h3 className="text-gold-300 font-bold mb-3 border-b border-gray-700 pb-2">نتائج البحث</h3>
                          {searchedUser && (
                              <div className={`bg-black p-4 rounded-xl border ${searchedUser.isBanned ? 'border-red-600' : 'border-gray-700'}`}>
                                  <div className="flex items-center gap-3 mb-3">
                                      <img src={searchedUser.avatar} className="w-12 h-12 rounded-full border-2 border-gold-500 object-cover shrink-0" />
                                      <div className="min-w-0 flex-1">
                                          <div className="font-bold text-white text-lg truncate flex items-center gap-2">
                                              {searchedUser.name}
                                              {searchedUser.vipLevel && searchedUser.vipLevel > 0 && <span className="bg-yellow-600 text-white text-[9px] px-1 rounded">VIP {searchedUser.vipLevel}</span>}
                                          </div>
                                          <div className="text-xs text-gray-500">ID: {searchedUser.id}</div>
                                          <div className="text-[10px] text-gray-400">Diamonds: {searchedUser.wallet?.diamonds || 0}</div>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                      <button onClick={() => setShowGiftModal(searchedUser.uid!)} className="bg-blue-900/30 text-blue-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Gift className="w-3 h-3"/> شحن</button>
                                      <button onClick={() => setShowDeductModal(searchedUser.uid!)} className="bg-red-900/30 text-red-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><MinusCircle className="w-3 h-3"/> سحب</button>
                                      <button onClick={() => { setShowVipModal(searchedUser.uid!); setVipDuration('permanent'); }} className="bg-yellow-900/30 text-yellow-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Crown className="w-3 h-3"/> VIP</button>
                                      <button onClick={() => setShowIdModal(searchedUser.uid!)} className="bg-purple-900/30 text-purple-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Edit3 className="w-3 h-3"/> ID</button>
                                      <button onClick={() => initiateBanAction(searchedUser)} className={`py-1.5 rounded text-xs flex items-center justify-center gap-1 col-span-2 ${searchedUser.isBanned ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{searchedUser.isBanned ? 'فك الحظر' : 'حظر'}</button>
                                      
                                      <button onClick={() => searchedUser.isAgent ? handleRevokeAgent(searchedUser.uid!) : handleAssignAgent(searchedUser.uid!)} className={`py-1.5 rounded text-xs col-span-1 ${searchedUser.isAgent ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'}`}>{searchedUser.isAgent ? 'إلغاء وكالة' : 'تعيين وكيل'}</button>
                                      <button onClick={() => searchedUser.isWelcomeAgent ? handleRevokeWelcomeAgent(searchedUser.uid!) : handleAssignWelcomeAgent(searchedUser.uid!)} className={`py-1.5 rounded text-xs col-span-1 ${searchedUser.isWelcomeAgent ? 'bg-red-900 text-red-300' : 'bg-purple-900 text-purple-300'}`}>{searchedUser.isWelcomeAgent ? 'إلغاء ترحيب' : 'تعيين ترحيب'}</button>
                                      
                                      {searchedUser.isAgent && (
                                          <button onClick={() => handleRechargeAgency(searchedUser.uid!)} className="col-span-2 bg-blue-600 text-white py-1.5 rounded text-xs">شحن رصيد وكالة</button>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  )}
                  <h3 className="text-white font-bold mb-2">جميع المستخدمين ({users.length})</h3>
                  {loading ? <div className="text-center py-10 text-gray-500">جاري التحميل...</div> : users.map(user => (
                      <div key={user.uid} className={`bg-gray-900 border ${user.isBanned ? 'border-red-600' : 'border-gray-800'} rounded-lg p-3 flex justify-between items-center`}>
                          <div className="flex items-center gap-3">
                              <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
                              <div>
                                  <div className="text-white text-sm font-bold flex items-center gap-1">
                                      {user.name}
                                      {user.vipLevel && user.vipLevel > 0 && <span className="bg-yellow-600 text-white text-[8px] px-1 rounded">VIP {user.vipLevel}</span>}
                                      {user.isBanned && <span className="text-[8px] bg-red-600 text-white px-1 rounded">محظور</span>}
                                  </div>
                                  <div className="text-gray-500 text-xs">{user.id}</div>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => setSearchedUser(user)} className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded text-[10px] font-bold hover:bg-gray-600 flex items-center gap-1">
                                  <Edit3 className="w-3 h-3"/> إدارة
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* NEW VIP CONTROL TAB */}
      {activeTab === 'vip_control' && (
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-yellow-400 mb-4 flex items-center gap-2"><Crown className="w-5 h-5"/> إدارة VIP المباشرة</h3>
              
              <div className="bg-gray-900 border border-yellow-600/30 rounded-xl p-4 mb-4">
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                          <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" />
                          <input type="text" placeholder="ابحث بـ ID المستخدم..." value={vipTargetId} onChange={(e) => setVipTargetId(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg py-2 pr-10 pl-4 text-white text-sm focus:border-yellow-500 outline-none"/>
                      </div>
                      <button onClick={handleSearchVipUser} className="bg-yellow-600 text-black px-4 rounded-lg font-bold text-sm hover:bg-yellow-500">بحث</button>
                  </div>
              </div>

              {vipTargetUser && (
                  <div className="bg-black/50 border border-gray-700 rounded-xl p-5 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-4 mb-6">
                          <img src={vipTargetUser.avatar} className="w-16 h-16 rounded-full border-2 border-yellow-500 object-cover" />
                          <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                  {vipTargetUser.name}
                                  {vipTargetUser.vipLevel && vipTargetUser.vipLevel > 0 && <span className="bg-yellow-600 text-black text-[10px] px-2 py-0.5 rounded-full font-bold">VIP {vipTargetUser.vipLevel}</span>}
                              </h3>
                              <p className="text-gray-400 text-xs font-mono">ID: {vipTargetUser.id}</p>
                          </div>
                      </div>

                      <h4 className="text-gray-300 text-sm font-bold mb-3 border-b border-gray-700 pb-2">تعيين المستوى الجديد</h4>
                      
                      <div className="grid grid-cols-2 gap-2 mb-4">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(level => {
                              const tier = VIP_TIERS.find(t => t.level === level);
                              return (
                                  <button 
                                      key={level} 
                                      onClick={() => handleQuickVipUpdate(level)}
                                      disabled={actionLoading === `vip_update_${level}`}
                                      className={`py-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1
                                          ${vipTargetUser.vipLevel === level 
                                              ? 'bg-yellow-600 text-black border-yellow-400 cursor-default' 
                                              : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-yellow-600/50'
                                          }
                                      `}
                                  >
                                      {actionLoading === `vip_update_${level}` ? '...' : (
                                          <>
                                              <Crown className="w-3 h-3" />
                                              {level === 8 ? 'VIP 8 (امبراطور)' : `VIP ${level} - ${tier?.name[language]}`}
                                          </>
                                      )}
                                  </button>
                              );
                          })}
                      </div>

                      <button 
                          onClick={() => handleQuickVipUpdate(0)}
                          disabled={actionLoading === `vip_update_0`}
                          className="w-full py-3 bg-red-900/50 border border-red-500 text-red-400 rounded-lg font-bold hover:bg-red-900 transition flex items-center justify-center gap-2"
                      >
                          {actionLoading === 'vip_update_0' ? '...' : <><Trash2 className="w-4 h-4" /> إزالة VIP (تنزيل للمستوى 0)</>}
                      </button>
                  </div>
              )}
          </div>
      )}

      {/* AGENCIES TAB */}
      {activeTab === 'agencies' && (
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-blue-400 mb-4 flex items-center gap-2"><Database className="w-5 h-5"/> الوكالات</h3>
              <div className="space-y-4">
                  {agents.length === 0 ? <p className="text-gray-500 text-center py-10">لا يوجد وكلاء حالياً</p> : agents.map(agent => (
                      <div key={agent.uid} className="bg-gray-900 border border-blue-900 rounded-xl p-4 flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                              <img src={agent.avatar} className="w-12 h-12 rounded-full border border-blue-500"/>
                              <div>
                                  <h4 className="text-white font-bold">{agent.name}</h4>
                                  <p className="text-xs text-gray-400">ID: {agent.id}</p>
                                  <p className="text-xs text-blue-400 font-bold">Balance: {agent.agencyBalance || 0}</p>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => handleRechargeAgency(agent.uid)} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-bold">شحن رصيد</button>
                              <button onClick={() => handleRevokeAgent(agent.uid)} className="flex-1 bg-red-900/50 text-red-300 py-1.5 rounded text-xs border border-red-900">سحب الوكالة</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* WELCOME REQUESTS TAB */}
      {activeTab === 'welcome' && (
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-purple-400 mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5"/> طلبات الترحيب</h3>
              <div className="space-y-3">
                  {welcomeRequests.length === 0 ? <p className="text-gray-500 text-center py-10">لا توجد طلبات معلقة</p> : welcomeRequests.map(req => (
                      <div key={req.id} className="bg-gray-900 border border-purple-900/50 rounded-xl p-4">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <span className="text-xs text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded">الوكيل: {req.agentName}</span>
                                  <h4 className="text-white font-bold mt-1">المستخدم المستهدف: {req.targetDisplayId}</h4>
                                  <p className="text-[10px] text-gray-500">{new Date(req.timestamp).toLocaleString()}</p>
                              </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                              <button onClick={() => handleApproveRequest(req)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-bold">قبول</button>
                              <button onClick={() => handleRejectRequest(req.id)} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-1.5 rounded text-xs font-bold">رفض</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* SVGA CONTROL PANEL TAB */}
      {activeTab === 'svga' && (
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-cyan-400 mb-4 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5"/> لوحة تحكم المتجر (هدايا/دخوليات/إطارات)
              </h3>
              
              <div className="bg-gray-900 border border-cyan-900 rounded-xl p-4 space-y-4 mb-6">
                  <h4 className="text-white font-bold text-sm mb-2">إضافة عنصر جديد</h4>
                  <div>
                      <label className="text-xs text-gray-400 mb-2 block">نوع العنصر</label>
                      <div className="flex bg-black/40 p-1 rounded-lg">
                          <button onClick={() => setSvgaType('gift')} className={`flex-1 py-2 text-xs font-bold rounded ${svgaType === 'gift' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>هدية</button>
                          <button onClick={() => setSvgaType('entry')} className={`flex-1 py-2 text-xs font-bold rounded ${svgaType === 'entry' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>دخولية</button>
                          <button onClick={() => setSvgaType('frame')} className={`flex-1 py-2 text-xs font-bold rounded ${svgaType === 'frame' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>إطار</button>
                          <button onClick={() => setSvgaType('bubble')} className={`flex-1 py-2 text-xs font-bold rounded ${svgaType === 'bubble' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>فقاعة</button>
                      </div>
                  </div>

                  {svgaType === 'gift' && (
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">تصنيف الهدية (Tab)</label>
                              <select 
                                value={giftTabType} 
                                onChange={(e) => setGiftTabType(e.target.value as any)}
                                className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white text-xs outline-none"
                              >
                                  <option value="static">Classic (Static)</option>
                                  <option value="animated">Animated</option>
                              </select>
                          </div>
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">فئة الهدية (Category)</label>
                              <select 
                                value={giftCategoryType} 
                                onChange={(e) => setGiftCategoryType(e.target.value as any)}
                                className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white text-xs outline-none"
                              >
                                  <option value="standard">Standard</option>
                                  <option value="cp">CP</option>
                              </select>
                          </div>
                      </div>
                  )}

                  <div>
                      <label className="text-xs text-gray-400 mb-1 block">صورة الهدية/العنصر (Icon)</label>
                      <label className="w-full h-20 bg-black border border-gray-700 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-cyan-500">
                          <input type="file" className="hidden" accept="image/*" onChange={handleSvgaIconUpload} />
                          {svgaIcon ? (
                              <img src={svgaIcon} className="h-full object-contain" />
                          ) : (
                              <div className="flex flex-col items-center text-gray-500">
                                  <ImageIcon className="w-5 h-5 mb-1" />
                                  <span className="text-[9px]">اختر صورة</span>
                              </div>
                          )}
                      </label>
                  </div>

                  <div>
                      <label className="text-xs text-gray-400 mb-1 block">ملف الحركة (Animation Source - Optional)</label>
                      <label className="w-full h-20 bg-black border border-gray-700 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-cyan-500">
                          <input type="file" className="hidden" accept=".svga,image/gif,image/webp,image/png" onChange={handleSvgaFileUpload} />
                          {svgaFileUrl ? (
                              <div className="text-cyan-400 text-xs font-bold flex items-center gap-2"><CheckCircle className="w-4 h-4"/> تم اختيار الملف</div>
                          ) : (
                              <div className="flex flex-col items-center text-gray-500">
                                  <Upload className="w-5 h-5 mb-1" />
                                  <span className="text-[9px]">SVGA / GIF / WebP</span>
                              </div>
                          )}
                      </label>
                      <p className="text-[9px] text-gray-500 mt-1">يمكنك رفع ملف SVGA أصلي أو صورة متحركة (GIF/WebP). إذا تركت فارغاً، سيتم استخدام الأيقونة.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">الاسم</label>
                          <input type="text" value={svgaName} onChange={(e) => setSvgaName(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white text-xs outline-none" placeholder="اسم العنصر"/>
                      </div>
                      <div>
                          <label className="text-xs text-gray-400 mb-1 block">السعر (ماسات)</label>
                          <input type="number" value={svgaPrice} onChange={(e) => setSvgaPrice(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-white text-xs outline-none" placeholder="0"/>
                      </div>
                  </div>

                  <button 
                      onClick={handleAddSvgaItem} 
                      disabled={isUploadingItem}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                  >
                      {isUploadingItem ? <Loader2 className="w-5 h-5 animate-spin" /> : 'نعم - إضافة للسيرفر'}
                  </button>
              </div>

              {/* LIST ITEMS SECTION */}
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-4">
                      <h4 className="text-white font-bold text-sm">قائمة العناصر</h4>
                      <div className="flex bg-black/40 rounded-lg p-1">
                          <button 
                              onClick={() => setListFilter('store')} 
                              className={`px-3 py-1 rounded text-[10px] font-bold ${listFilter === 'store' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}
                          >
                              المتجر (اطارات/دخول)
                          </button>
                          <button 
                              onClick={() => setListFilter('gifts')} 
                              className={`px-3 py-1 rounded text-[10px] font-bold ${listFilter === 'gifts' ? 'bg-pink-600 text-white' : 'text-gray-400'}`}
                          >
                              الهدايا
                          </button>
                      </div>
                  </div>

                  {/* DELETE ALL BUTTON */}
                  <div className="mb-4">
                      <button 
                          onClick={() => handleDeleteAllItems(listFilter === 'store' ? 'store' : 'gift')}
                          disabled={actionLoading !== null}
                          className="w-full py-2 bg-red-900/50 border border-red-500 text-red-400 rounded-lg text-xs font-bold hover:bg-red-800 transition flex items-center justify-center gap-2"
                      >
                          <Trash2 className="w-4 h-4"/> 
                          {actionLoading?.startsWith('delete_all') ? 'جاري الحذف...' : `حذف جميع ${listFilter === 'store' ? 'عناصر المتجر' : 'الهدايا'}`}
                      </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                      {listFilter === 'store' ? (
                          dynamicStoreItems.length === 0 ? <p className="text-gray-500 text-xs text-center col-span-2 py-4">لا توجد عناصر متجر.</p> :
                          dynamicStoreItems.map(item => (
                              <div key={item.id} className="bg-black/50 p-3 rounded-lg border border-gray-700 relative group">
                                  {editingItem === item.id ? (
                                      <div className="space-y-2">
                                          <input 
                                              type="text" 
                                              className="w-full bg-gray-800 text-white text-xs p-1 rounded border border-gray-600" 
                                              value={editItemData.name} 
                                              onChange={(e) => setEditItemData({...editItemData, name: e.target.value})}
                                          />
                                          <input 
                                              type="number" 
                                              className="w-full bg-gray-800 text-white text-xs p-1 rounded border border-gray-600" 
                                              value={editItemData.cost} 
                                              onChange={(e) => setEditItemData({...editItemData, cost: e.target.value})}
                                          />
                                          <div className="flex gap-1 mt-2">
                                              <button onClick={() => handleUpdateItem(item.id, 'store')} className="bg-green-600 p-1 rounded text-white flex-1"><Save className="w-3 h-3 mx-auto"/></button>
                                              <button onClick={() => setEditingItem(null)} className="bg-gray-600 p-1 rounded text-white flex-1"><X className="w-3 h-3 mx-auto"/></button>
                                          </div>
                                      </div>
                                  ) : (
                                      <>
                                          <div className="flex justify-center mb-2 h-12">
                                              {item.svgaUrl ? (
                                                  <img src={item.svgaUrl} className="h-full object-contain"/>
                                              ) : (
                                                  <div className={`w-10 h-10 rounded-full border-2 border-gray-500 ${item.previewClass}`}></div>
                                              )}
                                          </div>
                                          <div className="text-center">
                                              <p className="text-white font-bold text-xs truncate">{item.name.ar}</p>
                                              <p className="text-yellow-400 text-[10px] font-mono">{item.price} 💎</p>
                                              <span className="text-[8px] bg-gray-700 px-1 rounded text-gray-300 mt-1 inline-block">{item.type}</span>
                                          </div>
                                          {/* Always visible buttons for better UX, z-50 to ensure clickable */}
                                          <div className="absolute top-1 right-1 flex gap-1 z-50">
                                              <button 
                                                  onClick={() => { setEditingItem(item.id); setEditItemData({name: item.name.ar, cost: item.price.toString()}); }} 
                                                  className="bg-blue-600/80 text-white p-1 rounded hover:bg-blue-500"
                                              >
                                                  <Edit3 className="w-3 h-3"/>
                                              </button>
                                              <button 
                                                  onClick={() => handleDeleteItem(item.id, 'store')} 
                                                  className="bg-red-600/80 text-white p-1 rounded hover:bg-red-500"
                                              >
                                                  <Trash2 className="w-3 h-3"/>
                                              </button>
                                          </div>
                                      </>
                                  )}
                              </div>
                          ))
                      ) : (
                          dynamicGifts.length === 0 ? <p className="text-gray-500 text-xs text-center col-span-2 py-4">لا توجد هدايا.</p> :
                          dynamicGifts.map(gift => (
                              <div key={gift.id} className="bg-black/50 p-3 rounded-lg border border-gray-700 relative group">
                                  {editingItem === gift.id ? (
                                      <div className="space-y-2">
                                          <input 
                                              type="text" 
                                              className="w-full bg-gray-800 text-white text-xs p-1 rounded border border-gray-600" 
                                              value={editItemData.name} 
                                              onChange={(e) => setEditItemData({...editItemData, name: e.target.value})}
                                          />
                                          <input 
                                              type="number" 
                                              className="w-full bg-gray-800 text-white text-xs p-1 rounded border border-gray-600" 
                                              value={editItemData.cost} 
                                              onChange={(e) => setEditItemData({...editItemData, cost: e.target.value})}
                                          />
                                          <div className="flex gap-1 mt-2">
                                              <button onClick={() => handleUpdateItem(gift.id, 'gift')} className="bg-green-600 p-1 rounded text-white flex-1"><Save className="w-3 h-3 mx-auto"/></button>
                                              <button onClick={() => setEditingItem(null)} className="bg-gray-600 p-1 rounded text-white flex-1"><X className="w-3 h-3 mx-auto"/></button>
                                          </div>
                                      </div>
                                  ) : (
                                      <>
                                          <div className="flex justify-center mb-2 h-10">
                                              {(gift.svgaUrl || gift.icon.startsWith('data:') || gift.icon.startsWith('http')) ? (
                                                  <img src={gift.icon} className="h-full object-contain"/>
                                              ) : (
                                                  <span className="text-2xl">{gift.icon}</span>
                                              )}
                                          </div>
                                          <div className="text-center">
                                              <p className="text-white font-bold text-xs truncate">{gift.name}</p>
                                              <p className="text-yellow-400 text-[10px] font-mono">{gift.cost} 💎</p>
                                              <div className="flex gap-1 justify-center mt-1">
                                                  <span className="text-[8px] bg-gray-700 px-1 rounded text-gray-300">{gift.type}</span>
                                              </div>
                                          </div>
                                          {/* Always visible buttons for better UX, z-50 to ensure clickable */}
                                          <div className="absolute top-1 right-1 flex gap-1 z-50">
                                              <button 
                                                  onClick={() => { setEditingItem(gift.id); setEditItemData({name: gift.name, cost: gift.cost.toString()}); }} 
                                                  className="bg-blue-600/80 text-white p-1 rounded hover:bg-blue-500"
                                              >
                                                  <Edit3 className="w-3 h-3"/>
                                              </button>
                                              <button 
                                                  onClick={() => handleDeleteItem(gift.id, 'gift')} 
                                                  className="bg-red-600/80 text-white p-1 rounded hover:bg-red-500"
                                              >
                                                  <Trash2 className="w-3 h-3"/>
                                              </button>
                                          </div>
                                      </>
                                  )}
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* BANNERS TAB */}
      {activeTab === 'banners' && (
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-pink-400 mb-4 flex items-center gap-2"><Layers className="w-5 h-5"/> إدارة البنرات</h3>
              
              <div className="bg-gray-900 border border-pink-900 rounded-xl p-4 mb-4 space-y-3">
                  <h4 className="text-white font-bold text-sm">إضافة بنر جديد</h4>
                  <label className="block w-full h-24 bg-black border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-pink-500">
                      <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                      {newBannerImage ? <img src={newBannerImage} className="h-full object-contain"/> : <div className="text-center text-gray-500"><Upload className="w-5 h-5 mx-auto mb-1"/><span className="text-xs">رفع صورة</span></div>}
                  </label>
                  <input type="text" value={newBannerTitle} onChange={e => setNewBannerTitle(e.target.value)} placeholder="عنوان البنر (اختياري)" className="w-full bg-black border border-gray-600 rounded p-2 text-white text-xs"/>
                  <button onClick={handleAddBanner} disabled={!newBannerImage} className="w-full bg-pink-600 text-white py-2 rounded font-bold disabled:opacity-50">إضافة</button>
              </div>

              <div className="space-y-3">
                  {banners.map(banner => (
                      <div key={banner.id} className="bg-gray-800 rounded-lg p-3 relative group overflow-hidden border border-gray-700">
                          <img src={banner.imageUrl} className="w-full h-24 object-cover rounded mb-2" />
                          <div className="flex justify-between items-center">
                              <span className="text-xs text-white font-bold">{banner.title || 'بدون عنوان'}</span>
                              <button onClick={() => handleDeleteBanner(banner.id)} className="bg-red-600 text-white p-1.5 rounded"><Trash2 className="w-3 h-3"/></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* OFFICIAL MESSAGES TAB */}
      {activeTab === 'official' && (
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-green-400 mb-4 flex items-center gap-2"><Megaphone className="w-5 h-5"/> رسائل رسمية (Broadcast)</h3>
              <div className="bg-gray-900 border border-green-900 rounded-xl p-4 space-y-3">
                  <input type="text" value={officialTitle} onChange={e => setOfficialTitle(e.target.value)} placeholder="عنوان الرسالة" className="w-full bg-black border border-gray-600 rounded p-3 text-white text-sm focus:border-green-500 outline-none"/>
                  <textarea value={officialBody} onChange={e => setOfficialBody(e.target.value)} rows={4} placeholder="نص الرسالة..." className="w-full bg-black border border-gray-600 rounded p-3 text-white text-sm focus:border-green-500 outline-none"/>
                  <button onClick={handleBroadcast} disabled={!officialTitle || !officialBody} className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50">إرسال للجميع</button>
              </div>
          </div>
      )}

      {/* SYSTEM TOOLS TAB */}
      {activeTab === 'system' && (
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-red-400 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> أدوات النظام (خطر)</h3>
              
              <div className="grid grid-cols-1 gap-3">
                  <button onClick={handleDeleteRooms} className="bg-red-900/40 border border-red-600 text-red-300 py-3 rounded-lg font-bold hover:bg-red-900 transition flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> حذف جميع الغرف</button>
                  <button onClick={handleResetAllCups} className="bg-orange-900/40 border border-orange-600 text-orange-300 py-3 rounded-lg font-bold hover:bg-orange-900 transition flex items-center justify-center gap-2"><Trophy className="w-4 h-4"/> تصفير الكؤوس</button>
                  <button onClick={handleResetAllCoins} className="bg-yellow-900/40 border border-yellow-600 text-yellow-300 py-3 rounded-lg font-bold hover:bg-yellow-900 transition flex items-center justify-center gap-2"><Coins className="w-4 h-4"/> تصفير الكوينز</button>
                  <button onClick={handleResetGhostUsers} className="bg-purple-900/40 border border-purple-600 text-purple-300 py-3 rounded-lg font-bold hover:bg-purple-900 transition flex items-center justify-center gap-2"><Ghost className="w-4 h-4"/> طرد الأشباح (إخلاء المقاعد)</button>
                  <button onClick={handleSyncRoomIds} className="bg-blue-900/40 border border-blue-600 text-blue-300 py-3 rounded-lg font-bold hover:bg-blue-900 transition flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4"/> مزامنة معرفات الغرف</button>
                  <button onClick={handleResetChats} className="bg-gray-800 border border-gray-600 text-gray-300 py-3 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4"/> حذف جميع المحادثات</button>
              </div>

              <div className="mt-6 bg-gray-900 p-4 rounded-xl border border-gray-700">
                  <h4 className="text-white font-bold text-sm mb-3">إعدادات اللعبة (حظ الغرف)</h4>
                  <div className="space-y-3">
                      <div>
                          <label className="text-xs text-gray-400">نسبة الحظ (0-100%)</label>
                          <input type="number" value={roomLuck} onChange={e => setRoomLuckState(Number(e.target.value))} className="w-full bg-black p-2 rounded text-white border border-gray-600" />
                      </div>
                      <div>
                          <label className="text-xs text-gray-400">نمط اللعب</label>
                          <div className="flex bg-black p-1 rounded mt-1">
                              <button onClick={() => setGameModeState('FAIR')} className={`flex-1 text-xs py-1 rounded ${gameMode === 'FAIR' ? 'bg-green-600 text-white' : 'text-gray-400'}`}>عادل</button>
                              <button onClick={() => setGameModeState('DRAIN')} className={`flex-1 text-xs py-1 rounded ${gameMode === 'DRAIN' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>سحب</button>
                              <button onClick={() => setGameModeState('HOOK')} className={`flex-1 text-xs py-1 rounded ${gameMode === 'HOOK' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>صنارة</button>
                          </div>
                      </div>
                      <button onClick={() => handleUpdateRoomGameConfig('ALL')} className="w-full bg-brand-600 text-white py-2 rounded font-bold mt-2">تحديث الكل</button>
                  </div>
              </div>
          </div>
      )}

      {/* ... Modals (Ban, Gift, Deduct, ID, VIP) - kept exactly same ... */}
      {showGiftModal && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-blue-500 rounded-xl p-5 w-full max-w-xs text-right">
                  <h3 className="text-blue-400 font-bold mb-4">شحن</h3>
                  <input type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)} className="w-full bg-black p-2 rounded mb-4 text-white border border-gray-700"/>
                  <div className="flex gap-2"><button onClick={handleGiftSubmit} className="flex-1 bg-blue-600 text-white py-2 rounded">إرسال</button><button onClick={() => setShowGiftModal(null)} className="flex-1 bg-gray-700 text-white py-2 rounded">إلغاء</button></div>
              </div>
          </div>
      )}
      
      {showDeductModal && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-red-500 rounded-xl p-5 w-full max-w-xs text-right">
                  <h3 className="text-red-400 font-bold mb-4">سحب (خصم)</h3>
                  <input type="number" value={deductAmount} onChange={e => setDeductAmount(e.target.value)} className="w-full bg-black p-2 rounded mb-4 text-white border border-gray-700"/>
                  <div className="flex gap-2"><button onClick={handleDeductSubmit} className="flex-1 bg-red-600 text-white py-2 rounded">تنفيذ</button><button onClick={() => setShowDeductModal(null)} className="flex-1 bg-gray-700 text-white py-2 rounded">إلغاء</button></div>
              </div>
          </div>
      )}

      {showVipModal && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-yellow-500 rounded-xl p-5 w-full max-w-xs text-right max-h-[80vh] overflow-y-auto">
                  <h3 className="text-yellow-400 font-bold mb-4">تحديد مستوى VIP</h3>
                  <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleSelectVip(0)} className="bg-gray-700 text-white py-2 rounded text-xs">إزالة VIP</button>
                      <button onClick={() => handleSelectVip(vipDuration === 'permanent' ? 8 : 1)} className="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-bold py-2 rounded text-xs">VIP 8 (امبراطور)</button>
                      {VIP_TIERS.map(t => (
                          <button key={t.level} onClick={() => handleSelectVip(t.level)} className={`py-2 rounded text-xs text-white border border-gray-600 hover:bg-gray-800`}>VIP {t.level} - {t.name.ar}</button>
                      ))}
                  </div>
                  <button onClick={() => setShowVipModal(null)} className="w-full mt-4 bg-gray-700 text-white py-2 rounded">إلغاء</button>
              </div>
          </div>
      )}

      {showIdModal && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-purple-500 rounded-xl p-5 w-full max-w-xs text-right">
                  <h3 className="text-purple-400 font-bold mb-4">تغيير ID</h3>
                  <input type="text" value={newCustomId} onChange={e => setNewCustomId(e.target.value)} className="w-full bg-black p-2 rounded mb-4 text-white border border-gray-700" placeholder="New ID"/>
                  <div className="flex gap-2"><button onClick={handleUpdateId} className="flex-1 bg-purple-600 text-white py-2 rounded">تحديث</button><button onClick={() => setShowIdModal(null)} className="flex-1 bg-gray-700 text-white py-2 rounded">إلغاء</button></div>
              </div>
          </div>
      )}

      {showBanModal && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-red-600 rounded-xl p-5 w-full max-w-xs text-right">
                  <h3 className="text-red-500 font-bold mb-4">تأكيد الحظر</h3>
                  <p className="text-gray-300 text-xs mb-4">اختر مدة الحظر:</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                      <button onClick={() => setBanDuration(1)} className={`py-2 rounded text-xs ${banDuration === 1 ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>24 ساعة</button>
                      <button onClick={() => setBanDuration(7)} className={`py-2 rounded text-xs ${banDuration === 7 ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>أسبوع</button>
                      <button onClick={() => setBanDuration(30)} className={`py-2 rounded text-xs ${banDuration === 30 ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>شهر</button>
                      <button onClick={() => setBanDuration(-1)} className={`py-2 rounded text-xs ${banDuration === -1 ? 'bg-red-900 text-white border border-red-500' : 'bg-gray-700 text-gray-300'}`}>غلق الحساب (أبد)</button>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => confirmBanUser(showBanModal!, true)} className="flex-1 bg-red-600 text-white py-2 rounded font-bold" disabled={actionLoading === showBanModal}>
                          {actionLoading === showBanModal ? '...' : 'تأكيد الحظر'}
                      </button>
                      <button onClick={() => setShowBanModal(null)} className="flex-1 bg-gray-700 text-white py-2 rounded">إلغاء</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
