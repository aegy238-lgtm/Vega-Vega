
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  limit, 
  increment, 
  arrayUnion, 
  arrayRemove,
  Unsubscribe,
  writeBatch,
  runTransaction,
  deleteField
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut
} from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { 
  User, 
  Room, 
  ChatMessage, 
  Banner, 
  Notification, 
  FriendRequest, 
  PrivateMessage, 
  PrivateChatSummary,
  StoreItem,
  RoomSeat,
  Visitor,
  RelatedUser,
  WealthTransaction,
  WelcomeRequest,
  Gift
} from '../types';

// --- Account Creation Limit Logic ---
const MAX_ACCOUNTS = 2;
const ACCOUNTS_KEY = 'flex_device_accounts';

const checkCreationLimit = () => {
    // Disabled limit for unrestricted access
    return;
    /*
    const stored = localStorage.getItem(ACCOUNTS_KEY);
    const count = stored ? parseInt(stored) : 0;
    if (count >= MAX_ACCOUNTS) {
        throw new Error("عفواً، لقد وصلت للحد الأقصى لإنشاء الحسابات (2 حساب فقط). غير مسموح بإنشاء أكثر.");
    }
    */
};

const incrementCreationCount = () => {
    const stored = localStorage.getItem(ACCOUNTS_KEY);
    const count = stored ? parseInt(stored) : 0;
    localStorage.setItem(ACCOUNTS_KEY, (count + 1).toString());
};

// --- Helper to Sanitize Data for Firestore ---
// Safely removes undefined values and handles circular references
const deepClean = (obj: any, seen = new WeakSet()): any => {
    if (obj === undefined) return undefined;
    if (obj === null) return null;
    // Handle primitives
    if (typeof obj !== 'object') return obj;
    // Handle Date
    if (obj instanceof Date) return obj;

    // Detect circular reference
    if (seen.has(obj)) return undefined; 
    seen.add(obj);

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(v => deepClean(v, seen)).filter(v => v !== undefined);
    }

    // Handle Plain Objects
    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = deepClean(obj[key], seen);
            if (val !== undefined) {
                result[key] = val;
            }
        }
    }
    return result;
};

// Ensure NO undefined values are passed to Firestore
const sanitizeSeat = (seat: any): RoomSeat => ({
    index: Number(seat.index),
    userId: seat.userId || null, 
    userName: seat.userName || null,
    userAvatar: seat.userAvatar || null,
    frameId: seat.frameId || null,
    isMuted: !!seat.isMuted,
    isLocked: !!seat.isLocked,
    giftCount: Number(seat.giftCount) || 0,
    vipLevel: Number(seat.vipLevel) || 0,
    adminRole: seat.adminRole || null,
});

// --- Auth ---
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const loginWithEmail = async (email: string, pass: string) => {
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const registerWithEmail = async (email: string, pass: string) => {
  // Check limit (Disabled now)
  if (email !== 'admin@flex.com') {
      checkCreationLimit(); 
  }
  return await createUserWithEmailAndPassword(auth, email, pass);
};

export const logoutUser = async () => {
  return await signOut(auth);
};

// --- User Profile ---
export const getUserProfile = async (uid: string): Promise<User | null> => {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as User) : null;
};

export const createUserProfile = async (uid: string, data: Partial<User>) => {
  // If not creating the official admin, check limit
  if (data.id !== 'OFFECAL') {
      checkCreationLimit(); 
  }

  const displayId = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Apply deepClean to input data first
  const safeData = deepClean(data);

  const userData: User = {
    uid,
    id: displayId,
    name: safeData.name || 'User',
    email: safeData.email || undefined, // Save Email
    avatar: safeData.avatar || '',
    level: 1,
    diamondsSpent: 0,
    diamondsReceived: 0,
    receivedGifts: {},
    vip: false,
    vipLevel: 0,
    vipExpiresAt: 0,
    wallet: { diamonds: 0, coins: 0 },
    equippedFrame: '',
    equippedBubble: '',
    inventory: {},
    ownedItems: [],
    friendsCount: 0,
    followersCount: 0,
    followingCount: 0,
    visitorsCount: 0,
    isAdmin: false,
    adminRole: null,
    canCreateRoom: true, // Default: creating rooms is OPEN by default
    dailyProfit: 0,
    lastDailyReset: Date.now(),
    isWelcomeAgent: false,
    ...safeData
  };
  
  // Final deep clean before saving
  await setDoc(doc(db, 'users', uid), deepClean(userData));
  
  if (data.id !== 'OFFECAL') {
      incrementCreationCount(); 
  }
  return userData;
};

export const updateUserProfile = async (uid: string, data: Partial<User>) => {
  const docRef = doc(db, 'users', uid);
  const cleanData = deepClean(data);
  await updateDoc(docRef, cleanData);
};

// New Function: Delete User Profile completely
export const deleteUserProfile = async (uid: string) => {
    // 1. Delete the user document
    await deleteDoc(doc(db, 'users', uid));
};

export const listenToUserProfile = (uid: string, callback: (user: User | null) => void): Unsubscribe => {
  return onSnapshot(doc(db, 'users', uid), (docSnapshot) => {
    if (docSnapshot.exists()) {
        const userData = docSnapshot.data() as User;
        
        // Check VIP Expiration
        if (userData.vip && userData.vipExpiresAt && userData.vipExpiresAt > 0 && userData.vipExpiresAt < Date.now()) {
            // VIP has expired
            updateDoc(doc(db, 'users', uid), {
                vip: false,
                vipLevel: 0,
                vipExpiresAt: 0
            }).catch(console.error);
        }

        callback(userData);
    } else {
        callback(null);
    }
  });
};

