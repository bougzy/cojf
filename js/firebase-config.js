// Firebase Configuration
// IMPORTANT: Replace these values with your actual Firebase project credentials
// Get these from Firebase Console > Project Settings > General > Your apps > Firebase SDK snippet

const firebaseConfig = {
  apiKey: "AIzaSyCdKkb-pWgM9ClT3jvSsxzFzTdxn-3k9-Y",
  authDomain: "cojriv10.firebaseapp.com",
  projectId: "cojriv10",
  storageBucket: "cojriv10.firebasestorage.app",
  messagingSenderId: "2737797909",
  appId: "1:2737797909:web:b0a9dbdc0e4cea917c071c",
  measurementId: "G-V8W3XHXZ01"
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

// Collection references for livestream
const livestreamCollection = db.collection('livestream');
const streamHistoryCollection = db.collection('streamHistory');
const settingsCollection = db.collection('settings');

// Livestream helper functions
const livestreamHelper = {
    // Go live - save current stream to Firebase
    async goLive(streamData) {
        // First, stop any existing stream
        await this.stopStream();

        // Create new live stream document
        const docRef = await livestreamCollection.doc('current').set({
            isLive: true,
            platform: streamData.platform,
            videoId: streamData.videoId,
            streamUrl: streamData.streamUrl,
            embedUrl: streamData.embedUrl || null,
            title: streamData.title,
            preacher: streamData.preacher,
            category: streamData.category,
            quality: streamData.quality,
            description: streamData.description,
            autoSave: streamData.autoSave,
            destinations: streamData.destinations,
            startedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return docRef;
    },

    // Stop stream
    async stopStream() {
        try {
            const currentStream = await this.getCurrentStream();
            if (currentStream && currentStream.isLive) {
                // Save to history before stopping
                await streamHistoryCollection.add({
                    ...currentStream,
                    isLive: false,
                    endedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Update current stream status
            await livestreamCollection.doc('current').update({
                isLive: false,
                endedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.log('No active stream to stop');
        }
    },

    // Get current stream status
    async getCurrentStream() {
        try {
            const doc = await livestreamCollection.doc('current').get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting current stream:', error);
            return null;
        }
    },

    // Save recording as sermon (auto-save feature)
    async saveRecording(recordingData) {
        // Generate embed URL based on platform
        let mediaUrl = recordingData.streamUrl;
        if (recordingData.platform === 'youtube' && recordingData.videoId) {
            mediaUrl = `https://www.youtube.com/embed/${recordingData.videoId}`;
        }

        const sermonData = {
            title: recordingData.title,
            preacher: recordingData.preacher || '',
            category: recordingData.category || 'sunday-service',
            description: recordingData.description || '',
            mediaType: 'video',
            mediaUrl: mediaUrl,
            streamUrl: recordingData.streamUrl,
            platform: recordingData.platform,
            videoId: recordingData.videoId,
            quality: recordingData.quality,
            duration: recordingData.duration || '',
            isStreamRecording: true,
            showOnSermons: recordingData.destinations?.sermons || true,
            showOnHomepage: recordingData.destinations?.homepage || false,
            showOnYaya: recordingData.destinations?.yaya || false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            views: 0,
            downloads: 0
        };

        // Save to sermons collection
        const docRef = await sermonsCollection.add(sermonData);

        // Update stream history to mark as saved
        const historySnapshot = await streamHistoryCollection
            .orderBy('endedAt', 'desc')
            .limit(1)
            .get();

        if (!historySnapshot.empty) {
            await historySnapshot.docs[0].ref.update({
                savedAsSermon: true,
                sermonId: docRef.id
            });
        }

        return docRef.id;
    },

    // Get past streams from history
    async getPastStreams(limit = 10) {
        try {
            const snapshot = await streamHistoryCollection
                .orderBy('endedAt', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting past streams:', error);
            return [];
        }
    },

    // Save stream settings
    async saveSettings(settings) {
        await settingsCollection.doc('livestream').set({
            ...settings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    },

    // Get stream settings
    async getSettings() {
        try {
            const doc = await settingsCollection.doc('livestream').get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting settings:', error);
            return null;
        }
    },

    // Listen to stream status changes (real-time)
    onStreamStatusChange(callback) {
        return livestreamCollection.doc('current').onSnapshot((doc) => {
            if (doc.exists) {
                callback({ id: doc.id, ...doc.data() });
            } else {
                callback(null);
            }
        });
    }
};

// Helper function to get the current live stream for front-end pages (homepage)
async function getCurrentLiveStream() {
    try {
        const stream = await livestreamHelper.getCurrentStream();
        if (stream && stream.isLive) {
            return stream;
        }
        return null;
    } catch (error) {
        console.error('Error checking live stream:', error);
        return null;
    }
}

console.log('Firebase initialized successfully');
