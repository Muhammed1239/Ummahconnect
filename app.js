// app.js
// Main Firebase logic and helpers. Place in same folder as firebaseConfig.js
import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ---------- UTILITIES ---------- */
function uid() { return Date.now().toString(); }
function showToast(msg) {
  const t = document.createElement('div');
  Object.assign(t.style, {
    position: 'fixed', right: '20px', bottom: '20px', zIndex: 9999,
    background: '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: '10px',
    boxShadow: '0 10px 30px rgba(2,6,23,0.3)', opacity: 0, transform: 'translateY(8px)',
    transition: 'all .28s cubic-bezier(.2,.9,.3,1)'
  });
  t.innerText = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(()=> { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(()=> t.remove(),350); }, 3000);
}

/* ---------- AUTH & USER DOCUMENTS ---------- */

async function createUserAccount(userData) {
  // userData: {accountType, email, password, name, orgName, country, sector, briefing, website, logo}
  const cred = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
  const uidLocal = cred.user.uid;
  const userDoc = {
    id: uidLocal,
    accountType: userData.accountType,
    name: userData.accountType === 'local' ? (userData.name || '') : '',
    orgName: userData.accountType === 'organization' ? (userData.orgName || '') : '',
    email: userData.email,
    country: userData.country || '',
    sector: userData.sector || '',
    briefing: userData.briefing || '',
    logo: userData.logo || '',
    website: userData.website || '',
    approved: userData.accountType === 'local' ? true : false,
    isAdmin: false,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'users', uidLocal), userDoc);
  return userDoc;
}

async function signIn(email, password) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  const profileSnap = await getDoc(doc(db, 'users', res.user.uid));
  if (!profileSnap.exists()) {
    // If no profile doc exists, create a minimal one (rare edge-case)
    const fallback = {
      id: res.user.uid,
      accountType: 'local',
      name: res.user.email,
      email: res.user.email,
      approved: true,
      isAdmin: false,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', res.user.uid), fallback);
    return fallback;
  }
  const profile = profileSnap.data();
  if (profile.accountType === 'organization' && profile.approved !== true) {
    await signOut(auth);
    throw new Error('Organization not yet approved by admin.');
  }
  return profile;
}

function logout() { return signOut(auth); }

async function getCurrentProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data() : null;
}

/* ---------- POSTS & FEED ---------- */

async function addPost(content, author, authorType) {
  const post = {
    id: uid(),
    author,
    content,
    timestamp: new Date().toISOString(),
    authorType
  };
  await addDoc(collection(db, 'posts'), post);
  return post;
}

function listenPosts(onUpdate) {
  const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, snapshot => {
    const arr = [];
    snapshot.forEach(d => arr.push(d.data()));
    onUpdate(arr);
  });
}

/* ---------- USERS: get lists ---------- */

async function getLocalUsers(countryFilter = null) {
  const q = query(collection(db, 'users'), where('accountType', '==', 'local'));
  const snap = await getDocs(q);
  let arr = [];
  snap.forEach(d => {
    const data = d.data();
    if (countryFilter && data.country && data.country.toLowerCase() !== countryFilter.toLowerCase()) return;
    arr.push(data);
  });
  return arr;
}

async function getApprovedOrganizations(country = null, sector = null) {
  const q = query(collection(db, 'users'), where('accountType', '==', 'organization'));
  const snap = await getDocs(q);
  let arr = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.approved === true) arr.push(data);
  });
  if (country) arr = arr.filter(u => u.country && u.country.toLowerCase() === country.toLowerCase());
  if (sector) arr = arr.filter(u => u.sector && u.sector.toLowerCase() === sector.toLowerCase());
  return arr;
}

/* ---------- ADMIN ---------- */

async function fetchPendingOrgs() {
  const q = query(collection(db, 'users'), where('accountType', '==', 'organization'));
  const snap = await getDocs(q);
  const arr = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.approved === false) arr.push(data);
  });
  return arr;
}

async function setOrgApproval(userId, value) {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, { approved: value });
}

/* ---------- PROFILE UPDATE ---------- */

async function updateProfile(userId, updates) {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, updates);
}

/* ---------- EXPORT ---------- */

window.UC = {
  auth, db,
  createUserAccount,
  signIn,
  logout,
  getCurrentProfile,
  addPost,
  listenPosts,
  getLocalUsers,
  getApprovedOrganizations,
  fetchPendingOrgs,
  setOrgApproval,
  updateProfile,
  showToast
};