export const searchUserByDisplayId = async (displayId: string): Promise<User | null> => {
  const q = query(collection(db, 'users'), where('id', '==', displayId), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].data() as User;
  return null;
};

// --- Welcome Agency System ---

export const submitWelcomeRequest = async (agent: User, targetDisplayId: string) => {
    const targetUser = await searchUserByDisplayId(targetDisplayId);
    if (!targetUser) throw new Error("المستخدم غير موجود");

    await addDoc(collection(db, 'welcome_requests'), {
        agentId: agent.uid,
        agentName: agent.name,
        targetDisplayId: targetDisplayId,
        status: 'pending',
        timestamp: Date.now()
    });
};

export const listenToWelcomeRequests = (callback: (requests: WelcomeRequest[]) => void): Unsubscribe => {
    const q = query(collection(db, 'welcome_requests'), where('status', '==', 'pending'));
    return onSnapshot(q, (snap) => {
        const reqs: WelcomeRequest[] = [];
        snap.forEach(d => reqs.push({ id: d.id, ...d.data() } as WelcomeRequest));
        reqs.sort((a, b) => b.timestamp - a.timestamp);
        callback(reqs);
    });
};

export const approveWelcomeRequest = async (requestId: string, targetDisplayId: string) => {
    const user = await searchUserByDisplayId(targetDisplayId);
    if (!user || !user.uid) throw new Error("المستخدم المستهدف غير موجود");

    const batch = writeBatch(db);
    
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + oneWeek;

    const userRef = doc(db, 'users', user.uid);
    batch.update(userRef, {
        vip: true,
        vipLevel: 5,
        vipExpiresAt: expiresAt,
        'wallet.diamonds': increment(20000000)
    });

    const reqRef = doc(db, 'welcome_requests', requestId);
    batch.update(reqRef, { status: 'approved' });

    const notifRef = collection(db, `users/${user.uid}/notifications`);
    batch.set(doc(notifRef), {
        id: Date.now().toString(),
        type: 'system',
        title: '🎉 Welcome Bonus',
        body: 'تم قبول طلب الترحيب! حصلت على VIP 5 (لمدة 7 أيام) و 20 مليون ماسة.',
        timestamp: Date.now(),
        read: false
    });

    await batch.commit();
};

export const rejectWelcomeRequest = async (requestId: string) => {
    await updateDoc(doc(db, 'welcome_requests', requestId), { status: 'rejected' });
};

// --- Profile Interactions (Lists & Visits) ---

export const recordProfileVisit = async (targetUid: string, visitor: User) => {
    if (!visitor.uid || visitor.uid === targetUid) return;

    const visitorRef = doc(db, `users/${targetUid}/visitors`, visitor.uid);
    const targetUserRef = doc(db, 'users', targetUid);

    await runTransaction(db, async (transaction) => {
        const visitDoc = await transaction.get(visitorRef);
        const now = Date.now();

        if (visitDoc.exists()) {
            transaction.update(visitorRef, {
                lastVisitTime: now,
                visitCount: increment(1),
                name: visitor.name,
                avatar: visitor.avatar
            });
        } else {
            const visitData: Visitor = {
                uid: visitor.uid!,
                name: visitor.name,
                avatar: visitor.avatar,
                lastVisitTime: now,
                visitCount: 1
            };
            transaction.set(visitorRef, visitData);
            transaction.update(targetUserRef, { visitorsCount: increment(1) });
        }
    });
};

export const getUserList = async (uid: string, type: 'friends' | 'followers' | 'following' | 'visitors'): Promise<any[]> => {
    const colRef = collection(db, `users/${uid}/${type}`);
    let q;
    if (type === 'visitors') {
        q = query(colRef, orderBy('lastVisitTime', 'desc'), limit(50));
    } else {
        q = query(colRef, limit(50)); 
    }
    
    const snap = await getDocs(q);
    const list: any[] = [];
    
    if (type === 'friends') { 
       const userIds = snap.docs.map(d => d.id);
       if (userIds.length > 0) {
           for (const id of userIds) {
               const p = await getUserProfile(id);
               if (p) list.push({ uid: p.uid, name: p.name, avatar: p.avatar });
           }
       }
    } else {
       snap.forEach(d => list.push(d.data()));
    }
    return list;
};

// Check Friendship Status
export const checkFriendshipStatus = async (myUid: string, targetUid: string): Promise<'friends' | 'sent' | 'none'> => {
    if (!myUid || !targetUid) return 'none';
    const friendDoc = await getDoc(doc(db, `users/${myUid}/friends`, targetUid));
    if (friendDoc.exists()) return 'friends';
    const reqDoc = await getDoc(doc(db, `users/${targetUid}/friendRequests`, myUid));
    if (reqDoc.exists()) return 'sent';
    return 'none';
};

// --- Admin ---
export const getAllUsers = async (): Promise<User[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => d.data() as User);
};

export const adminUpdateUser = async (uid: string, data: Partial<User>) => {
  await updateDoc(doc(db, 'users', uid), deepClean(data));
};

export const adminBanRoom = async (roomId: string, isBanned: boolean) => {
  await updateDoc(doc(db, 'rooms', roomId), { isBanned });
};

