// Firebase Configuration
// IMPORTANT: Replace these values with your actual Firebase project credentials
// Get these from Firebase Console > Project Settings > General > Your apps > Firebase SDK snippet

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

// Collection references
const sermonsCollection = db.collection('sermons');
const mediaCollection = db.collection('media');

// Helper functions for media uploads
const uploadMedia = {
    // Upload file to Firebase Storage
    async uploadFile(file, folder, onProgress) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = storage.ref(`${folder}/${fileName}`);

        const uploadTask = storageRef.put(file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) onProgress(progress);
                },
                (error) => reject(error),
                async () => {
                    const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve({
                        url: downloadURL,
                        fileName: fileName,
                        path: `${folder}/${fileName}`
                    });
                }
            );
        });
    },

    // Save sermon/media metadata to Firestore
    async saveSermon(data) {
        const docRef = await sermonsCollection.add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            views: 0,
            downloads: 0
        });
        return docRef.id;
    },

    // Save general media (images, etc.)
    async saveMedia(data) {
        const docRef = await mediaCollection.add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef.id;
    },

    // Get all sermons
    async getSermons(limit = 50) {
        const snapshot = await sermonsCollection
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    // Get sermon by ID
    async getSermonById(id) {
        const doc = await sermonsCollection.doc(id).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    },

    // Delete sermon
    async deleteSermon(id, filePath) {
        // Delete from Storage if file exists
        if (filePath) {
            try {
                await storage.ref(filePath).delete();
            } catch (e) {
                console.log('File may not exist in storage:', e);
            }
        }
        // Delete from Firestore
        await sermonsCollection.doc(id).delete();
    },

    // Update sermon views
    async incrementViews(id) {
        await sermonsCollection.doc(id).update({
            views: firebase.firestore.FieldValue.increment(1)
        });
    },

    // Update sermon downloads
    async incrementDownloads(id) {
        await sermonsCollection.doc(id).update({
            downloads: firebase.firestore.FieldValue.increment(1)
        });
    }
};

// Authentication helper
const authHelper = {
    // Sign in with email/password
    async signIn(email, password) {
        return await auth.signInWithEmailAndPassword(email, password);
    },

    // Sign out
    async signOut() {
        return await auth.signOut();
    },

    // Check if user is admin (you can customize this logic)
    isAdmin(user) {
        // Add your admin email(s) here
        const adminEmails = ['admin@rccgcoj.org', 'pastor@rccgcoj.org'];
        return user && adminEmails.includes(user.email);
    },

    // Listen to auth state changes
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged(callback);
    }
};

console.log('Firebase initialized successfully');
