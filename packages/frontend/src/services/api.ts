import axios from "axios";
import { firebaseAuth } from "@/config/firebase";

const api = axios.create({
  baseURL: import.meta.env.DEV ? "http://localhost:5001" : "",
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach Firebase ID token to requests
api.interceptors.request.use(async (config) => {
  const user = firebaseAuth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — sign out
      firebaseAuth.signOut();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