export const deleteRoom = async (roomId: string) => {
  await deleteDoc(doc(db, 'rooms', roomId));
};

export const deleteAllRooms = async () => {
  const snap = await getDocs(collection(db, 'rooms'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

export const resetAllGhostUsers = async () => {
  const roomsSnap = await getDocs(collection(db, 'rooms'));
  const batch = writeBatch(db);
  
  const emptySeats = Array(11).fill(null).map((_, i) => ({ 
      index: i, 
      userId: null, 
      userName: null, 
      userAvatar: null, 
      isMuted: false, 
      isLocked: false, 
      giftCount: 0,
      frameId: null,
      vipLevel: 0,
      adminRole: null
  }));

  roomsSnap.docs.forEach(doc => {
      batch.update(doc.ref, { 
          seats: emptySeats,
          seatCount: 10,
          viewerCount: 0
      });
  });
  
  await batch.commit();
};

export const syncRoomIdsWithUserIds = async () => {
  const roomsSnap = await getDocs(collection(db, 'rooms'));
  const batch = writeBatch(db);
  roomsSnap.docs.forEach(doc => {
      const roomData = doc.data() as Room;
      if (roomData.hostId && roomData.displayId !== roomData.hostId) {
          batch.update(doc.ref, { displayId: roomData.hostId });
      }
  });
  await batch.commit();
};

export const toggleRoomHotStatus = async (roomId: string, isHot: boolean) => {
  await updateDoc(doc(db, 'rooms', roomId), { isHot });
};

export const toggleRoomActivitiesStatus = async (roomId: string, isActivities: boolean) => {
  await updateDoc(doc(db, 'rooms', roomId), { isActivities });
};

export const toggleRoomOfficialStatus = async (roomId: string, isOfficial: boolean) => {
  await updateDoc(doc(db, 'rooms', roomId), { isOfficial });
};

export const updateRoomGameConfig = async (roomId: string, luck: number, mode: 'FAIR' | 'DRAIN' | 'HOOK', hookThreshold: number) => {
  await updateDoc(doc(db, 'rooms', roomId), { 
      gameLuck: luck,
      gameMode: mode,
      hookThreshold: hookThreshold
  });
};

export const setRoomLuck = async (roomId: string, luckPercentage: number) => {
  await updateDoc(doc(db, 'rooms', roomId), { gameLuck: luckPercentage });
};

export const sendSystemNotification = async (uid: string, title: string, body: string) => {
  const notif: Notification = {
    id: Date.now().toString(),
    type: 'system',
    title,
    body,
    timestamp: Date.now(),
    read: false
  };
  await addDoc(collection(db, `users/${uid}/notifications`), notif);
};

export const broadcastOfficialMessage = async (title: string, body: string) => {
  await addDoc(collection(db, 'broadcasts'), {
    title,
    body,
    timestamp: Date.now(),
    type: 'official'
  });
};

export const resetAllRoomCups = async () => {
    const roomsSnap = await getDocs(collection(db, 'rooms'));
    const batch = writeBatch(db);
    const now = Date.now();
    
    roomsSnap.docs.forEach(doc => {
        batch.update(doc.ref, { 
            contributors: {},
            cupStartTime: now
        });
    });
    
    await batch.commit();
};

// --- SVGA / Dynamic Items Management (Admin) ---

export const addSvgaGift = async (gift: Gift) => {
    await addDoc(collection(db, 'gifts'), deepClean(gift));
};

export const addSvgaStoreItem = async (item: StoreItem) => {
    await addDoc(collection(db, 'store_items'), deepClean(item));
};

export const deleteGift = async (giftId: string) => {
    await deleteDoc(doc(db, 'gifts', giftId));
};

export const deleteStoreItem = async (itemId: string) => {
    await deleteDoc(doc(db, 'store_items', itemId));
};

export const updateGift = async (giftId: string, data: Partial<Gift>) => {
    await updateDoc(doc(db, 'gifts', giftId), deepClean(data));
};

export const updateStoreItem = async (itemId: string, data: Partial<StoreItem>) => {
    await updateDoc(doc(db, 'store_items', itemId), deepClean(data));
};

export const listenToDynamicGifts = (callback: (gifts: Gift[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, 'gifts'), (snap) => {
        const gifts: Gift[] = [];
        snap.forEach(d => gifts.push({ id: d.id, ...d.data() } as Gift));
        callback(gifts);
    });
};

export const listenToDynamicStoreItems = (callback: (items: StoreItem[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, 'store_items'), (snap) => {
        const items: StoreItem[] = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() } as StoreItem));
        callback(items);
    });
};

// --- Rooms ---
export const createRoom = async (title: string, thumbnail: string, host: User, hostUid: string, backgroundType: 'image' | 'video' = 'image') => {
    const roomRef = doc(collection(db, 'rooms'));
    const initialSeatCount = 10;
    
    const newRoom: Room = {
        id: roomRef.id,
        displayId: host.id,
        title,
        hostName: host.name,
        hostAvatar: host.avatar,
        hostId: host.id, 
        viewerCount: 0,
        thumbnail, 
        backgroundImage: thumbnail, 
        backgroundType: backgroundType, 
        tags: [],
        isAiHost: false,
        seatCount: initialSeatCount,
        seats: Array(initialSeatCount + 1).fill(null).map((_, i) => ({ 
            index: i, 
            userId: null, 
            userName: null, 
            userAvatar: null, 
            isMuted: false, 
            isLocked: false, 
            giftCount: 0,
            frameId: null,
            vipLevel: 0,
            adminRole: null
        })),
        isBanned: false,
        isHot: false,
        isOfficial: false,
        isActivities: false,
        isLocked: false,
        password: '',
        contributors: {},
        cupStartTime: Date.now(), 
        bannedUsers: {},
        admins: [],
        gameLuck: 50, 
        gameMode: 'FAIR', 
        hookThreshold: 50000, 
        roomWealth: 0 
    };
    
    // Apply deepClean to the room object before saving
    await setDoc(roomRef, deepClean(newRoom));
    return newRoom;
};

