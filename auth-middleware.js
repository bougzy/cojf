// auth-middleware.js
const API_BASE_URL = 'https://coj-agf0.onrender.com';

class AuthMiddleware {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.userData = JSON.parse(localStorage.getItem('userData') || '{}');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!this.userData.id;
    }

    // Check user type
    isBuyer() {
        return this.userData.userType === 'buyer' || this.userData.userType === 'both';
    }

    isSeller() {
        return this.userData.userType === 'seller' || this.userData.userType === 'both';
    }

    isBoth() {
        return this.userData.userType === 'both';
    }

    isAdmin() {
        return ['super_admin', 'content_admin', 'marketplace_admin'].includes(this.userData.role);
    }

    // Redirect to login if not authenticated
    requireAuth(redirectTo = 'login.html') {
        if (!this.isAuthenticated()) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }

    // Redirect based on user type (for role-based access)
    requireUserType(allowedTypes, redirectTo = 'unauthorized.html') {
        if (!this.requireAuth()) return false;

        const userType = this.userData.userType;
        const role = this.userData.role;

        // Check if user type is allowed
        if (allowedTypes.includes(userType) || allowedTypes.includes(role)) {
            return true;
        }

        // Admin roles have special access
        if (this.isAdmin()) {
            return true;
        }

        // Not authorized
        window.location.href = redirectTo;
        return false;
    }

    // Logout function
    logout(redirectTo = 'login.html') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = redirectTo;
    }

    // Get authorization header for API calls
    getAuthHeader() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Validate token with server
    async validateToken() {
        if (!this.token) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    // Update user data
    updateUserData(newData) {
        this.userData = { ...this.userData, ...newData };
        localStorage.setItem('userData', JSON.stringify(this.userData));
    }
}

// Create global instance
const auth = new AuthMiddleware();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
} else {
    window.auth = auth;
}