export const changeRoomSeatCount = async (roomId: string, currentSeats: RoomSeat[], newCount: number) => {
    const roomRef = doc(db, 'rooms', roomId);
    const totalSize = newCount + 1;
    
    let newSeats = [...currentSeats];

    if (totalSize > currentSeats.length) {
        for (let i = currentSeats.length; i < totalSize; i++) {
            newSeats.push({
                index: i,
                userId: null,
                userName: null,
                userAvatar: null,
                isMuted: false,
                isLocked: false,
                giftCount: 0,
                frameId: null,
                vipLevel: 0,
                adminRole: null
            });
        }
    } else if (totalSize < currentSeats.length) {
        newSeats = newSeats.slice(0, totalSize);
    }

    await updateDoc(roomRef, {
        seatCount: newCount,
        seats: newSeats.map(sanitizeSeat)
    });
};

export const listenToRooms = (callback: (rooms: Room[]) => void): Unsubscribe => {
  const q = query(collection(db, 'rooms'), orderBy('viewerCount', 'desc')); 
  return onSnapshot(q, (snap) => {
    const rooms: Room[] = [];
    snap.forEach(d => rooms.push(d.data() as Room));
    callback(rooms);
  });
};

export const listenToRoom = (roomId: string, callback: (room: Room | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, 'rooms', roomId), (doc) => {
        if (doc.exists()) callback(doc.data() as Room);
        else callback(null);
    });
};

export const getRoomsByHostId = async (hostUid: string): Promise<Room[]> => {
    const user = await getUserProfile(hostUid);
    if (!user) return [];
    const q = query(collection(db, 'rooms'), where('hostId', '==', user.id));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Room);
};

export const updateRoomDetails = async (roomId: string, updates: Partial<Room>) => {
    await updateDoc(doc(db, 'rooms', roomId), deepClean(updates));
};

export const distributeRoomWealth = async (roomId: string, hostUid: string, targetDisplayId: string, amount: number) => {
    if (amount <= 0) throw new Error("Invalid amount");

    const targetUser = await searchUserByDisplayId(targetDisplayId);
    if (!targetUser || !targetUser.uid) throw new Error("Target user not found");

    const roomRef = doc(db, 'rooms', roomId);
    const targetUserRef = doc(db, 'users', targetUser.uid);
    const transactionRef = doc(collection(db, 'rooms', roomId, 'wealth_transactions'));

    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Room does not exist");
        
        const roomData = roomDoc.data() as Room;
        
        const currentWealth = roomData.roomWealth || 0;
        if (currentWealth < amount) throw new Error("Insufficient room wealth");

        transaction.update(roomRef, { roomWealth: increment(-amount) });
        transaction.update(targetUserRef, { 'wallet.diamonds': increment(amount) });

        transaction.set(transactionRef, {
            id: transactionRef.id,
            targetUserName: targetUser.name,
            targetUserAvatar: targetUser.avatar,
            targetDisplayId: targetUser.id,
            amount: amount,
            timestamp: Date.now()
        });
    });
};

export const getRoomWealthHistory = async (roomId: string): Promise<WealthTransaction[]> => {
    const q = query(collection(db, 'rooms', roomId, 'wealth_transactions'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WealthTransaction);
};

// --- REAL-TIME VIEWER TRACKING ---
export const enterRoom = async (roomId: string, user: User) => {
    if (!roomId || !user.uid) return;
    const viewerRef = doc(db, `rooms/${roomId}/viewers`, user.uid);
    await setDoc(viewerRef, {
        uid: user.uid,
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        adminRole: user.adminRole || null,
        vipLevel: user.vipLevel || 0,
        equippedFrame: user.equippedFrame || null,
        timestamp: Date.now()
    });
    await updateDoc(doc(db, 'rooms', roomId), { viewerCount: increment(1) });
};

export const exitRoom = async (roomId: string, userId: string) => {
    if (!roomId || !userId) return;
    await deleteDoc(doc(db, `rooms/${roomId}/viewers`, userId));
    await updateDoc(doc(db, 'rooms', roomId), { viewerCount: increment(-1) });
};

export const listenToRoomViewers = (roomId: string, callback: (viewers: User[]) => void): Unsubscribe => {
    const q = query(collection(db, `rooms/${roomId}/viewers`), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snap) => {
        const viewers: User[] = [];
        snap.forEach(d => viewers.push(d.data() as User));
        callback(viewers);
    });
};

export const incrementViewerCount = async (roomId: string) => {
    await updateDoc(doc(db, 'rooms', roomId), { viewerCount: increment(1) });
};

export const decrementViewerCount = async (roomId: string) => {
    await updateDoc(doc(db, 'rooms', roomId), { viewerCount: increment(-1) });
};

// --- Seats & Moderation (TRANSACTIONAL) ---
export const takeSeat = async (roomId: string, seatIndex: number, user: User) => {
    const roomRef = doc(db, 'rooms', roomId);
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw "Room does not exist";
        
        const roomData = roomDoc.data() as Room;
        let seats = [...roomData.seats];
        
        if (seats[seatIndex] && seats[seatIndex].userId && seats[seatIndex].userId !== user.id) {
             throw "Seat occupied";
        }
        
        if (seats[seatIndex] && seats[seatIndex].isLocked && !user.isAdmin && user.id !== roomData.hostId) {
             throw "Seat locked";
        }
        
        const currentSeatIndex = seats.findIndex(s => s.userId === user.id);
        if (currentSeatIndex !== -1) {
            seats[currentSeatIndex] = sanitizeSeat({
                index: currentSeatIndex,
                userId: null,
                userName: null,
                userAvatar: null,
                frameId: null,
                isMuted: false,
                isLocked: seats[currentSeatIndex].isLocked,
                giftCount: 0,
                vipLevel: 0,
                adminRole: null
            });
        }

        if (!seats[seatIndex]) {
            seats[seatIndex] = {
                index: seatIndex,
                userId: null,
                userName: null,
                userAvatar: null,
                isMuted: false,
                isLocked: false,
                giftCount: 0,
                frameId: null,
                vipLevel: 0,
                adminRole: null
            };
        }

        seats[seatIndex] = sanitizeSeat({
            index: seatIndex,
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            frameId: user.equippedFrame || null,
            isMuted: false,
            isLocked: seats[seatIndex].isLocked,
            giftCount: 0,
            vipLevel: user.vipLevel || 0,
            adminRole: user.adminRole || null
        });
        
        transaction.update(roomRef, { seats });
    });
};

// Move Seat Function (Swap or Jump)
export const moveSeat = async (roomId: string, currentSeatIndex: number, targetSeatIndex: number, user: User) => {
    const roomRef = doc(db, 'rooms', roomId);
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw "Room does not exist";
        const roomData = roomDoc.data() as Room;
        let seats = [...roomData.seats];

        // Validation
        if (seats[targetSeatIndex]?.userId) throw "Target seat occupied";
        if (seats[targetSeatIndex]?.isLocked && !user.isAdmin && user.id !== roomData.hostId) throw "Target seat locked";
        if (seats[currentSeatIndex]?.userId !== user.id) throw "Not on source seat";

        // Preserve current seat mute status
        const isMuted = seats[currentSeatIndex].isMuted;

        // Clear old seat
        seats[currentSeatIndex] = sanitizeSeat({
            ...seats[currentSeatIndex], 
            userId: null, userName: null, userAvatar: null, frameId: null,
            giftCount: 0, isMuted: false, vipLevel: 0, adminRole: null
        });

        // Fill new seat
        seats[targetSeatIndex] = sanitizeSeat({
            ...seats[targetSeatIndex], // keep index/lock status of target
            userId: user.id, userName: user.name, userAvatar: user.avatar,
            frameId: user.equippedFrame || null,
            isMuted: isMuted, // Carry over mute status
            giftCount: 0, // Reset session gifts on new seat
            vipLevel: user.vipLevel || 0,
            adminRole: user.adminRole || null
        });

        transaction.update(roomRef, { seats });
    });
};

export const leaveSeat = async (roomId: string, user: User) => {
    const roomRef = doc(db, 'rooms', roomId);
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) return;
        
        const roomData = roomDoc.data() as Room;
        const seats = roomData.seats.map(s => {
            if (s.userId === user.id) {
                return sanitizeSeat({ 
                    index: s.index,
                    userId: null, 
                    userName: null, 
                    userAvatar: null, 
                    frameId: null,
                    giftCount: 0, 
                    isMuted: false,
                    isLocked: s.isLocked,
                    vipLevel: 0,
                    adminRole: null
                });
            }
            return sanitizeSeat(s);
        });
        transaction.update(roomRef, { seats });
    });
};

export const kickUserFromSeat = async (roomId: string, seatIndex: number) => {
    const roomRef = doc(db, 'rooms', roomId);
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) return;
        
        const roomData = roomDoc.data() as Room;
        let seats = [...roomData.seats];
        
        if (seats[seatIndex]) {
            seats[seatIndex] = sanitizeSeat({ 
                index: seats[seatIndex].index,
                userId: null, 
                userName: null, 
                userAvatar: null, 
                frameId: null,
                giftCount: 0, 
                isMuted: false,
                isLocked: seats[seatIndex].isLocked,
                vipLevel: 0,
                adminRole: null
            });
            transaction.update(roomRef, { seats });
        }
    });
};

export const toggleSeatLock = async (roomId: string, seatIndex: number, isLocked: boolean) => {
    const roomRef = doc(db, 'rooms', roomId);
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) return;
        
        const roomData = roomDoc.data() as Room;
        let seats = [...roomData.seats];
        
        if (seats[seatIndex]) {
            seats[seatIndex].isLocked = isLocked;
            seats = seats.map(sanitizeSeat);
            transaction.update(roomRef, { seats });
        }
    });
};

export const toggleSeatMute = async (roomId: string, seatIndex: number, isMuted: boolean) => {
    const roomRef = doc(db, 'rooms', roomId);
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) return;
        
        const roomData = roomDoc.data() as Room;
        let seats = [...roomData.seats];
        
        if (seats[seatIndex]) {
            seats[seatIndex].isMuted = isMuted;
            seats = seats.map(sanitizeSeat);
            transaction.update(roomRef, { seats });
        }
    });
};

export const banUserFromRoom = async (roomId: string, userId: string, durationInMinutes: number) => {
    const expiry = durationInMinutes === -1 ? -1 : Date.now() + (durationInMinutes * 60 * 1000);
    
    await updateDoc(doc(db, 'rooms', roomId), {
        [`bannedUsers.${userId}`]: expiry
    });
};

export const unbanUserFromRoom = async (roomId: string, userId: string) => {
    await updateDoc(doc(db, 'rooms', roomId), {
        [`bannedUsers.${userId}`]: deleteField()
    });
};

export const addRoomAdmin = async (roomId: string, userId: string) => {
    await updateDoc(doc(db, 'rooms', roomId), {
        admins: arrayUnion(userId)
    });
};

export const removeRoomAdmin = async (roomId: string, userId: string) => {
    await updateDoc(doc(db, 'rooms', roomId), {
        admins: arrayRemove(userId)
    });
};

// --- Messaging ---
export const sendMessage = async (roomId: string, message: ChatMessage) => {
    const cleanMessage = deepClean(message);
    await addDoc(collection(db, `rooms/${roomId}/messages`), cleanMessage);
};

export const listenToMessages = (roomId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe => {
    const q = query(collection(db, `rooms/${roomId}/messages`), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach(doc => msgs.push(doc.data() as ChatMessage));
        callback(msgs.reverse());
    });
};

// --- Banners ---
export const addBanner = async (imageUrl: string, title?: string, link?: string) => {
    await addDoc(collection(db, 'banners'), deepClean({ imageUrl, title, link, timestamp: Date.now() }));
};

export const deleteBanner = async (bannerId: string) => {
    await deleteDoc(doc(db, 'banners', bannerId));
};

export const listenToBanners = (callback: (banners: Banner[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, 'banners'), (snap) => {
        const banners: Banner[] = [];
        snap.forEach(d => banners.push({ id: d.id, ...d.data() } as Banner));
        callback(banners);
    });
};

// --- Store & Inventory ---
export const purchaseStoreItem = async (uid: string, item: StoreItem, currentUser: User) => {
    const price = item.price;
    const currency = item.currency === 'diamonds' ? 'wallet.diamonds' : 'wallet.coins';
    const currentBalance = item.currency === 'diamonds' ? (currentUser.wallet?.diamonds || 0) : (currentUser.wallet?.coins || 0);

    if (currentBalance < price) throw new Error("Insufficient funds");

    const duration = 7 * 24 * 60 * 60 * 1000;
    const currentExpiry = currentUser.inventory?.[item.id] || 0;
    const newExpiry = Math.max(currentExpiry, Date.now()) + duration;

    const userRef = doc(db, 'users', uid);
    const batch = writeBatch(db);

    batch.update(userRef, { [currency]: increment(-price) });
    batch.update(userRef, { [`inventory.${item.id}`]: newExpiry });

    if (item.type === 'frame' && !currentUser.equippedFrame) {
        batch.update(userRef, { equippedFrame: item.id });
    }
    if (item.type === 'bubble' && !currentUser.equippedBubble) {
        batch.update(userRef, { equippedBubble: item.id });
    }
    if (item.type === 'entry' && !currentUser.equippedEntry) {
        batch.update(userRef, { equippedEntry: item.id });
    }

    await batch.commit();
};

// --- Wallet & Exchange & Games ---
export const updateWalletForGame = async (uid: string, amount: number) => {
    const userRef = doc(db, 'users', uid);
    
    await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) return;
        
        const userData = userDoc.data() as User;
        let dailyProfit = userData.dailyProfit || 0;
        const lastReset = userData.lastDailyReset || 0;
        const now = Date.now();
        
        if (now - lastReset > 24 * 60 * 60 * 1000) {
            dailyProfit = 0;
            transaction.update(userRef, { lastDailyReset: now });
        }
        
        if (amount > 0) {
            dailyProfit += amount;
        }
        
        transaction.update(userRef, {
            'wallet.diamonds': increment(amount),
            dailyProfit: dailyProfit
        });
    });
};

export const exchangeCoinsToDiamonds = async (uid: string, amount: number) => {
    if (amount <= 0) return;
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        'wallet.diamonds': increment(amount),
        'wallet.coins': increment(-amount) 
    });
};

export const resetCoins = async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { 'wallet.coins': 0 });
};

export const resetAllUsersCoins = async () => {
    const usersSnap = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);
    let count = 0;
    usersSnap.forEach(doc => {
        if (count < 499) {
            batch.update(doc.ref, { 'wallet.coins': 0 });
            count++;
        }
    });
    if (count > 0) {
        await batch.commit();
    }
};

// --- Agency ---
export const transferAgencyDiamonds = async (agencyUid: string, targetDisplayId: string, amount: number) => {
    const targetUser = await searchUserByDisplayId(targetDisplayId);
    if (!targetUser || !targetUser.uid) throw new Error("User not found");

    const batch = writeBatch(db);
    const agencyRef = doc(db, 'users', agencyUid);
    batch.update(agencyRef, { agencyBalance: increment(-amount) });
    const targetRef = doc(db, 'users', targetUser.uid);
    batch.update(targetRef, { 'wallet.diamonds': increment(amount) });
    await batch.commit();
};

// --- Notifications & Friends ---
export const listenToNotifications = (uid: string, type: 'system' | 'official', callback: (msgs: Notification[]) => void): Unsubscribe => {
    if (type === 'official') {
        const q = query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc'));
        return onSnapshot(q, (snap) => {
             const msgs: Notification[] = [];
             snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as Notification));
             callback(msgs);
        });
    } else {
        const q = query(collection(db, `users/${uid}/notifications`), orderBy('timestamp', 'desc'));
        return onSnapshot(q, (snap) => {
             const msgs: Notification[] = [];
             snap.forEach(d => msgs.push(d.data() as Notification));
             callback(msgs);
        });
    }
};

export const listenToUnreadNotifications = (uid: string, callback: (counts: { system: number, official: number, total: number }) => void): Unsubscribe => {
    let systemCount = 0;
    let broadcastCount = 0;
    let currentBroadcastSnap: any = null; 

    const calculateBroadcasts = () => {
        if (!currentBroadcastSnap) return 0;
        const lastRead = parseInt(localStorage.getItem(`last_broadcast_read_${uid}`) || '0');
        return currentBroadcastSnap.docs.filter((doc: any) => doc.data().timestamp > lastRead).length;
    };

    const updateCallback = () => {
        callback({ system: systemCount, official: broadcastCount, total: systemCount + broadcastCount });
    };

    const qSystem = query(collection(db, `users/${uid}/notifications`), where('read', '==', false));
    const unsubSystem = onSnapshot(qSystem, (snap) => {
        systemCount = snap.size;
        updateCallback();
    });

    const qBroadcast = query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc'), limit(10));
    const unsubBroadcast = onSnapshot(qBroadcast, (snap) => {
        currentBroadcastSnap = snap;
        broadcastCount = calculateBroadcasts();
        updateCallback();
    });

    const handleLocalRead = () => {
        broadcastCount = calculateBroadcasts();
        updateCallback();
    };
    window.addEventListener('flex_official_read', handleLocalRead);

    return () => {
        unsubSystem();
        unsubBroadcast();
        window.removeEventListener('flex_official_read', handleLocalRead);
    };
};

export const markOfficialMessagesRead = (uid: string) => {
    localStorage.setItem(`last_broadcast_read_${uid}`, Date.now().toString());
    window.dispatchEvent(new Event('flex_official_read'));
};

export const markSystemNotificationsRead = async (uid: string) => {
    const q = query(collection(db, `users/${uid}/notifications`), where('read', '==', false));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
};

export const sendFriendRequest = async (fromUid: string, toUid: string, name: string, avatar: string) => {
    const req: FriendRequest = {
        uid: fromUid,
        name,
        avatar,
        timestamp: Date.now()
    };
    await setDoc(doc(db, `users/${toUid}/friendRequests`, fromUid), req);
};

export const listenToFriendRequests = (uid: string, callback: (reqs: FriendRequest[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, `users/${uid}/friendRequests`), (snap) => {
        const reqs: FriendRequest[] = [];
        snap.forEach(d => reqs.push(d.data() as FriendRequest));
        callback(reqs);
    });
};

export const acceptFriendRequest = async (uid: string, targetUid: string) => {
    const batch = writeBatch(db);
    batch.setDoc(doc(db, `users/${uid}/friends`, targetUid), { timestamp: Date.now() });
    batch.setDoc(doc(db, `users/${targetUid}/friends`, uid), { timestamp: Date.now() });
    batch.delete(doc(db, `users/${uid}/friendRequests`, targetUid));
    batch.update(doc(db, 'users', uid), { friendsCount: increment(1) });
    batch.update(doc(db, 'users', targetUid), { friendsCount: increment(1) });
    await batch.commit();
};

export const rejectFriendRequest = async (uid: string, targetUid: string) => {
    await deleteDoc(doc(db, `users/${uid}/friendRequests`, targetUid));
};

// --- Private Chats ---
export const initiatePrivateChat = async (myUid: string, otherUid: string, otherUser: User): Promise<PrivateChatSummary | null> => {
    const chatId = [myUid, otherUid].sort().join('_');
    const chatRef = doc(db, `users/${myUid}/chats`, chatId);
    const snap = await getDoc(chatRef);
    if (snap.exists()) return snap.data() as PrivateChatSummary;

    const summary: PrivateChatSummary = {
        chatId,
        otherUserUid: otherUid,
        otherUserName: otherUser.name,
        otherUserAvatar: otherUser.avatar,
        lastMessage: '',
        lastMessageTime: Date.now(),
        unreadCount: 0
    };
    await setDoc(chatRef, summary);
    return summary;
};

export const listenToChatList = (uid: string, callback: (chats: PrivateChatSummary[]) => void): Unsubscribe => {
    const q = query(collection(db, `users/${uid}/chats`), orderBy('lastMessageTime', 'desc'));
    return onSnapshot(q, (snap) => {
        const chats: PrivateChatSummary[] = [];
        snap.forEach(d => chats.push(d.data() as PrivateChatSummary));
        callback(chats);
    });
};

export const listenToPrivateMessages = (chatId: string, callback: (msgs: PrivateMessage[]) => void): Unsubscribe => {
    const q = query(collection(db, `private_messages/${chatId}/messages`), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snap) => {
        const msgs: PrivateMessage[] = [];
        snap.forEach(d => msgs.push(d.data() as PrivateMessage));
        callback(msgs);
    });
};

export const sendPrivateMessage = async (
  sender: { uid: string; name: string; avatar: string; frameId?: string; bubbleId?: string },
  receiver: { uid: string; name: string; avatar: string },
  text: string
) => {
    const chatId = [sender.uid, receiver.uid].sort().join('_');
    const msg: PrivateMessage = {
        id: Date.now().toString(),
        senderId: sender.uid,
        text,
        timestamp: Date.now(),
        read: false,
        frameId: sender.frameId || undefined, 
        bubbleId: sender.bubbleId || undefined 
    };

    const batch = writeBatch(db);
    const msgRef = doc(collection(db, `private_messages/${chatId}/messages`));
    batch.set(msgRef, msg);

    const senderChatRef = doc(db, `users/${sender.uid}/chats`, chatId);
    batch.set(senderChatRef, {
        chatId,
        otherUserUid: receiver.uid,
        otherUserName: receiver.name,
        otherUserAvatar: receiver.avatar,
        lastMessage: text,
        lastMessageTime: Date.now()
    }, { merge: true });

    const receiverChatRef = doc(db, `users/${receiver.uid}/chats`, chatId);
    batch.set(receiverChatRef, {
        chatId,
        otherUserUid: sender.uid,
        otherUserName: sender.name,
        otherUserAvatar: sender.avatar,
        lastMessage: text,
        lastMessageTime: Date.now(),
        unreadCount: increment(1)
    }, { merge: true });

    await batch.commit();
};

export const markChatAsRead = async (myUid: string, otherUid: string) => {
    const chatId = [myUid, otherUid].sort().join('_');
    await updateDoc(doc(db, `users/${myUid}/chats`, chatId), { unreadCount: 0 });
};

// --- Gifts ---
export const sendGiftTransaction = async (roomId: string, senderUid: string, targetSeatIndex: number, cost: number, giftId?: string) => {
    const senderDoc = await getDoc(doc(db, 'users', senderUid));
    if (!senderDoc.exists()) throw new Error("Sender not found");
    const senderData = senderDoc.data() as User;

    const roomRef = doc(db, 'rooms', roomId);
    
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Room not found");
        
        const room = roomDoc.data() as Room;
        const now = Date.now();
        let contributors = room.contributors || {};
        let cupStart = room.cupStartTime || now;

        if (now - cupStart > 86400000) {
            contributors = {}; 
            cupStart = now; 
        }

        const senderKey = senderUid;
        
        if (!contributors[senderKey]) {
            contributors[senderKey] = {
                userId: senderData.id, 
                name: senderData.name,
                avatar: senderData.avatar,
                amount: 0
            };
        }
        contributors[senderKey].amount += cost;
        contributors[senderKey].name = senderData.name;
        contributors[senderKey].avatar = senderData.avatar;

        const wealthContribution = Math.floor(cost * 0.15);

        transaction.update(roomRef, {
            contributors: contributors,
            cupStartTime: cupStart,
            roomWealth: increment(wealthContribution) 
        });

        const senderRef = doc(db, 'users', senderUid);
        transaction.update(senderRef, { 
            'wallet.diamonds': increment(-cost),
            diamondsSpent: increment(cost)
        });

        let newSeats = [...room.seats];
        
        if (targetSeatIndex >= newSeats.length) {
             const diff = targetSeatIndex - newSeats.length + 1;
             for (let i=0; i<diff; i++) {
                 newSeats.push({
                    index: newSeats.length,
                    userId: null,
                    userName: null,
                    userAvatar: null,
                    isMuted: false,
                    isLocked: false,
                    giftCount: 0,
                    frameId: null,
                    vipLevel: 0,
                    adminRole: null
                 });
             }
        }

        newSeats[targetSeatIndex].giftCount += cost;
        newSeats = newSeats.map(sanitizeSeat);
        
        transaction.update(roomRef, { seats: newSeats });
    });

    const roomSnap = await getDoc(roomRef);
    const roomData = roomSnap.data() as Room;
    const recipientUserId = roomData.seats[targetSeatIndex]?.userId;
    
    if (recipientUserId) {
        const q = query(collection(db, 'users'), where('id', '==', recipientUserId), limit(1));
        const userSnap = await getDocs(q);
        if (!userSnap.empty) {
            const recipientDoc = userSnap.docs[0];
            const coinsAmount = Math.floor(cost * 0.30);
            const updates: any = {
                'wallet.coins': increment(coinsAmount),
                diamondsReceived: increment(cost)
            };
            if (giftId) updates[`receivedGifts.${giftId}`] = increment(1);
            await updateDoc(recipientDoc.ref, updates);
        }
    }
};

export const resetAllChats = async () => {
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const chatIds = new Set<string>();

        for (const userDoc of usersSnap.docs) {
            const chatsRef = collection(db, `users/${userDoc.id}/chats`);
            const chatsSnap = await getDocs(chatsRef);
            
            if (!chatsSnap.empty) {
                const batch = writeBatch(db);
                chatsSnap.forEach((doc) => {
                    batch.delete(doc.ref);
                    chatIds.add(doc.id);
                });
                await batch.commit();
            }
        }

        for (const chatId of chatIds) {
            const messagesRef = collection(db, `private_messages/${chatId}/messages`);
            const messagesSnap = await getDocs(messagesRef);
            
            if (!messagesSnap.empty) {
                const batch = writeBatch(db);
                messagesSnap.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
        }
    } catch (e) {
        console.error("Failed to reset chats:", e);
        throw e;
    }
};
